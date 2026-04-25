/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║     SMART ROUTE OPTIMIZER  — Modified A* with Safety Weight     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ALGORITHM OVERVIEW:
 * Standard A* minimises: f(n) = g(n) + h(n)
 *   g(n) = actual cost from start
 *   h(n) = heuristic (Haversine distance to goal)
 *
 * Our modification adds a SAFETY COST per edge:
 *   edgeCost = distance × dangerPenalty(safetyScore)
 *   dangerPenalty(s) = 1 + α × (1 - s/100)²
 *
 *   α = safety weight (0=ignore safety, 1=avoid danger moderately, 10=avoid heavily)
 *
 * ROUTE TYPES:
 *   - Safest:   α = 10  (strongly penalise dangerous segments)
 *   - Fastest:  α = 0   (pure distance, like Dijkstra)
 *   - Balanced: α = 3   (moderate safety penalty)
 *
 * Graph is built dynamically from OSM Overpass API waypoints.
 * If OSM fails, we fall back to direct-path segmentation.
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

// ── Danger Penalty Function ────────────────────────────────────────────────────
function dangerPenalty(safetyScore, alpha) {
  const danger = 1 - safetyScore / 100;
  return 1 + alpha * danger * danger;
}

// ── Fetch road waypoints from OSM ─────────────────────────────────────────────
async function fetchOSMWaypoints(lat1, lng1, lat2, lng2) {
  try {
    // Bounding box with slight padding
    const minLat = Math.min(lat1, lat2) - 0.01;
    const maxLat = Math.max(lat1, lat2) + 0.01;
    const minLng = Math.min(lng1, lng2) - 0.01;
    const maxLng = Math.max(lng1, lng2) + 0.01;

    const query = `
      [out:json][timeout:15];
      way["highway"~"primary|secondary|tertiary|residential|unclassified|living_street|footway|path"]
        (${minLat},${minLng},${maxLat},${maxLng});
      (._;>;);
      out body;
    `;
    const res = await axios.post(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(query)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    const elements = res.data?.elements || [];
    const nodes = {};
    elements.filter((e) => e.type === 'node').forEach((n) => {
      nodes[n.id] = { lat: n.lat, lng: n.lon };
    });

    const ways = elements.filter((e) => e.type === 'way');
    // Build node list: each way = ordered sequence of node IDs
    const waypoints = [];
    ways.forEach((w) => {
      w.nodes?.forEach((nid) => {
        if (nodes[nid]) waypoints.push(nodes[nid]);
      });
    });

    // Deduplicate (within ~10m)
    const seen = new Set();
    return waypoints.filter((p) => {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return null; // triggers fallback
  }
}

// ── Generate intermediate waypoints (fallback) ────────────────────────────────
function generateFallbackWaypoints(lat1, lng1, lat2, lng2, steps = 10) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Slight S-curve offset to simulate a realistic road
    const offset = Math.sin(t * Math.PI) * 0.003;
    points.push({
      lat: lat1 + (lat2 - lat1) * t + (Math.random() - 0.5) * 0.001,
      lng: lng1 + (lng2 - lng1) * t + offset,
    });
  }
  return points;
}

// ── A* Graph Search (on discretised waypoints) ────────────────────────────────
async function aStarSafeRoute(waypoints, goalLat, goalLng, alpha) {
  if (!waypoints || waypoints.length === 0) return [];

  // Priority queue: [fScore, index]
  const pq = [[0, 0]];
  const gScore = new Array(waypoints.length).fill(Infinity);
  const parent = new Array(waypoints.length).fill(-1);
  gScore[0] = 0;

  const goalIdx = waypoints.length - 1;

  while (pq.length > 0) {
    pq.sort((a, b) => a[0] - b[0]);
    const [, current] = pq.shift();

    if (current === goalIdx) break;

    // Consider next 5 nearest nodes as neighbours
    const neighbours = waypoints
      .map((p, i) => ({ i, d: haversine(waypoints[current].lat, waypoints[current].lng, p.lat, p.lng) }))
      .filter((x) => x.i !== current)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);

    for (const { i, d } of neighbours) {
      const safetyScore = waypoints[i].safetyScore ?? 60;
      const edgeCost = d * dangerPenalty(safetyScore, alpha);
      const newG = gScore[current] + edgeCost;
      if (newG < gScore[i]) {
        gScore[i] = newG;
        parent[i] = current;
        const h = haversine(waypoints[i].lat, waypoints[i].lng, goalLat, goalLng);
        pq.push([newG + h, i]);
      }
    }
  }

  // Reconstruct path
  const path = [];
  let cur = goalIdx;
  while (cur !== -1) {
    path.unshift(waypoints[cur]);
    cur = parent[cur];
  }
  return path;
}

// ── Main Route Computation ─────────────────────────────────────────────────────
async function computeRoutes(originLat, originLng, destLat, destLng) {
  // 1. Fetch road waypoints from OSM
  let rawWaypoints = await fetchOSMWaypoints(originLat, originLng, destLat, destLng);
  const usingFallback = !rawWaypoints || rawWaypoints.length < 5;
  if (usingFallback) {
    rawWaypoints = generateFallbackWaypoints(originLat, originLng, destLat, destLng, 12);
  }

  // Attach origin/dest explicitly
  rawWaypoints.unshift({ lat: originLat, lng: originLng });
  rawWaypoints.push({ lat: destLat, lng: destLng });

  // 2. Compute safety scores for a sample of waypoints (parallel, throttled)
  const sampleEvery = Math.max(1, Math.floor(rawWaypoints.length / 15));
  const scoredWaypoints = await Promise.all(
    rawWaypoints.map(async (p, i) => {
      if (i % sampleEvery !== 0 && i !== 0 && i !== rawWaypoints.length - 1) {
        return { ...p, safetyScore: null }; // filled via interpolation below
      }
      const result = await computeSafetyScore(p.lat, p.lng);
      return { ...p, safetyScore: result.score, riskLevel: result.riskLevel };
    })
  );

  // Interpolate safety scores for unscored waypoints
  let lastKnown = 60;
  for (let i = 0; i < scoredWaypoints.length; i++) {
    if (scoredWaypoints[i].safetyScore !== null) {
      lastKnown = scoredWaypoints[i].safetyScore;
    } else {
      scoredWaypoints[i].safetyScore = lastKnown;
    }
  }

  // 3. Run A* for each route type
  const [safestPath, fastestPath, balancedPath] = await Promise.all([
    aStarSafeRoute(scoredWaypoints, destLat, destLng, 10),   // safest
    aStarSafeRoute(scoredWaypoints, destLat, destLng, 0),    // fastest
    aStarSafeRoute(scoredWaypoints, destLat, destLng, 3),    // balanced
  ]);

  // 4. Compute route metrics
  function computeMetrics(path) {
    let dist = 0;
    let scoreSum = 0;
    const segments = [];
    for (let i = 0; i < path.length - 1; i++) {
      const d = haversine(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
      dist += d;
      scoreSum += path[i].safetyScore ?? 60;
      segments.push({
        from: { lat: path[i].lat, lng: path[i].lng },
        to: { lat: path[i + 1].lat, lng: path[i + 1].lng },
        distanceKm: parseFloat(d.toFixed(3)),
        safetyScore: path[i].safetyScore ?? 60,
      });
    }
    const avgSafety = path.length > 1 ? Math.round(scoreSum / (path.length - 1)) : 60;
    const estMinutes = Math.round((dist / 30) * 60); // ~30 km/h urban average
    return { waypoints: path, segments, totalDistanceKm: parseFloat(dist.toFixed(2)), estimatedMinutes: estMinutes, overallSafetyScore: avgSafety };
  }

  return {
    safest:   { ...computeMetrics(safestPath),   routeType: 'safest' },
    fastest:  { ...computeMetrics(fastestPath),  routeType: 'fastest' },
    balanced: { ...computeMetrics(balancedPath), routeType: 'balanced' },
    meta: { usingFallback, waypointCount: scoredWaypoints.length },
  };
}

module.exports = { computeRoutes, haversine, dangerPenalty };
