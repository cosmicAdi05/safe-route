"use client";
/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║  SafeRoutes — Intelligent Orchestration Demo Panel        ║
 * ║  Shows: Route A/B/C · Risk Level · Time Slider ·          ║
 * ║         Report Incident · Trust Indicator · Cost Formula  ║
 * ╚════════════════════════════════════════════════════════════╝
 */

import { useState, useCallback, useEffect } from "react";
import {
  Shield, AlertTriangle,
  Radio, CheckCircle, XCircle,
  Info, ChevronDown, ChevronUp, Loader,
} from "lucide-react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ── Types ──────────────────────────────────────────────────────────────────
interface Route {
  routeType: "fastest" | "safest" | "balanced";
  distance_km: number;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  safety_score: number;
  cost: number;
  estimatedMinutes: number;
  waypoints: { lat: number; lng: number }[];
}

interface OrchestrateResult {
  routes: { fastest: Route; safest: Route; balanced: Route };
  winner: "fastest" | "safest" | "balanced";
  explanation: string;
  meta: {
    source: string;
    hour: number;
    timeLabel: string;
    timeMultiplier: number;
    userTrust: number;
    trustLabel: string;
    liveIncidentPenalty: number;
    lambda: number;
    usingFallback: boolean;
  };
}

interface IncidentResult {
  trustStatus: string;
  effectiveSeverity: number;
  isSuspicious: boolean;
  updatedRisk?: { risk_level: string; risk_score: number; safety_score: number };
}

// ── Style helpers ──────────────────────────────────────────────────────────
const RISK_COLOR  = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444", CRITICAL: "#dc2626" } as const;
const RISK_BG     = { LOW: "rgba(34,197,94,0.1)", MEDIUM: "rgba(245,158,11,0.1)", HIGH: "rgba(239,68,68,0.1)", CRITICAL: "rgba(220,38,38,0.15)" } as const;
const RISK_EMOJI  = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴", CRITICAL: "🚨" } as const;
const ROUTE_COLOR = { fastest: "#6366f1", safest: "#22c55e", balanced: "#f59e0b" } as const;

type RiskLevel = keyof typeof RISK_COLOR;

function rColor(l?: string) { return RISK_COLOR[(l as RiskLevel) ?? "MEDIUM"] ?? "#f59e0b"; }
function rBg(l?: string)    { return RISK_BG[(l as RiskLevel) ?? "MEDIUM"] ?? RISK_BG.MEDIUM; }
function rEmoji(l?: string) { return RISK_EMOJI[(l as RiskLevel) ?? "MEDIUM"] ?? "🟡"; }

// ── Sub-components ─────────────────────────────────────────────────────────
function RiskBadge({ level }: { level?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 99,
      background: rBg(level), color: rColor(level),
      border: `1px solid ${rColor(level)}44`,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
    }}>
      {rEmoji(level)} {level ?? "MEDIUM"}
    </span>
  );
}

function RouteCard({ route, isWinner, onSelect, isSelected }: {
  route: Route; isWinner: boolean; onSelect: () => void; isSelected: boolean;
}) {
  const c = ROUTE_COLOR[route.routeType];
  const icons: Record<string, string> = { fastest: "⚡", safest: "🛡️", balanced: "⚖️" };
  const labels: Record<string, string> = { fastest: "Route A — Fastest", safest: "Route B — Safest", balanced: "Route C — Balanced" };
  const descs:  Record<string, string> = { fastest: "Direct path, min distance", safest: "Safe detour, max protection", balanced: "Speed/safety tradeoff" };

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 14, cursor: "pointer",
        border: `2px solid ${isSelected ? c : isWinner ? c + "66" : "var(--border)"}`,
        background: isSelected ? `${c}12` : isWinner ? `${c}06` : "rgba(255,255,255,0.02)",
        padding: 14, position: "relative", transition: "all 0.25s",
        boxShadow: isSelected ? `0 0 18px ${c}44` : "none",
      }}
    >
      {isWinner && (
        <div style={{
          position: "absolute", top: -10, right: 14,
          background: c, color: "#fff", fontSize: 9,
          fontWeight: 800, padding: "3px 9px", borderRadius: 99,
        }}>★ AI PICK</div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${c}22`, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17,
        }}>{icons[route.routeType]}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "Space Grotesk" }}>
            {labels[route.routeType]}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>{descs[route.routeType]}</div>
        </div>
        <RiskBadge level={route.risk_level} />
      </div>

      {/* Safety bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>
          <span>Safety Score</span>
          <span style={{ fontWeight: 700, color: rColor(route.risk_level) }}>{route.safety_score}/100</span>
        </div>
        <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 99, transition: "width 0.8s ease",
            width: `${route.safety_score}%`,
            background: `linear-gradient(90deg,${rColor(route.risk_level)}88,${rColor(route.risk_level)})`,
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {[
          { label: "Distance", value: `${route.distance_km} km` },
          { label: "ETA",      value: `${route.estimatedMinutes} min` },
          { label: "Risk",     value: `${(route.risk_score * 100).toFixed(0)}%` },
          { label: "Cost",     value: route.cost.toFixed(2) },
        ].map(({ label, value }) => (
          <div key={label} style={{
            textAlign: "center", padding: "6px 4px", borderRadius: 7,
            background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#f1f5f9" }}>{value}</div>
            <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
interface Props {
  origin: { lat: number; lng: number } | null;
  dest:   { lat: number; lng: number } | null;
  onRoutesComputed?: (fastest: any, safest: any) => void;
}

export default function DemoRoutePanel({ origin, dest, onRoutesComputed }: Props) {
  const [result, setResult]       = useState<OrchestrateResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [reporting, setReporting] = useState(false);

  // Controls
  const [lambda, setLambda]         = useState(5);
  const [timeOfDay, setTimeOfDay]   = useState(new Date().getHours());
  const [selectedRoute, setSelected] = useState<"fastest" | "safest" | "balanced">("safest");

  // Incident state
  const [incidentFeedback, setIncidentFeedback] = useState<IncidentResult | null>(null);
  const [showExplanation, setShowExplanation]   = useState(false);

  // Auth
  const [token, setToken]   = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("sr_token"));
    try {
      const u = JSON.parse(localStorage.getItem("sr_user") || "{}");
      setUserName(u.name ?? null);
    } catch {}
  }, []);

  const isVerified = !!token;

  // ── Time risk label ────────────────────────────────────────────
  const timeRiskLabel = () => {
    if (timeOfDay >= 22 || timeOfDay <= 5)  return { label: "NIGHT 🌙", danger: "HIGH", multi: "×1.4" };
    if (timeOfDay >= 18 && timeOfDay <= 21) return { label: "EVENING 🌆", danger: "MEDIUM", multi: "×1.2" };
    if (timeOfDay >= 5  && timeOfDay <= 8)  return { label: "EARLY MORNING 🌅", danger: "LOW", multi: "×1.1" };
    return { label: "DAYTIME ☀️", danger: "LOW", multi: "×1.0" };
  };
  const trl = timeRiskLabel();

  // ── Compute routes ─────────────────────────────────────────────
  const computeRoutes = useCallback(async () => {
    const o = origin || { lat: 28.6139, lng: 77.2090 };
    const d = dest   || { lat: 28.6517, lng: 77.1913 };
    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API}/api/routes/orchestrate`, {
        method: "POST", headers,
        body: JSON.stringify({
          originLat: o.lat, originLng: o.lng,
          destLat: d.lat,   destLng: d.lng,
          lambda, time: timeOfDay,
        }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data: OrchestrateResult = await res.json();
      setResult(data);
      setSelected(data.winner);
      onRoutesComputed?.(data.routes.fastest, data.routes.safest);
      toast.success(`✅ AI recommends ${data.winner.toUpperCase()} route`, { duration: 3000 });
    } catch (e: any) {
      toast.error("Backend or ML Engine offline. Check servers.");
    } finally { setLoading(false); }
  }, [origin, dest, lambda, timeOfDay, token, onRoutesComputed]);

  // ── Report Incident ────────────────────────────────────────────
  const reportIncident = useCallback(async () => {
    const o = origin || { lat: 28.6139, lng: 77.2090 };
    const d = dest   || { lat: 28.6517, lng: 77.1913 };
    const midLat = (o.lat + d.lat) / 2;
    const midLng = (o.lng + d.lng) / 2;
    setReporting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API}/api/incidents`, {
        method: "POST", headers,
        body: JSON.stringify({ lat: midLat, lng: midLng, type: "suspicious_activity", severity: 4,
          description: "Demo incident — route risk recalculating" }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data: IncidentResult = await res.json();
      setIncidentFeedback(data);
      toast.error(`🚨 Incident logged — Trust: ${data.trustStatus}`, { duration: 5000 });
      // Auto recalculate
      setTimeout(computeRoutes, 900);
    } catch {
      toast.error("Could not report incident — is backend running?");
    } finally { setReporting(false); }
  }, [origin, dest, token, computeRoutes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ══ TRUST INDICATOR ════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        borderRadius: 10, border: `1px solid ${isVerified ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)"}`,
        background: isVerified ? "rgba(34,197,94,0.06)" : "rgba(245,158,11,0.06)",
      }}>
        {isVerified
          ? <CheckCircle size={16} color="#22c55e" />
          : <XCircle    size={16} color="#f59e0b" />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: isVerified ? "#86efac" : "#fcd34d" }}>
            {isVerified ? `Verified User — ${userName ?? "User"}` : "Guest / Low Trust"}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            {isVerified ? "Trust Score: 80+ — full incident weight" : "Trust Score: 40 — reduced incident impact"}
          </div>
        </div>
        {!isVerified && (
          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>Sign In →</span>
        )}
      </div>

      {/* ══ CONTROLS GRID ═══════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* Lambda */}
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: "#94a3b8" }}>Safety λ</span>
            <span style={{ fontWeight: 800, color: "#818cf8" }}>{lambda}</span>
          </div>
          <input type="range" min={0} max={10} step={0.5} value={lambda}
            onChange={e => setLambda(+e.target.value)}
            style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }} />
          <div style={{ fontSize: 9, color: "#475569", marginTop: 4, textAlign: "center" }}>
            Cost = dist + ({lambda} × risk)
          </div>
        </div>

        {/* Time slider */}
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: "#94a3b8" }}>Time 🕐</span>
            <span style={{ fontWeight: 800, color: "#fbbf24" }}>{timeOfDay}:00</span>
          </div>
          <input type="range" min={0} max={23} step={1} value={timeOfDay}
            onChange={e => setTimeOfDay(+e.target.value)}
            style={{ width: "100%", accentColor: "#f59e0b", cursor: "pointer" }} />
          <div style={{ fontSize: 9, marginTop: 4, textAlign: "center", color: rColor(trl.danger as any) }}>
            {trl.label} {trl.multi}
          </div>
        </div>
      </div>

      {/* ══ COMPUTE BUTTON ══════════════════════════════════════ */}
      <button className="btn btn-primary" style={{ padding: "13px", fontSize: 14 }}
        onClick={computeRoutes} disabled={loading} id="demo-compute-btn">
        {loading
          ? <><Loader size={14} style={{ animation: "spin-slow 1s linear infinite" }} /> Orchestrating…</>
          : <><Shield size={14} /> Compute Smart Routes</>}
      </button>

      {/* ══ RESULTS ═════════════════════════════════════════════ */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} className="anim-fade">

          {/* Meta banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            borderRadius: 8, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <Info size={12} color="#818cf8" />
            <div style={{ fontSize: 10, color: "#94a3b8", flex: 1 }}>
              <b style={{ color: "#818cf8" }}>Source:</b> {result.meta.source} &nbsp;|&nbsp;
              <b style={{ color: "#818cf8" }}>Trust:</b> {result.meta.trustLabel} ({result.meta.userTrust}%) &nbsp;|&nbsp;
              <b style={{ color: rColor(result.meta.liveIncidentPenalty > 0.1 ? "HIGH" : "LOW") }}>
                Live incidents: {result.meta.liveIncidentPenalty.toFixed(2)}
              </b>
            </div>
          </div>

          {/* Route cards */}
          {(["fastest", "safest", "balanced"] as const).map(t => (
            <RouteCard
              key={t}
              route={result.routes[t]}
              isWinner={result.winner === t}
              isSelected={selectedRoute === t}
              onSelect={() => {
                setSelected(t);
                onRoutesComputed?.(result.routes.fastest, result.routes.safest);
              }}
            />
          ))}

          {/* AI explanation toggle */}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "8px" }}
            onClick={() => setShowExplanation(v => !v)}
          >
            <Info size={11} /> AI Decision Explanation
            {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showExplanation && (
            <div style={{
              padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.2)", fontSize: 11, color: "#94a3b8",
              lineHeight: 1.8,
            }} className="anim-fade">
              {result.explanation}
            </div>
          )}
        </div>
      )}

      {/* ══ INCIDENT REPORTING ══════════════════════════════════ */}
      <div style={{
        borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)",
        background: "rgba(239,68,68,0.05)", padding: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Radio size={12} color="#ef4444" /> Live Incident Reporting
        </div>
        <div style={{ fontSize: 10, color: "#475569", marginBottom: 12 }}>
          Demonstrates: Fake Detection · Trust Weighting · Real-time Recalculation
        </div>

        {/* Incident feedback */}
        {incidentFeedback && (
          <div style={{
            padding: "8px 12px", borderRadius: 8, marginBottom: 10,
            background: incidentFeedback.isSuspicious ? "rgba(220,38,38,0.12)" : rBg(incidentFeedback.updatedRisk?.risk_level),
            border: `1px solid ${incidentFeedback.isSuspicious ? "#dc262655" : rColor(incidentFeedback.updatedRisk?.risk_level) + "44"}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: incidentFeedback.isSuspicious ? "#fca5a5" : rColor(incidentFeedback.updatedRisk?.risk_level) }}>
              {incidentFeedback.isSuspicious ? "🚩 FLAGGED AS SUSPICIOUS — impact reduced 90%" : `✅ Incident accepted — ${incidentFeedback.trustStatus}`}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
              Effective severity: {incidentFeedback.effectiveSeverity}/5 &nbsp;|&nbsp;
              Risk: {incidentFeedback.updatedRisk?.risk_level ?? "MEDIUM"}
            </div>
          </div>
        )}

        <button
          className="btn btn-danger"
          style={{ width: "100%", padding: "11px" }}
          onClick={reportIncident}
          disabled={reporting}
          id="report-incident-demo-btn"
        >
          {reporting
            ? <><Loader size={13} style={{ animation: "spin-slow 1s linear infinite" }} /> Reporting…</>
            : <><AlertTriangle size={13} /> Report Incident on Route</>}
        </button>
      </div>

      {/* ══ EMPTY STATE ═════════════════════════════════════════ */}
      {!result && !loading && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#475569" }}>
          <Shield size={40} style={{ margin: "0 auto 12px", opacity: 0.18, display: "block" }} />
          <div style={{ fontSize: 12, marginBottom: 5 }}>Set λ and time, then click Compute</div>
          <div style={{ fontSize: 10, color: "#374151" }}>
            Fastest · Safest · Balanced — all from one AI orchestrator
          </div>
        </div>
      )}
    </div>
  );
}
