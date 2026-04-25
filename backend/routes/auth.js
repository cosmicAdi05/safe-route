const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed });
    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, preferences: user.preferences },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, preferences: user.preferences, stats: user.stats },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Profile ───────────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth'), async (req, res) => {
  const user = await User.findById(req.userId).select('-password');
  res.json({ user });
});

// ── Update Preferences ────────────────────────────────────────────────────────
router.patch('/preferences', require('../middleware/auth'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: { preferences: req.body } },
    { new: true, runValidators: true }
  ).select('-password');
  res.json({ user });
});

module.exports = router;
