require('dotenv').config();
const db = require('./server/db');
const fs = require('fs');

async function seed() {
  await db.connect();

  const existing = await db.vehicles().countDocuments();
  if (existing > 0) {
    console.log('MongoDB already has data, skipping seed.');
    await db.close();
    return;
  }

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

  console.log('Seed complete!');
  await db.close();
}

seed().catch(err => { console.error(err); process.exit(1); });