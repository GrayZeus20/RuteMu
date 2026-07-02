const express = require('express');
const router = express.Router();
const { getDb, save } = require('../db');
const crypto = require('crypto');

function uid() { return crypto.randomBytes(8).toString('hex'); }

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.vehicles.reverse());
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uid();
  const vehicle = { id, name, color: color || '#3388ff', created_at: new Date().toISOString() };
  db.vehicles.push(vehicle);
  save();
  res.status(201).json(vehicle);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const vehicle = db.vehicles.find(v => v.id === req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(vehicle);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const idx = db.vehicles.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Vehicle not found' });
  const vehicle = db.vehicles.splice(idx, 1)[0];
  // Also remove related positions (keep trips for history)
  db.positions = db.positions.filter(p => p.vehicle_id !== req.params.id);
  save();
  res.json({ deleted: true, vehicle });
});

router.get('/:id/latest', (req, res) => {
  const db = getDb();
  const positions = db.positions.filter(p => p.vehicle_id === req.params.id);
  if (positions.length === 0) return res.json(null);
  res.json(positions[positions.length - 1]);
});

module.exports = router;
