require('dotenv').config();
const db = require('./server/db');
const fs = require('fs');

async function seed() {
  await db.connect();

  const hasVehicles = (await db.vehicles().countDocuments()) > 0;
  if (!hasVehicles) {
    const raw = fs.readFileSync('./data/db.json', 'utf8');
    const data = JSON.parse(raw);

    if (data.vehicles.length > 0) {
      await db.vehicles().insertMany(data.vehicles);
      console.log(`Seeded ${data.vehicles.length} vehicles`);
    }
    if (data.trips.length > 0) {
      await db.trips().insertMany(data.trips);
      console.log(`Seeded ${data.trips.length} trips`);
    }
    if (data.positions.length > 0) {
      await db.positions().insertMany(data.positions);
      console.log(`Seeded ${data.positions.length} positions`);
    }
  } else {
    console.log('MongoDB already has vehicle data, skipping base seed.');
  }

  const hasPlaces = (await db.places().countDocuments()) > 0;
  if (!hasPlaces) {
    const places = [
      { id: db.uid(), name: 'Gudang Logistik Utama', type: 'supplier', category: 'Gudang', address: 'Jl. Raya Logistics No.1, Jakarta', lat: -6.210, lng: 106.820, color: '#f59e0b', rating: 4.8, transactions: 124, lastVisit: '2026-07-04T04:12:00Z' },
      { id: db.uid(), name: 'Pabrik Komponen Selatan', type: 'supplier', category: 'Pabrik', address: 'Jl. Industri Km.12, Bekasi', lat: -6.240, lng: 106.990, color: '#ef4444', rating: 4.6, transactions: 98, lastVisit: '2026-07-03T06:35:00Z' },
      { id: db.uid(), name: 'Pasar Induk Gate 3', type: 'supplier', category: 'Pasar', address: 'Pasar Induk, Jakarta Timur', lat: -6.190, lng: 106.880, color: '#22c55e', rating: 4.3, transactions: 67, lastVisit: '2026-07-01T07:10:00Z' },
      { id: db.uid(), name: 'Pembayaran Tol Kota', type: 'payment', category: 'Tol', address: 'Gerbang Tol Jakarta Timur', lat: -6.215, lng: 106.895, color: '#6366f1', rating: 4.0, transactions: 312, lastVisit: '2026-07-04T03:40:00Z' },
      { id: db.uid(), name: 'Pembayaran BBM Shell', type: 'payment', category: 'SPBU', address: 'Jl. Sudirman Km.8, Jakarta', lat: -6.225, lng: 106.800, color: '#22c55e', rating: 4.7, transactions: 201, lastVisit: '2026-07-04T02:55:00Z' },
      { id: db.uid(), name: 'POS Paket Express JNE', type: 'payment', category: 'Kirim', address: 'Kantor JNE, Bekasi', lat: -6.260, lng: 106.960, color: '#ef4444', rating: 4.4, transactions: 145, lastVisit: '2026-07-03T09:12:00Z' },
      { id: db.uid(), name: 'Gudang Timur', type: 'supplier', category: 'Gudang', address: 'Jl. Timur Raya, Jakarta', lat: -6.295, lng: 106.920, color: '#3b82f6', rating: 4.5, transactions: 79, lastVisit: '2026-07-02T08:05:00Z' },
      { id: db.uid(), name: 'Parkir Bayar E-Park', type: 'payment', category: 'Parkir', address: 'Mall Central Park', lat: -6.175, lng: 106.790, color: '#8b5cf6', rating: 4.2, transactions: 56, lastVisit: '2026-07-01T05:44:00Z' }
    ];
    await db.places().insertMany(places);
    console.log(`Seeded ${places.length} places`);
  } else {
    console.log('Places already exist, skipping place seed.');
  }

  console.log('Seed complete!');
  await db.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
