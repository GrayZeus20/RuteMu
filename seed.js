const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');

function uid() { return crypto.randomBytes(8).toString('hex'); }

function rand(min, max) { return Math.random() * (max - min) + min; }

function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

const vehicles = [
  { id: 'v001', name: 'Truck Logistik A', color: '#3b82f6' },
  { id: 'v002', name: 'Motor Kurir B', color: '#22c55e' },
  { id: 'v003', name: 'Mobil Ops C', color: '#f59e0b' },
  { id: 'v004', name: 'Bus Trans D', color: '#ef4444' },
  { id: 'v005', name: 'Pickup Ekspedisi E', color: '#8b5cf6' },
];

const tripTemplates = [
  { name: 'Jakarta - Bekasi Delivery', vehicleId: 'v001', latStart: -6.200, lngStart: 106.800, latEnd: -6.248, lngEnd: 106.999, points: 30 },
  { name: 'Bekasi - Jakarta Return', vehicleId: 'v001', latStart: -6.231, lngStart: 106.898, latEnd: -6.198, lngEnd: 106.818, points: 25 },
  { name: 'South Jakarta Route', vehicleId: 'v002', latStart: -6.250, lngStart: 106.791, latEnd: -6.300, lngEnd: 106.821, points: 20 },
  { name: 'Kebayoran Loop', vehicleId: 'v002', latStart: -6.280, lngStart: 106.809, latEnd: -6.239, lngEnd: 106.778, points: 22 },
  { name: 'Office Route AM', vehicleId: 'v003', latStart: -6.180, lngStart: 106.819, latEnd: -6.198, lngEnd: 106.849, points: 18 },
  { name: 'Office Route PM', vehicleId: 'v003', latStart: -6.191, lngStart: 106.830, latEnd: -6.176, lngEnd: 106.809, points: 15 },
  { name: 'Transit Halim - Pondok Indah', vehicleId: 'v004', latStart: -6.257, lngStart: 106.891, latEnd: -6.265, lngEnd: 106.783, points: 28 },
  { name: 'Pondok Indah - SCBD', vehicleId: 'v004', latStart: -6.265, lngStart: 106.783, latEnd: -6.224, lngEnd: 106.807, points: 20 },
  { name: 'Gudang Cakung - Tanjung Priok', vehicleId: 'v005', latStart: -6.219, lngStart: 106.956, latEnd: -6.109, lngEnd: 106.883, points: 35 },
  { name: 'Tanjung Priok - Kota Tua', vehicleId: 'v005', latStart: -6.109, lngStart: 106.883, latEnd: -6.137, lngEnd: 106.812, points: 22 },
];

function generatePositions(tripId, vehicleId, template, tripStart) {
  const positions = [];
  const latStep = (template.latEnd - template.latStart) / template.points;
  const lngStep = (template.lngEnd - template.lngStart) / template.points;

  for (let i = 0; i < template.points; i++) {
    const t = tripStart + i * 15000;
    const lat = template.latStart + latStep * i + rand(-0.001, 0.001);
    const lng = template.lngStart + lngStep * i + rand(-0.001, 0.001);
    positions.push({
      trip_id: tripId,
      vehicle_id: vehicleId,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      speed: parseFloat(rand(2, 15).toFixed(3)),
      heading: randInt(0, 359),
      accuracy: randInt(5, 20),
      altitude: randInt(10, 60),
      timestamp: new Date(t).toISOString(),
    });
  }
  return positions;
}

function generateTrips() {
  const trips = [];
  const allPositions = [];
  const baseTime = Date.parse('2026-06-26T22:35:09.710Z');

  tripTemplates.forEach((tmpl, idx) => {
    const tripId = `trip${String(idx + 1).padStart(3, '0')}`;
    const startTime = baseTime + idx * 3600000 * 8 + randInt(0, 3600000);
    const tripDuration = tmpl.points * 15000;
    const endTime = startTime + tripDuration;

    const positions = generatePositions(tripId, tmpl.vehicleId, tmpl, startTime);

    let distance = 0;
    let maxSpeed = 0;
    let speedSum = 0;

    for (let i = 1; i < positions.length; i++) {
      const d = haversine(positions[i - 1].lat, positions[i - 1].lng, positions[i].lat, positions[i].lng);
      distance += d;
    }

    positions.forEach(p => {
      maxSpeed = Math.max(maxSpeed, p.speed);
      speedSum += p.speed;
    });

    const avgSpeed = positions.length > 0 ? speedSum / positions.length : 0;

    trips.push({
      id: tripId,
      vehicle_id: tmpl.vehicleId,
      name: tmpl.name,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      distance: parseFloat(distance.toFixed(2)),
      avg_speed: parseFloat(avgSpeed.toFixed(2)),
      max_speed: parseFloat(maxSpeed.toFixed(2)),
    });

    allPositions.push(...positions);
  });

  return { trips, positions: allPositions };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const { trips, positions } = generateTrips();

const data = {
  vehicles: vehicles.map(v => ({
    ...v,
    created_at: new Date(Date.parse('2026-06-21T23:05:09.710Z') + Math.random() * 86400000 * 5).toISOString(),
  })),
  trips,
  positions,
};

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

console.log(`Seed data generated:`);
console.log(`  Vehicles : ${data.vehicles.length}`);
console.log(`  Trips    : ${data.trips.length}`);
console.log(`  Positions: ${data.positions.length}`);
console.log(`File saved: ${dbPath}`);
