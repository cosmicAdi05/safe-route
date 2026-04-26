"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { AlertTriangle, X, Shield, Activity } from "lucide-react";

import {
  routeApi, incidentApi, safetyApi, zoneApi, getStoredUser,
  type RouteSet, type RouteResult, type Incident, type SafetyZone, type HeatPoint, type User,
} from "@/lib/api";
import { predictRisk, type RiskPrediction } from "@/lib/offlineML";

import BottomDrawer from "./BottomDrawer";
import SOSButton from "./SOSButton";
import FloatingSearch from "./FloatingSearch";
import AuthModal from "./AuthModal";
import CyberPanel from "./CyberPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import SafeHavenPanel from "./SafeHavenPanel";

// ── Leaflet icons ────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const ROUTE_COLORS = { safest: "#22c55e", fastest: "#6366f1", balanced: "#f59e0b" };
const INCIDENT_COLORS: Record<string, string> = {
  theft: "#ef4444", assault: "#dc2626", harassment: "#f97316",
  accident: "#eab308", poor_lighting: "#6366f1", suspicious_activity: "#8b5cf6",
  eve_teasing: "#ec4899", road_hazard: "#f59e0b", crowd_surge: "#06b6d4", other: "#94a3b8",
};

// Safe Haven markers
const SAFE_HAVENS = [
  { id: 1, name: "Connaught Place Police Station", type: "police", lat: 28.6315, lng: 77.2167 },
  { id: 2, name: "AIIMS Hospital", type: "hospital", lat: 28.5672, lng: 77.2100 },
  { id: 3, name: "Safdarjung Hospital", type: "hospital", lat: 28.5686, lng: 77.2064 },
  { id: 5, name: "Metro Station — Rajiv Chowk", type: "metro", lat: 28.6328, lng: 77.2197 },
  { id: 6, name: "Women Help Center", type: "shelter", lat: 28.5675, lng: 77.2430 },
];

const HAVEN_COLORS: Record<string, string> = {
  police: "#6366f1", hospital: "#ef4444", metro: "#22c55e", shelter: "#f59e0b"
};

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

const makeIcon = (color: string, size = 12, pulse = false) => L.divIcon({
  html: `<div style="
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};border:2px solid rgba(255,255,255,0.7);
    box-shadow:0 0 ${size}px ${color}99;
    ${pulse ? `animation:pulse 2s infinite` : ""}
  "></div>`,
  className: "", iconAnchor: [size / 2, size / 2],
});

const makeHavenIcon = (color: string) => L.divIcon({
  html: `<div style="
    width:20px;height:20px;border-radius:6px;
    background:${color}22;border:2px solid ${color};
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 12px ${color}55;
  "><div style="width:8px;height:8px;border-radius:50%;background:${color};"></div></div>`,
  className: "", iconAnchor: [10, 10],
});

export default function MapApp() {
  const [origin, setOrigin] = useState<{lat:number;lng:number;label?:string}|null>(null);
  const [dest,   setDest]   = useState<{lat:number;lng:number;label?:string}|null>(null);
  const [pickingMode, setPickingMode] = useState<"origin"|"dest"|null>(null);

  const [routes, setRoutes]             = useState<RouteSet|null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"safest"|"fastest"|"balanced">("safest");
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [zones, setZones] = useState<SafetyZone[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [liveLocation, setLiveLocation] = useState<{lat:number;lng:number}|null>(null);
  const [trackingLive, setTrackingLive] = useState(false);
  const [showHavens, setShowHavens] = useState(true);
  const watchIdRef = useRef<number|null>(null);

  // ── Live Location Tracking ─────────────────────────────────────────────
  const startLiveTracking = useCallback(() => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    toast.success("Live location tracking started");
    setTrackingLive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveLocation(loc);
        setOrigin({ ...loc, label: "My Location (Live)" });
      },
      () => toast.error("Location access denied"),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, []);

  const stopLiveTracking = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    setTrackingLive(false);
    setLiveLocation(null);
    toast("Live tracking stopped");
  }, []);


  // Offline ML
  const [offlineScore, setOfflineScore] = useState<RiskPrediction | null>(null);

  // Modals
  const [showCyber, setShowCyber]         = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSafeHavens, setShowSafeHavens] = useState(false);
  const [showAuth, setShowAuth]           = useState(false);
  const [user, setUser] = useState<User|null>(null);
  const socketRef = useRef<Socket|null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = getStoredUser();
    if (saved) setUser(saved);

    const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000", { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("safety-update", (data) => {
      setLiveAlerts(prev => [{ ...data, id: Date.now() }, ...prev.slice(0, 4)]);
    });

    fetchNearbyData(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    return () => { socket.disconnect(); };
  }, []);

  const fetchNearbyData = useCallback(async (lat: number, lng: number) => {
    try {
      const [inc, heat, z] = await Promise.allSettled([
        incidentApi.nearby(lat, lng),
        incidentApi.heatmap(24),
        zoneApi.nearby(lat, lng),
      ]);
      if (inc.status === "fulfilled") setIncidents(inc.value.incidents);
      if (heat.status === "fulfilled") setHeatPoints(heat.value.points);
      if (z.status === "fulfilled") setZones(z.value.zones);
    } catch {}
  }, []);

  // ── Offline ML Score whenever dest changes ────────────────────────────────
  useEffect(() => {
    if (!dest) { setOfflineScore(null); return; }
    const hour = new Date().getHours();
    predictRisk({
      hour,
      isWeekend: [0, 6].includes(new Date().getDay()),
      lighting: hour >= 20 || hour <= 5 ? 0.2 : 0.8,
      roadType: "secondary",
      crowdDensity: 0.4,
      crimeScore: 0.3,
      severityAvg: 0.25,
    }).then(setOfflineScore).catch(() => {});
  }, [dest]);

  // ── Map Click ────────────────────────────────────────────────────────────
  const handleMapClick = (lat: number, lng: number) => {
    if (pickingMode === "origin") {
      setOrigin({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setPickingMode(null);
      toast.success("Start point set");
    } else if (pickingMode === "dest") {
      setDest({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setPickingMode(null);
      toast.success("Destination set");
    }
  };

  // ── Compute Routes ───────────────────────────────────────────────────────
  const computeRoutes = async () => {
    if (!origin || !dest) return toast.error("Set start and end on the map");
    setLoadingRoutes(true);
    try {
      const res = await routeApi.orchestrate({
        originLat: origin.lat, originLng: origin.lng,
        destLat: dest.lat,     destLng: dest.lng,
        time: new Date().getHours(), lambda: 5,
      });
      const transform = (r: any, type: any): RouteResult => ({
        ...r, routeType: type,
        waypoints: r.waypoints || [],
        totalDistanceKm: r.distance_km || r.totalDistanceKm || 0,
        overallSafetyScore: r.safety_score || r.overallSafetyScore || 60,
        estimatedMinutes: r.estimatedMinutes || 12,
      });
      setRoutes({
        fastest: transform(res.routes.fastest, "fastest"),
        safest:  transform(res.routes.safest,  "safest"),
        balanced:transform(res.routes.balanced,"balanced"),
        meta: { usingFallback: false },
      } as any);
      setSelectedRoute(res.winner);
      toast.success(`AI recommends ${res.winner} route`);
      fetchNearbyData(origin.lat, origin.lng);
    } catch (err: any) {
      toast.error(err.message || "Route failed");
    } finally {
      setLoadingRoutes(false);
    }
  };

  // ── Safe Haven Navigate ──────────────────────────────────────────────────
  const handleHavenNav = (lat: number, lng: number, name: string) => {
    setDest({ lat, lng, label: name });
    setShowSafeHavens(false);
    toast.success(`Destination: ${name}`);
  };

  const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-strong w-full sm:max-w-lg max-h-[85vh] overflow-y-auto scrollbar-none relative animate-slide-up"
        style={{ borderRadius: "32px 32px 0 0", paddingBottom: 32 }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all z-10">
          <X size={18} />
        </button>
        <div className="p-6 pt-8">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="w-screen h-screen relative overflow-hidden mesh-bg">

      {/* ── Map Canvas ── */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={DEFAULT_CENTER} zoom={5} zoomControl={false} style={{ width: "100%", height: "100%" }}>
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>'
            maxZoom={20}
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <ZoomControl position="bottomright" />

          {/* Danger Zones */}
          {zones.filter(z => z.type === "danger").map(z => (
            <Circle key={z._id}
              center={[z.location.coordinates[1], z.location.coordinates[0]]}
              radius={z.radius}
              pathOptions={{ fillColor: "#ef4444", fillOpacity: 0.07, color: "#ef4444", weight: 1.5, opacity: 0.5 }}
            />
          ))}

          {/* Caution Zones */}
          {zones.filter(z => z.type === "caution").map(z => (
            <Circle key={z._id}
              center={[z.location.coordinates[1], z.location.coordinates[0]]}
              radius={z.radius}
              pathOptions={{ fillColor: "#f59e0b", fillOpacity: 0.05, color: "#f59e0b", weight: 1, opacity: 0.3 }}
            />
          ))}

          {/* Incident Heat circles */}
          {heatPoints.slice(0, 80).map((pt, i) => (
            <Circle key={i}
              center={[pt.lat, pt.lng]}
              radius={60 + pt.weight * 18}
              pathOptions={{ fillColor: INCIDENT_COLORS[pt.type] || "#ef4444", fillOpacity: 0.10, stroke: false }}
            />
          ))}

          {/* Safe Haven Markers */}
          {showHavens && SAFE_HAVENS.map(h => (
            <Marker key={h.id} position={[h.lat, h.lng]} icon={makeHavenIcon(HAVEN_COLORS[h.type])}>
              <Popup>
                <div style={{ minWidth: 160, color: "#f1f5f9" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: HAVEN_COLORS[h.type], fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>{h.type}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Incident Markers (pulsing) */}
          {incidents.map(inc => (
            <Marker key={inc._id}
              position={[inc.location.coordinates[1], inc.location.coordinates[0]]}
              icon={makeIcon(INCIDENT_COLORS[inc.type] || "#ef4444", 12, true)}
            >
              <Popup>
                <div style={{ color: "#f1f5f9", minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, textTransform: "capitalize", marginBottom: 4 }}>
                    {inc.isSuspicious ? "🚩 " : ""}{inc.type.replace(/_/g," ")}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Severity {inc.severity}/5</div>
                  {inc.description && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{inc.description}</div>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Routes */}
          {routes && (["safest","fastest","balanced"] as const)
            .filter(t => t !== selectedRoute).map(t => (
            <Polyline key={t}
              positions={(routes[t] as RouteResult).waypoints.map(p => [p.lat, p.lng])}
              pathOptions={{ color: ROUTE_COLORS[t], weight: 3, opacity: 0.2, dashArray: "10,10" }}
            />
          ))}
          {routes && (
            <Polyline
              positions={(routes[selectedRoute] as RouteResult).waypoints.map(p => [p.lat, p.lng])}
              pathOptions={{ color: ROUTE_COLORS[selectedRoute], weight: 6, opacity: 0.9 }}
            />
          )}

          {/* Live Location Marker */}
          {liveLocation && (
            <Marker
              position={[liveLocation.lat, liveLocation.lng]}
              icon={L.divIcon({
                html: `<div style="
                  width:20px;height:20px;border-radius:50%;
                  background:rgba(59,130,246,0.9);
                  border:3px solid #fff;
                  box-shadow:0 0 0 6px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.5);
                  animation:pulse 2s infinite
                "></div>`,
                className: "", iconAnchor: [10, 10]
              })}
            >
              <Popup>
                <div style={{ color: "#f1f5f9" }}>
                  <b>You are here</b>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>Live GPS · Updates every 5s</div>
                </div>
              </Popup>
            </Marker>
          )}
          {origin && <Marker position={[origin.lat, origin.lng]} icon={makeIcon("#6366f1", 16)}>
            <Popup><div style={{ color: "#f1f5f9" }}><b>Start</b><br/><span style={{fontSize:11, color:"#94a3b8"}}>{origin.label}</span></div></Popup>
          </Marker>}
          {dest && <Marker position={[dest.lat, dest.lng]} icon={makeIcon("#22c55e", 16)}>
            <Popup><div style={{ color: "#f1f5f9" }}><b>Destination</b><br/><span style={{fontSize:11, color:"#94a3b8"}}>{dest.label}</span></div></Popup>
          </Marker>}
        </MapContainer>
      </div>

      {/* ── Floating Search ── */}
      <FloatingSearch
        origin={origin} dest={dest}
        onSetOrigin={(loc) => loc.lat ? setOrigin(loc) : setOrigin(null)}
        onSetDest={(loc) => loc.lat ? setDest(loc) : setDest(null)}
        onCompute={computeRoutes}
        onOpenCyber={() => setShowCyber(true)}
        onOpenAnalytics={() => setShowAnalytics(true)}
        onUseMyLocation={startLiveTracking}
        user={user}
      />

      {/* ── Live Tracking Control ── */}
      {trackingLive && (
        <div className="fixed top-40 left-1/2 -translate-x-1/2 z-[800] glass px-5 py-2.5 rounded-2xl flex items-center gap-3 border border-blue-500/30 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs font-bold text-blue-300">Live Tracking Active</span>
          <button onClick={stopLiveTracking} className="text-[10px] text-slate-400 hover:text-white ml-2">Stop</button>
        </div>
      )}
      <div className="fixed top-6 right-5 z-[800] flex flex-col gap-2">
        <button
          onClick={() => setShowSafeHavens(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl glass text-xs font-bold text-safe border border-safe/20 hover:bg-safe/10 transition-all"
        >
          <Shield size={14} /> Safe Havens
        </button>
        <button
          onClick={() => setShowHavens(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl glass text-xs font-bold text-slate-400 hover:bg-white/5 transition-all"
        >
          <Activity size={14} /> {showHavens ? "Hide" : "Show"} Map
        </button>
      </div>

      {/* ── Picking Mode Banner ── */}
      {pickingMode && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[800] glass px-6 py-3 rounded-2xl flex items-center gap-3 border border-primary/30 animate-float pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-bold">Tap map to set {pickingMode === "origin" ? "start" : "destination"}</span>
        </div>
      )}

      {/* ── Live Alert Strips ── */}
      {liveAlerts.length > 0 && (
        <div className="fixed top-36 right-5 z-[800] flex flex-col gap-2 max-w-[260px]">
          {liveAlerts.slice(0, 2).map(a => (
            <div key={a.id} className="glass p-3 rounded-2xl flex gap-3 border-l-2 border-l-danger animate-slide-up">
              <AlertTriangle size={15} className="text-danger flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-black text-slate-200">Live Incident</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{a.incidentType?.replace(/_/g, " ")} nearby</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom Drawer ── */}
      <BottomDrawer
        routes={routes}
        selectedRoute={selectedRoute}
        onSelect={setSelectedRoute}
        loading={loadingRoutes}
        offlineScore={offlineScore}
      />

      {/* ── SOS Hub ── */}
      <SOSButton />

      {/* ── Modals ── */}
      {showCyber && <Modal onClose={() => setShowCyber(false)}><CyberPanel /></Modal>}
      {showAnalytics && <Modal onClose={() => setShowAnalytics(false)}><AnalyticsPanel /></Modal>}
      {showSafeHavens && <Modal onClose={() => setShowSafeHavens(false)}><SafeHavenPanel onNavigateTo={handleHavenNav} /></Modal>}
      {showAuth && <AuthModal onAuth={(t, u) => { setUser(u); setShowAuth(false); }} onClose={() => setShowAuth(false)} />}
    </div>
  );
}
