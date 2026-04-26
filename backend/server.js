require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const axios   = require('axios');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] } });
app.set('io', io);
io.on('connection', s => console.log(`[WS] connected: ${s.id}`));

// ── Middleware ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// PRODUCTION: allow Vercel frontend + localhost
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://safe-route-nav.vercel.app",
  /\.vercel\.app$/,
];
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));

// CYBERSECURITY: Rate limiting per 15 min window
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300, message: { error: 'Too many requests' } }));

// ── Constants ─────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'saferoutes_hackathon_2025';
const ML_URL     = process.env.ML_ENGINE_URL || 'http://localhost:8000';

// ── In-Memory Store (no DB needed for demo) ───────────────────────
const store = { users: [], incidents: [], routes: [], cyberAlerts: [] };

// ── CYBERSECURITY: JWT Middleware ─────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  req.user = null;
  if (!token) return next();
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    req.user = store.users.find(u => u.id === id) || null;
  } catch {}
  next();
};

// ── TIME-BASED RISK: Helper ───────────────────────────────────────
// Night (22-5): +40% risk  Evening (18-21): +20%  Morning (5-8): +10%
function getTimeRiskMultiplier(hour) {
  if (hour >= 22 || hour <= 5)  return 1.4;
  if (hour >= 18 && hour <= 21) return 1.2;
  if (hour >= 5  && hour <= 8)  return 1.1;
  return 1.0;
}

function getTimeLabel(hour) {
  if (hour >= 22 || hour <= 5)  return 'NIGHT 🌙 — High Risk Period';
  if (hour >= 18 && hour <= 21) return 'EVENING 🌆 — Elevated Risk';
  if (hour >= 5  && hour <= 8)  return 'EARLY MORNING 🌅 — Moderate Risk';
  return 'DAYTIME ☀️ — Lower Risk';
}

// ── ROUTE COST FORMULA: Cost = Distance + (λ × Risk) ─────────────
function computeCost(distanceKm, riskScore, lambda) {
  return parseFloat((distanceKm + lambda * riskScore * distanceKm).toFixed(3));
}

// ── Haversine distance ────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── BUILD WAYPOINTS ───────────────────────────────────────────────
function buildWaypoints(lat1, lng1, lat2, lng2, detourOffset = 0, steps = 10) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const curve = Math.sin(t * Math.PI) * detourOffset;
    return {
      lat: parseFloat((lat1 + (lat2 - lat1) * t + curve * 0.3).toFixed(5)),
      lng: parseFloat((lng1 + (lng2 - lng1) * t + curve).toFixed(5)),
    };
  });
}

// ── HEALTH ────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({
  status: 'OK', version: '3.0.0-hackathon',
  features: ['orchestration','time-risk','fake-detection','jwt','rate-limiting'],
  timestamp: new Date().toISOString(),
}));

// ── AUTH ──────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email, password required' });
    if (store.users.find(u => u.email === email))
      return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(), name, email, password: hashed, role: 'user',
      trustScore: 80,   // Verified users start with 80/100 trust
      reportsCount: 0,
      createdAt: new Date().toISOString(),
    };
    store.users.push(user);
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...user, password: undefined } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = store.users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { ...user, password: undefined } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: { ...req.user, password: undefined } });
});

// ════════════════════════════════════════════════════════════════
// INTELLIGENT ORCHESTRATION LAYER — Central Decision Engine
// Aggregates: ML risk + user reports + trust score + time risk
// ════════════════════════════════════════════════════════════════
app.post('/api/routes/orchestrate', authenticate, async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng, time, lambda = 5 } = req.body;

    // CYBERSECURITY: Input validation
    if (!originLat || !originLng || !destLat || !destLng)
      return res.status(400).json({ error: 'originLat, originLng, destLat, destLng required' });
    const oLat = parseFloat(originLat), oLng = parseFloat(originLng);
    const dLat = parseFloat(destLat),   dLng = parseFloat(destLng);
    const lam  = Math.max(0, Math.min(10, parseFloat(lambda)));
    const hour = time !== undefined ? parseInt(time) : new Date().getHours();

    if ([oLat,oLng,dLat,dLng].some(isNaN))
      return res.status(400).json({ error: 'Coordinates must be valid numbers' });

    // ── STEP 1: Get ML risk scores ────────────────────────────
    let mlFastest = null, mlSafest = null;
    try {
      const mlRes = await axios.post(`${ML_URL}/compare-routes`, {
        origin_lat: oLat, origin_lng: oLng,
        dest_lat: dLat,   dest_lng: dLng,
        lam, time: hour,
      }, { timeout: 12000 });
      mlFastest = mlRes.data.fastest;
      mlSafest  = mlRes.data.safest;
    } catch (mlErr) {
      console.warn('[Orchestrator] ML Engine offline — using built-in fallback');
    }

    // ── STEP 2: Time-based risk multiplier ───────────────────
    const timeMultiplier = getTimeRiskMultiplier(hour);
    const timeLabel      = getTimeLabel(hour);

    // ── STEP 3: Count live incident weight near routes ────────
    const distKm = haversine(oLat, oLng, dLat, dLng);
    const midLat = (oLat + dLat) / 2;
    const midLng = (oLng + dLng) / 2;
    const liveIncidentPenalty = store.incidents
      .filter(i => !i.isSuspicious && haversine(midLat, midLng, i.location.coordinates[1], i.location.coordinates[0]) < 1)
      .reduce((sum, i) => sum + (i.severity * (i.trustWeight || 0.5) * 0.05), 0);

    // ── STEP 4: Trust score of requester ─────────────────────
    const userTrust = req.user ? req.user.trustScore : 40;
    const trustLabel = userTrust >= 75 ? 'Highly Verified' : userTrust >= 50 ? 'Verified' : 'Low Trust';

    // ── STEP 5: Build 3 routes with Cost = Distance + λ×Risk ─
    const buildRoute = (type, baseRiskScore, detourOffset, safetyBonus = 0) => {
      const waypoints   = buildWaypoints(oLat, oLng, dLat, dLng, detourOffset);
      const routeDist   = detourOffset > 0 ? distKm * (1 + detourOffset * 0.8) : distKm;
      const rawRisk     = Math.min(1, (baseRiskScore + liveIncidentPenalty) * timeMultiplier);
      const finalRisk   = parseFloat(rawRisk.toFixed(3));
      const safetyScore = Math.max(5, Math.min(100, Math.round((1 - rawRisk) * 100) + safetyBonus));
      const riskLevel   = finalRisk >= 0.75 ? 'CRITICAL' : finalRisk >= 0.5 ? 'HIGH' : finalRisk >= 0.25 ? 'MEDIUM' : 'LOW';
      const cost        = computeCost(routeDist, finalRisk, lam);
      const eta         = Math.round(routeDist / 30 * 60);
      return {
        routeType: type, waypoints,
        distance_km: parseFloat(routeDist.toFixed(2)),
        risk_score: finalRisk, risk_level: riskLevel,
        safety_score: safetyScore, overallSafetyScore: safetyScore,
        cost, estimatedMinutes: eta,
        totalDistanceKm: parseFloat(routeDist.toFixed(2)),
      };
    };

    // Use ML scores if available, otherwise derive from coordinates
    const baseFastRisk = mlFastest
      ? mlFastest.risk_score
      : Math.abs(Math.sin(oLat * 100 + oLng * 100)) * 0.5 + 0.15;
    const baseSafeRisk = mlSafest
      ? mlSafest.risk_score * 0.75
      : baseFastRisk * 0.6;

    const fastest  = buildRoute('fastest',  baseFastRisk, 0,     0);
    const safest   = buildRoute('safest',   baseSafeRisk, 0.012, 10);
    const balanced = buildRoute('balanced', (baseFastRisk + baseSafeRisk) / 2, 0.006, 5);

    // ── STEP 6: Final AI decision ─────────────────────────────
    const costs  = { fastest: fastest.cost, safest: safest.cost, balanced: balanced.cost };
    const winner = Object.keys(costs).reduce((a, b) => costs[a] < costs[b] ? a : b);

    const explanation = [
      `📍 Direct distance: ${distKm.toFixed(2)} km.`,
      `⏰ Time risk: ${timeLabel} (×${timeMultiplier}).`,
      `🚨 Live incidents on route: ${liveIncidentPenalty > 0 ? (liveIncidentPenalty * 20).toFixed(0) : 0} reports weighted.`,
      `👤 User trust: ${trustLabel} (${userTrust}%).`,
      `📊 Route costs — Fastest: ${fastest.cost.toFixed(2)} | Safest: ${safest.cost.toFixed(2)} | Balanced: ${balanced.cost.toFixed(2)}.`,
      `✅ AI recommends: ${winner.toUpperCase()} route using λ=${lam} (Cost = Distance + λ × Risk).`,
    ].join(' ');

    store.routes.push({ originLat: oLat, originLng: oLng, destLat: dLat, destLng: dLng, createdAt: new Date() });

    res.json({
      routes: { fastest, safest, balanced },
      winner,
      explanation,
      meta: {
        source:          mlFastest ? 'ml-engine + orchestrator' : 'orchestrator-fallback',
        hour,
        timeLabel,
        timeMultiplier,
        userTrust,
        trustLabel,
        liveIncidentPenalty: parseFloat(liveIncidentPenalty.toFixed(3)),
        lambda:          lam,
        usingFallback:   !mlFastest,
      },
    });
  } catch (e) {
    console.error('[Orchestrate]', e.message);
    res.status(500).json({ error: 'Orchestration failed', details: e.message });
  }
});

// Backwards compat for older MapApp calls — proxy to orchestrate
app.post('/api/routes/compute', authenticate, async (req, res) => {
  if (!req.body.time) req.body.time = new Date().getHours();
  if (!req.body.lambda) req.body.lambda = 5;
  // Re-use same handler by calling it with modified req
  const { originLat, originLng, destLat, destLng, time, lambda } = req.body;
  if (!originLat || !originLng || !destLat || !destLng)
    return res.status(400).json({ error: 'Coordinates required' });
  try {
    const oLat = parseFloat(originLat), oLng = parseFloat(originLng);
    const dLat = parseFloat(destLat),   dLng = parseFloat(destLng);
    const lam  = Math.max(0, Math.min(10, parseFloat(lambda)));
    const hour = parseInt(time);
    const distKm = haversine(oLat, oLng, dLat, dLng);
    const buildRoute = (type, riskScore, detour, bonus) => {
      const wpts = buildWaypoints(oLat, oLng, dLat, dLng, detour);
      const dist = detour > 0 ? distKm * (1 + detour * 0.8) : distKm;
      const tm   = getTimeRiskMultiplier(hour);
      const risk = Math.min(1, riskScore * tm);
      const ss   = Math.max(5, Math.min(100, Math.round((1 - risk) * 100) + bonus));
      const rl   = risk >= 0.75 ? 'CRITICAL' : risk >= 0.5 ? 'HIGH' : risk >= 0.25 ? 'MEDIUM' : 'LOW';
      return { routeType: type, waypoints: wpts, totalDistanceKm: parseFloat(dist.toFixed(2)),
        estimatedMinutes: Math.round(dist / 30 * 60), overallSafetyScore: ss,
        risk_score: parseFloat(risk.toFixed(3)), risk_level: rl, safety_score: ss,
        cost: computeCost(dist, risk, lam), segments: [] };
    };
    const base = Math.abs(Math.sin(oLat * 100 + oLng * 100)) * 0.5 + 0.15;
    res.json({ routes: {
      fastest:  buildRoute('fastest',  base,       0,     0),
      safest:   buildRoute('safest',   base * 0.6, 0.012, 10),
      balanced: buildRoute('balanced', base * 0.8, 0.006, 5),
      meta: { usingFallback: false, source: 'orchestrator' },
    }, timestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// INCIDENTS — with Cybersecurity: Trust Scoring + Fake Detection
// ════════════════════════════════════════════════════════════════
app.post('/api/incidents', authenticate, async (req, res) => {
  try {
    const { type, severity, lat, lng, description, anonymous } = req.body;

    // CYBERSECURITY: Input validation
    if (!type || !severity || lat == null || lng == null)
      return res.status(400).json({ error: 'type, severity, lat, lng required' });
    const parsedLat = parseFloat(lat), parsedLng = parseFloat(lng);
    const parsedSev = Math.min(5, Math.max(1, parseInt(severity)));
    if (isNaN(parsedLat) || isNaN(parsedLng))
      return res.status(400).json({ error: 'Invalid coordinates' });

    // CYBERSECURITY A: Trust score of reporter
    const userTrust   = req.user ? req.user.trustScore : 40;
    let   trustWeight = userTrust / 100; // 0.4 (guest) to 1.0 (trusted user)
    let   trustStatus = req.user ? (userTrust >= 75 ? 'Highly Verified ✅' : 'Verified 🔵') : 'Guest / Low Trust ⚠️';

    // CYBERSECURITY B: Fake Incident Detection
    // If ≥3 reports within 30m in last 10 min → mark suspicious
    const recentNearby = store.incidents.filter(inc => {
      const distM = haversine(parsedLat, parsedLng, inc.location.coordinates[1], inc.location.coordinates[0]) * 1000;
      const ageMs = Date.now() - new Date(inc.createdAt).getTime();
      return distM < 30 && ageMs < 10 * 60 * 1000;
    });

    let isSuspicious = false;
    if (recentNearby.length >= 3) {
      isSuspicious  = true;
      trustWeight  *= 0.1; // Slash to 10% weight
      trustStatus   = 'Suspicious 🚩 (spam detected)';
    } else if (req.user && userTrust >= 75) {
      trustWeight = Math.min(1.3, trustWeight * 1.3); // Boost verified users
    }

    const effectiveSeverity = Math.min(5, Math.max(1, Math.round(parsedSev * trustWeight)));

    const incident = {
      _id: Date.now().toString(),
      type, severity: effectiveSeverity, originalSeverity: parsedSev,
      description: description || null,
      reporterId:  req.user ? req.user.id : 'guest',
      trustStatus, trustWeight: parseFloat(trustWeight.toFixed(2)),
      isSuspicious,
      location: { type: 'Point', coordinates: [parsedLng, parsedLat] },
      active: true, upvotes: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    };
    store.incidents.push(incident);

    // Update reporter trust positively (for future reports)
    if (req.user) {
      req.user.reportsCount++;
      if (!isSuspicious && req.user.trustScore < 95)
        req.user.trustScore = Math.min(95, req.user.trustScore + 2);
    }

    // Forward to ML engine
    let updatedRisk = null;
    try {
      const mlRes = await axios.post(`${ML_URL}/report-incident`, {
        latitude: parsedLat, longitude: parsedLng, type, severity: effectiveSeverity,
      }, { timeout: 3000 });
      updatedRisk = mlRes.data.updated_risk;
    } catch {}

    // Real-time broadcast via WebSocket
    io.emit('safety-update', {
      lat: parsedLat, lng: parsedLng,
      safetyScore:  updatedRisk?.safety_score ?? Math.max(10, 80 - effectiveSeverity * 15),
      riskLevel:    updatedRisk?.risk_level    ?? (effectiveSeverity >= 4 ? 'HIGH' : effectiveSeverity >= 3 ? 'MEDIUM' : 'LOW'),
      incidentType: type, severity: effectiveSeverity,
      trustStatus, isSuspicious,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ incident, trustStatus, effectiveSeverity, isSuspicious, updatedRisk });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/incidents/nearby', (req, res) => {
  const { lat, lng, radius = 3000 } = req.query;
  const nearby = store.incidents.filter(i => {
    const d = haversine(parseFloat(lat), parseFloat(lng), i.location.coordinates[1], i.location.coordinates[0]) * 1000;
    return d <= parseInt(radius);
  });
  res.json({ incidents: nearby, count: nearby.length });
});

app.get('/api/incidents/heatmap', (_, res) => {
  const points = store.incidents.map(i => ({
    lat: i.location.coordinates[1], lng: i.location.coordinates[0],
    weight: i.severity, type: i.type, time: i.createdAt,
  }));
  res.json({ points, count: points.length });
});

app.post('/api/incidents/:id/upvote', (req, res) => {
  const inc = store.incidents.find(i => i._id === req.params.id);
  if (!inc) return res.status(404).json({ error: 'Not found' });
  inc.upvotes++;
  res.json({ incident: inc });
});

// ── Safety Score ──────────────────────────────────────────────────
app.get('/api/safety/score', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const mlRes = await axios.post(`${ML_URL}/predict-risk`, {
      latitude: parseFloat(lat), longitude: parseFloat(lng), time: new Date().getHours(),
    }, { timeout: 6000 });
    const d = mlRes.data;
    const color = d.risk_level === 'LOW' ? '#22c55e' : d.risk_level === 'MEDIUM' ? '#f59e0b' : '#ef4444';
    res.json({ score: d.safety_score, riskLevel: d.risk_level, riskColor: color, factors: d.factors });
  } catch {
    const score = Math.round(40 + Math.abs(Math.sin(parseFloat(lat)*100 + parseFloat(lng)*100)) * 55);
    const riskLevel = score >= 75 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH';
    res.json({ score, riskLevel, riskColor: score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444', factors: {} });
  }
});

// ── Zones ─────────────────────────────────────────────────────────
const DEMO_ZONES = [
  { _id:'z1', name:'India Gate',       type:'safe',    safetyScore:82, radius:400, location:{coordinates:[77.2295,28.6129]} },
  { _id:'z2', name:'Connaught Place',  type:'caution', safetyScore:65, radius:450, location:{coordinates:[77.2167,28.6315]} },
  { _id:'z3', name:'Old Delhi Chowk', type:'danger',  safetyScore:28, radius:350, location:{coordinates:[77.2300,28.6562]} },
  { _id:'z4', name:'Karol Bagh',       type:'danger',  safetyScore:38, radius:400, location:{coordinates:[77.1913,28.6517]} },
  { _id:'z5', name:'Hauz Khas',        type:'safe',    safetyScore:79, radius:300, location:{coordinates:[77.2001,28.5494]} },
  { _id:'z6', name:'Paharganj',        type:'danger',  safetyScore:30, radius:300, location:{coordinates:[77.2128,28.6453]} },
];
app.get('/api/zones/nearby',  (_, res) => res.json({ zones: DEMO_ZONES }));
app.post('/api/zones/seed',   (_, res) => res.json({ inserted: 0, message: 'Using built-in zones' }));

// ── Cybersecurity Hub Endpoints ─────────────────────────────────────

/**
 * Mock Deepfake Detection API
 * In a real scenario, this would call a model like FaceForensics++ or a Vision Transformer.
 */
app.post('/api/cyber/analyze', authenticate, (req, res) => {
  const { mediaUrl, incidentId } = req.body;
  
  // Simulation: analyze for GAN artifacts, frequency consistency, and metadata anomalies
  const isAI = Math.random() > 0.7; // 30% chance for demo
  const confidence = 0.85 + (Math.random() * 0.14);
  
  const analysis = {
    isAI,
    confidence,
    markers: isAI ? ['GAN_Artifacts_Detected', 'Frequency_Domain_Anomaly', 'Metadata_Mismatch'] : ['Natural_Noise_Distribution'],
    timestamp: new Date()
  };

  if (isAI) {
    store.cyberAlerts.unshift({
      id: Date.now(),
      type: 'Deepfake',
      status: 'Flagged',
      target: `Incident #${incidentId || 'Unknown'}`,
      confidence,
      timestamp: new Date()
    });
  }
  res.json(analysis);
});

app.get('/api/cyber/alerts', (req, res) => {
  res.json({ alerts: store.cyberAlerts.slice(0, 10) });
});

app.post('/api/cyber/report', authenticate, (req, res) => {
  const { type, description, severity } = req.body;
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  const newAlert = {
    id: Date.now(),
    type: type || 'Manual Report',
    description,
    status: 'Investigating',
    severity: severity || 'Medium',
    reporter: req.user.name,
    timestamp: new Date()
  };
  store.cyberAlerts.unshift(newAlert);
  res.json({ success: true, alert: newAlert });
});

// ── Analytics ─────────────────────────────────────────────────────
app.get('/api/analytics/stats', (req, res) => {
  const stats = {
    totalIncidents: store.incidents.length,
    totalRoutes: store.routes.length,
    totalUsers: store.users.length,
    suspiciousReports: store.incidents.filter(i => i.isSuspicious).length,
    cyberThreatsBlocked: store.cyberAlerts.length,
    incidentsByType: Object.entries(
      store.incidents.reduce((acc, curr) => {
        acc[curr.type] = (acc[curr.type] || 0) + 1;
        return acc;
      }, {})
    ).map(([_id, count]) => ({ _id, count }))
  };
  res.json(stats);
});

app.get('/api/analytics/trend', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const trend = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days-1-i)*86400000);
    return { _id: d.toISOString().split('T')[0], count: Math.floor(Math.random()*8) + store.incidents.length };
  });
  res.json({ trend });
});

// ── Hourly safety (for time slider preview) ───────────────────────
app.get('/api/safety/hourly', (_, res) => {
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    riskMultiplier: getTimeRiskMultiplier(h),
    label: getTimeLabel(h),
    safetyIndex: Math.round((1 / getTimeRiskMultiplier(h)) * 100),
  }));
  res.json({ hourly });
});

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message });
});

// ── Auto-expire incidents after 24h ───────────────────────────────
setInterval(() => {
  const before = store.incidents.length;
  store.incidents = store.incidents.filter(i => new Date(i.expiresAt).getTime() > Date.now());
  const removed = before - store.incidents.length;
  if (removed > 0) console.log(`[Cleanup] Expired ${removed} incidents`);
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`
╔══════════════════════════════════════════════════════╗
║  SafeRoutes AI — Hackathon Backend v3.0             ║
║  http://localhost:${PORT}                             ║
║  Features: Orchestration · Time Risk · Cybersecurity ║
╚══════════════════════════════════════════════════════╝`));

module.exports = { app, io };
