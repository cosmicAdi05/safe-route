const mongoose = require('mongoose');

const safetyZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['danger', 'caution', 'safe'], required: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },  // [lng, lat]
  },
  radius: { type: Number, default: 300 },  // meters
  safetyScore: { type: Number, min: 0, max: 100, required: true },
  // Detailed sub-scores (0-100 each, higher = safer)
  factors: {
    crimeIndex: { type: Number, default: 50 },
    lightingIndex: { type: Number, default: 50 },
    crowdIndex: { type: Number, default: 50 },
    policeProximity: { type: Number, default: 50 },
    incidentDensity: { type: Number, default: 50 },
  },
  // Time-varying scores: hour 0-23
  hourlyScores: { type: [Number], default: Array(24).fill(50) },
  // ML risk prediction output
  mlRiskScore: { type: Number, default: 50 },
  incidentCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  source: { type: String, enum: ['osm', 'manual', 'ml', 'crowdsourced'], default: 'crowdsourced' },
});

safetyZoneSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SafetyZone', safetyZoneSchema);
