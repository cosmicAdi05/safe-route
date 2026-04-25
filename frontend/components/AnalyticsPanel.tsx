"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";
import { analyticsApi, mlApi, type AnalyticsStats } from "@/lib/api";
import { TrendingUp, Users, MapPin, AlertTriangle, Brain, Cpu } from "lucide-react";

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

export default function AnalyticsPanel() {
  const [stats, setStats]   = useState<AnalyticsStats|null>(null);
  const [trend, setTrend]   = useState<{ _id:string; count:number }[]>([]);
  const [mlHealth, setMlHealth] = useState<{ model_loaded:boolean; version?:string; live_incidents?:number }|null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.stats().catch(() => null),
      analyticsApi.trend(7).catch(() => ({ trend:[] })),
      mlApi.health().catch(() => null),
    ]).then(([s, t, ml]) => {
      if (s) setStats(s as any);
      if (t) setTrend((t as any).trend ?? []);
      if (ml) setMlHealth(ml as any);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height:80 }} />)}
    </div>
  );

  return (
    <div className="anim-fade">
      {/* ── ML Status ── */}
      <div style={{
        padding:"10px 14px", borderRadius:10, marginBottom:16,
        background: mlHealth?.model_loaded ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
        border:`1px solid ${mlHealth?.model_loaded ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        display:"flex", alignItems:"center", gap:10,
      }}>
        <Brain size={16} color={mlHealth?.model_loaded ? "#22c55e" : "#ef4444"} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:700, color: mlHealth?.model_loaded ? "#22c55e" : "#ef4444" }}>
            ML Engine {mlHealth?.model_loaded ? "ONLINE" : "OFFLINE"}
            {mlHealth?.version && <span style={{ fontWeight:400, color:"#94a3b8", fontSize:11 }}> v{mlHealth.version}</span>}
          </div>
          <div style={{ fontSize:10, color:"#94a3b8" }}>
            GradientBoost · Time-Risk · Trust Scoring
            {mlHealth?.live_incidents !== undefined && ` · ${mlHealth.live_incidents} live incidents`}
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {stats && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
          {[
            { label:"Total Incidents",   value: stats.totalIncidents,    icon: AlertTriangle, color:"#ef4444" },
            { label:"Routes Computed",   value: stats.totalRoutes,       icon: MapPin,        color:"#6366f1" },
            { label:"Active Users",      value: stats.totalUsers,        icon: Users,         color:"#22c55e" },
            { label:"🚩 Suspicious",     value: (stats as any).suspiciousReports ?? 0, icon: Cpu, color:"#f97316" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card" style={{ borderColor:`rgba(${color==="#ef4444"?"239,68,68":color==="#6366f1"?"99,102,241":color==="#22c55e"?"34,197,94":"245,158,11"},0.2)` }}>
              <Icon size={14} color={color} style={{ margin:"0 auto 6px" }} />
              <div className="stat-value" style={{ color }}>{value ?? "—"}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Incident Trend ── */}
      {trend.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>
            7-Day Incident Trend
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trend}>
              <XAxis dataKey="_id" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background:"rgba(13,21,38,0.97)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:8, fontSize:12 }}
                labelStyle={{ color:"#94a3b8" }}
                itemStyle={{ color:"#818cf8" }}
              />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill:"#6366f1", r:3 }} activeDot={{ r:5, fill:"#818cf8" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Incident Type Breakdown ── */}
      {stats?.incidentsByType && stats.incidentsByType.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>
            Incident Breakdown
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.incidentsByType} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="_id" tick={{ fill:"#94a3b8", fontSize:10 }} width={100} tickFormatter={(v) => v.replace(/_/g," ")} />
              <Tooltip
                contentStyle={{ background:"rgba(13,21,38,0.97)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:8, fontSize:12 }}
                labelStyle={{ color:"#94a3b8" }}
                itemStyle={{ color:"#818cf8" }}
              />
              <Bar dataKey="count" radius={[0,4,4,0]}>
                {stats.incidentsByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Fallback empty ── */}
      {!stats && (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#475569" }}>
          <TrendingUp size={40} style={{ margin:"0 auto 12px", opacity:0.3 }} />
          <div style={{ fontSize:13 }}>Start the backend to see live analytics</div>
          <div style={{ fontSize:11, marginTop:6, color:"#94a3b8" }}>
            Run: <code style={{ color:"#818cf8" }}>node server.js</code>
          </div>
        </div>
      )}
    </div>
  );
}
