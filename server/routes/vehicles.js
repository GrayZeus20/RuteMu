const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  const docs = await db.vehicles().find().sort({ _id: -1 }).toArray();
  res.json(docs.map(d => ({ id: d.id, name: d.name, color: d.color, created_at: d.created_at })));
});

router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const vehicle = { id: db.uid(), name, color: color || '#3388ff', created_at: new Date().toISOString() };
  await db.vehicles().insertOne(vehicle);
  res.status(201).json({ id: vehicle.id, name: vehicle.name, color: vehicle.color, created_at: vehicle.created_at });
});

router.get('/:id', async (req, res) => {
  const vehicle = await db.vehicles().findOne({ id: req.params.id });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ id: vehicle.id, name: vehicle.name, color: vehicle.color, created_at: vehicle.created_at });
});

router.delete('/:id', async (req, res) => {
  const vehicle = await db.vehicles().findOneAndDelete({ id: req.params.id });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  await db.positions().deleteMany({ vehicle_id: req.params.id });
  res.json({ deleted: true, vehicle: { id: vehicle.id, name: vehicle.name } });
});

router.get('/:id/latest', async (req, res) => {
  const pos = await db.positions().find({ vehicle_id: req.params.id })
    .sort({ timestamp: -1 }).limit(1).toArray();
  res.json(pos.length > 0 ? pos[0] : null);
});

module.exports = router;