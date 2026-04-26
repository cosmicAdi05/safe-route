"use client";
import { useState } from "react";
import { Search, MapPin, Navigation, ArrowRight, User, Menu, Shield } from "lucide-react";

interface Props {
  origin: any;
  dest: any;
  onSetOrigin: () => void;
  onSetDest: () => void;
  onCompute: () => void;
  onOpenCyber: () => void;
  onOpenAnalytics: () => void;
  user: any;
}

export default function FloatingSearch({ origin, dest, onSetOrigin, onSetDest, onCompute, onOpenCyber, onOpenAnalytics, user }: Props) {
  const [focused, setFocused] = useState<"origin" | "dest" | null>(null);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[440px] z-[1100] flex flex-col gap-3">
      
      {/* Top Profile / Branding Bar */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg">
            <Shield size={16} color="#fff" />
          </div>
          <span className="font-display font-black text-lg tracking-tight">SafeRoute</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenCyber} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
            <Shield size={18} className="text-primary" />
          </button>
          <button onClick={onOpenAnalytics} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
            <Activity size={18} className="text-safe" />
          </button>
          <button className="w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center overflow-hidden">
          {user ? (
            <div className="bg-primary/20 text-primary font-bold text-xs uppercase">{user.name[0]}</div>
          ) : (
            <User size={18} className="text-slate-400" />
          )}
        </button>
      </div>

      {/* Input Hub */}
      <div className="glass rounded-3xl p-2 shadow-2xl">
        <div className="flex flex-col gap-1">
          {/* Origin */}
          <button 
            onClick={onSetOrigin}
            className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${
              focused === "origin" ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className="w-2 h-2 rounded-full border-2 border-primary" />
            <div className="flex-1 text-left overflow-hidden">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Starting Point</div>
              <div className="text-sm font-medium truncate text-slate-200">
                {origin?.label || "Set Current Location"}
              </div>
            </div>
            <Search size={16} className="text-slate-600" />
          </button>

          {/* Divider */}
          <div className="mx-8 h-[1px] bg-white/5" />

          {/* Destination */}
          <button 
            onClick={onSetDest}
            className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${
              focused === "dest" ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-safe" />
            <div className="flex-1 text-left overflow-hidden">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Destination</div>
              <div className="text-sm font-medium truncate text-slate-200">
                {dest?.label || "Where to?"}
              </div>
            </div>
            <Navigation size={16} className="text-slate-600" />
          </button>
        </div>

        {/* Compute Button (only if both set) */}
        {origin && dest && (
          <button 
            onClick={onCompute}
            className="w-full mt-2 bg-primary py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-95"
          >
            Calculate Safe Routes <ArrowRight size={16} />
          </button>
        )}
      </div>

    </div>
  );
}
