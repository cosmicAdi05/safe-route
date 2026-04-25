const express = require('express');
const SafetyZone = require('../models/SafetyZone');

const router = express.Router();

// ── Get zones near a point ────────────────────────────────────────────────────
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 2000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const zones = await SafetyZone.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius),
        },
      },
    }).limit(30);

    res.json({ zones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Seed sample zones (admin use, for demo) ────────────────────────────────────
router.post('/seed', async (req, res) => {
  try {
    const { zones } = req.body;
    if (!Array.isArray(zones)) return res.status(400).json({ error: 'zones array required' });
    const inserted = await SafetyZone.insertMany(zones.map((z) => ({
      ...z,
      location: { type: 'Point', coordinates: [z.lng, z.lat] },
    })));
    res.status(201).json({ inserted: inserted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
