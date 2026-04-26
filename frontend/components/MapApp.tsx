"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import {
  Shield, Navigation, AlertTriangle, MapPin, Zap, Clock,
  Activity, User, Radio, Eye, Search, Plus, X, Info
} from "lucide-react";

import {
  routeApi, incidentApi, safetyApi, zoneApi, mlApi, getStoredUser,
  type RouteSet, type RouteResult, type Incident, type SafetyZone, type HeatPoint, type User,
} from "@/lib/api";

// New Redesigned Components
import BottomDrawer from "./BottomDrawer";
import SOSButton from "./SOSButton";
import FloatingSearch from "./FloatingSearch";
import AuthModal from "./AuthModal";

// ── Leaflet Setup ─────────────────────────────────────────────
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

const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090]; // Delhi

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

const makeIcon = (color: string, isPulsing = false) =>
  L.divIcon({
    html: `<div class="${isPulsing ? 'animate-pulse-red' : ''}" style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 10px ${color}aa"></div>`,
    className: "", iconAnchor: [7, 7],
  });

export default function MapApp() {
  // ── State ──────────────────────────────────────────────────
  const [origin, setOrigin] = useState<{lat:number;lng:number;label?:string}|null>(null);
  const [dest, setDest]     = useState<{lat:number;lng:number;label?:string}|null>(null);
  const [pickingMode, setPickingMode] = useState<"origin"|"dest"|null>(null);
  
  const [routes, setRoutes] = useState<RouteSet|null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"safest"|"fastest"|"balanced">("safest");
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [zones, setZones] = useState<SafetyZone[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  
  const [user, setUser] = useState<User|null>(null);
  const [showCyber, setShowCyber] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const socketRef = useRef<Socket|null>(null);

  // ── Initialization ──────────────────────────────────────────
  useEffect(() => {
    const saved = getStoredUser();
    if (saved) setUser(saved);

    const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000", { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("safety-update", (data) => {
      setLiveAlerts(prev => [{...data, id: Date.now()}, ...prev.slice(0,5)]);
      fetchNearbyData(data.lat, data.lng);
    });

    fetchNearbyData(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    return () => { socket.disconnect(); };
  }, []);

  const fetchNearbyData = useCallback(async (lat: number, lng: number) => {
    try {
      const [{incidents}, {points}, {zones}] = await Promise.all([
        incidentApi.nearby(lat, lng),
        incidentApi.heatmap(24),
        zoneApi.nearby(lat, lng)
      ]);
      setIncidents(incidents);
      setHeatPoints(points);
      setZones(zones);
    } catch {}
  }, []);

  // ── Actions ────────────────────────────────────────────────
  const handleMapClick = (lat: number, lng: number) => {
    if (pickingMode === "origin") {
      setOrigin({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setPickingMode(null);
    } else if (pickingMode === "dest") {
      setDest({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setPickingMode(null);
    }
  };

  const computeRoutes = async () => {
    if (!origin || !dest) return toast.error("Select start and end points");
    setLoadingRoutes(true);
    try {
      const res = await routeApi.orchestrate({
        originLat: origin.lat, originLng: origin.lng,
        destLat: dest.lat, destLng: dest.lng,
        time: new Date().getHours(), lambda: 5
      });
      
      // Transform to MapRoute
      const transform = (r: any, type: any): RouteResult => ({
        ...r, routeType: type,
        waypoints: r.waypoints || [],
        totalDistanceKm: r.distance_km || 0,
        overallSafetyScore: r.safety_score || 60,
        estimatedMinutes: r.estimatedMinutes || 10
      });

      setRoutes({
        fastest: transform(res.routes.fastest, "fastest"),
        safest: transform(res.routes.safest, "safest"),
        balanced: transform(res.routes.balanced, "balanced"),
        meta: { usingFallback: false }
      } as any);
      setSelectedRoute(res.winner);
      toast.success(`AI selected ${res.winner} path`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingRoutes(false);
    }
  };

  return (
    <div className="w-screen h-screen relative bg-bg overflow-hidden font-sans">
      
      {/* ── Top Floating UI ── */}
      <FloatingSearch 
        origin={origin} 
        dest={dest} 
        onSetOrigin={() => { setPickingMode("origin"); toast("Click map for start point"); }}
        onSetDest={() => { setPickingMode("dest"); toast("Click map for destination"); }}
        onCompute={computeRoutes}
        onOpenCyber={() => setShowCyber(true)}
        onOpenAnalytics={() => setShowAnalytics(true)}
        user={user}
      />

      {/* ── Map Canvas ── */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={14}
          zoomControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO'
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <ZoomControl position="bottomright" />

          {/* Danger Zones (Radial Gradients) */}
          {zones.filter(z => z.type === 'danger').map(zone => (
            <Circle 
              key={zone._id}
              center={[zone.location.coordinates[1], zone.location.coordinates[0]]}
              radius={zone.radius}
              pathOptions={{ fillColor: '#ef4444', fillOpacity: 0.15, stroke: false }}
            />
          ))}

          {/* Active Route with Animated Draw Effect */}
          {routes && (
            <Polyline 
              positions={routes[selectedRoute].waypoints.map(p => [p.lat, p.lng])}
              pathOptions={{ color: ROUTE_COLORS[selectedRoute], weight: 6, opacity: 0.8 }}
              className="route-path"
            />
          )}

          {/* Ghost Routes (Unselected) */}
          {routes && (["safest", "fastest", "balanced"] as const)
            .filter(t => t !== selectedRoute)
            .map(t => (
              <Polyline 
                key={t}
                positions={routes[t].waypoints.map(p => [p.lat, p.lng])}
                pathOptions={{ color: ROUTE_COLORS[t], weight: 3, opacity: 0.2, dashArray: "10, 10" }}
              />
            ))
          }

          {/* Pulsing Incident Markers */}
          {incidents.map(inc => (
            <Marker 
              key={inc._id}
              position={[inc.location.coordinates[1], inc.location.coordinates[0]]}
              icon={makeIcon(INCIDENT_COLORS[inc.type] || "#ef4444", true)}
            >
              <Popup>
                <div className="p-2">
                  <div className="font-bold uppercase text-[10px] text-slate-400">{inc.type}</div>
                  <div className="text-sm font-semibold mt-1">{inc.description || "Safety Alert"}</div>
                  <div className="flex mt-2 items-center gap-1">
                    <AlertTriangle size={12} className="text-danger" />
                    <span className="text-[10px] font-bold text-danger">HIGH RISK ZONE</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Origin/Dest Pins */}
          {origin && <Marker position={[origin.lat, origin.lng]} icon={makeIcon("#6366f1")} />}
          {dest && <Marker position={[dest.lat, dest.lng]} icon={makeIcon("#22c55e")} />}

        </MapContainer>
      </div>

      {/* ── Bottom Safety Drawer ── */}
      <BottomDrawer 
        routes={routes} 
        selectedRoute={selectedRoute} 
        onSelect={setSelectedRoute}
        loading={loadingRoutes}
      />

      {/* ── Emergency SOS Hub ── */}
      <SOSButton />

      {/* ── Live Alert Overlay ── */}
      {liveAlerts.length > 0 && (
        <div className="fixed top-40 right-6 z-[1000] flex flex-col gap-2 max-w-[280px]">
          {liveAlerts.map(alert => (
            <div key={alert.id} className="glass p-3 rounded-2xl border-l-4 border-l-danger flex gap-3 anim-slide-up">
              <div className="bg-danger/20 p-2 rounded-lg h-fit">
                <AlertTriangle size={16} className="text-danger" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Live Incident</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{alert.incidentType?.replace('_',' ')} reported nearby</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAuth && <AuthModal onAuth={(t, u) => { setUser(u); setShowAuth(false); }} onClose={() => setShowAuth(false)} />}
      
      {/* Modals */}
      {showCyber && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-[32px] p-6 relative">
            <button onClick={() => setShowCyber(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white">
              <X size={24} />
            </button>
            <CyberPanel />
          </div>
        </div>
      )}

      {showAnalytics && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-[32px] p-6 relative">
            <button onClick={() => setShowAnalytics(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white">
              <X size={24} />
            </button>
            <AnalyticsPanel />
          </div>
        </div>
      )}
    </div>
  );
}
