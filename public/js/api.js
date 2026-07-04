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

  getStats() { return this.request('/api/stats'); },

  getExplorePlaces({ q, type, lat, lng, limit } = {}) {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (type && type !== 'all') qs.set('type', type);
    if (lat != null && lng != null) { qs.set('lat', lat); qs.set('lng', lng); }
    if (limit) qs.set('limit', limit);
    const qstr = qs.toString();
    return this.request(`/api/explore/places${qstr ? '?' + qstr : ''}`);
  },
  getExploreSuppliers() { return this.request('/api/explore/suppliers'); },
  getExplorePayments() { return this.request('/api/explore/payments'); },
  getExploreHistory() { return this.request('/api/explore/history'); }
};
