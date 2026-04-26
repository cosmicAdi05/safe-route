"use client";
import { useState } from "react";
import { Phone, Share2, AlertCircle, X, ShieldAlert, Heart, Radio } from "lucide-react";
import toast from "react-hot-toast";

export default function SOSButton() {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { label: "Emergency 112", icon: Phone, color: "bg-red-500", onClick: () => toast.error("Calling Emergency Services...") },
    { label: "Share Live Location", icon: Share2, color: "bg-blue-500", onClick: () => toast.success("Location link copied to clipboard") },
    { label: "Trigger Silent Alert", icon: Radio, color: "bg-indigo-500", onClick: () => toast.success("Silent alert sent to nearest safe-haven") },
  ];

  return (
    <div className="fixed bottom-[180px] right-6 z-[1100] flex flex-col items-end gap-3">
      
      {/* Action Menu */}
      {isOpen && (
        <div className="flex flex-col gap-3 mb-2 anim-fade">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`flex items-center gap-3 px-5 py-3 rounded-full text-white font-bold shadow-lg transform transition-all duration-300 hover:scale-105 active:scale-95 ${action.color}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <action.icon size={18} />
              <span className="text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main SOS Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all duration-500 transform ${
          isOpen ? "bg-slate-800 rotate-90" : "bg-red-600 animate-pulse-red hover:scale-110"
        }`}
      >
        {isOpen ? (
          <X size={32} color="#fff" />
        ) : (
          <ShieldAlert size={32} color="#fff" />
        )}
      </button>

      {/* Label (only when closed) */}
      {!isOpen && (
        <div className="bg-red-600/10 border border-red-600/30 px-3 py-1 rounded-full text-[10px] font-black text-red-500 uppercase tracking-widest mr-1">
          Emergency SOS
        </div>
      )}
    </div>
  );
}
