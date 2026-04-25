const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  type: {
    type: String,
    enum: [
      'theft', 'assault', 'harassment', 'accident',
      'poor_lighting', 'suspicious_activity', 'eve_teasing',
      'road_hazard', 'crowd_surge', 'other'
    ],
    required: true,
  },
  severity: { type: Number, min: 1, max: 5, required: true },  // 1=minor, 5=critical
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },  // [lng, lat]
  },
  address: { type: String },
  description: { type: String, maxlength: 500 },
  anonymous: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  upvotes: { type: Number, default: 0 },
  active: { type: Boolean, default: true },   // false after 24h
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Geospatial index for nearby queries
incidentSchema.index({ location: '2dsphere' });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ active: 1, 'location': '2dsphere' });

// Auto-expire incidents after 24 hours
incidentSchema.pre('save', function (next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Incident', incidentSchema);
