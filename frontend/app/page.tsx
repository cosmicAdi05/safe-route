"use client";
export default function HomePage() {
  // Redirect is handled via dynamic import of MapApp to avoid SSR issues with Leaflet
  return <MapApp />;
}

import dynamic from "next/dynamic";
const MapApp = dynamic(() => import("@/components/MapApp"), { ssr: false, loading: () => <AppLoader /> });

function AppLoader() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#070b14", gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:"50%", border:"3px solid rgba(99,102,241,0.2)", borderTop:"3px solid #6366f1", animation:"spin-slow 1s linear infinite" }} />
      <p style={{ color:"#94a3b8", fontSize:14 }}>Loading SafeRoutes AI…</p>
    </div>
  );
}
