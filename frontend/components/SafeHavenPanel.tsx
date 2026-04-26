"use client";
import { useState, useEffect } from "react";
import { Shield, MapPin, Phone, Navigation, Clock, Star, Search, X, Zap, Heart, Building2, ShieldCheck } from "lucide-react";

// All-India Safe Havens Dataset
const SAFE_HAVENS = [
  // ── DELHI ──────────────────────────────────────────────
  { id: 1,  name: "Connaught Place Police Station",   type: "police",   lat: 28.6315, lng: 77.2167, phone: "011-23412345", rating: 4.2, distance: "0.8 km",  city: "Delhi",     isOpen: true },
  { id: 2,  name: "AIIMS Hospital",                    type: "hospital", lat: 28.5672, lng: 77.2100, phone: "011-26588500", rating: 4.8, distance: "2.1 km",  city: "Delhi",     isOpen: true },
  { id: 3,  name: "Safdarjung Hospital",               type: "hospital", lat: 28.5686, lng: 77.2064, phone: "011-26165060", rating: 4.5, distance: "2.3 km",  city: "Delhi",     isOpen: true },
  { id: 4,  name: "Hauz Khas Police Station",          type: "police",   lat: 28.5494, lng: 77.2001, phone: "011-26967890", rating: 3.9, distance: "3.4 km",  city: "Delhi",     isOpen: true },
  { id: 5,  name: "Rajiv Chowk Metro Station",         type: "metro",    lat: 28.6328, lng: 77.2197, phone: "",             rating: 4.6, distance: "0.9 km",  city: "Delhi",     isOpen: true },
  { id: 6,  name: "Women Help Center — Lajpat Nagar", type: "shelter",  lat: 28.5675, lng: 77.2430, phone: "1091",         rating: 4.7, distance: "3.1 km",  city: "Delhi",     isOpen: true },
  { id: 7,  name: "Malviya Nagar Police Station",      type: "police",   lat: 28.5355, lng: 77.2153, phone: "011-29563421", rating: 3.8, distance: "4.5 km",  city: "Delhi",     isOpen: true },
  { id: 8,  name: "Khan Market Metro Station",         type: "metro",    lat: 28.5990, lng: 77.2271, phone: "",             rating: 4.3, distance: "1.7 km",  city: "Delhi",     isOpen: true },
  { id: 9,  name: "Lodi Road Police Station",          type: "police",   lat: 28.5900, lng: 77.2270, phone: "011-24691234", rating: 4.0, distance: "2.0 km",  city: "Delhi",     isOpen: true },
  { id: 10, name: "RML Hospital",                     type: "hospital", lat: 28.6362, lng: 77.2009, phone: "011-23404270", rating: 4.3, distance: "1.2 km",  city: "Delhi",     isOpen: true },
  // ── MUMBAI ─────────────────────────────────────────────
  { id: 11, name: "Colaba Police Station",             type: "police",   lat: 18.9147, lng: 72.8230, phone: "022-22021855", rating: 4.1, distance: "1.0 km",  city: "Mumbai",    isOpen: true },
  { id: 12, name: "KEM Hospital",                      type: "hospital", lat: 18.9971, lng: 72.8414, phone: "022-24107000", rating: 4.6, distance: "3.2 km",  city: "Mumbai",    isOpen: true },
  { id: 13, name: "Andheri Police Station",            type: "police",   lat: 19.1197, lng: 72.8468, phone: "022-26201234", rating: 3.9, distance: "5.1 km",  city: "Mumbai",    isOpen: true },
  { id: 14, name: "Dadar Police Station",              type: "police",   lat: 19.0178, lng: 72.8478, phone: "022-24224567", rating: 4.0, distance: "2.8 km",  city: "Mumbai",    isOpen: true },
  { id: 15, name: "CST Metro Station",                 type: "metro",    lat: 18.9398, lng: 72.8355, phone: "",             rating: 4.4, distance: "1.5 km",  city: "Mumbai",    isOpen: true },
  { id: 16, name: "Nair Hospital",                     type: "hospital", lat: 18.9648, lng: 72.8175, phone: "022-23027600", rating: 4.5, distance: "2.0 km",  city: "Mumbai",    isOpen: true },
  // ── BANGALORE ──────────────────────────────────────────
  { id: 17, name: "Cubbon Park Police Station",        type: "police",   lat: 12.9762, lng: 77.5929, phone: "080-22381234", rating: 4.2, distance: "1.3 km",  city: "Bangalore", isOpen: true },
  { id: 18, name: "Bowring Hospital",                  type: "hospital", lat: 12.9780, lng: 77.6090, phone: "080-25546789", rating: 4.4, distance: "2.5 km",  city: "Bangalore", isOpen: true },
  { id: 19, name: "MG Road Metro Station",             type: "metro",    lat: 12.9757, lng: 77.6085, phone: "",             rating: 4.7, distance: "0.8 km",  city: "Bangalore", isOpen: true },
  { id: 20, name: "Koramangala Police Station",        type: "police",   lat: 12.9352, lng: 77.6245, phone: "080-25506789", rating: 3.8, distance: "4.0 km",  city: "Bangalore", isOpen: true },
  // ── CHENNAI ────────────────────────────────────────────
  { id: 21, name: "Anna Salai Police Station",         type: "police",   lat: 13.0604, lng: 80.2496, phone: "044-28412345", rating: 4.0, distance: "1.5 km",  city: "Chennai",   isOpen: true },
  { id: 22, name: "Government General Hospital",       type: "hospital", lat: 13.0827, lng: 80.2707, phone: "044-25305000", rating: 4.5, distance: "3.0 km",  city: "Chennai",   isOpen: true },
  { id: 23, name: "Chennai Central Metro",             type: "metro",    lat: 13.0827, lng: 80.2757, phone: "",             rating: 4.3, distance: "2.2 km",  city: "Chennai",   isOpen: true },
  // ── KOLKATA ────────────────────────────────────────────
  { id: 24, name: "Lalbazar Police HQ",                type: "police",   lat: 22.5741, lng: 88.3634, phone: "033-22500371", rating: 4.3, distance: "1.0 km",  city: "Kolkata",   isOpen: true },
  { id: 25, name: "SSKM Hospital",                     type: "hospital", lat: 22.5348, lng: 88.3390, phone: "033-22041394", rating: 4.6, distance: "3.5 km",  city: "Kolkata",   isOpen: true },
  { id: 26, name: "Park Street Metro",                 type: "metro",    lat: 22.5531, lng: 88.3516, phone: "",             rating: 4.4, distance: "1.8 km",  city: "Kolkata",   isOpen: true },
  // ── HYDERABAD ──────────────────────────────────────────
  { id: 27, name: "Begumpet Police Station",           type: "police",   lat: 17.4480, lng: 78.4680, phone: "040-27895234", rating: 4.1, distance: "2.0 km",  city: "Hyderabad", isOpen: true },
  { id: 28, name: "Osmania General Hospital",          type: "hospital", lat: 17.3716, lng: 78.4743, phone: "040-24600123", rating: 4.4, distance: "4.1 km",  city: "Hyderabad", isOpen: true },
  { id: 29, name: "Ameerpet Metro Station",            type: "metro",    lat: 17.4374, lng: 78.4482, phone: "",             rating: 4.6, distance: "1.5 km",  city: "Hyderabad", isOpen: true },
  // ── PUNE ───────────────────────────────────────────────
  { id: 30, name: "Shivajinagar Police Station",       type: "police",   lat: 18.5314, lng: 73.8446, phone: "020-25531234", rating: 4.0, distance: "1.2 km",  city: "Pune",      isOpen: true },
  { id: 31, name: "Sassoon General Hospital",          type: "hospital", lat: 18.5195, lng: 73.8553, phone: "020-26127201", rating: 4.5, distance: "2.0 km",  city: "Pune",      isOpen: true },
  { id: 32, name: "Women Safety Center — Pune",        type: "shelter",  lat: 18.5204, lng: 73.8567, phone: "1091",         rating: 4.8, distance: "2.1 km",  city: "Pune",      isOpen: true },
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
