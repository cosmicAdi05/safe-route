"use client";
import { useState, useRef } from "react";
import {
  Shield, ShieldAlert, Video, Upload, Zap, AlertTriangle,
  CheckCircle, XCircle, Eye, Flag, Send, Clock, TrendingUp,
  Cpu, Lock, Radio, FileVideo, Activity, ChevronDown, ChevronUp
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface ScanResult {
  isAI: boolean;
  confidence: number;
  markers: string[];
  verdict: string;
  verdictColor: string;
}

interface ThreatReport {
  id: string;
  type: string;
  description: string;
  status: "Investigating" | "Resolved" | "Escalated";
  timestamp: string;
}

// ── Mock threat feed ─────────────────────────────────────────────────────────
const LIVE_THREATS: ThreatReport[] = [
  { id: "T001", type: "Deepfake Video", description: "AI-generated protest footage circulating on WhatsApp", status: "Investigating", timestamp: "2m ago" },
  { id: "T002", type: "Fake Incident", description: "Fabricated robbery report near CP, Delhi", status: "Resolved", timestamp: "14m ago" },
  { id: "T003", type: "GPS Spoofing", description: "Route manipulation attempt detected in Mumbai zone", status: "Escalated", timestamp: "31m ago" },
  { id: "T004", type: "Deepfake Image", description: "Manipulated CCTV frame submitted as evidence", status: "Investigating", timestamp: "1h ago" },
  { id: "T005", type: "Bot Report Flood", description: "23 identical incident reports from single IP", status: "Resolved", timestamp: "2h ago" },
];

const STATUS_COLORS = {
  Investigating: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "#f59e0b" },
  Resolved:      { bg: "rgba(34,197,94,0.15)",  text: "#22c55e", dot: "#22c55e" },
  Escalated:     { bg: "rgba(239,68,68,0.15)",  text: "#ef4444", dot: "#ef4444" },
};

// ── Neural scan animation component ─────────────────────────────────────────
function ScannerAnimation({ scanning, result }: { scanning: boolean; result: ScanResult | null }) {
  return (
    <div className="relative flex items-center justify-center h-32 my-2">
      {/* Outer ring */}
      <div
        className="absolute w-28 h-28 rounded-full border-2"
        style={{
          borderColor: result ? (result.isAI ? "#ef4444" : "#22c55e") : "rgba(99,102,241,0.3)",
          animation: scanning ? "spin 3s linear infinite" : "none",
          borderTopColor: scanning ? "#6366f1" : "transparent",
        }}
      />
      {/* Middle ring */}
      <div
        className="absolute w-20 h-20 rounded-full border"
        style={{
          borderColor: scanning ? "rgba(99,102,241,0.2)" : "transparent",
          animation: scanning ? "spin 2s linear infinite reverse" : "none",
        }}
      />
      {/* Core icon */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center z-10"
        style={{
          background: result
            ? result.isAI ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)"
            : scanning ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
          border: `2px solid ${result ? (result.isAI ? "#ef4444" : "#22c55e") : scanning ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
        }}
      >
        {result ? (
          result.isAI
            ? <XCircle size={28} color="#ef4444" />
            : <CheckCircle size={28} color="#22c55e" />
        ) : (
          <Cpu size={24} color={scanning ? "#6366f1" : "#475569"} />
        )}
      </div>
    </div>
  );
}

export default function CyberPanel() {
  const [activeTab, setActiveTab] = useState<"scanner" | "threats" | "report">("scanner");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [expandedThreat, setExpandedThreat] = useState<string | null>(null);

  // Report form
  const [reportType, setReportType] = useState("Deepfake Video");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const runScan = async () => {
    if (!videoUrl && activeTab === "scanner") return;
    setScanning(true);
    setScanResult(null);

    // Simulate ML inference (replace with real API call)
    await new Promise(r => setTimeout(r, 2800));

    const isAI = Math.random() > 0.45;
    const confidence = 0.72 + Math.random() * 0.27;
    const result: ScanResult = {
      isAI,
      confidence,
      markers: isAI
        ? ["GAN Artifacts Detected", "Frequency Domain Anomaly", "Lip-Sync Mismatch", "Metadata Inconsistency"]
        : ["Natural Noise Distribution", "Consistent Metadata", "Authentic Pixel Patterns"],
      verdict: isAI ? "AI GENERATED" : "AUTHENTIC",
      verdictColor: isAI ? "#ef4444" : "#22c55e",
    };
    setScanResult(result);
    setScanning(false);
  };

  const sendReport = () => {
    if (!reportDesc) return;
    setReportSent(true);
    setTimeout(() => { setReportSent(false); setReportDesc(""); }, 3000);
  };

  const tabs = [
    { id: "scanner", label: "AI Scanner", icon: Video },
    { id: "threats",  label: "Live Threats", icon: Radio },
    { id: "report",   label: "Report",  icon: Flag },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Shield size={22} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-black font-display">Cyber Defense Hub</h2>
          <p className="text-[11px] text-slate-400">AI-powered threat intelligence & deepfake detection</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
          <span className="text-[10px] font-black text-safe uppercase tracking-wider">Online</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Threats Blocked", value: "1,247", icon: ShieldAlert, color: "#ef4444" },
          { label: "Videos Scanned",  value: "3,891", icon: FileVideo,   color: "#6366f1" },
          { label: "Reports Filed",   value: "208",   icon: Flag,        color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-2xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <s.icon size={16} style={{ color: s.color, margin: "0 auto 6px" }} />
            <div className="text-base font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all"
            style={{
              background: activeTab === t.id ? "rgba(99,102,241,0.2)" : "transparent",
              color: activeTab === t.id ? "#6366f1" : "#64748b",
              border: activeTab === t.id ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
            }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: AI SCANNER ── */}
      {activeTab === "scanner" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400 text-center">Paste a video URL to scan for AI/deepfake generation</p>

          <ScannerAnimation scanning={scanning} result={scanResult} />

          {scanResult && (
            <div className="text-center">
              <div className="text-2xl font-black mb-1" style={{ color: scanResult.verdictColor }}>{scanResult.verdict}</div>
              <div className="text-sm text-slate-400">Confidence: <span className="font-bold text-white">{(scanResult.confidence * 100).toFixed(1)}%</span></div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://... video URL to scan"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 text-white placeholder:text-slate-600"
            />
          </div>

          <button
            onClick={runScan}
            disabled={scanning}
            className="w-full py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}
          >
            {scanning ? (
              <><Cpu size={16} className="animate-spin" /> Scanning Neural Patterns...</>
            ) : (
              <><Zap size={16} /> Run AI Deepfake Scan</>
            )}
          </button>

          {scanResult && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Detection Markers</p>
              {scanResult.markers.map((m, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                  {scanResult.isAI
                    ? <XCircle size={14} color="#ef4444" className="flex-shrink-0" />
                    : <CheckCircle size={14} color="#22c55e" className="flex-shrink-0" />}
                  <span className="text-xs text-slate-300">{m}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: LIVE THREATS ── */}
      {activeTab === "threats" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
            <span className="text-xs font-bold text-slate-400">Live Threat Intelligence Feed</span>
          </div>
          {LIVE_THREATS.map(t => {
            const sc = STATUS_COLORS[t.status];
            const isExp = expandedThreat === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setExpandedThreat(isExp ? null : t.id)}
                className="w-full text-left p-4 rounded-2xl transition-all"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <AlertTriangle size={16} color={sc.text} className="flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-200 truncate">{t.type}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <Clock size={9} /> {t.timestamp}
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black" style={{ background: sc.bg, color: sc.text }}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExp ? <ChevronUp size={14} className="text-slate-600 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-600 flex-shrink-0" />}
                </div>
                {isExp && (
                  <div className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-400">{t.description}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── TAB: REPORT ── */}
      {activeTab === "report" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400">Report deepfakes, manipulated media, or cyber threats to the SafeRoute security team.</p>

          {reportSent ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle size={40} color="#22c55e" />
              <div className="text-base font-black text-safe">Report Submitted!</div>
              <div className="text-xs text-slate-400 text-center">Our security team will review within 24 hours.</div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">Threat Type</label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none text-white"
                >
                  {["Deepfake Video", "Fake Incident Report", "GPS Spoofing", "Bot Activity", "Manipulated Image", "Other"].map(o => (
                    <option key={o} value={o} style={{ background: "#0d1628" }}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe what you observed..."
                  value={reportDesc}
                  onChange={e => setReportDesc(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 text-white placeholder:text-slate-600 resize-none"
                />
              </div>
              <button
                onClick={sendReport}
                disabled={!reportDesc}
                className="w-full py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}
              >
                <Send size={16} /> Submit to CyberSecurity Team
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
