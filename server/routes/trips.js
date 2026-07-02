const express = require('express');
const router = express.Router();
const { getDb, save } = require('../db');
const crypto = require('crypto');

function uid() { return crypto.randomBytes(8).toString('hex'); }

router.get('/', (req, res) => {
  const db = getDb();
  const { vehicle_id } = req.query;
  let trips = db.trips;
  if (vehicle_id) trips = trips.filter(t => t.vehicle_id === vehicle_id);
  res.json(trips.reverse().slice(0, 50));
});

router.post('/start', (req, res) => {
  const db = getDb();
  const { vehicle_id, name } = req.body;
  if (!vehicle_id) return res.status(400).json({ error: 'vehicle_id required' });
  const id = uid();
  const trip = { id, vehicle_id, name: name || null, start_time: new Date().toISOString(), end_time: null, distance: 0, avg_speed: 0, max_speed: 0 };
  db.trips.push(trip);
  save();
  res.status(201).json(trip);
});

router.post('/:id/end', (req, res) => {
  const db = getDb();
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const tripPositions = db.positions.filter(p => p.trip_id === req.params.id);
  let distance = 0;
  const maxSpeed = tripPositions.reduce((m, p) => Math.max(m, p.speed || 0), 0);
  const avgSpeed = tripPositions.length > 0 ? tripPositions.reduce((s, p) => s + (p.speed || 0), 0) / tripPositions.length : 0;

  for (let i = 1; i < tripPositions.length; i++) {
    distance += haversine(tripPositions[i-1].lat, tripPositions[i-1].lng, tripPositions[i].lat, tripPositions[i].lng);
  }

  trip.end_time = new Date().toISOString();
  trip.distance = distance;
  trip.avg_speed = avgSpeed;
  trip.max_speed = maxSpeed;
  save();

  res.json(trip);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(trip);
});

router.get('/:id/positions', (req, res) => {
  const db = getDb();
  const positions = db.positions.filter(p => p.trip_id === req.params.id);
  res.json(positions);
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
