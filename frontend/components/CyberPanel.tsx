"use client";
import { useState, useEffect } from "react";
import { ShieldAlert, Fingerprint, ShieldCheck, Eye, Upload, AlertCircle, FileSearch, Shield, Zap, Lock, Cpu } from "lucide-react";
import { cyberApi, type CyberAlert, type CyberAnalysis } from "@/lib/api";
import toast from "react-hot-toast";

export default function CyberPanel() {
  const [alerts, setAlerts] = useState<CyberAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [analysis, setAnalysis] = useState<CyberAnalysis | null>(null);
  
  // Reporting state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportType, setReportType] = useState("Deepfake");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 10000);
    return () => clearInterval(timer);
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await cyberApi.alerts();
      setAlerts(res.alerts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setAnalysis(null);
    
    // Simulate scan delay
    await new Promise(r => setTimeout(r, 2500));
    
    try {
      const res = await cyberApi.analyze("mock_url");
      setAnalysis(res);
      if (res.isAI) {
        toast.error("⚠️ AI Manipulation Detected!", { icon: "🛡️" });
        fetchAlerts();
      } else {
        toast.success("✅ Media Verified: Authentic Content");
      }
    } catch (err) {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await cyberApi.report({ type: reportType, description, severity: "High" });
      toast.success("Cyber Incident Reported to HQ");
      setShowReportForm(false);
      setDescription("");
      fetchAlerts();
    } catch (err) {
      toast.error("Failed to submit report");
    }
  };

  return (
    <div className="anim-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Shield color="#6366f1" size={20} />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Cyber Defense Hub</h2>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Deepfake Detection & Threat Mitigation</p>
        </div>
      </div>

      {/* ── Deepfake Scanner ── */}
      <div className="glass" style={{ padding: 20, border: "1px solid rgba(99,102,241,0.3)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 2, background: "linear-gradient(90deg, transparent, #6366f1, transparent)", animation: scanning ? "scanMove 1.5s infinite linear" : "none", opacity: scanning ? 1 : 0 }} />
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Fingerprint size={16} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Deepfake Analyzer</span>
          </div>
          {analysis && (
            <div style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: analysis.isAI ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)", color: analysis.isAI ? "#fca5a5" : "#86efac", fontWeight: 700 }}>
              {analysis.isAI ? "AI GENERATED" : "AUTHENTIC"}
            </div>
          )}
        </div>

        <div style={{ border: "2px dashed rgba(148,163,184,0.1)", borderRadius: 12, padding: 32, textAlign: "center", background: "rgba(13,21,38,0.4)", marginBottom: 16 }}>
          <Upload size={32} color="#475569" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Upload incident video/image to verify</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Supports MP4, MOV, JPG (Max 50MB)</div>
        </div>

        <button 
          onClick={handleScan}
          disabled={scanning}
          className="btn btn-primary" 
          style={{ width: "100%", gap: 10, height: 44 }}
        >
          {scanning ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderTopColor: "#fff" }} />
              Analyzing GAN Artifacts...
            </>
          ) : (
            <>
              <FileSearch size={18} />
              Start Neural Scan
            </>
          )}
        </button>

        {analysis && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Detection Confidence</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: analysis.isAI ? "#ef4444" : "#22c55e" }}>
                {Math.round(analysis.confidence * 100)}%
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {analysis.markers.map(m => (
                <span key={m} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(148,163,184,0.1)", color: "#94a3b8" }}>
                  {m.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Cyber Alerts Feed ── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={16} color="#f97316" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Digital Threat Feed</span>
          </div>
          <button 
            onClick={() => setShowReportForm(!showReportForm)}
            style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {showReportForm ? "Close Report" : "+ Report Cyber Threat"}
          </button>
        </div>

        {showReportForm && (
          <form onSubmit={handleReport} className="anim-fade" style={{ background: "rgba(99,102,241,0.05)", padding: 16, borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)", marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6 }}>Threat Type</label>
              <select 
                className="input" 
                value={reportType} 
                onChange={(e) => setReportType(e.target.value)}
                style={{ fontSize: 13 }}
              >
                <option value="Deepfake">Deepfake / AI Media</option>
                <option value="BotSwarm">Bot Swarm / Spam</option>
                <option value="Phishing">Social Engineering</option>
                <option value="FakeNews">Misinformation</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6 }}>Description</label>
              <textarea 
                className="input" 
                placeholder="Describe the digital threat..." 
                rows={3} 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ fontSize: 13, resize: "none" }}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 36, fontSize: 12 }}>
              Submit Defense Report
            </button>
          </form>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#475569", fontSize: 12 }}>
              No active digital threats detected
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className="glass anim-fade" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ 
                  width: 32, height: 32, borderRadius: 8, 
                  background: alert.type === 'Deepfake' ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {alert.type === 'Deepfake' ? <Cpu size={16} color="#ef4444" /> : <ShieldAlert size={16} color="#f97316" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{alert.type} Detected</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Status: <span style={{ color: alert.status === 'Blocked' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{alert.status}</span>
                    {alert.target && ` · Target: ${alert.target}`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Cyber Defense Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 12, background: "rgba(13,21,38,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Zap size={12} color="#eab308" />
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Uptime</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>99.9%</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: "rgba(13,21,38,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Lock size={12} color="#22c55e" />
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Defense</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e" }}>Active</div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scanMove {
          0% { transform: translateY(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(220px); opacity: 0; }
        }
        .spinner {
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top: 2px solid #fff;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
