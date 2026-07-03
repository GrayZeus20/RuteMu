const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB || 'rute_mu';

let client = null;
let db = null;

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('MongoDB connected:', DB_NAME);
  return db;
}

async function close() {
  if (client) await client.close();
}

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

function vehicles() {
  return db.collection('vehicles');
}

function trips() {
  return db.collection('trips');
}

function positions() {
  return db.collection('positions');
}

async function getStats() {
  const vCount = await vehicles().countDocuments();
  const tCount = await trips().countDocuments({ end_time: { $ne: null } });
  const distAgg = await trips().aggregate([
    { $group: { _id: null, total: { $sum: '$distance' } } }
  ]).toArray();
  const distance = distAgg.length > 0 ? distAgg[0].total : 0;
  return { vehicles: vCount, trips: tCount, distance };
}

module.exports = { connect, close, uid, vehicles, trips, positions, getStats };