// hooks/useSocket.ts — Real-time socket hook
"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface LiveAlert {
  id: number;
  lat: number;
  lng: number;
  safetyScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  incidentType: string;
  severity: number;
  timestamp: string;
}

export function useSocket() {
  const [connected, setConnected]   = useState(false);
  const [alerts, setAlerts]         = useState<LiveAlert[]>([]);
  const socketRef                   = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket"], reconnection: true });
    socketRef.current = socket;

    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("safety-update", (data: Omit<LiveAlert, "id">) => {
      setAlerts((prev) => [{ ...data, id: Date.now() }, ...prev.slice(0, 19)]);
    });

    return () => { socket.disconnect(); };
  }, []);

  return { connected, alerts, socket: socketRef.current };
}
