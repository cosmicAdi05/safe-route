const mongoose = require('mongoose');

// Individual segment between two waypoints
const segmentSchema = new mongoose.Schema({
  from: { lat: Number, lng: Number },
  to: { lat: Number, lng: Number },
  distanceKm: Number,
  safetyScore: { type: Number, min: 0, max: 100 },
  roadType: String,  // residential, primary, footway, etc.
});

const routeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  origin: {
    label: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  destination: {
    label: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  routeType: { type: String, enum: ['safest', 'fastest', 'balanced'], required: true },
  waypoints: [{ lat: Number, lng: Number }],
  segments: [segmentSchema],
  totalDistanceKm: Number,
  estimatedMinutes: Number,
  overallSafetyScore: { type: Number, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  // Computed factors
  safetyFactors: {
    crimeScore: Number,
    timeOfDayScore: Number,
    crowdScore: Number,
    weatherScore: Number,
    lightingScore: Number,
  },
  weatherSnapshot: {
    condition: String,
    temp: Number,
    visibility: Number,
  },
  computedAt: { type: Date, default: Date.now },
  selected: { type: Boolean, default: false },
});

module.exports = mongoose.model('Route', routeSchema);
