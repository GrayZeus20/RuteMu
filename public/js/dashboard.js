class Dashboard {
  constructor() {
    this.elements = {
      totalDist: document.getElementById('total-distance'),
      totalTrips: document.getElementById('total-trips'),
      totalVehicles: document.getElementById('total-vehicles'),
      currentSpeed: document.getElementById('current-speed'),
      tripList: document.getElementById('trip-list'),
      livePanel: document.getElementById('live-panel'),
      liveSpeed: document.getElementById('live-speed'),
      liveDist: document.getElementById('live-distance'),
      liveDuration: document.getElementById('live-duration'),
      liveDot: document.getElementById('live-dot'),
    };
    this.tripStartTime = null;
    this.tripDistance = 0;
    this.lastPosition = null;
  }

  async refreshStats() {
    try {
      const stats = await API.getStats();
      setText(this.elements.totalDist, this._formatDist(stats.distance));
      setText(this.elements.totalTrips, stats.trips);
      setText(this.elements.totalVehicles, stats.vehicles);
    } catch (e) { /* silent */ }
  }

  async refreshTrips(vehicleId) {
    try {
      const trips = await API.getTrips(vehicleId);
      this._renderTrips(trips);
    } catch (e) { /* silent */ }
  }

  _renderTrips(trips) {
    const el = this.elements.tripList;
    if (!el) return;
    if (!trips || trips.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="empty-state-text">No trips recorded yet</div>
        </div>`;
      return;
    }
    el.innerHTML = trips.map(t => {
      const dur = t.end_time
        ? this._formatDuration(new Date(t.start_time), new Date(t.end_time))
        : '<span style="color:var(--success)">In progress...</span>';
      const date = new Date(t.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="trip-card" data-id="${t.id}">
        <div class="trip-left">
          <div class="trip-name">${t.name || 'Trip · ' + t.id.slice(0, 6)}</div>
          <div class="trip-date">${date} · ${dur}</div>
        </div>
        <div class="trip-right">
          <div class="trip-distance">${this._formatDist(t.distance)}</div>
          <div class="trip-speed">${(t.avg_speed || 0).toFixed(1)} km/h</div>
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('.trip-card').forEach(card => {
      card.addEventListener('click', () => this._showTripDetail(card.dataset.id));
    });
  }

  async _showTripDetail(tripId) {
    try {
      const [positions, trip] = await Promise.all([
        API.getTripPositions(tripId),
        API.getTrip(tripId)
      ]);
      if (positions.length > 0) {
        App.mapManager.showRoute(positions, App.currentVehicle?.color || '#6366f1');
        this.showLiveInfo({
          speed: trip.avg_speed || 0,
          distance: trip.distance || 0,
          duration: trip.end_time
            ? this._formatDuration(new Date(trip.start_time), new Date(trip.end_time))
            : '00:00'
        });
        App.toast('Route loaded from trip history', 'info');
      }
    } catch (e) { /* silent */ }
  }

  updateTripProgress(position) {
    if (!this.tripStartTime) this.tripStartTime = Date.now();
    if (this.lastPosition) {
      const d = this._haversine(this.lastPosition.lat, this.lastPosition.lng, position.lat, position.lng);
      if (d < 100) this.tripDistance += d;
    }
    this.lastPosition = position;

    const speedKmh = position.speed * 3.6;
    const duration = Date.now() - this.tripStartTime;

    this.showLiveInfo({
      speed: speedKmh,
      distance: this.tripDistance,
      duration: this._formatDurationMs(duration)
    });

    setText(this.elements.currentSpeed, speedKmh.toFixed(1));
  }

  showLiveInfo({ speed, distance, duration }) {
    const panel = this.elements.livePanel;
    if (!panel) return;
    if (!panel.classList.contains('show') && !App.trackingActive) {
      panel.classList.add('show');
    }
    if (this.elements.liveSpeed) {
      this.elements.liveSpeed.innerHTML = `${(speed || 0).toFixed(1)} <span class="live-unit">km/h</span>`;
    }
    if (this.elements.liveDist) {
      this.elements.liveDist.innerHTML = `${this._formatDist(distance || 0)}`;
    }
    if (this.elements.liveDuration) {
      this.elements.liveDuration.textContent = duration || '00:00';
    }
  }

  showLivePanel() {
    const panel = this.elements.livePanel;
    if (panel) {
      panel.classList.add('show');
      if (this.elements.liveDot) this.elements.liveDot.classList.add('active');
    }
  }

  hideLivePanel() {
    const panel = this.elements.livePanel;
    if (panel) panel.classList.remove('show');
  }

  resetTrip() {
    this.tripStartTime = null;
    this.tripDistance = 0;
    this.lastPosition = null;
    this.hideLivePanel();
  }

  _formatDist(meters) {
    if (!meters || meters <= 0) return '0 <span class="live-unit">m</span>';
    if (meters < 1000) return `${Math.round(meters)} <span class="live-unit">m</span>`;
    return `${(meters / 1000).toFixed(2)} <span class="live-unit">km</span>`;
  }

  _formatDuration(start, end) {
    return this._formatDurationMs(end - start);
  }

  _formatDurationMs(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    if (hr > 0) return `${hr}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
  }

  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

function setText(el, val) {
  if (el) el.innerHTML = val;
}
