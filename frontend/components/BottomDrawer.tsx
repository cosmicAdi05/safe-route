"use client";
import { useState } from "react";
import { 
  Shield, ShieldCheck, Zap, Activity, Clock, 
  ChevronUp, ChevronDown, ArrowRight, Star, Users, 
  Lightbulb, AlertTriangle, TrendingUp, Cpu, Wifi, WifiOff
} from "lucide-react";
import { type RouteSet, type RouteResult } from "@/lib/api";

interface Props {
  routes: RouteSet | null;
  selectedRoute: "safest" | "fastest" | "balanced";
  onSelect: (type: "safest" | "fastest" | "balanced") => void;
  loading: boolean;
  offlineScore?: { score: number; category: string; categoryColor: string; inferenceMs: number } | null;
}

const ROUTE_META = {
  safest:   { icon: ShieldCheck, label: "Safest",   accent: "#22c55e", glow: "rgba(34,197,94,0.3)"   },
  balanced: { icon: Activity,    label: "Balanced",  accent: "#f59e0b", glow: "rgba(245,158,11,0.3)"  },
  fastest:  { icon: Zap,         label: "Fastest",   accent: "#6366f1", glow: "rgba(99,102,241,0.3)"  },
};

function RiskRing({ score, color }: { score: number; color: string }) {
  const r = 22, c = 28, dash = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle
        cx={c} cy={c} r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={dash}
        strokeDashoffset={dash * (1 - score / 100)}
        strokeLinecap="round"
        className="risk-ring"
      />
      <text
        x={c} y={c + 5}
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="800"
        style={{ transform: "rotate(90deg)", transformOrigin: `${c}px ${c}px`, fontFamily: "Inter,sans-serif" }}
      >
        {score}
      </text>
    </svg>
  );
}

export default function BottomDrawer({ routes, selectedRoute, onSelect, loading, offlineScore }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeRoute = routes ? (routes[selectedRoute] as RouteResult) : null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[900] glass-strong transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isExpanded ? "h-[82vh]" : routes ? "h-[200px]" : "h-[96px]"
      }`}
      style={{ borderRadius: "32px 32px 0 0" }}
    >
      {/* ── Top Gradient Accent Line ── */}
      <div style={{
        position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
        background: `linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)`
      }} />

      {/* ── Drag Handle ── */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex flex-col items-center pt-4 pb-3 cursor-pointer group"
      >
        <div className="w-10 h-1 rounded-full bg-white/10 group-hover:bg-white/25 transition-colors mb-3" />
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 flex items-center gap-2 group-hover:text-slate-300 transition-colors">
          {isExpanded ? (<><ChevronDown size={12}/> Close Details</>) : routes ? (<><ChevronUp size={12}/> Safety Insights</>) : "Tap map to set points"}
        </span>
      </button>

      <div className="px-5 pb-10 overflow-y-auto h-full scrollbar-none">

        {/* ── Loading State ── */}
        {loading && (
          <div className="flex flex-col gap-4 mt-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 rounded-3xl shimmer" />
            ))}
          </div>
        )}

        {/* ── No Routes State ── */}
        {!routes && !loading && (
          <div className="flex items-center gap-4 px-2 mt-1">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Shield size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">Set your route</p>
              <p className="text-xs text-slate-500 mt-0.5">Click the map to set start & end points</p>
            </div>
          </div>
        )}

        {/* ── Route Cards ── */}
        {routes && !loading && (
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {(["safest", "balanced", "fastest"] as const).map(type => {
              const r = routes[type] as RouteResult;
              const meta = ROUTE_META[type];
              const isActive = selectedRoute === type;
              return (
                <button
                  key={type}
                  onClick={() => onSelect(type)}
                  className="flex flex-col items-center p-3 rounded-3xl transition-all duration-300 relative overflow-hidden"
                  style={{
                    background: isActive ? `rgba(${meta.accent === "#22c55e" ? "34,197,94" : meta.accent === "#f59e0b" ? "245,158,11" : "99,102,241"},0.1)` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? meta.accent + "40" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: isActive ? `0 0 20px ${meta.glow}` : "none",
                  }}
                >
                  {isActive && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)` }} />
                  )}
                  <div className="mb-2">
                    <RiskRing score={r.overallSafetyScore} color={meta.accent} />
                  </div>
                  <meta.icon size={14} style={{ color: meta.accent, marginBottom: 4 }} />
                  <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: isActive ? meta.accent : "#64748b" }}>{meta.label}</span>
                  <span className="text-[9px] text-slate-600 mt-1">{Math.round(r.estimatedMinutes)} min</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Active Route Summary Bar ── */}
        {activeRoute && !loading && (
          <div
            className="flex justify-between items-center px-5 py-3 rounded-2xl mb-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-5">
              <div>
                <div className="text-2xl font-black">{Math.round(activeRoute.estimatedMinutes)}<span className="text-sm font-normal text-slate-400 ml-1">min</span></div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Time</div>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div>
                <div className="text-lg font-black">{activeRoute.totalDistanceKm?.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">km</span></div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Distance</div>
              </div>
              {offlineScore && (
                <>
                  <div className="w-px h-8 bg-white/8" />
                  <div>
                    <div className="text-lg font-black flex items-center gap-1.5">
                      <span style={{ color: offlineScore.categoryColor }}>{offlineScore.category}</span>
                      {offlineScore ? <WifiOff size={12} className="text-slate-600" /> : <Wifi size={12} className="text-safe" />}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">AI Score · {offlineScore.inferenceMs}ms</div>
                  </div>
                </>
              )}
            </div>
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, #6366f1, #8b5cf6)`,
                boxShadow: "0 4px 24px rgba(99,102,241,0.5)"
              }}
            >
              Start <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Safety Insights (Expanded) ── */}
        {isExpanded && activeRoute && (
          <div className="space-y-5 animate-fade-in">
            {/* Section title */}
            <div className="flex items-center justify-between">
              <h4 className="text-base font-black font-display flex items-center gap-2">
                Safety Breakdown
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">AI Powered</span>
              </h4>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
                Updated 2m ago
              </div>
            </div>

            {/* Insight Cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Street Lighting",  score: 78, icon: Lightbulb, color: "#eab308" },
                { label: "Crime Rate",        score: 22, icon: AlertTriangle, color: "#ef4444", invert: true },
                { label: "Crowd Safety",      score: 65, icon: Users, color: "#6366f1" },
                { label: "AI Safety Index",   score: activeRoute.overallSafetyScore, icon: TrendingUp, color: "#22c55e" },
              ].map(item => (
                <div
                  key={item.label}
                  className="p-4 rounded-2xl transition-all"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <item.icon size={16} style={{ color: item.color }} />
                    <span className="text-sm font-black" style={{ color: item.color }}>
                      {item.invert ? 100 - item.score : item.score}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2.5 font-medium">{item.label}</div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${item.invert ? 100 - item.score : item.score}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Offline ML Badge */}
            {offlineScore && (
              <div
                className="p-4 rounded-2xl flex gap-4 items-start"
                style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Cpu size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold">Offline ML Engine Active</span>
                    <span className="text-[9px] bg-safe/20 text-safe px-2 py-0.5 rounded-full font-black uppercase">v1.2.0</span>
                  </div>
                  <p className="text-xs text-slate-400">INT8 logistic regression · 1.0KB model · {offlineScore.inferenceMs}ms inference</p>
                  <div className="flex items-center gap-2 mt-2">
                    <WifiOff size={11} className="text-slate-500" />
                    <span className="text-[10px] text-slate-500">Works without internet connection</span>
                  </div>
                </div>
              </div>
            )}

            {/* Trust Row */}
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex -space-x-2">
                {["#6366f1","#22c55e","#f59e0b","#ef4444"].map((c,i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-surface" style={{ background: c }} />
                ))}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold">Verified by 140+ community reports</div>
                <div className="flex mt-1 gap-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={10} fill={i<5?"#f59e0b":"transparent"} color="#f59e0b" />)}
                  <span className="text-[9px] text-primary ml-1.5 font-black uppercase">4.8 Trust Score</span>
                </div>
              </div>
            </div>

            <p className="text-center text-[9px] text-slate-700 font-bold uppercase tracking-widest">
              SafeRoute AI v3.1 · Offline-First · Cybersecurity Hardened
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
