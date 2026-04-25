const express = require('express');
const Incident = require('../models/Incident');
const Route = require('../models/Route');
const User = require('../models/User');

const router = express.Router();

// ── Platform Stats (GET /api/analytics/stats) ─────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalIncidents, totalRoutes, totalUsers, incidentsByType] = await Promise.all([
      Incident.countDocuments(),
      Route.countDocuments(),
      User.countDocuments(),
      Incident.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 }, avgSeverity: { $avg: '$severity' } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    res.json({ totalIncidents, totalRoutes, totalUsers, incidentsByType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Incident Trend (last N days) ──────────────────────────────────────────────
router.get('/trend', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 86_400_000);
    const trend = await Incident.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ trend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
