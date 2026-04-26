// lib/api.ts — centralised API client (v3.0 — fully connected)
const API = process.env.NEXT_PUBLIC_API_URL || "https://saferoutes-backend.onrender.com";
const ML  = process.env.NEXT_PUBLIC_ML_URL  || "https://saferoutes-ml.onrender.com";

// ── Auth token helpers ─────────────────────────────────────────────────────
export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("sr_token") : null;
}
export function getStoredUser(): User | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sr_user") : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getHeaders(extra?: Record<string, string>) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res  = await fetch(url, { headers: getHeaders(), ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>(`${API}/api/auth/login`, {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>(`${API}/api/auth/register`, {
      method: "POST", body: JSON.stringify({ name, email, password }),
    }),
  me: () => request<{ user: User }>(`${API}/api/auth/me`),
};

// ── Routes — Orchestration Layer ───────────────────────────────────────────
export const routeApi = {
  /**
   * NEW: Full Orchestration endpoint.
   * Aggregates ML risk + time risk + live incidents + trust score.
   * Returns: fastest / safest / balanced + winner + explanation + meta.
   */
  orchestrate: (params: OrchestrateParams) =>
    request<OrchestrateResult>(`${API}/api/routes/orchestrate`, {
      method: "POST", body: JSON.stringify(params),
    }),

  /**
   * Legacy compute — keeps MapApp "Navigate" tab working.
   * Internally calls the same orchestration logic on the backend.
   */
  compute: (params: RouteParams) =>
    request<{ routes: RouteSet; timestamp: string }>(`${API}/api/routes/compute`, {
      method: "POST", body: JSON.stringify(params),
    }),

  history: () => request<{ routes: RouteResult[] }>(`${API}/api/routes/history`),
};

// ── Incidents ──────────────────────────────────────────────────────────────
export const incidentApi = {
  /**
   * Report an incident.
   * Backend applies: trust weighting, fake detection, ML risk update, socket broadcast.
   * Returns: incident + trustStatus + effectiveSeverity + isSuspicious + updatedRisk
   */
  report: (data: IncidentPayload) =>
    request<IncidentReportResult>(`${API}/api/incidents`, {
      method: "POST", body: JSON.stringify(data),
    }),
  nearby: (lat: number, lng: number, radius = 2000) =>
    request<{ incidents: Incident[]; count: number }>(
      `${API}/api/incidents/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    ),
  heatmap: (hours = 24) =>
    request<{ points: HeatPoint[]; count: number }>(
      `${API}/api/incidents/heatmap?hours=${hours}`
    ),
  upvote: (id: string) =>
    request<{ incident: Incident }>(`${API}/api/incidents/${id}/upvote`, { method: "POST" }),
};

// ── Safety ─────────────────────────────────────────────────────────────────
export const safetyApi = {
  score: (lat: number, lng: number) =>
    request<SafetyResult>(`${API}/api/safety/score?lat=${lat}&lng=${lng}`),
  batch: (points: { lat: number; lng: number }[]) =>
    request<{ results: (SafetyResult & { lat: number; lng: number })[] }>(
      `${API}/api/safety/batch`, { method: "POST", body: JSON.stringify({ points }) }
    ),
  /** 24-hour time-based risk index from backend */
  hourly: () =>
    request<{ hourly: HourlySafety[] }>(`${API}/api/safety/hourly`),
};

// ── Zones ──────────────────────────────────────────────────────────────────
export const zoneApi = {
  nearby: (lat: number, lng: number, radius = 2000) =>
    request<{ zones: SafetyZone[] }>(
      `${API}/api/zones/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    ),
};

// ── ML Engine (direct) ─────────────────────────────────────────────────────
export const mlApi = {
  predict: (payload: MLPayload) =>
    request<MLResult>(`${ML}/predict`, { method: "POST", body: JSON.stringify(payload) }),
  predictRisk: (lat: number, lng: number, hour?: number) =>
    request<MLRiskResult>(`${ML}/predict-risk`, {
      method: "POST",
      body: JSON.stringify({ latitude: lat, longitude: lng, time: hour ?? new Date().getHours() }),
    }),
  compareRoutes: (params: OrchestrateParams) =>
    request<{ fastest: any; safest: any; winner: string; explanation: string }>(`${ML}/compare-routes`, {
      method: "POST",
      body: JSON.stringify({
        origin_lat: params.originLat, origin_lng: params.originLng,
        dest_lat: params.destLat,     dest_lng: params.destLng,
        lam: params.lambda ?? 5,      time: params.time ?? new Date().getHours(),
      }),
    }),
  /** 24h time-risk curve from ML engine */
  timeRisk: () => request<{ curve: TimeRiskPoint[] }>(`${ML}/time-risk`),
  hourly: (params: Record<string, number>) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ hourly: MLHourly[] }>(`${ML}/predict/hourly?${q}`);
  },
  health: () => request<{ status: string; model_loaded: boolean; live_incidents: number; version: string }>(`${ML}/health`),
  reportIncident: (lat: number, lng: number, type: string, severity: number) =>
    request<{ status: string; updated_risk: MLRiskResult }>(`${ML}/report-incident`, {
      method: "POST",
      body: JSON.stringify({ latitude: lat, longitude: lng, type, severity }),
    }),
};

// ── Analytics ──────────────────────────────────────────────────────────────
export const analyticsApi = {
  stats:  () => request<AnalyticsStats>(`${API}/api/analytics/stats`),
  trend:  (days = 7) => request<{ trend: { _id: string; count: number }[] }>(`${API}/api/analytics/trend?days=${days}`),
};

// ── Cybersecurity ──────────────────────────────────────────────────────────
export const cyberApi = {
  analyze: (mediaUrl: string, incidentId?: string) =>
    request<CyberAnalysis>(`${API}/api/cyber/analyze`, {
      method: "POST", body: JSON.stringify({ mediaUrl, incidentId }),
    }),
  alerts: () => request<{ alerts: CyberAlert[] }>(`${API}/api/cyber/alerts`),
  report: (data: Partial<CyberAlert>) =>
    request<{ success: boolean; alert: CyberAlert }>(`${API}/api/cyber/report`, {
      method: "POST", body: JSON.stringify(data),
    }),
};

// ══════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  trustScore: number;           // 0–100  (40=guest, 80=verified, 95=max)
  reportsCount: number;
  createdAt?: string;
}

export interface LatLng { lat: number; lng: number }

// Route params for old compute endpoint
export interface RouteParams {
  originLat: number; originLng: number;
  destLat: number;   destLng: number;
  originLabel?: string; destLabel?: string;
}

// Route params for new orchestrate endpoint
export interface OrchestrateParams {
  originLat: number; originLng: number;
  destLat:   number; destLng:   number;
  time?:     number;   // hour 0-23
  lambda?:   number;   // 0-10
}

export interface RouteResult {
  routeType:          "safest" | "fastest" | "balanced";
  waypoints:          LatLng[];
  segments:           { from: LatLng; to: LatLng; distanceKm: number; safetyScore: number }[];
  totalDistanceKm:    number;
  estimatedMinutes:   number;
  overallSafetyScore: number;
  // Extended fields from orchestrator
  distance_km?:       number;
  risk_score?:        number;
  risk_level?:        "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  safety_score?:      number;
  cost?:              number;
}

export interface RouteSet {
  safest:   RouteResult;
  fastest:  RouteResult;
  balanced: RouteResult;
  meta: { usingFallback: boolean; source?: string };
}

export interface OrchestrateResult {
  routes:      RouteSet;
  winner:      "fastest" | "safest" | "balanced";
  explanation: string;
  meta: {
    source:               string;
    hour:                 number;
    timeLabel:            string;
    timeMultiplier:       number;
    userTrust:            number;
    trustLabel:           string;
    liveIncidentPenalty:  number;
    lambda:               number;
    usingFallback:        boolean;
  };
}

export interface IncidentPayload {
  type: string; severity: number;
  lat: number;  lng: number;
  description?: string; anonymous?: boolean;
}

export interface Incident {
  _id:         string;
  type:        string;
  severity:    number;
  location:    { coordinates: [number, number] };
  description?: string;
  createdAt:   string;
  upvotes:     number;
  trustStatus?:  string;
  isSuspicious?: boolean;
  trustWeight?:  number;
  reporterId?:   string;
}

export interface IncidentReportResult {
  incident:          Incident;
  trustStatus:       string;
  effectiveSeverity: number;
  isSuspicious:      boolean;
  updatedRisk?:      MLRiskResult;
}

export interface SafetyResult {
  score:     number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskColor: string;
  factors:   Record<string, number | string | boolean>;
}

export interface SafetyZone {
  _id:      string;
  name:     string;
  type:     "safe" | "caution" | "danger";
  safetyScore: number;
  location: { coordinates: [number, number] };
  radius:   number;
}

export interface HeatPoint { lat: number; lng: number; weight: number; type: string; time?: string }

export interface HourlySafety {
  hour:           number;
  riskMultiplier: number;
  label:          string;
  safetyIndex:    number;
}

export interface TimeRiskPoint {
  hour:         number;
  multiplier:   number;
  label:        string;
  safety_index: number;
}

export interface MLPayload {
  hour_of_day: number; day_of_week: number;
  incident_density: number; area_type_code: number;
  police_proximity_km: number; avg_severity_recent: number;
}

export interface MLResult {
  risk_class: string; risk_probability: number; predicted_score: number;
}

export interface MLRiskResult {
  latitude?: number; longitude?: number; hour?: number;
  risk_score:   number;
  risk_level:   "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  safety_score: number;
  confidence:   number;
  factors:      Record<string, number | string | boolean>;
  live_incidents?: number;
}

export interface MLHourly { hour: number; risk_class: string; predicted_score: number }

export interface AnalyticsStats {
  totalIncidents:    number;
  totalRoutes:       number;
  totalUsers:        number;
  suspiciousReports: number;
  cyberThreatsBlocked: number;
  incidentsByType:   { _id: string; count: number; avgSeverity?: number }[];
}

export interface CyberAlert {
  id: number;
  type: string;
  status: string;
  target?: string;
  confidence?: number;
  severity?: string;
  description?: string;
  reporter?: string;
  timestamp: string;
}

export interface CyberAnalysis {
  isAI: boolean;
  confidence: number;
  markers: string[];
  timestamp: string;
}
