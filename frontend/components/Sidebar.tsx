"use client";
import { Shield, Navigation, AlertTriangle, BarChart2, Zap, LogIn, LogOut, CheckCircle, ShieldAlert } from "lucide-react";

interface SidebarProps {
  activeTab: "route"|"incidents"|"analytics"|"safety"|"demo";
  setActiveTab: (t: any) => void;
  user: any;
  liveAlerts: any[];
  onShowAuth: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const TABS = [
  { id:"route",     shortLabel:"Nav",      icon: Navigation    },
  { id:"incidents", shortLabel:"Incidents",icon: AlertTriangle  },
  { id:"analytics", shortLabel:"Data",     icon: BarChart2      },
  { id:"safety",    shortLabel:"Safety",   icon: Shield         },
  { id:"demo",      shortLabel:"AI Demo",  icon: Zap            },
] as const;

export default function Sidebar({ activeTab, setActiveTab, user, liveAlerts, onShowAuth, onLogout, children }: SidebarProps) {
  const latestAlert    = liveAlerts[0];
  const isHighRisk     = latestAlert?.riskLevel === "HIGH" || latestAlert?.riskLevel === "CRITICAL";
  const isSuspicious   = latestAlert?.isSuspicious;

  return (
    <aside className="sidebar">

      {/* ── Header ── */}
      <div style={{ padding:"18px 20px 0", flexShrink:0 }}>
        <div className="flex-between" style={{ marginBottom:14 }}>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:40, height:40, borderRadius:12,
              background:"linear-gradient(135deg, #6366f1, #4f46e5)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 24px rgba(99,102,241,0.6)", flexShrink:0,
            }}>
              <Shield size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily:"Space Grotesk", fontWeight:800, fontSize:18, letterSpacing:-0.5, lineHeight:1 }}>
                SafeRoutes
              </div>
              <div style={{ fontSize:9, color:"#6366f1", fontWeight:700, letterSpacing:1, marginTop:2 }}>
                AI NAVIGATOR v3.0
              </div>
            </div>
          </div>

          {/* Auth section */}
          {user ? (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {/* Trust indicator */}
              <div style={{
                display:"flex", alignItems:"center", gap:4, padding:"4px 8px",
                borderRadius:99, background:"rgba(34,197,94,0.12)",
                border:"1px solid rgba(34,197,94,0.35)",
              }}>
                <CheckCircle size={11} color="#22c55e" />
                <span style={{ fontSize:10, color:"#86efac", fontWeight:700 }}>
                  {user.name?.split(" ")[0]}
                </span>
              </div>
              <button className="btn btn-ghost" style={{ padding:"5px 8px" }} onClick={onLogout} title="Sign out">
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{
                display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
                borderRadius:99, background:"rgba(245,158,11,0.1)",
                border:"1px solid rgba(245,158,11,0.3)",
              }}>
                <ShieldAlert size={11} color="#f59e0b" />
                <span style={{ fontSize:9, color:"#fcd34d", fontWeight:700 }}>GUEST</span>
              </div>
              <button className="btn btn-ghost" style={{ padding:"5px 10px", fontSize:11 }} onClick={onShowAuth}>
                <LogIn size={12} /> Sign In
              </button>
            </div>
          )}
        </div>

        {/* ── Live feed status ── */}
        <div style={{
          display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
          background: isHighRisk ? "rgba(239,68,68,0.1)" : latestAlert ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.07)",
          border:`1px solid ${isHighRisk ? "rgba(239,68,68,0.3)" : latestAlert ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.2)"}`,
          borderRadius:10, marginBottom:14,
        }}>
          <div style={{
            width:8, height:8, borderRadius:"50%", flexShrink:0,
            background: isHighRisk ? "#ef4444" : latestAlert ? "#f59e0b" : "#22c55e",
            animation:"pulse-danger 1.5s infinite",
          }} />
          <span style={{ fontSize:11, flex:1, lineHeight:1.4,
            color: isHighRisk ? "#fca5a5" : latestAlert ? "#fcd34d" : "#86efac",
          }}>
            {latestAlert
              ? `${latestAlert.incidentType?.replace(/_/g," ")} — ${latestAlert.riskLevel} risk${isSuspicious ? " 🚩 flagged" : ""}`
              : "Live safety monitoring active"}
          </span>
          {liveAlerts.length > 0 && (
            <span style={{
              fontSize:10, background:"rgba(239,68,68,0.2)", color:"#fca5a5",
              padding:"2px 7px", borderRadius:99, fontWeight:700, flexShrink:0,
            }}>
              {liveAlerts.length}
            </span>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="tab-bar">
          {TABS.map(({ id, shortLabel, icon: Icon }) => (
            <button
              key={id}
              className={`tab-btn ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
              style={{ fontSize:10, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"6px 4px" }}
            >
              <Icon size={13} />
              {shortLabel}
            </button>
          ))}
        </div>

        <div className="divider" />
      </div>

      {/* ── Scrollable Panel ── */}
      <div className="panel-scroll" style={{ padding:"0 20px 24px" }}>
        {children}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding:"10px 20px", borderTop:"1px solid var(--border)", flexShrink:0,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span style={{ fontSize:9, color:"var(--text-muted)" }}>
          Orchestrator · ML Engine · JWT · Rate-limit
        </span>
        <span style={{ fontSize:9, color:"#6366f1", fontWeight:700 }}>SafeRoutes © 2025</span>
      </div>
    </aside>
  );
}
