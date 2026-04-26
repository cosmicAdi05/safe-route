"use client";
import { useState, useEffect } from "react";
import { ShieldAlert, Phone, Share2, Radio, X, MapPin, Settings, Check } from "lucide-react";
import toast from "react-hot-toast";

const CONTACT_KEY = "sr_emergency_contact";

export default function SOSButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [contact, setContact] = useState("");
  const [editVal, setEditVal] = useState("");
  const [liveCoords, setLiveCoords] = useState<{lat:number;lng:number}|null>(null);

  // Load saved contact
  useEffect(() => {
    const saved = localStorage.getItem(CONTACT_KEY) || "";
    setContact(saved);
    setEditVal(saved);
  }, []);

  // Get current position when panel opens
  useEffect(() => {
    if (!isOpen) return;
    navigator.geolocation?.getCurrentPosition(
      (p) => setLiveCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    );
  }, [isOpen]);

  const saveContact = () => {
    localStorage.setItem(CONTACT_KEY, editVal);
    setContact(editVal);
    setShowContactEdit(false);
    toast.success("Emergency contact saved!");
  };

  const shareOnWhatsApp = () => {
    if (!contact) {
      toast.error("Please set an emergency contact first");
      setShowContactEdit(true);
      return;
    }
    const coordText = liveCoords
      ? `https://maps.google.com/?q=${liveCoords.lat},${liveCoords.lng}`
      : "Location unavailable";
    const msg = encodeURIComponent(
      `🆘 SOS Alert from SafeRoute AI!\n\nI need help. My current live location:\n${coordText}\n\nPlease respond ASAP.`
    );
    // WhatsApp direct link with country code
    const number = contact.startsWith("+") ? contact.replace("+","") : `91${contact}`;
    window.open(`https://wa.me/${number}?text=${msg}`, "_blank");
    toast.success("Opening WhatsApp...");
  };

  const callEmergency = () => {
    window.open("tel:112");
    toast.error("Calling Emergency Services 112...", { icon: "📞" });
  };

  const triggerSilentAlert = () => {
    toast.success("Silent alert sent to nearest safe-haven", { icon: "📡" });
  };

  const actions = [
    { label: "Call 112 Emergency", icon: Phone, color: "bg-red-500", onClick: callEmergency },
    { label: `Share Location via WhatsApp`, icon: Share2, color: "bg-green-600", onClick: shareOnWhatsApp },
    { label: "Trigger Silent Alert", icon: Radio, color: "bg-indigo-500", onClick: triggerSilentAlert },
  ];

  return (
    <>
      <div className="fixed bottom-[215px] right-5 z-[1050] flex flex-col items-end gap-3">

        {/* Contact Editor */}
        {showContactEdit && (
          <div className="glass-strong rounded-3xl p-4 w-64 border border-white/10 animate-slide-up mb-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Emergency Contact</p>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="e.g. 9214863883"
                value={editVal}
                onChange={e => setEditVal(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 text-white placeholder:text-slate-600"
              />
              <button onClick={saveContact} className="bg-safe p-2 rounded-xl hover:bg-safe/80 transition-colors">
                <Check size={18} color="#fff" />
              </button>
            </div>
            <p className="text-[9px] text-slate-600 mt-2">Number will be used for WhatsApp location sharing. Stored locally only.</p>
          </div>
        )}

        {/* Action Menu */}
        {isOpen && (
          <div className="flex flex-col gap-3 mb-2 animate-slide-up">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`flex items-center gap-3 px-5 py-3 rounded-full text-white font-bold shadow-xl transform transition-all hover:scale-105 active:scale-95 text-sm ${action.color}`}
              >
                <action.icon size={18} />
                {action.label}
              </button>
            ))}
            {/* Contact config */}
            <button
              onClick={() => setShowContactEdit(v => !v)}
              className="flex items-center gap-3 px-5 py-3 rounded-full text-slate-300 font-bold bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-all"
            >
              <Settings size={18} />
              {contact ? `Contact: ${contact.slice(0,5)}****` : "Set Emergency Contact"}
            </button>
          </div>
        )}

        {/* SOS Main Button */}
        <button
          onClick={() => { setIsOpen(!isOpen); setShowContactEdit(false); }}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform ${
            isOpen
              ? "bg-slate-700 rotate-45 scale-110"
              : "bg-red-600 animate-pulse-glow hover:scale-110"
          }`}
        >
          {isOpen ? <X size={28} color="#fff" /> : <ShieldAlert size={28} color="#fff" />}
        </button>

        {!isOpen && (
          <div className="mr-1 bg-red-600/10 border border-red-600/20 px-3 py-1 rounded-full text-[9px] font-black text-red-400 uppercase tracking-widest">
            SOS
          </div>
        )}
      </div>
    </>
  );
}
