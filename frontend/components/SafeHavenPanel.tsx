"use client";
import { useState, useEffect } from "react";
import { Shield, MapPin, Phone, Navigation, Clock, Star, Search, X, Zap, Heart, Building2, ShieldCheck } from "lucide-react";

// Delhi-area Safe Havens dataset
const SAFE_HAVENS = [
  { id: 1, name: "Connaught Place Police Station", type: "police", lat: 28.6315, lng: 77.2167, phone: "011-23412345", rating: 4.2, distance: "0.8 km", isOpen: true },
  { id: 2, name: "AIIMS Hospital", type: "hospital", lat: 28.5672, lng: 77.2100, phone: "011-26588500", rating: 4.8, distance: "2.1 km", isOpen: true },
  { id: 3, name: "Safdarjung Hospital", type: "hospital", lat: 28.5686, lng: 77.2064, phone: "011-26165060", rating: 4.5, distance: "2.3 km", isOpen: true },
  { id: 4, name: "Hauz Khas Police Station", type: "police", lat: 28.5494, lng: 77.2001, phone: "011-26967890", rating: 3.9, distance: "3.4 km", isOpen: true },
  { id: 5, name: "Metro Station — Rajiv Chowk", type: "metro", lat: 28.6328, lng: 77.2197, phone: "", rating: 4.6, distance: "0.9 km", isOpen: true },
  { id: 6, name: "Women Help Center — Lajpat Nagar", type: "shelter", lat: 28.5675, lng: 77.2430, phone: "1091", rating: 4.7, distance: "3.1 km", isOpen: true },
  { id: 7, name: "IGI Airport Security", type: "police", lat: 28.5562, lng: 77.0999, phone: "011-25601234", rating: 4.1, distance: "8.2 km", isOpen: true },
  { id: 8, name: "Apollo Hospital Sarita Vihar", type: "hospital", lat: 28.5279, lng: 77.2900, phone: "011-29871234", rating: 4.9, distance: "6.1 km", isOpen: true },
  { id: 9, name: "Malviya Nagar Police Station", type: "police", lat: 28.5355, lng: 77.2153, phone: "011-29563421", rating: 3.8, distance: "4.5 km", isOpen: false },
  { id: 10, name: "Khan Market Metro Station", type: "metro", lat: 28.5990, lng: 77.2271, phone: "", rating: 4.3, distance: "1.7 km", isOpen: true },
];

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  police: { icon: ShieldCheck, color: "#6366f1", bg: "rgba(99,102,241,0.15)", label: "Police Station" },
  hospital: { icon: Heart, color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "Hospital" },
  metro: { icon: Zap, color: "#22c55e", bg: "rgba(34,197,94,0.15)", label: "Metro / Safe Zone" },
  shelter: { icon: Building2, color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "Women's Shelter" },
};

interface Props {
  userLat?: number;
  userLng?: number;
  onNavigateTo?: (lat: number, lng: number, name: string) => void;
}

export default function SafeHavenPanel({ userLat, userLng, onNavigateTo }: Props) {
  const [filter, setFilter] = useState<"all" | "police" | "hospital" | "metro" | "shelter">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof SAFE_HAVENS[0] | null>(null);

  const filtered = SAFE_HAVENS.filter(h => {
    const matchesType = filter === "all" || h.type === filter;
    const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-safe/10 border border-safe/20 flex items-center justify-center flex-shrink-0">
          <Shield size={20} className="text-safe" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Safe Havens</h2>
          <p className="text-xs text-slate-400">Nearby verified safe locations</p>
        </div>
        <div className="ml-auto bg-safe/10 border border-safe/20 px-3 py-1 rounded-full">
          <span className="text-[10px] font-black text-safe uppercase tracking-wider">
            {SAFE_HAVENS.filter(h=>h.isOpen).length} Open
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search safe havens..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-slate-600"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(["all", "police", "hospital", "metro", "shelter"] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
              filter === type
                ? "bg-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {type === "all" ? "All" : TYPE_CONFIG[type].label.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Haven Cards */}
      <div className="flex flex-col gap-3">
        {filtered.map(haven => {
          const cfg = TYPE_CONFIG[haven.type];
          const IconComp = cfg.icon;
          const isSelected = selected?.id === haven.id;

          return (
            <div
              key={haven.id}
              onClick={() => setSelected(isSelected ? null : haven)}
              className={`rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                isSelected
                  ? "border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                  : "border-white/5 bg-white/3 hover:bg-white/6 hover:border-white/10"
              }`}
            >
              <div className="p-4 flex items-center gap-4">
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg }}
                >
                  <IconComp size={22} style={{ color: cfg.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold truncate">{haven.name}</span>
                    {!haven.isOpen && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold flex-shrink-0">CLOSED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={10} /> {haven.distance}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={10} fill="#f59e0b" color="#f59e0b" /> {haven.rating}
                    </span>
                    <span className="px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color, fontSize: 9, fontWeight: 700 }}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                <Navigation size={16} className="text-slate-600 flex-shrink-0" />
              </div>

              {/* Expanded Actions */}
              {isSelected && (
                <div className="px-4 pb-4 pt-1 border-t border-white/5 flex gap-3 animate-[slideDown_0.2s_ease]">
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigateTo?.(haven.lat, haven.lng, haven.name); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary py-2.5 rounded-xl text-xs font-bold text-white hover:bg-primary/80 transition-colors"
                  >
                    <Navigation size={14} /> Navigate
                  </button>
                  {haven.phone && (
                    <a
                      href={`tel:${haven.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-2 bg-safe/20 border border-safe/30 py-2.5 rounded-xl text-xs font-bold text-safe hover:bg-safe/30 transition-colors"
                    >
                      <Phone size={14} /> Call
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Emergency Numbers */}
      <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4">
        <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-3">Emergency Numbers</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Police", number: "100" },
            { label: "Ambulance", number: "108" },
            { label: "Women", number: "1091" },
          ].map(e => (
            <a key={e.number} href={`tel:${e.number}`} className="flex flex-col items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-center">
              <span className="text-lg font-black text-red-400">{e.number}</span>
              <span className="text-[10px] text-slate-400 mt-1">{e.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
