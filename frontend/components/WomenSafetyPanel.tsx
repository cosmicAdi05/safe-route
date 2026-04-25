"use client";
import { useState, useEffect } from "react";
import { Shield, AlertTriangle, Moon, Clock, MapPin, Volume2, VolumeX, Info } from "lucide-react";
import { mlApi, safetyApi, type MLResult } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
  lat?: number;
  lng?: number;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}

const AREA_TYPES = [
  { code: 0, label: "Residential" },
  { code: 1, label: "Commercial" },
  { code: 2, label: "Industrial" },
  { code: 3, label: "Park / Open" },
  { code: 4, label: "Isolated" },
];

export default function WomenSafetyPanel({ lat, lng, enabled, onToggle }: Props) {
  const [hour, setHour]             = useState(new Date().getHours());
  const [areaType, setAreaType]     = useState(0);
  const [density, setDensity]       = useState(1.5);
  const [voiceAlert, setVoiceAlert] = useState(false);
  const [mlResult, setMlResult]     = useState<MLResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [hourlyForecast, setHourlyForecast] = useState<{ hour: number; predicted_score: number; risk_class: string }[]>([]);

  const riskColor = (r: string) =>
    r === "LOW" ? "#22c55e" : r === "MEDIUM" ? "#f59e0b" : r === "HIGH" ? "#ef4444" : "#dc2626";

  const analyzeRisk = async () => {
    setLoading(true);
    try {
      const result = await mlApi.predict({
        hour_of_day: hour,
        day_of_week: new Date().getDay(),
        incident_density: density,
        area_type_code: areaType,
        police_proximity_km: 1.2,
        avg_severity_recent: 2.0,
      });
      setMlResult(result);

      // Women safety mode: downgrade "MEDIUM" → "HIGH" for more caution
      if (enabled && result.risk_class === "MEDIUM") {
        result.risk_class = "HIGH";
        result.predicted_score = Math.min(result.predicted_score, 45);
        toast("⚠️ Women Safety Mode: risk threshold elevated", { icon: "🛡️" });
      }

      if (voiceAlert && result.risk_class !== "LOW") {
        const msg = `Warning: ${result.risk_class.toLowerCase()} risk area detected. Exercise caution.`;
        const utter = new SpeechSynthesisUtterance(msg);
        utter.rate = 0.9;
        window.speechSynthesis.speak(utter);
      }

      // Load hourly forecast
      const forecast = await mlApi.hourly({
        incident_density: density,
        area_type_code: areaType,
        police_proximity_km: 1.2,
        day_of_week: new Date().getDay(),
      });
      setHourlyForecast(forecast.hourly);
    } catch {
      // ML engine offline — use safety API fallback
      if (lat && lng) {
        const r = await safetyApi.score(lat, lng);
        setMlResult({
          risk_class: r.riskLevel,
          risk_probability: 0.75,
          predicted_score: r.score,
          factors_used: r.factors,
        });
      } else {
        toast.error("ML Engine offline — start ml_engine.py");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr   = h % 12 || 12;
    return `${hr}:00 ${ampm}`;
  };

  return (
    <div className="anim-fade" style={{ padding: "0 0 24px" }}>

      {/* Women Safety Toggle */}
      <div style={{
        padding: "12px 16px", borderRadius: 12, marginBottom: 16,
        background: enabled ? "rgba(236,72,153,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${enabled ? "rgba(236,72,153,0.4)" : "var(--border)"}`,
        display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
        transition: "all 0.25s",
      }} onClick={() => onToggle(!enabled)}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: enabled ? "linear-gradient(135deg,#ec4899,#be185d)" : "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: enabled ? "0 0 20px rgba(236,72,153,0.5)" : "none",
          transition: "all 0.25s",
        }}>
          <Shield size={18} color={enabled ? "#fff" : "#475569"} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: enabled ? "#f9a8d4" : "#f1f5f9" }}>
            Women Safety Mode
          </div>
          <div style={{ fontSize: 11, color: enabled ? "#ec4899" : "#475569", marginTop: 2 }}>
            {enabled ? "ACTIVE — elevated risk threshold" : "Tap to activate enhanced protection"}
          </div>
        </div>
        <div style={{
          width: 44, height: 24, borderRadius: 99, position: "relative",
          background: enabled ? "#ec4899" : "rgba(255,255,255,0.1)",
          transition: "background 0.25s", flexShrink: 0,
        }}>
          <div style={{
            position: "absolute", top: 3, left: enabled ? 23 : 3,
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }} />
        </div>
      </div>

      {/* Voice Alerts */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        borderRadius: 10, marginBottom: 16,
        background: voiceAlert ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${voiceAlert ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
        cursor: "pointer",
      }} onClick={() => setVoiceAlert(!voiceAlert)}>
        {voiceAlert ? <Volume2 size={15} color="#818cf8" /> : <VolumeX size={15} color="#475569" />}
        <span style={{ fontSize: 13, color: voiceAlert ? "#a5b4fc" : "#94a3b8" }}>
          Voice Alerts {voiceAlert ? "ON" : "OFF"}
        </span>
        <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>
          {voiceAlert ? "Speaks risk warnings aloud" : "Enable for audio alerts"}
        </span>
      </div>

      {/* ML Risk Controls */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
        ML Risk Predictor
      </div>

      {/* Hour slider */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: "#94a3b8" }}><Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Time</span>
          <span style={{ color: hour >= 21 || hour <= 6 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{formatHour(hour)}</span>
        </div>
        <input type="range" min={0} max={23} value={hour} onChange={(e) => setHour(+e.target.value)}
          style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4 }}>
          <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
        </div>
      </div>

      {/* Area type */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
          <MapPin size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Area Type
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {AREA_TYPES.map(({ code, label }) => (
            <button key={code} onClick={() => setAreaType(code)}
              style={{
                padding: "5px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                background: areaType === code ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${areaType === code ? "#6366f1" : "var(--border)"}`,
                color: areaType === code ? "#a5b4fc" : "#94a3b8",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Incident density */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: "#94a3b8" }}>Incident Density</span>
          <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{density.toFixed(1)} / km²</span>
        </div>
        <input type="range" min={0} max={10} step={0.5} value={density}
          onChange={(e) => setDensity(+e.target.value)}
          style={{ width: "100%", accentColor: "#ef4444", cursor: "pointer" }} />
      </div>

      {/* Predict Button */}
      <button className="btn btn-primary" style={{ width: "100%", marginBottom: 16 }}
        onClick={analyzeRisk} disabled={loading}>
        {loading
          ? <><span style={{ animation: "spin-slow 1s linear infinite", display: "inline-block" }}>⚙</span> Predicting…</>
          : "🤖 Run ML Risk Prediction"}
      </button>

      {/* ML Result */}
      {mlResult && (
        <div style={{
          padding: 16, borderRadius: 12, marginBottom: 16,
          background: `${riskColor(mlResult.risk_class)}15`,
          border: `1px solid ${riskColor(mlResult.risk_class)}55`,
        }} className="anim-fade">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>ML Predicted Risk</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: riskColor(mlResult.risk_class), lineHeight: 1.1, marginTop: 4 }}>
                {mlResult.risk_class}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: riskColor(mlResult.risk_class), lineHeight: 1 }}>
                {mlResult.predicted_score}
              </div>
              <div style={{ fontSize: 10, color: "#475569" }}>Safety Score</div>
            </div>
          </div>

          <div className="risk-meter" style={{ marginBottom: 10 }}>
            <div className="risk-meter-fill" style={{ width: `${mlResult.predicted_score}%`, background: riskColor(mlResult.risk_class) }} />
          </div>

          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Confidence: <b style={{ color: "#f1f5f9" }}>{(mlResult.risk_probability * 100).toFixed(0)}%</b>
            {" · "}Model: <b style={{ color: "#a5b4fc" }}>GradientBoost</b>
          </div>

          {/* Factors */}
          {mlResult.factors_used && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {Object.entries(mlResult.factors_used).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: "#475569", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                  <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hourly forecast mini-chart */}
      {hourlyForecast.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            24-Hour Safety Forecast
          </div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 48 }}>
            {hourlyForecast.map(({ hour: h, predicted_score, risk_class }) => (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{
                  width: "100%",
                  height: `${Math.round((predicted_score / 100) * 40)}px`,
                  background: riskColor(risk_class),
                  borderRadius: "2px 2px 0 0",
                  opacity: h === hour ? 1 : 0.45,
                  transition: "opacity 0.2s",
                  minHeight: 3,
                }} title={`${formatHour(h)}: ${predicted_score}/100`} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569", marginTop: 4 }}>
            <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
          </div>
        </div>
      )}

      {/* Safety Tips */}
      {enabled && (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.2)" }} className="anim-fade">
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f9a8d4", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Info size={13} /> Women Safety Tips
          </div>
          {[
            "Prefer Safest route after 8 PM",
            "Avoid isolated areas (area type code 4)",
            "Share live location with trusted contacts",
            "Use well-lit, crowded routes",
          ].map((tip, i) => (
            <div key={i} style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, display: "flex", gap: 8 }}>
              <span style={{ color: "#ec4899", flexShrink: 0 }}>•</span>{tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
