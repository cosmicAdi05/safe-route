"use client";
import { useState, useRef } from "react";
import { MapPin, Navigation, Loader, Shield, Clock, ChevronDown, Info, Route } from "lucide-react";
import { geocodeAddress } from "@/lib/utils";
import { riskColor, riskLabel } from "@/lib/utils";
import type { RouteSet, RouteResult } from "@/lib/api";
import toast from "react-hot-toast";

const ROUTE_COLORS = { safest:"#22c55e", fastest:"#6366f1", balanced:"#f59e0b" };
const ROUTE_ICONS  = { safest:"🛡️", fastest:"⚡", balanced:"⚖️" };
const ROUTE_DESCS  = {
  safest:   "A* α=10 — max danger avoidance",
  fastest:  "Dijkstra — shortest distance",
  balanced: "A* α=3 — speed/safety tradeoff",
};

interface Props {
  origin: any; dest: any;
  setOrigin: (v:any) => void; setDest: (v:any) => void;
  pickingMode: any; setPickingMode: (v:any) => void;
  routes: RouteSet|null; selectedRoute: "safest"|"fastest"|"balanced";
  setSelectedRoute: (v:any) => void; loadingRoutes: boolean; onCompute: () => void;
  onStepClick?: (lat: number, lng: number) => void;
}

function LocationInput({ label, value, onSet, onClear, pickingMode, pickingKey, setPickingMode, accentColor }: any) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<any>(null);

  const handleSearch = async (q: string) => {
    setQuery(q);
    clearTimeout(timerRef.current);
    if (q.length < 3) return;
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      const result = await geocodeAddress(q);
      setSearching(false);
      if (result) {
        onSet(result);
        toast.success(`📍 ${label} set`);
      } else {
        toast.error("Location not found — try clicking the map");
      }
    }, 800);
  };

  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" }}>{label}</label>
      <div style={{ display:"flex", gap:6, marginTop:6 }}>
        <div style={{ flex:1, position:"relative" }}>
          <input
            className="input"
            style={{ paddingRight: searching ? 32 : 12, fontSize:12, borderColor: pickingMode===pickingKey ? accentColor : undefined }}
            placeholder={value ? `${value.lat?.toFixed(4)}, ${value.lng?.toFixed(4)}` : "Search address or click map…"}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && (
            <Loader size={12} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", animation:"spin-slow 1s linear infinite" }} />
          )}
          {value && !query && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", padding:"0 12px", pointerEvents:"none" }}>
              <span style={{ fontSize:12, color:"#f1f5f9", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {value.label?.substring(0,35) || `${value.lat?.toFixed(4)}, ${value.lng?.toFixed(4)}`}
              </span>
            </div>
          )}
        </div>
        <button
          className={`btn ${pickingMode===pickingKey ? "btn-primary" : "btn-ghost"}`}
          style={{ padding:"10px 11px", flexShrink:0, ...(pickingMode===pickingKey ? { background:accentColor, boxShadow:`0 0 12px ${accentColor}66` }:{}) }}
          onClick={() => { setPickingMode(pickingMode===pickingKey ? null : pickingKey); setQuery(""); }}
          title="Click on map to pick location"
        >
          <MapPin size={13} />
        </button>
        {value && (
          <button className="btn btn-ghost" style={{ padding:"10px 11px", flexShrink:0 }} onClick={() => { onClear(); setQuery(""); }}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function RoutePanel({ origin, dest, setOrigin, setDest, pickingMode, setPickingMode, routes, selectedRoute, setSelectedRoute, loadingRoutes, onCompute }: Props) {
  const [showAlgo, setShowAlgo] = useState(false);

  const activeRoute: RouteResult | null = routes ? (routes[selectedRoute] as RouteResult) : null;

  return (
    <div className="anim-fade">
      {/* Instruction hint */}
      <div style={{ fontSize:12, color:"#94a3b8", marginBottom:14, padding:"9px 12px", background:"rgba(99,102,241,0.07)", borderRadius:8, border:"1px solid rgba(99,102,241,0.15)", lineHeight:1.6 }}>
        <b style={{ color:"#818cf8" }}>Tip:</b> Search an address <em>or</em> click 📍 then tap the map to pin a location.
      </div>

      {/* Origin */}
      <LocationInput
        label="Origin"
        value={origin}
        onSet={setOrigin}
        onClear={() => setOrigin(null)}
        pickingMode={pickingMode}
        pickingKey="origin"
        setPickingMode={setPickingMode}
        accentColor="#6366f1"
      />

      {/* Destination */}
      <LocationInput
        label="Destination"
        value={dest}
        onSet={setDest}
        onClear={() => setDest(null)}
        pickingMode={pickingMode}
        pickingKey="dest"
        setPickingMode={setPickingMode}
        accentColor="#22c55e"
      />

      {/* Swap */}
      {origin && dest && (
        <button className="btn btn-ghost" style={{ width:"100%", fontSize:12, marginBottom:10, padding:"7px" }}
          onClick={() => { const tmp = origin; setOrigin(dest); setDest(tmp); }}>
          ⇅ Swap origin & destination
        </button>
      )}

      {/* Compute */}
      <button
        className="btn btn-primary"
        style={{ width:"100%", padding:"13px", fontSize:14, marginBottom:20 }}
        onClick={onCompute}
        disabled={!origin || !dest || loadingRoutes}
        id="compute-routes-btn"
      >
        {loadingRoutes
          ? <><Loader size={15} style={{ animation:"spin-slow 1s linear infinite" }} /> Computing AI Routes…</>
          : <><Shield size={15} /> Compute Safe Routes</>}
      </button>

      {/* Route cards */}
      {routes && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>
            Route Comparison
          </div>

          {(["safest","fastest","balanced"] as const).map((type) => {
            const r = routes[type] as RouteResult;
            const isSelected = selectedRoute === type;
            const sc = r.overallSafetyScore;
            const color = riskColor(sc);
            return (
              <div key={type} className={`route-card ${isSelected ? "selected" : ""}`}
                style={{ marginBottom:8 }}
                onClick={() => setSelectedRoute(type)}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:20 }}>{ROUTE_ICONS[type]}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, textTransform:"capitalize" }}>{type}</div>
                      <div style={{ fontSize:10, color:"#94a3b8" }}>{ROUTE_DESCS[type]}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22, fontWeight:900, color, lineHeight:1 }}>
                      {sc}<span style={{ fontSize:12, fontWeight:400, color:"#475569" }}>/100</span>
                    </div>
                    <div style={{ fontSize:9, color, fontWeight:700, letterSpacing:"0.05em" }}>{riskLabel(sc)} RISK</div>
                  </div>
                </div>

                <div className="risk-meter" style={{ marginBottom:8 }}>
                  <div className="risk-meter-fill" style={{ width:`${sc}%`, background:color }} />
                </div>

                <div style={{ display:"flex", gap:14, fontSize:11, color:"#94a3b8" }}>
                  <span><Route size={10} style={{ display:"inline", verticalAlign:"middle", marginRight:3 }} />
                    {r.totalDistanceKm} km</span>
                  <span><Clock size={10} style={{ display:"inline", verticalAlign:"middle", marginRight:3 }} />
                    {r.estimatedMinutes} min</span>
                  <span style={{ marginLeft:"auto", fontSize:10, fontWeight:700, color: isSelected ? ROUTE_COLORS[type] : "#475569" }}>
                    {isSelected ? "● ACTIVE" : "Select"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Active route info */}
          {activeRoute && (
            <div style={{ marginTop:14, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding:12, borderRadius:10, background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#818cf8", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  Selected Route Stats
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[
                    { label:"Steps",        value: activeRoute.instructions?.length || 0 },
                    { label:"Segments",     value: activeRoute.segments?.length || "—" },
                    { label:"Distance",     value: `${activeRoute.totalDistanceKm} km` },
                    { label:"ETA",          value: `${activeRoute.estimatedMinutes} min` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign:"center", padding:"8px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:"#f1f5f9" }}>{value}</div>
                      <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step-by-Step Directions */}
              {activeRoute.instructions && activeRoute.instructions.length > 0 && (
                <div style={{ padding:12, borderRadius:16, background:"rgba(13,22,40,0.5)", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em", display:"flex", alignItems:"center", gap:6 }}>
                    <Navigation size={12} /> Turn-by-Turn Directions
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:"200px", overflowY:"auto", paddingRight:6 }} className="scrollbar-none">
                    {activeRoute.instructions.map((step, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                          // Approximate lat/lng from waypoints (since OSRM steps don't always have them directly in this version)
                          const wptIndex = Math.floor((i / activeRoute.instructions.length) * activeRoute.waypoints.length);
                          const wpt = activeRoute.waypoints[wptIndex];
                          if (wpt && onStepClick) onStepClick(wpt.lat, wpt.lng);
                        }}
                        style={{ display:"flex", gap:10, paddingBottom:8, borderBottom: i === activeRoute.instructions.length-1 ? "none" : "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}
                      >
                        <div style={{ width:18, height:18, borderRadius:5, background:"rgba(99,102,241,0.15)", color:"#818cf8", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyCenter:"center", flexShrink:0, marginTop:2 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, color:"#f1f5f9", lineHeight:1.4 }}>{step.text}</div>
                          <div style={{ fontSize:9, color:"#475569", marginTop:2 }}>{step.name} · {step.distanceM}m</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Algorithm toggle */}
          <button className="btn btn-ghost" style={{ width:"100%", marginTop:10, fontSize:11, padding:"7px" }}
            onClick={() => setShowAlgo(!showAlgo)}>
            <Info size={11} /> Algorithm Details
            <ChevronDown size={11} style={{ transform: showAlgo?"rotate(180deg)":"none", transition:"transform 0.2s", marginLeft:4 }} />
          </button>

          {showAlgo && (
            <div style={{ marginTop:8, padding:14, background:"rgba(15,20,40,0.6)", borderRadius:10, border:"1px solid rgba(99,102,241,0.15)", fontSize:11 }} className="anim-fade">
              <div style={{ fontWeight:700, color:"#818cf8", marginBottom:6 }}>Modified A* Safety Formula</div>
              <code style={{ display:"block", background:"rgba(0,0,0,0.4)", padding:10, borderRadius:8, color:"#a5b4fc", lineHeight:1.8, marginBottom:8 }}>
                edgeCost = dist × (1 + α × (1−s/100)²){"\n"}
                {"\n"}α=10 → Safest   (avoid danger strongly){"\n"}
                α=0  → Fastest  (pure distance){"\n"}
                α=3  → Balanced (moderate trade-off)
              </code>
              <div style={{ color:"#475569", lineHeight:1.7 }}>
                Safety score <b style={{ color:"#94a3b8" }}>s</b> computed live from:
                crime density (35%) · time of day (20%) · OSM crowd (15%) · weather (15%) · police (10%) · surge (5%)
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!routes && !loadingRoutes && (
        <div style={{ textAlign:"center", padding:"36px 0", color:"#475569" }}>
          <Shield size={44} style={{ margin:"0 auto 14px", opacity:0.2, display:"block" }} />
          <div style={{ fontSize:13, marginBottom:6 }}>Set your origin and destination to get started</div>
          <div style={{ fontSize:11, color:"#374151" }}>AI computes 3 routes simultaneously:<br/>Safest · Fastest · Balanced</div>
        </div>
      )}
    </div>
  );
}
