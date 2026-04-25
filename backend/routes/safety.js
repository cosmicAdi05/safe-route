const express = require('express');
const { computeSafetyScore } = require('../services/safetyEngine');
const SafetyZone = require('../models/SafetyZone');

const router = express.Router();

// ── Score a point (GET /api/safety/score?lat=&lng=) ──────────────────────────
router.get('/score', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const result = await computeSafetyScore(parseFloat(lat), parseFloat(lng));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Score multiple points (POST /api/safety/batch) ────────────────────────────
router.post('/batch', async (req, res) => {
  try {
    const { points } = req.body; // [{lat, lng}, ...]
    if (!Array.isArray(points) || points.length === 0)
      return res.status(400).json({ error: 'points array required' });

    const results = await Promise.all(
      points.slice(0, 50).map(async ({ lat, lng }) => {
        const score = await computeSafetyScore(lat, lng);
        return { lat, lng, ...score };
      })
    );
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Time-slider heatmap scores (GET /api/safety/hourly?lat=&lng=) ─────────────
router.get('/hourly', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const { getTimeOfDaySafety } = require('../services/safetyEngine');
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      timeScore: getTimeOfDaySafety(h),
    }));
    res.json({ hourly, lat, lng });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
