"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import {
  Shield, Navigation, AlertTriangle, MapPin, Zap, Clock,
  Activity, BarChart2, User, ChevronRight, Radio, Eye,
  TrendingUp, Search, Plus, X, Info, Wind
} from "lucide-react";

import {
  routeApi, incidentApi, safetyApi, zoneApi, mlApi, getStoredUser,
  type RouteSet, type RouteResult, type Incident, type SafetyZone, type HeatPoint, type User,
} from "@/lib/api";

import Sidebar from "./Sidebar";
import RoutePanel from "./RoutePanel";
import IncidentPanel from "./IncidentPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import AuthModal from "./AuthModal";
import WomenSafetyPanel from "./WomenSafetyPanel";
import DemoRoutePanel from "./DemoRoutePanel";

// ── Fix Leaflet default icon ─────────────────────────────────
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

const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090]; // New Delhi

// ── Map Click Handler ────────────────────────────────────────
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ── Custom Icons ─────────────────────────────────────────────
const makeIcon = (color: string, size = 14) =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 8px ${color}66"></div>`,
    className: "", iconAnchor: [size / 2, size / 2],
  });

const originIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#6366f1;border:3px solid #fff;box-shadow:0 0 12px #6366f1aa;"></div>`,
  className: "", iconAnchor: [9, 9],
});
const destIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 12px #22c55eaa;"></div>`,
  className: "", iconAnchor: [9, 9],
});

export default function MapApp() {
  // ── State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"route"|"incidents"|"analytics"|"safety"|"demo">("route");
  const [womenMode, setWomenMode]   = useState(false);
  const [origin, setOrigin]       = useState<{lat:number;lng:number;label?:string}|null>(null);
  const [dest, setDest]           = useState<{lat:number;lng:number;label?:string}|null>(null);
  const [pickingMode, setPickingMode] = useState<"origin"|"dest"|"incident"|null>(null);

  // Global time-of-day (shared with DemoRoutePanel)
  const [timeOfDay, setTimeOfDay] = useState(new Date().getHours());

  const [routes, setRoutes]           = useState<RouteSet|null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"safest"|"fastest"|"balanced">("safest");
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const [incidents, setIncidents]     = useState<Incident[]>([]);
  const [heatPoints, setHeatPoints]   = useState<HeatPoint[]>([]);
  const [zones, setZones]             = useState<SafetyZone[]>([]);
  const [liveAlerts, setLiveAlerts]   = useState<any[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showZones, setShowZones]     = useState(true);

  const [mapCenter, setMapCenter]     = useState<[number,number]>(DEFAULT_CENTER);
  const [clickedPoint, setClickedPoint] = useState<{lat:number;lng:number}|null>(null);
  const [pointSafety, setPointSafety] = useState<any>(null);

  const [showAuth, setShowAuth]       = useState(false);
  const [user, setUser]               = useState<User|null>(null);
  const socketRef                     = useRef<Socket|null>(null);

  // ── Socket.io Real-time Connection ───────────────────────
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000", {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => toast.success("🔴 Live safety feed connected", { duration: 2000 }));
    socket.on("safety-update", (data) => {
      setLiveAlerts((prev) => [{ ...data, id: Date.now() }, ...prev.slice(0, 9)]);
      if (data.riskLevel === "HIGH" || data.riskLevel === "CRITICAL") {
        toast.error(`⚠️ ${data.incidentType?.replace("_"," ")} reported nearby (${data.riskLevel})`, { duration: 5000 });
      }
      // Refresh incidents
      fetchNearbyIncidents(data.lat, data.lng);
    });

    return () => { socket.disconnect(); };
  }, []);

  // ── Load user from localStorage on mount ─────────────────
  useEffect(() => {
    const saved = getStoredUser();
    if (saved) setUser(saved);
    // Load initial map data
    fetchNearbyIncidents(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    fetchHeatmap();
    fetchZones(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
  }, []);

  // ── Data Fetchers ──────────────────────────────────────────
  const fetchNearbyIncidents = useCallback(async (lat: number, lng: number) => {
    try {
      const { incidents } = await incidentApi.nearby(lat, lng, 3000);
      setIncidents(incidents);
    } catch {}
  }, []);

  const fetchHeatmap = useCallback(async () => {
    try {
      const { points } = await incidentApi.heatmap(24);
      setHeatPoints(points);
    } catch {}
  }, []);

  const fetchZones = useCallback(async (lat: number, lng: number) => {
    try {
      const { zones } = await zoneApi.nearby(lat, lng, 3000);
      setZones(zones);
    } catch {}
  }, []);

  // ── Map Click ──────────────────────────────────────────────
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (pickingMode === "origin") {
      setOrigin({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      setPickingMode(null);
      toast.success("📍 Origin set");
    } else if (pickingMode === "dest") {
      setDest({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      setPickingMode(null);
      toast.success("🎯 Destination set");
    } else if (pickingMode === "incident") {
      setClickedPoint({ lat, lng });
      setPickingMode(null);
    } else {
      // Show safety score for clicked point
      setClickedPoint({ lat, lng });
      setPointSafety(null);
      try {
        const result = await safetyApi.score(lat, lng);
        setPointSafety(result);
      } catch {}
    }
  }, [pickingMode]);

  // ── Route Computation via Orchestrator ───────────────────
  const computeRoutes = useCallback(async () => {
    if (!origin || !dest) return toast.error("Set origin and destination first");
    setLoadingRoutes(true);
    try {
      // Use full orchestration endpoint — aggregates ML + time + trust + incidents
      const result = await routeApi.orchestrate({
        originLat: origin.lat, originLng: origin.lng,
        destLat:   dest.lat,   destLng:   dest.lng,
        time:      timeOfDay,
        lambda:    5,
      });

      // Normalise orchestrator route shape → RouteSet shape for map
      const normalize = (r: any, type: "safest"|"fastest"|"balanced"): RouteResult => ({
        routeType:          type,
        waypoints:          r.waypoints ?? [],
        segments:           r.segments  ?? [],
        totalDistanceKm:    r.distance_km    ?? r.totalDistanceKm    ?? 0,
        estimatedMinutes:   r.estimatedMinutes ?? Math.round((r.distance_km ?? 1) / 30 * 60),
        overallSafetyScore: r.safety_score    ?? r.overallSafetyScore ?? 60,
        // pass-through extended fields
        ...r,
      });

      const routeSet: RouteSet = {
        fastest:  normalize(result.routes.fastest,  "fastest"),
        safest:   normalize(result.routes.safest,   "safest"),
        balanced: normalize(result.routes.balanced, "balanced"),
        meta: { usingFallback: result.meta.usingFallback, source: result.meta.source },
      };
      setRoutes(routeSet);
      setSelectedRoute(result.winner);
      toast.success(`✅ AI recommends ${result.winner.toUpperCase()} route · Trust: ${result.meta.trustLabel}`);
      fetchNearbyIncidents(origin.lat, origin.lng);
      fetchZones(origin.lat, origin.lng);
    } catch (err: any) {
      // Fallback to legacy compute if orchestrator errors
      try {
        const fb = await routeApi.compute({ originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng });
        setRoutes(fb.routes);
        toast.success("✅ Routes computed (fallback mode)");
      } catch {
        toast.error(err.message || "Route computation failed");
      }
    } finally {
      setLoadingRoutes(false);
    }
  }, [origin, dest, timeOfDay, fetchNearbyIncidents, fetchZones]);

  // ── Auth handlers ──────────────────────────────────────────
  const handleAuth = (token: string, userData: any) => {
    localStorage.setItem("sr_token", token);
    localStorage.setItem("sr_user", JSON.stringify(userData));
    setUser(userData as User);
    setShowAuth(false);
    toast.success(`Welcome, ${userData.name}! ✅ Trust Score: ${userData.trustScore ?? 80}/100`);
  };

  const handleLogout = () => {
    localStorage.removeItem("sr_token");
    localStorage.removeItem("sr_user");
    setUser(null);
    toast("Signed out — now in Guest / Low Trust mode");
  };

  // ── Get active route polyline ──────────────────────────────
  const activeRoute: RouteResult | null = routes
    ? (routes[selectedRoute] as RouteResult)
    : null;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        liveAlerts={liveAlerts}
        onShowAuth={() => setShowAuth(true)}
        onLogout={handleLogout}
      >
        {activeTab === "route" && (
          <RoutePanel
            origin={origin}
            dest={dest}
            setOrigin={setOrigin}
            setDest={setDest}
            pickingMode={pickingMode}
            setPickingMode={setPickingMode}
            routes={routes}
            selectedRoute={selectedRoute}
            setSelectedRoute={setSelectedRoute}
            loadingRoutes={loadingRoutes}
            onCompute={computeRoutes}
          />
        )}
        {activeTab === "incidents" && (
          <IncidentPanel
            incidents={incidents}
            pickingMode={pickingMode}
            setPickingMode={setPickingMode}
            clickedPoint={clickedPoint}
            setClickedPoint={setClickedPoint}
            onRefresh={() => fetchNearbyIncidents(mapCenter[0], mapCenter[1])}
          />
        )}
        {activeTab === "analytics" && (
          <AnalyticsPanel />
        )}
        {activeTab === "safety" && (
          <WomenSafetyPanel
            lat={mapCenter[0]}
            lng={mapCenter[1]}
            enabled={womenMode}
            onToggle={setWomenMode}
          />
        )}
        {activeTab === "demo" && (
          <DemoRoutePanel
            origin={origin}
            dest={dest}
            onRoutesComputed={(fastest, safest) => {
              // Map orchestrator route format → MapApp RouteSet format
              const toMapRoute = (r: any, type: string) => ({
                ...r,
                routeType: type as any,
                totalDistanceKm:    r.distance_km    ?? r.totalDistanceKm    ?? 5,
                estimatedMinutes:   r.estimatedMinutes ?? Math.round((r.distance_km ?? 5) / 30 * 60),
                overallSafetyScore: r.safety_score   ?? r.overallSafetyScore ?? 60,
                segments: [],
              });
              setRoutes({
                fastest:  toMapRoute(fastest, "fastest"),
                safest:   toMapRoute(safest,  "safest"),
                balanced: toMapRoute(safest,  "balanced"),
                meta: { usingFallback: false },
              } as any);
            }}
          />
        )}
      </Sidebar>

      {/* ── Map ── */}
      <div className="map-wrapper">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <ZoomControl position="bottomright" />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Origin / Destination */}
          {origin && <Marker position={[origin.lat, origin.lng]} icon={originIcon}><Popup><b>Origin</b><br/>{origin.label}</Popup></Marker>}
          {dest   && <Marker position={[dest.lat, dest.lng]}   icon={destIcon}><Popup><b>Destination</b><br/>{dest.label}</Popup></Marker>}

          {/* Active Route Polyline */}
          {activeRoute && (
            <Polyline
              positions={activeRoute.waypoints.map((p) => [p.lat, p.lng])}
              color={ROUTE_COLORS[selectedRoute]}
              weight={5}
              opacity={0.9}
            />
          )}

          {/* All Routes (dimmed) */}
          {routes && (["safest","fastest","balanced"] as const).filter((t) => t !== selectedRoute).map((t) => (
            <Polyline
              key={t}
              positions={(routes[t] as RouteResult).waypoints.map((p) => [p.lat, p.lng])}
              color={ROUTE_COLORS[t]}
              weight={2}
              opacity={0.3}
              dashArray="6 4"
            />
          ))}

          {/* Safety Zones */}
          {showZones && zones.map((zone) => (
            <Circle
              key={zone._id}
              center={[zone.location.coordinates[1], zone.location.coordinates[0]]}
              radius={zone.radius}
              color={zone.type === "danger" ? "#ef4444" : zone.type === "caution" ? "#f59e0b" : "#22c55e"}
              fillOpacity={0.12}
              weight={1.5}
            >
              <Popup>
                <div style={{ color: "#fff", minWidth: 160 }}>
                  <b style={{ fontSize: 13 }}>{zone.name}</b>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Safety Score: <b style={{ color: zone.safetyScore > 60 ? "#22c55e" : "#ef4444" }}>{zone.safetyScore}/100</b></div>
                </div>
              </Popup>
            </Circle>
          ))}

          {/* Incident Heatmap (circles) */}
          {showHeatmap && heatPoints.slice(0, 200).map((pt, i) => (
            <Circle
              key={i}
              center={[pt.lat, pt.lng]}
              radius={80 + pt.weight * 30}
              color={INCIDENT_COLORS[pt.type] || "#ef4444"}
              fillOpacity={0.25}
              weight={0}
            />
          ))}

          {/* Incident Markers */}
          {incidents.map((inc) => {
            const incColor = inc.isSuspicious ? "#dc2626" : (INCIDENT_COLORS[inc.type] || "#ef4444");
            return (
              <Marker
                key={inc._id}
                position={[inc.location.coordinates[1], inc.location.coordinates[0]]}
                icon={makeIcon(incColor, inc.isSuspicious ? 10 : 12)}
              >
                <Popup>
                  <div style={{ color: "#fff", minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", marginBottom: 4 }}>
                      {inc.isSuspicious ? "🚩 " : ""}{inc.type.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                      Severity: {"⚡".repeat(inc.severity)} ({inc.severity}/5)
                    </div>
                    {inc.trustStatus && (
                      <div style={{ fontSize: 10, color: inc.isSuspicious ? "#fca5a5" : "#86efac", marginBottom: 4 }}>
                        {inc.isSuspicious ? "🚩 Flagged — impact reduced" : `✅ ${inc.trustStatus}`}
                      </div>
                    )}
                    {inc.description && <div style={{ fontSize: 11, marginTop: 4, color: "#94a3b8" }}>{inc.description}</div>}
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
                      {new Date(inc.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Clicked Point Safety Score */}
          {clickedPoint && (
            <Marker
              position={[clickedPoint.lat, clickedPoint.lng]}
              icon={makeIcon(pointSafety ? pointSafety.riskColor : "#94a3b8", 16)}
            >
              <Popup>
                {pointSafety ? (
                  <div style={{ color: "#fff", minWidth: 200 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Safety Score</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: pointSafety.riskColor }}>
                      {pointSafety.score}<span style={{ fontSize: 14, fontWeight: 400 }}>/100</span>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, color: pointSafety.riskColor, fontWeight: 600 }}>
                      {pointSafety.riskLevel} RISK
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                      {Object.entries(pointSafety.factors).map(([k, v]) => (
                        <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom: 2 }}>
                          <span style={{ textTransform:"capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                          <span style={{ color: "#fff" }}>{Math.round(v as number)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Loading safety score…</div>
                )}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* ── Map Controls Overlay ── */}
        <MapControls
          showHeatmap={showHeatmap}
          setShowHeatmap={setShowHeatmap}
          showZones={showZones}
          setShowZones={setShowZones}
          pickingMode={pickingMode}
          setPickingMode={setPickingMode}
        />

        {/* ── Live Alert Ticker ── */}
        {liveAlerts.length > 0 && (
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "rgba(7,11,20,0.96)", border: `1px solid ${liveAlerts[0].isSuspicious ? "rgba(220,38,38,0.6)" : "rgba(239,68,68,0.4)"}`,
            borderRadius: 12, padding: "8px 18px", display: "flex", alignItems: "center",
            gap: 10, fontSize: 13, color: "#fca5a5", backdropFilter: "blur(14px)",
            animation: "fadeIn 0.3s ease", zIndex: 500, maxWidth: 480,
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            <Radio size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span>
                {liveAlerts[0].isSuspicious ? "🚩 Suspicious: " : "⚠️ "}
                <b>{liveAlerts[0].incidentType?.replace(/_/g," ")}</b>
                {" "}{liveAlerts[0].riskLevel} risk · Safety: {liveAlerts[0].safetyScore}/100
              </span>
              {liveAlerts[0].trustStatus && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  Reporter: {liveAlerts[0].trustStatus}
                </div>
              )}
            </div>
            {liveAlerts.length > 1 && (
              <span style={{ fontSize: 10, background: "rgba(239,68,68,0.2)", color: "#fca5a5", padding: "2px 7px", borderRadius: 99, fontWeight: 700, flexShrink: 0 }}>
                +{liveAlerts.length - 1}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Auth Modal ── */}
      {showAuth && <AuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} />}
    </div>
  );
}

// ── Map Controls Float ──────────────────────────────────────
function MapControls({ showHeatmap, setShowHeatmap, showZones, setShowZones, pickingMode, setPickingMode }: any) {
  return (
    <div style={{
      position: "absolute", top: 16, right: 16, zIndex: 500,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12, gap: 6 }}
        onClick={() => setShowHeatmap((h: boolean) => !h)}>
        <Activity size={14} /> {showHeatmap ? "Hide" : "Show"} Heatmap
      </button>
      <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12, gap: 6 }}
        onClick={() => setShowZones((z: boolean) => !z)}>
        <Eye size={14} /> {showZones ? "Hide" : "Show"} Zones
      </button>
    </div>
  );
}
