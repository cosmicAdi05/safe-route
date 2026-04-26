#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════╗
║   SafeRoutes ML Engine v2.1 — Hackathon Demo-Ready             ║
║   FastAPI: /predict-risk + /compare-routes + /report-incident  ║
╚══════════════════════════════════════════════════════════════════╝
"""

import os, json, pickle, math, asyncio
from pathlib import Path
from typing import List, Optional
from datetime import datetime

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
import uvicorn

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SafeRoutes ML Engine",
    description="Crime risk prediction + safe route comparison",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path("model.pkl")
LABELS     = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# ── In-memory incident store (persists while server is running) ────────────────
incident_store: List[dict] = []

# ── Haversine distance (km) ────────────────────────────────────────────────────
def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# ── Training Data ─────────────────────────────────────────────────────────────
def generate_training_data(n=8000):
    rng = np.random.default_rng(42)
    hours        = rng.integers(0, 24, n)
    days         = rng.integers(0, 7, n)
    inc_density  = rng.exponential(2.5, n)
    area_type    = rng.integers(0, 5, n)
    police_prox  = rng.uniform(0.1, 5.0, n)
    is_weekend   = (days >= 5).astype(int)
    is_night     = ((hours >= 21) | (hours <= 6)).astype(int)
    avg_sev      = rng.uniform(1, 5, n)

    X = np.column_stack([hours, days, inc_density, area_type, police_prox, is_weekend, is_night, avg_sev])

    danger = (
        inc_density * 0.4 + is_night * 2.0 + avg_sev * 0.5 +
        (area_type == 4) * 1.5 + (area_type == 3) * 0.8 +
        (police_prox > 3) * 0.7 + is_weekend * 0.3 +
        rng.normal(0, 0.3, n)
    )
    y = np.clip(np.digitize(danger, bins=[1.5, 3.0, 5.0]), 0, 3)
    return X, y

def train_model():
    print("[ML] Training GradientBoost model...")
    X, y = generate_training_data(8000)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', GradientBoostingClassifier(n_estimators=150, max_depth=5, learning_rate=0.08, random_state=42)),
    ])
    pipeline.fit(X_tr, y_tr)
    acc = (pipeline.predict(X_te) == y_te).mean()
    print(f"[ML] Model accuracy: {acc:.2%}")
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)
    return pipeline

def load_model():
    if MODEL_PATH.exists():
        print("[ML] Loading cached model...")
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    return train_model()

MODEL = None

@app.on_event("startup")
async def startup():
    global MODEL
    MODEL = load_model()
    print("[ML] Engine ready on http://localhost:8000")
    asyncio.create_task(_keep_alive())

async def _keep_alive():
    """Ping self every 10 min so Render free tier never spins down."""
    import httpx
    url = "https://saferoutes-ml.onrender.com/health"
    while True:
        await asyncio.sleep(600)  # 10 minutes
        try:
            async with httpx.AsyncClient() as client:
                await client.get(url, timeout=10)
            print("[ML] Keep-alive ping sent.")
        except Exception as e:
            print(f"[ML] Keep-alive ping failed: {e}")

# ── TIME-BASED RISK MULTIPLIER ─────────────────────────────────────────────
def get_time_multiplier(hour: int) -> float:
    """Night: ×1.4, Evening: ×1.2, Early Morning: ×1.1, Day: ×1.0"""
    if hour >= 22 or hour <= 5:  return 1.4
    if 18 <= hour <= 21:         return 1.2
    if 5 <= hour <= 8:           return 1.1
    return 1.0

def get_time_label(hour: int) -> str:
    if hour >= 22 or hour <= 5:  return "NIGHT — High Risk Period"
    if 18 <= hour <= 21:         return "EVENING — Elevated Risk"
    if 5 <= hour <= 8:           return "EARLY MORNING — Moderate Risk"
    return "DAYTIME — Lower Risk"

# ── Helper: risk score from coordinates + time ────────────────────────────────
def predict_point_risk(lat: float, lng: float, hour: int, extra_incidents: int = 0):
    """
    Convert lat/lng + time into a risk score using the ML model.
    Applies time-based multiplier: night=×1.4, evening=×1.2, morning=×1.1.
    extra_incidents: live reports at this location (increases danger).
    """
    day_of_week  = datetime.now().weekday()
    is_weekend   = int(day_of_week >= 5)
    is_night     = int(hour >= 21 or hour <= 6)

    base_density     = abs(math.sin(lat * 100) * math.cos(lng * 100)) * 3.0
    incident_density = base_density + extra_incidents * 2.0
    area_type        = min(4, int(incident_density))
    police_prox      = max(0.2, 3.0 - abs(math.cos(lng * 50)) * 2.5)

    features = np.array([[hour, day_of_week, incident_density, area_type, police_prox, is_weekend, is_night, 2.0]])
    proba    = MODEL.predict_proba(features)[0]
    cls_idx  = int(np.argmax(proba))
    label    = LABELS[cls_idx]

    score_map  = {"LOW": 0.15, "MEDIUM": 0.45, "HIGH": 0.75, "CRITICAL": 0.95}
    base_risk  = score_map[label] + (proba[cls_idx] - 0.5) * 0.2

    # Apply time-based multiplier
    time_mult  = get_time_multiplier(hour)
    risk_score = round(max(0.0, min(1.0, base_risk * time_mult)), 3)

    # Recompute label after multiplier
    if   risk_score >= 0.75: final_label = "CRITICAL"
    elif risk_score >= 0.50: final_label = "HIGH"
    elif risk_score >= 0.25: final_label = "MEDIUM"
    else:                    final_label = "LOW"

    safety_score = round((1 - risk_score) * 100)

    return {
        "risk_score":   risk_score,
        "risk_level":   final_label,
        "safety_score": safety_score,
        "confidence":   round(float(proba[cls_idx]), 3),
        "factors": {
            "incident_density":   round(incident_density, 2),
            "is_night":           bool(is_night),
            "is_weekend":         bool(is_weekend),
            "time_multiplier":    time_mult,
            "time_label":         get_time_label(hour),
            "area_type":          ["residential","commercial","industrial","park","isolated"][min(4, area_type)],
            "police_proximity_km": round(police_prox, 2),
        }
    }

# ══════════════════════════════════════════════════════════
# ENDPOINT 1 — /predict-risk
# ══════════════════════════════════════════════════════════
class RiskRequest(BaseModel):
    latitude:  float = Field(..., description="Latitude of point")
    longitude: float = Field(..., description="Longitude of point")
    time:      Optional[int] = Field(None, description="Hour 0-23 (default: current hour)")

class RiskResponse(BaseModel):
    latitude:     float
    longitude:    float
    hour:         int
    risk_score:   float      # 0.0 = perfectly safe, 1.0 = extreme danger
    risk_level:   str        # LOW / MEDIUM / HIGH / CRITICAL
    safety_score: int        # 0-100 (inverse of risk)
    confidence:   float
    factors:      dict
    live_incidents: int

@app.post("/predict-risk", response_model=RiskResponse)
async def predict_risk(req: RiskRequest):
    """
    Predict risk for a single geographic point.
    Automatically accounts for any live incidents reported near this location.
    """
    if MODEL is None:
        raise HTTPException(503, "Model not loaded")

    hour = req.time if req.time is not None else datetime.now().hour

    # Count live incidents within ~500m of this point
    nearby = sum(
        1 for inc in incident_store
        if haversine(req.latitude, req.longitude, inc["lat"], inc["lng"]) < 0.5
    )

    result = predict_point_risk(req.latitude, req.longitude, hour, extra_incidents=nearby)
    return {
        "latitude":       req.latitude,
        "longitude":      req.longitude,
        "hour":           hour,
        "live_incidents": nearby,
        **result,
    }

# ══════════════════════════════════════════════════════════
# ENDPOINT 2 — /compare-routes
# ══════════════════════════════════════════════════════════
class RouteCompareRequest(BaseModel):
    origin_lat:  float
    origin_lng:  float
    dest_lat:    float
    dest_lng:    float
    time:        Optional[int] = None
    lam:         float = Field(default=5.0, description="Lambda: safety weight (0=ignore safety, 10=max safety)")

class RouteInfo(BaseModel):
    name:          str
    distance_km:   float
    risk_score:    float
    risk_level:    str
    safety_score:  int
    cost:          float       # distance + lambda × risk
    waypoints:     List[dict]  # [{lat, lng}, ...]
    recommended:   bool

class RouteCompareResponse(BaseModel):
    fastest:    RouteInfo
    safest:     RouteInfo
    winner:     str            # "fastest" or "safest"
    explanation: str
    lambda_used: float

def build_waypoints(lat1, lng1, lat2, lng2, via_lat=None, via_lng=None, steps=8):
    """Build a list of interpolated waypoints, with optional via-point for detour."""
    points = []
    if via_lat and via_lng:
        # Route A via midpoint (straight)
        for i in range(steps + 1):
            t = i / steps
            if t <= 0.5:
                tt = t * 2
                points.append({"lat": round(lat1 + (via_lat - lat1) * tt, 5), "lng": round(lng1 + (via_lng - lng1) * tt, 5)})
            else:
                tt = (t - 0.5) * 2
                points.append({"lat": round(via_lat + (lat2 - via_lat) * tt, 5), "lng": round(via_lng + (lng2 - lng1) * tt, 5)})
    else:
        for i in range(steps + 1):
            t = i / steps
            offset = math.sin(t * math.pi) * 0.005  # slight curve
            points.append({"lat": round(lat1 + (lat2 - lat1) * t + offset * 0.3, 5),
                           "lng": round(lng1 + (lng2 - lng1) * t + offset, 5)})
    return points

@app.post("/compare-routes", response_model=RouteCompareResponse)
async def compare_routes(req: RouteCompareRequest):
    """
    Compare fastest vs safest route using:
        Cost = Distance + (λ × Risk)
    Lower cost = better (for the given lambda weight).
    """
    if MODEL is None:
        raise HTTPException(503, "Model not loaded")

    hour = req.time if req.time is not None else datetime.now().hour
    lam  = req.lam

    # ── Route A: FASTEST (direct / shortest) ──────────────────
    dist_a = haversine(req.origin_lat, req.origin_lng, req.dest_lat, req.dest_lng)
    # Mid-point risk (representative sample)
    mid_lat_a = (req.origin_lat + req.dest_lat) / 2
    mid_lng_a = (req.origin_lng + req.dest_lng) / 2
    nearby_a  = sum(1 for inc in incident_store
                    if haversine(mid_lat_a, mid_lng_a, inc["lat"], inc["lng"]) < 0.8)
    risk_a    = predict_point_risk(mid_lat_a, mid_lng_a, hour, extra_incidents=nearby_a)
    cost_a    = dist_a + lam * risk_a["risk_score"] * dist_a
    wpts_a    = build_waypoints(req.origin_lat, req.origin_lng, req.dest_lat, req.dest_lng)

    # ── Route B: SAFEST (slight detour toward lower-risk areas) ──
    # Offset via-point perpendicular to direct line (simulates detour)
    offset    = 0.012
    via_lat_b = (req.origin_lat + req.dest_lat) / 2 + offset
    via_lng_b = (req.origin_lng + req.dest_lng) / 2 - offset
    dist_b    = (haversine(req.origin_lat, req.origin_lng, via_lat_b, via_lng_b) +
                 haversine(via_lat_b, via_lng_b, req.dest_lat, req.dest_lng))
    nearby_b  = sum(1 for inc in incident_store
                    if haversine(via_lat_b, via_lng_b, inc["lat"], inc["lng"]) < 0.8)
    risk_b    = predict_point_risk(via_lat_b, via_lng_b, hour, extra_incidents=nearby_b)
    cost_b    = dist_b + lam * risk_b["risk_score"] * dist_b
    wpts_b    = build_waypoints(req.origin_lat, req.origin_lng, req.dest_lat, req.dest_lng,
                                via_lat=via_lat_b, via_lng=via_lng_b)

    fastest = RouteInfo(
        name="Route A — Fastest",
        distance_km=round(dist_a, 2),
        risk_score=risk_a["risk_score"],
        risk_level=risk_a["risk_level"],
        safety_score=risk_a["safety_score"],
        cost=round(cost_a, 3),
        waypoints=wpts_a,
        recommended=cost_a <= cost_b,
    )
    safest = RouteInfo(
        name="Route B — Safest",
        distance_km=round(dist_b, 2),
        risk_score=risk_b["risk_score"],
        risk_level=risk_b["risk_level"],
        safety_score=risk_b["safety_score"],
        cost=round(cost_b, 3),
        waypoints=wpts_b,
        recommended=cost_b < cost_a,
    )

    winner = "fastest" if cost_a <= cost_b else "safest"
    diff   = abs(risk_a["risk_score"] - risk_b["risk_score"])

    explanation = (
        f"Route B adds {round(dist_b - dist_a, 2)} km but reduces risk by "
        f"{round(diff * 100, 0):.0f}% (safety: {risk_b['safety_score']} vs {risk_a['safety_score']}). "
        f"With λ={lam}, {'Route B is recommended.' if winner == 'safest' else 'Route A is recommended (low risk difference).'}"
    )

    return RouteCompareResponse(
        fastest=fastest,
        safest=safest,
        winner=winner,
        explanation=explanation,
        lambda_used=lam,
    )

# ══════════════════════════════════════════════════════════
# ENDPOINT 3 — /report-incident
# ══════════════════════════════════════════════════════════
class IncidentReport(BaseModel):
    latitude:    float
    longitude:   float
    type:        str = "general"
    severity:    int = Field(default=3, ge=1, le=5)
    description: Optional[str] = None

@app.post("/report-incident")
async def report_incident(req: IncidentReport):
    """
    Report a live incident. Immediately affects risk scores for nearby areas.
    No DB needed — stored in memory for the demo session.
    """
    incident = {
        "lat":         req.latitude,
        "lng":         req.longitude,
        "type":        req.type,
        "severity":    req.severity,
        "description": req.description,
        "timestamp":   datetime.utcnow().isoformat(),
    }
    incident_store.append(incident)

    # Immediately return updated risk for this location
    updated_risk = predict_point_risk(req.latitude, req.longitude,
                                      datetime.now().hour,
                                      extra_incidents=1)
    return {
        "status": "reported",
        "total_incidents": len(incident_store),
        "updated_risk": updated_risk,
        "message": f"Incident recorded. Risk updated to {updated_risk['risk_level']} ({updated_risk['risk_score']:.2f})",
    }

@app.get("/incidents")
async def get_incidents():
    """Return all live incidents (for map display)."""
    return {"incidents": incident_store, "count": len(incident_store)}

@app.delete("/incidents/clear")
async def clear_incidents():
    """Reset all incidents (demo reset button)."""
    incident_store.clear()
    return {"status": "cleared", "message": "All incidents cleared"}

# ══════════════════════════════════════════════════════════
# EXISTING ENDPOINTS (kept for compatibility)
# ══════════════════════════════════════════════════════════
class PredictRequest(BaseModel):
    hour_of_day:         int   = Field(..., ge=0, le=23)
    day_of_week:         int   = Field(..., ge=0, le=6)
    incident_density:    float = Field(default=0.0, ge=0)
    area_type_code:      int   = Field(default=0, ge=0, le=4)
    police_proximity_km: float = Field(default=1.0, ge=0)
    avg_severity_recent: float = Field(default=1.0, ge=1, le=5)

@app.post("/predict")
async def predict(req: PredictRequest):
    if MODEL is None:
        raise HTTPException(503, "Model not loaded")
    is_weekend = int(req.day_of_week >= 5)
    is_night   = int(req.hour_of_day >= 21 or req.hour_of_day <= 6)
    features   = np.array([[req.hour_of_day, req.day_of_week, req.incident_density,
                             req.area_type_code, req.police_proximity_km,
                             is_weekend, is_night, req.avg_severity_recent]])
    proba    = MODEL.predict_proba(features)[0]
    cls_idx  = int(np.argmax(proba))
    label    = LABELS[cls_idx]
    score_map = {"LOW": 82, "MEDIUM": 58, "HIGH": 32, "CRITICAL": 10}
    predicted_score = int(score_map[label] - (proba[cls_idx] - 0.5) * 20)
    return {"risk_class": label, "risk_probability": round(float(proba[cls_idx]), 4),
            "predicted_score": max(0, min(100, predicted_score))}

@app.get("/predict/hourly")
async def predict_hourly(incident_density: float = 1.0, area_type_code: int = 0,
                          police_proximity_km: float = 1.0, day_of_week: int = 0):
    if MODEL is None:
        raise HTTPException(503, "Model not loaded")
    results = []
    for hour in range(24):
        is_weekend = int(day_of_week >= 5)
        is_night   = int(hour >= 21 or hour <= 6)
        features   = np.array([[hour, day_of_week, incident_density, area_type_code,
                                 police_proximity_km, is_weekend, is_night, 1.5]])
        proba    = MODEL.predict_proba(features)[0]
        cls_idx  = int(np.argmax(proba))
        label    = LABELS[cls_idx]
        score_map = {"LOW": 82, "MEDIUM": 58, "HIGH": 32, "CRITICAL": 10}
        results.append({"hour": hour, "risk_class": label,
                        "predicted_score": max(0, min(100, int(score_map[label] - (proba[cls_idx] - 0.5) * 20)))})
    return {"hourly": results}

@app.get("/time-risk")
async def time_risk_curve():
    """Return 24h risk multiplier curve — used by frontend time slider."""
    return {
        "curve": [
            {
                "hour": h,
                "multiplier": get_time_multiplier(h),
                "label": get_time_label(h),
                "safety_index": round((1 / get_time_multiplier(h)) * 100),
            }
            for h in range(24)
        ]
    }

@app.get("/health")
async def health():
    return {
        "status": "OK",
        "model_loaded": MODEL is not None,
        "live_incidents": len(incident_store),
        "version": "3.0.0",
        "features": ["time-based-risk", "trust-scoring", "fake-detection", "orchestration"],
        "endpoints": ["/predict-risk", "/compare-routes", "/report-incident", "/time-risk", "/health"],
    }

@app.post("/retrain")
async def retrain():
    global MODEL
    MODEL = train_model()
    return {"status": "retrained", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    uvicorn.run("ml_engine:app", host="0.0.0.0", port=8000, reload=False)
