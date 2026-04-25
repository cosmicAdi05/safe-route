const express = require('express');
const { computeRoutes } = require('../services/routeOptimizer');
const Route = require('../models/Route');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── Compute Routes ─────────────────────────────────────────────────────────────
// POST /api/routes/compute
router.post('/compute', async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng, originLabel, destLabel } = req.body;
    if (!originLat || !originLng || !destLat || !destLng)
      return res.status(400).json({ error: 'Origin and destination coordinates required' });

    const routes = await computeRoutes(
      parseFloat(originLat), parseFloat(originLng),
      parseFloat(destLat),   parseFloat(destLng)
    );

    // Optionally save if user is authenticated
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        const { id: userId } = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        await Route.insertMany([
          { userId, origin: { label: originLabel, lat: originLat, lng: originLng },
            destination: { label: destLabel, lat: destLat, lng: destLng }, ...routes.safest },
          { userId, origin: { label: originLabel, lat: originLat, lng: originLng },
            destination: { label: destLabel, lat: destLat, lng: destLng }, ...routes.fastest },
          { userId, origin: { label: originLabel, lat: originLat, lng: originLng },
            destination: { label: destLabel, lat: destLat, lng: destLng }, ...routes.balanced },
        ]);
        // Update user stats
        const User = require('../models/User');
        await User.findByIdAndUpdate(userId, { $inc: { 'stats.routesComputed': 1 } });
      } catch {}
    }

    res.json({ routes, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get User's Route History ───────────────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  const routes = await Route.find({ userId: req.userId })
    .sort({ computedAt: -1 })
    .limit(20);
  res.json({ routes });
});

module.exports = router;
