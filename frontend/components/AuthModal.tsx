"use client";
import { useState } from "react";
import { Shield, X, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Props { onAuth: (token:string, user:any) => void; onClose: () => void }

export default function AuthModal({ onAuth, onClose }: Props) {
  const [mode, setMode]         = useState<"login"|"register">("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = mode === "login"
        ? await authApi.login(email, password)
        : await authApi.register(name, email, password);
      onAuth(result.token, result.user);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:1000,
      background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div className="glass" style={{ width:"100%", maxWidth:420, padding:32, position:"relative", animation:"fadeIn 0.25s ease" }}>
        {/* Close */}
        <button onClick={onClose} style={{ position:"absolute", top:16, right:16, background:"none", border:"none", cursor:"pointer", color:"#475569", padding:4 }}>
          <X size={18} />
        </button>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:"linear-gradient(135deg,#6366f1,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", boxShadow:"0 0 24px rgba(99,102,241,0.5)" }}>
            <Shield size={22} color="#fff" />
          </div>
          <h2 style={{ fontFamily:"Space Grotesk", fontSize:22, fontWeight:700, marginBottom:4 }}>
            {mode === "login" ? "Welcome back" : "Join SafeRoutes"}
          </h2>
          <p style={{ color:"#94a3b8", fontSize:13 }}>
            {mode === "login" ? "Sign in to save routes and reports" : "Create an account to get started"}
          </p>
        </div>

        {/* Tab switch */}
        <div className="tab-bar" style={{ marginBottom:24 }}>
          <button className={`tab-btn ${mode==="login" ? "active":""}`} onClick={() => setMode("login")}>Sign In</button>
          <button className={`tab-btn ${mode==="register" ? "active":""}`} onClick={() => setMode("register")}>Register</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:"#94a3b8", marginBottom:6, display:"block" }}>Full Name</label>
              <input className="input" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:"#94a3b8", marginBottom:6, display:"block" }}>Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom:24, position:"relative" }}>
            <label style={{ fontSize:12, color:"#94a3b8", marginBottom:6, display:"block" }}>Password</label>
            <input className="input" type={showPwd ? "text":"password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight:44 }} />
            <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position:"absolute", right:12, top:34, background:"none", border:"none", cursor:"pointer", color:"#475569" }}>
              {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width:"100%", padding:13, fontSize:14 }} disabled={loading}>
            {loading ? "Please wait…" : mode==="login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
