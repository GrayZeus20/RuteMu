const API = {
  async request(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getVehicles() { return this.request('/api/vehicles'); },
  addVehicle(name, color) { return this.request('/api/vehicles', { method: 'POST', body: JSON.stringify({ name, color }) }); },
  getVehicle(id) { return this.request(`/api/vehicles/${id}`); },
  getVehicleLatest(id) { return this.request(`/api/vehicles/${id}/latest`); },
  deleteVehicle(id) { return this.request(`/api/vehicles/${id}`, { method: 'DELETE' }); },

  getTrips(vehicleId) {
    const q = vehicleId ? `?vehicle_id=${vehicleId}` : '';
    return this.request(`/api/trips${q}`);
  },
  startTrip(vehicleId, name) { return this.request('/api/trips/start', { method: 'POST', body: JSON.stringify({ vehicle_id: vehicleId, name }) }); },
  endTrip(id) { return this.request(`/api/trips/${id}/end`, { method: 'POST' }); },
  getTrip(id) { return this.request(`/api/trips/${id}`); },
  getTripPositions(id) { return this.request(`/api/trips/${id}/positions`); },

  getStats() { return this.request('/api/stats'); }
};
