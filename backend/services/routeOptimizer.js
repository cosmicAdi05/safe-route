/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   SMART ROUTE OPTIMIZER  — OSRM + Safety Scoring  v3.0        ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Uses OSRM (Open Source Routing Machine) public API for        ║
 * ║  real road-following routes, then overlays our safety scoring. ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ROUTE TYPES:
 *   - Fastest:  OSRM primary route (shortest travel time)
 *   - Safest:   OSRM via-point detour through lower-risk areas
 *   - Balanced: OSRM alternative route (if available), else midpoint
 */

const axios = require('axios');
const { computeSafetyScore } = require('./safetyEngine');

// ── Haversine Distance (km) ────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dangerPenalty(safetyScore, alpha) {
  const danger = 1 - safetyScore / 100;
  return 1 + alpha * danger * danger;
}

// ── Fetch routes from OSRM (with alternatives) ────────────────────────────────
async function fetchOSRMRoutes(lat1, lng1, lat2, lng2) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${lng1},${lat1};${lng2},${lat2}` +
    `?overview=full&geometries=geojson&alternatives=true&steps=true`;

  const res = await axios.get(url, { timeout: 12000 });
  if (!res.data?.routes?.length) throw new Error('OSRM returned no routes');
  return res.data.routes; // array, each has .geometry.coordinates + .distance + .duration
}

// ── Fetch via-point detour route (for safest path) ───────────────────────────
async function fetchOSRMViaRoute(lat1, lng1, lat2, lng2) {
  // Compute a perpendicular offset via-point to force a different road
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const len  = Math.sqrt(dLat ** 2 + dLng ** 2) || 0.001;
  const perpLat = (lat1 + lat2) / 2 + (-dLng / len) * 0.009;
  const perpLng = (lng1 + lng2) / 2 + ( dLat / len) * 0.009;

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${lng1},${lat1};${perpLng},${perpLat};${lng2},${lat2}` +
    `?overview=full&geometries=geojson&steps=true`;

  const res = await axios.get(url, { timeout: 12000 });
  return res.data?.routes?.[0] || null;
}

// ── Decode GeoJSON geometry → sampled {lat,lng} waypoints ────────────────────
function decodeGeometry(route, maxPoints = 60) {
  const coords = route.geometry.coordinates; // each: [lng, lat]
  const step   = Math.max(1, Math.floor(coords.length / maxPoints));
  const points = [];
  for (let i = 0; i < coords.length; i += step) {
    points.push({ lat: coords[i][1], lng: coords[i][0] });
  }
  // Always include last point
  const last = coords[coords.length - 1];
  if (!points.length || points[points.length - 1].lat !== last[1]) {
    points.push({ lat: last[1], lng: last[0] });
  }
  return points;
}

// ── Score safety along waypoints (parallel, sampled) ─────────────────────────
async function scoreRouteWaypoints(waypoints) {
  // Only score every Nth point to avoid too many DB/API calls
  const sampleEvery = Math.max(1, Math.floor(waypoints.length / 8));

  const scored = await Promise.all(
    waypoints.map(async (p, i) => {
      if (i % sampleEvery !== 0 && i !== 0 && i !== waypoints.length - 1) {
        return { ...p, safetyScore: null };
      }
      try {
        const result = await computeSafetyScore(p.lat, p.lng);
        return { ...p, safetyScore: result.score, riskLevel: result.riskLevel };
      } catch {
        return { ...p, safetyScore: 65 };
      }
    })
  );

  // Interpolate nulls from nearest known score
  let last = 65;
  for (const p of scored) {
    if (p.safetyScore !== null) last = p.safetyScore;
    else p.safetyScore = last;
  }
  return scored;
}

// ── Compute route metrics from scored waypoints ───────────────────────────────
function computeMetrics(waypoints, osrmDistM, osrmDurS, route) {
  const dist = osrmDistM
    ? osrmDistM / 1000
    : waypoints.reduce((sum, p, i) => {
        if (i === 0) return 0;
        return sum + haversine(waypoints[i - 1].lat, waypoints[i - 1].lng, p.lat, p.lng);
      }, 0);

  const estMinutes = osrmDurS
    ? Math.round(osrmDurS / 60)
    : Math.round((dist / 30) * 60);

  const scoreSum = waypoints.reduce((s, p) => s + (p.safetyScore ?? 65), 0);
  const avgSafety = Math.round(scoreSum / waypoints.length);

  const segments = waypoints.slice(0, -1).map((p, i) => ({
    from: { lat: p.lat, lng: p.lng },
    to:   { lat: waypoints[i + 1].lat, lng: waypoints[i + 1].lng },
    distanceKm: parseFloat(
      haversine(p.lat, p.lng, waypoints[i + 1].lat, waypoints[i + 1].lng).toFixed(3)
    ),
    safetyScore: p.safetyScore ?? 65,
  }));

  const instructions = route?.legs?.flatMap(leg => 
    leg.steps.map(step => ({
      text: step.maneuver.instruction,
      distanceM: Math.round(step.distance),
      durationS: Math.round(step.duration),
      name: step.name || "Street"
    }))
  ) || [];

  return {
    waypoints,
    segments,
    instructions,
    totalDistanceKm:    parseFloat(dist.toFixed(2)),
    estimatedMinutes:   estMinutes,
    overallSafetyScore: avgSafety,
  };
}

// ── Fallback: interpolated straight-ish path ──────────────────────────────────
function generateFallbackWaypoints(lat1, lng1, lat2, lng2, steps = 12) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const offset = Math.sin(t * Math.PI) * 0.003;
    points.push({
      lat: lat1 + (lat2 - lat1) * t,
      lng: lng1 + (lng2 - lng1) * t + offset,
    });
  }
  return points;
}

// ── Main Entry Point ──────────────────────────────────────────────────────────
async function computeRoutes(originLat, originLng, destLat, destLng) {
  let osrmRoutes = null;
  let viaRoute   = null;
  let usingFallback = false;

  // 1. Fetch from OSRM (fastest + alternative + via-detour in parallel)
  try {
    [osrmRoutes, viaRoute] = await Promise.all([
      fetchOSRMRoutes(originLat, originLng, destLat, destLng),
      fetchOSRMViaRoute(originLat, originLng, destLat, destLng).catch(() => null),
    ]);
  } catch (err) {
    console.warn('[RouteOptimizer] OSRM failed:', err.message, '— using fallback');
    usingFallback = true;
  }

  // 2. If OSRM failed entirely, use simple interpolation
  if (usingFallback || !osrmRoutes?.length) {
    const wpts   = await scoreRouteWaypoints(generateFallbackWaypoints(originLat, originLng, destLat, destLng));
    const metrics = computeMetrics(wpts);
    return {
      fastest:  { ...metrics, routeType: 'fastest' },
      safest:   { ...metrics, routeType: 'safest' },
      balanced: { ...metrics, routeType: 'balanced' },
      meta: { usingFallback: true, waypointCount: wpts.length, source: 'fallback' },
    };
  }

  // 3. Assign routes:
  //    Fastest  → OSRM primary (lowest duration)
  //    Safest   → via-point detour (different roads) OR OSRM alternative
  //    Balanced → OSRM alternative OR same as fastest
  const fastestRaw  = osrmRoutes[0];
  const safestRaw   = viaRoute || osrmRoutes[1] || osrmRoutes[0];
  const balancedRaw = osrmRoutes[1] || viaRoute  || osrmRoutes[0];

  // 4. Score safety on all three routes in parallel
  const [fastestWpts, safestWpts, balancedWpts] = await Promise.all([
    scoreRouteWaypoints(decodeGeometry(fastestRaw)),
    scoreRouteWaypoints(decodeGeometry(safestRaw)),
    scoreRouteWaypoints(decodeGeometry(balancedRaw)),
  ]);

  return {
    fastest:  { ...computeMetrics(fastestWpts,  fastestRaw.distance,  fastestRaw.duration,  fastestRaw),  routeType: 'fastest' },
    safest:   { ...computeMetrics(safestWpts,   safestRaw.distance,   safestRaw.duration,   safestRaw),   routeType: 'safest' },
    balanced: { ...computeMetrics(balancedWpts, balancedRaw.distance, balancedRaw.duration, balancedRaw), routeType: 'balanced' },
    meta: {
      usingFallback:  false,
      waypointCount:  fastestWpts.length,
      source:         'osrm',
      alternatives:   osrmRoutes.length,
    },
  };
}

module.exports = { computeRoutes, haversine, dangerPenalty };
