/**
 * Seed script — populates MongoDB with sample SafetyZones for demo
 * Run: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SafetyZone = require('./models/SafetyZone');
const Incident   = require('./models/Incident');

// Sample zones around New Delhi
const SAMPLE_ZONES = [
  { name: 'Connaught Place',     lat: 28.6315, lng: 77.2167, safetyScore: 72, type: 'caution', radius: 500 },
  { name: 'India Gate',          lat: 28.6129, lng: 77.2295, safetyScore: 82, type: 'safe',    radius: 400 },
  { name: 'Nizamuddin Station',  lat: 28.5884, lng: 77.2511, safetyScore: 38, type: 'danger',  radius: 350 },
  { name: 'Lajpat Nagar',        lat: 28.5681, lng: 77.2375, safetyScore: 55, type: 'caution', radius: 450 },
  { name: 'Karol Bagh',          lat: 28.6517, lng: 77.1913, safetyScore: 48, type: 'danger',  radius: 400 },
  { name: 'Hauz Khas Village',   lat: 28.5494, lng: 77.2001, safetyScore: 78, type: 'safe',    radius: 300 },
  { name: 'Paharganj',           lat: 28.6453, lng: 77.2128, safetyScore: 32, type: 'danger',  radius: 300 },
  { name: 'Saket Mall Area',     lat: 28.5247, lng: 77.2066, safetyScore: 80, type: 'safe',    radius: 500 },
  { name: 'Dwarka Sector 10',    lat: 28.5753, lng: 77.0421, safetyScore: 65, type: 'caution', radius: 400 },
  { name: 'Rohini Sector 3',     lat: 28.7213, lng: 77.1197, safetyScore: 60, type: 'caution', radius: 450 },
  { name: 'Old Delhi Chowk',     lat: 28.6562, lng: 77.2300, safetyScore: 25, type: 'danger',  radius: 350 },
  { name: 'Nehru Place IT Hub',  lat: 28.5491, lng: 77.2521, safetyScore: 70, type: 'safe',    radius: 400 },
];

// Sample incidents
const SAMPLE_INCIDENTS = [
  { type: 'theft',              severity: 4, lat: 28.6453, lng: 77.2128 },
  { type: 'poor_lighting',      severity: 2, lat: 28.6315, lng: 77.2167 },
  { type: 'suspicious_activity',severity: 3, lat: 28.5884, lng: 77.2511 },
  { type: 'harassment',         severity: 4, lat: 28.6562, lng: 77.2300 },
  { type: 'road_hazard',        severity: 2, lat: 28.5681, lng: 77.2375 },
  { type: 'assault',            severity: 5, lat: 28.6517, lng: 77.1913 },
  { type: 'eve_teasing',        severity: 3, lat: 28.6453, lng: 77.2128 },
  { type: 'crowd_surge',        severity: 2, lat: 28.6129, lng: 77.2295 },
];

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);

  // Clear existing
  await SafetyZone.deleteMany({});
  await Incident.deleteMany({});
  console.log('[Seed] Cleared existing data');

  // Insert zones
  const zones = await SafetyZone.insertMany(
    SAMPLE_ZONES.map((z) => ({
      name: z.name,
      type: z.type,
      safetyScore: z.safetyScore,
      radius: z.radius,
      location: { type: 'Point', coordinates: [z.lng, z.lat] },
      source: 'manual',
      hourlyScores: Array(24).fill(0).map((_, h) => {
        // Night hours reduce score
        const isNight = h >= 21 || h <= 5;
        return Math.max(5, z.safetyScore - (isNight ? 20 : 0) + Math.floor(Math.random() * 10));
      }),
    }))
  );
  console.log(`[Seed] Inserted ${zones.length} safety zones`);

  // Insert incidents (spread over last 24 hours)
  const incidents = await Incident.insertMany(
    SAMPLE_INCIDENTS.map((inc, i) => ({
      type: inc.type,
      severity: inc.severity,
      location: { type: 'Point', coordinates: [inc.lng, inc.lat] },
      anonymous: true,
      active: true,
      description: `Sample ${inc.type.replace(/_/g, ' ')} incident for demo`,
      createdAt: new Date(Date.now() - i * 2 * 3600000), // spread over 16h
      expiresAt: new Date(Date.now() + 8 * 3600000),
    }))
  );
  console.log(`[Seed] Inserted ${incidents.length} sample incidents`);

  console.log('\n[Seed] ✅ Database seeded successfully!');
  console.log('[Seed] You can now start the backend: node server.js\n');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => { console.error('[Seed] Error:', err.message); process.exit(1); });
