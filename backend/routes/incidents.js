const express = require('express');
const Incident = require('../models/Incident');
const SafetyZone = require('../models/SafetyZone');
const { computeSafetyScore } = require('../services/safetyEngine');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// ── Report Incident (POST /api/incidents) ─────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type, severity, lat, lng, description, anonymous } = req.body;
    if (!type || !severity || lat == null || lng == null)
      return res.status(400).json({ error: 'type, severity, lat, lng required' });

    // Try to get userId from optional auth header
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        userId = decoded.id;
        await User.findByIdAndUpdate(userId, { $inc: { 'stats.incidentsReported': 1 } });
      } catch {}
    }

    const incident = await Incident.create({
      userId,
      type,
      severity: parseInt(severity),
      location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      description,
      anonymous: anonymous || !userId,
    });

    // Recalculate safety score for this area and broadcast via Socket.io
    const newScore = await computeSafetyScore(lat, lng);
    const io = req.app.get('io');
    io.emit('safety-update', {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      safetyScore: newScore.score,
      riskLevel: newScore.riskLevel,
      incidentType: type,
      severity: parseInt(severity),
      timestamp: new Date().toISOString(),
    });

    // Update or create a safety zone at this location
    await SafetyZone.findOneAndUpdate(
      { location: { $near: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 200 } } },
      { $set: { safetyScore: newScore.score }, $inc: { incidentCount: 1 }, lastUpdated: new Date() },
      { new: true, upsert: false }
    );

    res.status(201).json({ incident, updatedSafetyScore: newScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Nearby Incidents (GET /api/incidents/nearby) ─────────────────────────
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 1000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const incidents = await Incident.find({
      active: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius),
        },
      },
    })
      .limit(50)
      .select('-userId');

    res.json({ incidents, count: incidents.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upvote Incident ───────────────────────────────────────────────────────────
router.post('/:id/upvote', async (req, res) => {
  const incident = await Incident.findByIdAndUpdate(
    req.params.id,
    { $inc: { upvotes: 1 } },
    { new: true }
  );
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json({ incident });
});

// ── Get Recent Incidents (for heatmap) ───────────────────────────────────────
router.get('/heatmap', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 3_600_000);
    const incidents = await Incident.find({ createdAt: { $gte: since }, active: true })
      .select('location severity type createdAt')
      .limit(500);
    // Return as [lat, lng, intensity] for heatmap layer
    const points = incidents.map((inc) => ({
      lat: inc.location.coordinates[1],
      lng: inc.location.coordinates[0],
      weight: inc.severity,
      type: inc.type,
      time: inc.createdAt,
    }));
    res.json({ points, count: points.length, since: since.toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
