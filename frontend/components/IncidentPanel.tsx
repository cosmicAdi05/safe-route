"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, Plus, MapPin, RefreshCw, ChevronUp, ChevronDown, ShieldAlert, CheckCircle, XCircle, Lock } from "lucide-react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const INCIDENT_TYPES = [
  { value:"theft",               label:"Theft/Robbery",  emoji:"🔓" },
  { value:"assault",             label:"Assault",         emoji:"👊" },
  { value:"harassment",          label:"Harassment",      emoji:"🚨" },
  { value:"eve_teasing",         label:"Eve Teasing",     emoji:"⚠️" },
  { value:"accident",            label:"Road Accident",   emoji:"🚗" },
  { value:"poor_lighting",       label:"Poor Lighting",   emoji:"💡" },
  { value:"suspicious_activity", label:"Suspicious",      emoji:"👀" },
  { value:"road_hazard",         label:"Road Hazard",     emoji:"🚧" },
  { value:"crowd_surge",         label:"Crowd Surge",     emoji:"👥" },
  { value:"other",               label:"Other",           emoji:"📍" },
];

const SEVERITY_LABELS = ["","Minor","Low","Moderate","High","Critical"];
const SEVERITY_COLORS = ["","#22c55e","#84cc16","#f59e0b","#ef4444","#dc2626"];

// ── Trust badge helper ─────────────────────────────────────────────────────
function TrustBadge({ status, isSuspicious }: { status?: string; isSuspicious?: boolean }) {
  if (!status) return null;
  const isFlagged  = isSuspicious;
  const isVerified = status.toLowerCase().includes("verified") || status.toLowerCase().includes("highly");
  const color  = isFlagged ? "#dc2626" : isVerified ? "#22c55e" : "#f59e0b";
  const bg     = isFlagged ? "rgba(220,38,38,0.12)" : isVerified ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)";
  const icon   = isFlagged ? <ShieldAlert size={11} /> : isVerified ? <CheckCircle size={11} /> : <XCircle size={11} />;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"2px 8px", borderRadius:99,
      background: bg, color, border:`1px solid ${color}44`,
      fontSize:10, fontWeight:700,
    }}>
      {icon} {status}
    </span>
  );
}

interface Incident {
  _id: string; type: string; severity: number; description?: string;
  createdAt: string; upvotes: number; trustStatus?: string; isSuspicious?: boolean;
  location: { coordinates: [number, number] };
}

interface Props {
  incidents: Incident[];
  pickingMode: any; setPickingMode: any;
  clickedPoint: {lat:number;lng:number}|null; setClickedPoint: any;
  onRefresh: () => void;
}

export default function IncidentPanel({ incidents, pickingMode, setPickingMode, clickedPoint, setClickedPoint, onRefresh }: Props) {
  const [form, setForm]         = useState<{ type?: string; severity: number; description?: string }>({ severity: 3 });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [token, setToken]       = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("sr_token"));
    try { setUserName(JSON.parse(localStorage.getItem("sr_user") || "{}").name ?? null); } catch {}
  }, []);

  const isVerified = !!token;

  const handleSubmit = async () => {
    if (!clickedPoint) return toast.error("Click the map to set incident location");
    if (!form.type)    return toast.error("Select incident type");
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API}/api/incidents`, {
        method: "POST", headers,
        body: JSON.stringify({
          type: form.type, severity: form.severity,
          lat: clickedPoint.lat, lng: clickedPoint.lng,
          description: form.description, anonymous: true,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setLastResult(data);

      if (data.isSuspicious) {
        toast.error("🚩 Flagged as suspicious — impact reduced");
      } else {
        toast.success(`✅ Reported as ${data.trustStatus} — risk updating…`);
      }

      setForm({ severity: 3 });
      setClickedPoint(null);
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    } finally { setSubmitting(false); }
  };

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff < 1) return "just now";
    if (diff < 60) return `${Math.round(diff)}m ago`;
    return `${Math.round(diff / 60)}h ago`;
  };

  return (
    <div className="anim-fade">

      {/* ── Trust indicator strip ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
        borderRadius:9, marginBottom:14,
        background: isVerified ? "rgba(34,197,94,0.06)" : "rgba(245,158,11,0.06)",
        border:`1px solid ${isVerified ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
      }}>
        {isVerified ? <Lock size={13} color="#22c55e" /> : <ShieldAlert size={13} color="#f59e0b" />}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color: isVerified ? "#86efac" : "#fcd34d" }}>
            {isVerified ? `Verified Reporter — ${userName ?? "User"}` : "Guest Reporter — Low Trust"}
          </div>
          <div style={{ fontSize:10, color:"#94a3b8" }}>
            {isVerified
              ? "Trust Score 80+ · Your reports carry full weight"
              : "Trust Score 40 · Sign in for higher impact reports"}
          </div>
        </div>
      </div>

      {/* ── Last submission feedback ── */}
      {lastResult && (
        <div style={{
          padding:"10px 12px", borderRadius:9, marginBottom:12,
          background: lastResult.isSuspicious ? "rgba(220,38,38,0.08)" : "rgba(34,197,94,0.06)",
          border:`1px solid ${lastResult.isSuspicious ? "rgba(220,38,38,0.3)" : "rgba(34,197,94,0.3)"}`,
        }} className="anim-fade">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color: lastResult.isSuspicious ? "#fca5a5" : "#86efac" }}>
              {lastResult.isSuspicious ? "🚩 Flagged as Suspicious" : "✅ Report Accepted"}
            </span>
            <TrustBadge status={lastResult.trustStatus} isSuspicious={lastResult.isSuspicious} />
          </div>
          <div style={{ fontSize:10, color:"#94a3b8" }}>
            Effective severity: <b style={{ color:"#f1f5f9" }}>{lastResult.effectiveSeverity}/5</b> &nbsp;|&nbsp;
            {lastResult.isSuspicious
              ? "Impact reduced 90% (spam detection triggered)"
              : `Risk updated → ${lastResult.updatedRisk?.risk_level ?? "MEDIUM"}`}
          </div>
        </div>
      )}

      {/* ── Report Button ── */}
      <button
        className="btn btn-danger"
        style={{ width:"100%", marginBottom:14 }}
        onClick={() => setShowForm(!showForm)}
        id="report-incident-btn"
      >
        <Plus size={14} /> Report Incident
        {showForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* ── Incident Form ── */}
      {showForm && (
        <div style={{ marginBottom:20, padding:14, background:"rgba(239,68,68,0.06)", borderRadius:12, border:"1px solid rgba(239,68,68,0.2)" }} className="anim-fade">

          {/* Location picker */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Location</label>
            <div style={{ display:"flex", gap:8, marginTop:6 }}>
              <div style={{
                flex:1, padding:"9px 12px", borderRadius:8,
                background:"rgba(255,255,255,0.03)",
                border:`1px solid ${pickingMode==="incident" ? "#ef4444" : "var(--border)"}`,
                fontSize:12, color: clickedPoint ? "#f1f5f9" : "#475569",
              }}>
                {clickedPoint ? `${clickedPoint.lat.toFixed(4)}, ${clickedPoint.lng.toFixed(4)}` : "Click map to pin location…"}
              </div>
              <button
                className={`btn ${pickingMode==="incident" ? "btn-danger" : "btn-ghost"}`}
                style={{ padding:"9px 12px", flexShrink:0 }}
                onClick={() => setPickingMode(pickingMode==="incident" ? null : "incident")}
              >
                <MapPin size={13} />
              </button>
            </div>
          </div>

          {/* Incident type grid */}
          <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Type</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:6, marginBottom:12 }}>
            {INCIDENT_TYPES.map((t) => (
              <button key={t.value}
                onClick={() => setForm(f => ({ ...f, type: t.value }))}
                style={{
                  padding:"7px 10px", borderRadius:8, fontSize:12, cursor:"pointer", textAlign:"left",
                  background: form.type===t.value ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.03)",
                  border:`1px solid ${form.type===t.value ? "#ef4444" : "var(--border)"}`,
                  color: form.type===t.value ? "#fca5a5" : "#94a3b8",
                  fontFamily:"inherit", transition:"all 0.15s",
                }}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {/* Severity */}
          <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Severity — <span style={{ color: SEVERITY_COLORS[form.severity] }}>{SEVERITY_LABELS[form.severity]}</span>
          </label>
          <div style={{ display:"flex", gap:6, marginTop:6, marginBottom:12 }}>
            {[1,2,3,4,5].map(s => (
              <button key={s}
                onClick={() => setForm(f => ({ ...f, severity: s }))}
                style={{
                  flex:1, padding:"8px", borderRadius:8, fontSize:12, cursor:"pointer",
                  background: form.severity===s ? `${SEVERITY_COLORS[s]}22` : "rgba(255,255,255,0.03)",
                  border:`1px solid ${form.severity===s ? SEVERITY_COLORS[s] : "var(--border)"}`,
                  color: form.severity===s ? SEVERITY_COLORS[s] : "#94a3b8",
                  fontFamily:"inherit", fontWeight: form.severity===s ? 700 : 400,
                }}
              >{s}</button>
            ))}
          </div>

          {/* Description */}
          <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Description (optional)</label>
          <textarea
            className="input"
            style={{ marginTop:6, height:68, resize:"none", marginBottom:12 }}
            placeholder="Brief description…"
            value={form.description || ""}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />

          {/* Cybersecurity notice */}
          <div style={{ fontSize:10, color:"#475569", marginBottom:10, padding:"7px 10px", borderRadius:7, background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.15)" }}>
            🔒 <b style={{ color:"#818cf8" }}>Cybersecurity:</b> Reports are weighted by your trust score. Spam clusters are auto-detected and flagged.
          </div>

          <button
            className="btn btn-danger"
            style={{ width:"100%" }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      )}

      {/* ── Nearby Incidents List ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", letterSpacing:"0.07em", textTransform:"uppercase" }}>
          Nearby ({incidents.length})
        </div>
        <button className="btn btn-ghost" style={{ padding:"5px 8px", fontSize:11 }} onClick={onRefresh}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {incidents.length === 0 ? (
        <div style={{ textAlign:"center", padding:"28px 0", color:"#475569" }}>
          <AlertTriangle size={32} style={{ margin:"0 auto 10px", opacity:0.3, display:"block" }} />
          <div style={{ fontSize:13 }}>No active incidents in this area</div>
        </div>
      ) : (
        incidents.map(inc => {
          const color = inc.severity >= 4 ? "#ef4444" : inc.severity >= 3 ? "#f59e0b" : "#22c55e";
          return (
            <div key={inc._id} style={{
              padding:"12px 14px", borderRadius:10, marginBottom:8,
              background: inc.isSuspicious ? "rgba(220,38,38,0.05)" : "rgba(255,255,255,0.03)",
              border:`1px solid ${inc.isSuspicious ? "rgba(220,38,38,0.25)" : `rgba(${inc.severity>=4?"239,68,68":inc.severity>=3?"245,158,11":"34,197,94"},0.2)`}`,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", background:color, flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:600, textTransform:"capitalize" }}>
                    {inc.type.replace(/_/g," ")}
                  </span>
                </div>
                {inc.trustStatus && <TrustBadge status={inc.trustStatus} isSuspicious={inc.isSuspicious} />}
              </div>
              {inc.description && <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, marginLeft:16 }}>{inc.description}</div>}
              <div style={{ display:"flex", gap:10, fontSize:10, color:"#475569", marginLeft:16 }}>
                <span>{"⚡".repeat(inc.severity)} sev.{inc.severity}</span>
                <span>{timeAgo(inc.createdAt)}</span>
                <span>👍 {inc.upvotes}</span>
                {inc.isSuspicious && <span style={{ color:"#fca5a5" }}>🚩 Suspicious</span>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
