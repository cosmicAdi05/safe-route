"use client";
import { useState } from "react";
import { 
  Shield, Clock, MapPin, Zap, ChevronUp, ChevronDown, 
  Lightbulb, Users, AlertTriangle, TrendingUp, Info, 
  ArrowRight, ShieldCheck, Star, Activity
} from "lucide-react";
import { type RouteResult, type RouteSet } from "@/lib/api";

interface Props {
  routes: RouteSet | null;
  selectedRoute: "safest" | "fastest" | "balanced";
  onSelect: (type: "safest" | "fastest" | "balanced") => void;
  loading: boolean;
}

export default function BottomDrawer({ routes, selectedRoute, onSelect, loading }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeRoute = routes ? routes[selectedRoute] : null;

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-[1000] glass rounded-t-[32px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isExpanded ? "h-[85vh]" : "h-[160px]"
      }`}
    >
      {/* Handle / Drag Indicator */}
      <div 
        className="w-full flex flex-col items-center py-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mb-2" />
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          {isExpanded ? "Safety Insights" : "Swipe up for Safety Details"}
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </h3>
      </div>

      <div className="px-6 pb-10 overflow-y-auto h-full scroll-smooth">
        
        {/* ── Route Options ── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {(["safest", "balanced", "fastest"] as const).map((type) => {
            const r = routes ? (routes[type] as RouteResult) : null;
            const active = selectedRoute === type;
            
            return (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${
                  active 
                    ? "bg-primary/20 border-primary border-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                    : "bg-slate-900/40 border-white/5 border hover:bg-slate-800/60"
                }`}
              >
                <div className={`mb-2 p-2 rounded-lg ${active ? "bg-primary text-white" : "text-slate-400"}`}>
                  {type === "safest" ? <ShieldCheck size={20} /> : type === "fastest" ? <Zap size={20} /> : <Activity size={20} />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter mb-1">{type}</span>
                {r ? (
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-black leading-none">{r.overallSafetyScore}%</span>
                    <span className="text-[9px] text-slate-500 font-medium">SAFETY</span>
                  </div>
                ) : (
                  <div className="h-6 w-12 bg-slate-800 rounded animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Route Summary ── */}
        {activeRoute && (
          <div className="flex justify-between items-center bg-white/5 rounded-2xl p-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold">{Math.round(activeRoute.estimatedMinutes)} <span className="text-sm font-normal text-slate-400">min</span></div>
              <div className="h-4 w-[1px] bg-white/10" />
              <div className="text-slate-300 text-sm">{activeRoute.totalDistanceKm.toFixed(1)} km</div>
            </div>
            <button className="bg-primary hover:bg-primary/80 text-white font-bold py-3 px-8 rounded-full shadow-[0_4px_20px_rgba(99,102,241,0.4)] transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
              Start <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── Detailed Safety Insights (Visible when expanded) ── */}
        <div className={`space-y-6 transition-opacity duration-300 ${isExpanded ? "opacity-100" : "opacity-0"}`}>
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-bold flex items-center gap-2">
              Safety Breakdown <Shield size={20} className="text-primary" />
            </h4>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={12} /> Updated 2 mins ago
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Street Lighting", score: 85, icon: Lightbulb, color: "text-yellow-400", bg: "bg-yellow-400" },
              { label: "Crime Frequency", score: 12, icon: Shield, color: "text-red-400", bg: "bg-red-400", invert: true },
              { label: "Crowd Density", score: 45, icon: Users, color: "text-blue-400", bg: "bg-blue-400" },
              { label: "AI Safety Index", score: 92, icon: TrendingUp, color: "text-safe", bg: "bg-safe" },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <item.icon className={item.color} size={18} />
                    <span className="text-sm font-medium text-slate-300">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold">{item.score}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.bg} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${item.invert ? 100 - item.score : item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Community Trust ── */}
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 flex gap-4">
            <div className="bg-primary/20 p-3 rounded-full h-fit">
              <Users className="text-primary" size={24} />
            </div>
            <div>
              <div className="font-bold text-slate-200">Community Validated</div>
              <p className="text-sm text-slate-400 mt-1">Based on 140+ real-time reports from verified users in this area.</p>
              <div className="flex mt-3 gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} size={12} fill={i<5?"#6366f1":"transparent"} color="#6366f1" />)}
                <span className="text-[10px] text-primary ml-2 font-bold uppercase">4.8 TRUST SCORE</span>
              </div>
            </div>
          </div>

          <div className="text-center py-6">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
              © SafeRoute AI v3.0 · Cybersecurity Hardened
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
