"use client";
import { useState, useRef, useEffect } from "react";
import { Search, Navigation, ArrowRight, User, Shield, Activity, MapPin, X, Loader2 } from "lucide-react";

interface Props {
  origin: any;
  dest: any;
  onSetOrigin: (loc: { lat: number; lng: number; label: string }) => void;
  onSetDest: (loc: { lat: number; lng: number; label: string }) => void;
  onCompute: () => void;
  onOpenCyber: () => void;
  onOpenAnalytics: () => void;
  user: any;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

function LocationInput({
  placeholder,
  value,
  onSelect,
  onClear,
  icon,
  dotColor,
}: {
  placeholder: string;
  value: string;
  onSelect: (loc: { lat: number; lng: number; label: string }) => void;
  onClear: () => void;
  icon: React.ReactNode;
  dotColor: string;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => { setQuery(value); }, [value]);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=json&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const pick = (s: Suggestion) => {
    const label = s.display_name.split(",").slice(0, 3).join(", ");
    setQuery(label);
    setSuggestions([]);
    setOpen(false);
    onSelect({ lat: parseFloat(s.lat), lng: parseFloat(s.lon), label });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition-colors group">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600 text-slate-200"
        />
        {loading && <Loader2 size={14} className="text-slate-500 animate-spin flex-shrink-0" />}
        {query && !loading && (
          <button onMouseDown={() => { setQuery(""); onClear(); }} className="text-slate-600 hover:text-slate-300 flex-shrink-0">
            <X size={14} />
          </button>
        )}
        {!query && !loading && icon}
      </div>

      {/* Suggestions Dropdown */}
      {open && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 glass-strong rounded-2xl overflow-hidden shadow-2xl"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {suggestions.map((s, i) => {
            const parts = s.display_name.split(",");
            const name = parts[0];
            const area = parts.slice(1, 3).join(",").trim();
            return (
              <button
                key={i}
                onMouseDown={() => pick(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition-colors text-left border-b border-white/5 last:border-0"
              >
                <MapPin size={14} className="text-primary flex-shrink-0" />
                <div className="overflow-hidden">
                  <div className="text-sm font-semibold text-slate-200 truncate">{name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{area}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FloatingSearch({
  origin, dest,
  onSetOrigin, onSetDest,
  onCompute, onOpenCyber, onOpenAnalytics, onUseMyLocation, user,
}: Props) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 w-[92%] max-w-[440px] z-[1100] flex flex-col gap-3">

      {/* ── Branding Bar ── */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-xl shadow-[0_0_12px_rgba(99,102,241,0.5)]">
            <Shield size={16} color="#fff" />
          </div>
          <span className="font-display font-black text-lg tracking-tight">SafeRoute</span>
          <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onOpenCyber} title="Cyber Defense" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
            <Shield size={16} className="text-primary" />
          </button>
          <button onClick={onOpenAnalytics} title="Analytics" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
            <Activity size={16} className="text-safe" />
          </button>
          <button className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center">
            {user ? (
              <span className="text-primary font-black text-xs uppercase">{user.name?.[0]}</span>
            ) : (
              <User size={16} className="text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* ── Search Hub ── */}
      <div className="glass-strong rounded-3xl px-2 py-1 shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <LocationInput
          placeholder="Starting point..."
          value={origin?.label || ""}
          dotColor="#6366f1"
          icon={<Search size={14} className="text-slate-600" />}
          onSelect={onSetOrigin}
          onClear={() => onSetOrigin({ lat: 0, lng: 0, label: "" })}
        />
        <button
          onClick={onUseMyLocation}
          className="mx-3 mb-2 flex items-center gap-2 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
        >
          <MapPin size={11} /> Use My Live Location (GPS)
        </button>

        {/* Divider with swap icon */}
        <div className="mx-4 h-px bg-white/5" />

        <LocationInput
          placeholder="Where to? (e.g. Connaught Place)"
          value={dest?.label || ""}
          dotColor="#22c55e"
          icon={<Navigation size={14} className="text-slate-600" />}
          onSelect={onSetDest}
          onClear={() => onSetDest({ lat: 0, lng: 0, label: "" })}
        />

        {/* Calculate Button */}
        {origin?.lat && dest?.lat && (
          <button
            onClick={onCompute}
            className="w-full mt-2 mb-1 py-3 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}
          >
            <Shield size={16} /> Calculate Safest Route <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
