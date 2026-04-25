const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  preferences: {
    safetyWeight: { type: Number, default: 0.6, min: 0, max: 1 },
    speedWeight: { type: Number, default: 0.4, min: 0, max: 1 },
    womenSafetyMode: { type: Boolean, default: false },
    nightAlerts: { type: Boolean, default: true },
    voiceAlerts: { type: Boolean, default: false },
  },
  stats: {
    routesComputed: { type: Number, default: 0 },
    incidentsReported: { type: Number, default: 0 },
    safeKmTravelled: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
