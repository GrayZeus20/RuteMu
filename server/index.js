require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const vehiclesRouter = require('./routes/vehicles');
const tripsRouter = require('./routes/trips');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/vehicles', vehiclesRouter);
app.use('/api/trips', tripsRouter);

// Search + explore dataset
app.get('/api/explore/places', async (req, res) => {
  const { q, type, lat, lng, limit } = req.query;
  const pipeline = [];

  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const match = { $or: [
      { name: regex },
      { address: regex },
      { supplier: regex },
      { category: regex }
    ]};
    pipeline.push({ $match: match });
  }

  if (type && type !== 'all') pipeline.push({ $match: { type } });

  if (lat && lng) {
    pipeline.push({
      $addFields: {
        distance: {
          $sqrt: {
            $add: [
              { $pow: [{ $subtract: ['$lat', Number(lat)] }, 2] },
              { $pow: [{ $subtract: ['$lng', Number(lng)] }, 2] }
            ]
          }
        }
      }
    });
    pipeline.push({ $sort: { distance: 1 } });
  }

  pipeline.push({ $limit: Number(limit) || 20 });
  const docs = await db.places().aggregate(pipeline).toArray();
  res.json(docs);
});

app.get('/api/explore/suppliers', async (req, res) => {
  const docs = await db.places()
    .sort({ transactions: -1 })
    .limit(20)
    .toArray();
  res.json(docs);
});

app.get('/api/explore/payments', async (req, res) => {
  const docs = await db.places()
    .find({ type: 'payment' })
    .sort({ lastVisit: -1 })
    .limit(20)
    .toArray();
  res.json(docs);
});

app.get('/api/explore/history', async (req, res) => {
  const docs = await db.places()
    .find({ type: { $in: ['supplier','payment'] } })
    .sort({ lastVisit: -1 })
    .limit(30)
    .toArray();
  res.json(docs);
});

app.get('/api/stats', async (req, res) => {
  const stats = await db.getStats();
  res.json(stats);
});

const onlineVehicles = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('register-vehicle', (data) => {
    const { vehicleId, name } = data;
    socket.vehicleId = vehicleId;
    onlineVehicles.set(vehicleId, { id: vehicleId, name, socketId: socket.id, lastUpdate: Date.now() });
    io.emit('vehicles-online', Array.from(onlineVehicles.values()));
    console.log('Vehicle registered:', name, vehicleId);
  });

  socket.on('position-update', async (data) => {
    const { vehicleId, tripId, lat, lng, speed, heading, accuracy, altitude } = data;
    if (vehicleId && lat != null && lng != null) {
      await db.positions().insertOne({
        trip_id: tripId || '',
        vehicle_id: vehicleId,
        lat, lng,
        speed: speed || 0, heading: heading || 0,
        accuracy: accuracy || 0, altitude: altitude || 0,
        timestamp: new Date().toISOString()
      });

      if (onlineVehicles.has(vehicleId)) {
        onlineVehicles.get(vehicleId).lastUpdate = Date.now();
      }

      socket.broadcast.emit('position', { vehicleId, tripId, lat, lng, speed, heading, accuracy, altitude });
    }
  });

  socket.on('disconnect', () => {
    if (socket.vehicleId) {
      onlineVehicles.delete(socket.vehicleId);
      io.emit('vehicles-online', Array.from(onlineVehicles.values()));
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

db.connect().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});