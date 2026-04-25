/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         SMART SAFETY SCORING ENGINE  — SafeRoutes v2.0         ║
 * ║  Mathematical model for real-time area safety quantification   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * FORMULA:
 *   SafetyScore(S) = 100 × Σ(wᵢ × fᵢ)   where Σwᵢ = 1
 *
 *   Factors (fᵢ)  |  Weight (wᵢ)  |  Source
 *   ─────────────────────────────────────────
 *   Crime density |  0.35         |  Historical DB + live incidents
 *   Time of day   |  0.20         |  System clock (night = penalty)
 *   Crowd density |  0.15         |  OSM + time heuristics
 *   Weather/light |  0.15         |  OpenWeatherMap API
 *   Police prox.  |  0.10         |  OSM amenity=police
 *   Incident surge|  0.05         |  Last-24h user reports
 *
 *   Higher score = Safer  (0 = extreme danger, 100 = perfectly safe)
 */

const axios = require('axios');
const Incident = require('../models/Incident');
const SafetyZone = require('../models/SafetyZone');

// ── Constants ─────────────────────────────────────────────────────────────────
const WEIGHTS = {
  crime: 0.35,
  timeOfDay: 0.20,
  crowd: 0.15,
  weather: 0.15,
  police: 0.10,
  incidentSurge: 0.05,
};

// Risk level thresholds
const RISK_LEVELS = [
  { min: 75, label: 'LOW',      color: '#22c55e' },
  { min: 50, label: 'MEDIUM',   color: '#f59e0b' },
  { min: 25, label: 'HIGH',     color: '#ef4444' },
  { min: 0,  label: 'CRITICAL', color: '#7f1d1d' },
];

// ── Time-of-Day Safety Factor ─────────────────────────────────────────────────
/**
 * Returns a 0-100 factor based on hour.
 * Night hours (22:00–05:00) are penalised heavily.
 * Peak activity hours (08:00–20:00) are treated as safest.
 */
function getTimeOfDaySafety(hour = new Date().getHours()) {
  // Piecewise linear model
  const hourlyBase = [
    20, 15, 10, 10, 15, 30,   // 00-05  (late night / early dawn)
    55, 75, 90, 95, 95, 95,   // 06-11  (morning)
    95, 95, 95, 90, 85, 80,   // 12-17  (afternoon)
    75, 70, 65, 55, 40, 30,   // 18-23  (evening -> night)
  ];
  return hourlyBase[hour];
}

// ── Crime Density Score ───────────────────────────────────────────────────────
/**
 * Queries active incidents within radiusM of a point.
 * Returns 0-100 score (100 = zero crime, 0 = extreme density).
 * Severity-weighted: critical incidents count 5×.
 */
async function getCrimeSafetyScore(lat, lng, radiusM = 500) {
  try {
    const incidents = await Incident.find({
      active: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusM,
        },
      },
    }).select('severity type createdAt');

    if (incidents.length === 0) return 90; // No reports → assumed safe

    // Weighted incident score — recent incidents count more
    const now = Date.now();
    let weightedSum = 0;
    incidents.forEach((inc) => {
      const ageHours = (now - new Date(inc.createdAt).getTime()) / 3_600_000;
      const recencyFactor = Math.exp(-0.1 * ageHours); // exponential decay
      weightedSum += inc.severity * recencyFactor;
    });

    // Clamp: max weighted score = 25 → maps to 0 safety
    const dangerScore = Math.min(weightedSum / 25, 1);
    return Math.round((1 - dangerScore) * 100);
  } catch {
    return 60; // fallback neutral score
  }
}

// ── Crowd / Area Type Score ───────────────────────────────────────────────────
/**
 * OSM-based heuristic: checks proximity to populated amenities.
 * Crowded = safer (more witnesses). Isolated = riskier.
 */
async function getCrowdSafetyScore(lat, lng) {
  try {
    const overpassQuery = `
      [out:json][timeout:10];
      (
        node["amenity"~"hospital|police|restaurant|school|bank|market|mall|bus_station"](around:400,${lat},${lng});
      );
      out count;
    `;
    const res = await axios.post(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(overpassQuery)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
    );
    const count = res.data?.elements?.[0]?.tags?.total || 0;
    // 0 amenities = 30 (isolated), 10+ amenities = 90 (busy area)
    return Math.min(30 + count * 6, 95);
  } catch {
    return 55; // fallback
  }
}

// ── Police Proximity Score ────────────────────────────────────────────────────
async function getPoliceSafetyScore(lat, lng) {
  try {
    const overpassQuery = `
      [out:json][timeout:8];
      node["amenity"="police"](around:1000,${lat},${lng});
      out count;
    `;
    const res = await axios.post(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(overpassQuery)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 7000 }
    );
    const count = res.data?.elements?.[0]?.tags?.total || 0;
    return count > 0 ? Math.min(60 + count * 15, 95) : 40;
  } catch {
    return 50;
  }
}

// ── Weather & Lighting Score ──────────────────────────────────────────────────
async function getWeatherSafetyScore(lat, lng) {
  try {
    const key = process.env.WEATHER_API_KEY;
    if (!key || key === 'your_openweathermap_api_key_here') {
      // Fallback: use time to approximate day/night lighting
      const hour = new Date().getHours();
      return hour >= 6 && hour <= 18 ? 85 : 50;
    }
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}`,
      { timeout: 5000 }
    );
    const { weather, visibility } = res.data;
    const condition = weather?.[0]?.main?.toLowerCase();
    let score = 80;
    if (condition === 'thunderstorm') score = 30;
    else if (condition === 'rain' || condition === 'snow') score = 50;
    else if (condition === 'fog' || condition === 'mist') score = 40;
    // Adjust for visibility (m): <500m very dangerous
    if (visibility < 500) score = Math.min(score, 25);
    else if (visibility < 2000) score = Math.min(score, 50);
    return score;
  } catch {
    return 70;
  }
}

// ── Incident Surge (last 1 hour) ──────────────────────────────────────────────
async function getIncidentSurgeScore(lat, lng) {
  try {
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    const count = await Incident.countDocuments({
      active: true,
      createdAt: { $gte: oneHourAgo },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 500,
        },
      },
    });
    // 0 = 100, 5+ = 0
    return Math.max(100 - count * 20, 0);
  } catch {
    return 80;
  }
}

// ── Master Composite Safety Score ─────────────────────────────────────────────
async function computeSafetyScore(lat, lng, options = {}) {
  const hour = options.hour ?? new Date().getHours();

  // Run all factor computations in parallel
  const [crime, crowd, police, weather, surge] = await Promise.all([
    getCrimeSafetyScore(lat, lng),
    getCrowdSafetyScore(lat, lng),
    getPoliceSafetyScore(lat, lng),
    getWeatherSafetyScore(lat, lng),
    getIncidentSurgeScore(lat, lng),
  ]);

  const timeOfDay = getTimeOfDaySafety(hour);

  // Weighted composite
  const composite =
    WEIGHTS.crime         * crime   +
    WEIGHTS.timeOfDay     * timeOfDay +
    WEIGHTS.crowd         * crowd   +
    WEIGHTS.weather       * weather +
    WEIGHTS.police        * police  +
    WEIGHTS.incidentSurge * surge;

  const score = Math.round(Math.max(0, Math.min(100, composite)));
  const risk  = RISK_LEVELS.find((r) => score >= r.min) || RISK_LEVELS[3];

  return {
    score,
    riskLevel: risk.label,
    riskColor: risk.color,
    factors: { crime, timeOfDay, crowd, weather, police, incidentSurge: surge },
  };
}

// ── Cron-triggered batch update for all active zones ─────────────────────────
async function updateSafetyScores() {
  try {
    const zones = await SafetyZone.find({});
    for (const zone of zones) {
      const [lng, lat] = zone.location.coordinates;
      const result = await computeSafetyScore(lat, lng);
      zone.safetyScore = result.score;
      zone.factors = {
        crimeIndex:       result.factors.crime,
        lightingIndex:    result.factors.weather,
        crowdIndex:       result.factors.crowd,
        policeProximity:  result.factors.police,
        incidentDensity:  result.factors.incidentSurge,
      };
      zone.lastUpdated = new Date();
      await zone.save();
    }
    console.log(`[SafetyEngine] Updated ${zones.length} zones`);
  } catch (err) {
    console.error('[SafetyEngine] Batch update error:', err.message);
  }
}

module.exports = {
  computeSafetyScore,
  getTimeOfDaySafety,
  getCrimeSafetyScore,
  updateSafetyScores,
  WEIGHTS,
  RISK_LEVELS,
};
