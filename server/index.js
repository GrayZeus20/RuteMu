const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { getDb, save } = require('./db');

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

app.get('/api/stats', (req, res) => {
  const db = getDb();
  res.json({
    vehicles: db.vehicles.length,
    trips: db.trips.filter(t => t.end_time).length,
    distance: db.trips.reduce((sum, t) => sum + (t.distance || 0), 0),
    positions: db.positions.length
  });
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

  socket.on('position-update', (data) => {
    const { vehicleId, tripId, lat, lng, speed, heading, accuracy, altitude } = data;
    if (vehicleId && lat != null && lng != null) {
      const db = getDb();
      db.positions.push({
        trip_id: tripId || '',
        vehicle_id: vehicleId,
        lat, lng,
        speed: speed || 0, heading: heading || 0,
        accuracy: accuracy || 0, altitude: altitude || 0,
        timestamp: new Date().toISOString()
      });
      save();

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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
