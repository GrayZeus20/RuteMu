const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  const { vehicle_id } = req.query;
  const filter = {};
  if (vehicle_id) filter.vehicle_id = vehicle_id;
  const docs = await db.trips().find(filter).sort({ _id: -1 }).limit(50).toArray();
  res.json(docs.map(t => ({ id: t.id, vehicle_id: t.vehicle_id, name: t.name,
    start_time: t.start_time, end_time: t.end_time, distance: t.distance,
    avg_speed: t.avg_speed, max_speed: t.max_speed })));
});

router.post('/start', async (req, res) => {
  const { vehicle_id, name } = req.body;
  if (!vehicle_id) return res.status(400).json({ error: 'vehicle_id required' });
  const trip = {
    id: db.uid(), vehicle_id, name: name || null,
    start_time: new Date().toISOString(), end_time: null,
    distance: 0, avg_speed: 0, max_speed: 0
  };
  await db.trips().insertOne(trip);
  res.status(201).json({ id: trip.id, vehicle_id: trip.vehicle_id, name: trip.name,
    start_time: trip.start_time, end_time: trip.end_time, distance: trip.distance,
    avg_speed: trip.avg_speed, max_speed: trip.max_speed });
});

router.post('/:id/end', async (req, res) => {
  const trip = await db.trips().findOne({ id: req.params.id });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const tripPositions = await db.positions().find({ trip_id: req.params.id }).toArray();
  let distance = 0;
  const maxSpeed = tripPositions.reduce((m, p) => Math.max(m, p.speed || 0), 0);
  const avgSpeed = tripPositions.length > 0
    ? tripPositions.reduce((s, p) => s + (p.speed || 0), 0) / tripPositions.length : 0;

  for (let i = 1; i < tripPositions.length; i++) {
    distance += haversine(tripPositions[i-1].lat, tripPositions[i-1].lng,
      tripPositions[i].lat, tripPositions[i].lng);
  }

  await db.trips().updateOne({ id: req.params.id }, {
    $set: {
      end_time: new Date().toISOString(),
      distance, avg_speed: avgSpeed, max_speed: maxSpeed
    }
  });

  const updated = await db.trips().findOne({ id: req.params.id });
  res.json({ id: updated.id, vehicle_id: updated.vehicle_id, name: updated.name,
    start_time: updated.start_time, end_time: updated.end_time,
    distance: updated.distance, avg_speed: updated.avg_speed, max_speed: updated.max_speed });
});

router.get('/:id', async (req, res) => {
  const trip = await db.trips().findOne({ id: req.params.id });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json({ id: trip.id, vehicle_id: trip.vehicle_id, name: trip.name,
    start_time: trip.start_time, end_time: trip.end_time, distance: trip.distance,
    avg_speed: trip.avg_speed, max_speed: trip.max_speed });
});

router.get('/:id/positions', async (req, res) => {
  const docs = await db.positions().find({ trip_id: req.params.id }).toArray();
  res.json(docs);
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