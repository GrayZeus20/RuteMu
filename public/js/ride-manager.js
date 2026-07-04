// ride-manager.js Lite
const RideManager = {
  active: false,
  rideMode: false,
  rideMap: null,
  ridePath: [],
  rideStart: null,
  rideTimer: null,
  rideMinuteMarker: null,

  open(params = {}) {
    const screen = byId('ride-screen');
    if (!screen) return;
    screen.classList.remove('hidden');
    if (screen.style.display === 'none') screen.style.display = 'flex';
    this.rideMode = true;
    this._bind();
    this._initRideMap();
    if (!this.rideStart) this.rideStart = Date.now();
    this._startTimer();
    this._ensureMinuteMarker();
    this._emitEvent('ride_open', { source: params.source || 'app' });
  },

  close() {
    const screen = byId('ride-screen');
    if (screen) { screen.classList.add('hidden'); screen.style.display = 'none'; }
    this.rideMode = false;
    this._unbind();
    this._stopTimer();
    this._emitEvent('ride_close', {});
  },

  startRide() {
    if (this.active) return;
    this.active = true;
    const btn = byId('ride-start');
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      btn.innerHTML = '<span class="ride-start-stop">STOP</span>';
    }
    const panel = byId('ride-live-panel');
    if (panel) panel.classList.add('show');
    this.rideStart = this.rideStart || Date.now();
    this.ridePath = this.ridePath || [];
    this._emitEvent('ride_start', { start: this.rideStart });
  },

  stopRide() {
    if (!this.active) return;
    this.active = false;
    const now = Date.now();
    const duration = now - (this.rideStart || now);
    const payload = {
      durationMs: duration,
      distanceM: this._estimateDistanceMeters(),
      path: this.ridePath.slice(-600),
      source: 'RideManager'
    };
    this._emitEvent('ride_stop', payload);
    this._afterStopReset();
  },

  toggleStartStop() {
    this.active ? this.stopRide() : this.startRide();
  },

  async share() {
    if (!this.rideMode) return;
    const type = this.active ? 'live' : 'route';
    await this._shareRide(type);
  },

  addSnapshot(posOrLat, lng, speedMps, heading) {
    if (!this.rideMode) return;
    let point;
    if (Number.isFinite(posOrLat?.lat)) {
      point = [Number(posOrLat.lat.toFixed(6)), Number(posOrLat.lng.toFixed(6))];
      this._appendPoint(point);
      this._appendLiveStats(posOrLat.speed, posOrLat.heading);
    } else {
      point = [Number(posOrLat), Number(lng)];
      this._appendPoint(point);
      this._appendLiveStats(speedMps, heading);
    }
  },

  _appendPoint(point) {
    this.ridePath = this.ridePath || [];
    const last = this.ridePath[this.ridePath.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return;
    this.ridePath.push(point);
    if (this.ridePath.length > 1500) this.ridePath.splice(0, this.ridePath.length - 1200);
    this._updateMapPreview();
  },

  _appendLiveStats(speedMps, heading) {
    const speedEl = byId('live-speed');
    const distEl = byId('live-distance');
    const durEl = byId('live-duration');
    if (speedEl) {
      const kmh = typeof speedMps === 'number' && Number.isFinite(speedMps) ? (speedMps * 3.6).toFixed(1) : '0.0';
      speedEl.innerHTML = `${kmh} <span class="live-unit">km/h</span>`;
    }
    if (distEl) {
      const d = this._estimateDistanceMeters();
      distEl.innerHTML = `${Math.round(d)} <span class="live-unit">m</span>`;
    }
    if (durEl) durEl.textContent = this._formatDurationFromNow();
  },

  _initRideMap() {
    const container = byId('ride-map');
    if (!container) return;
    if (this.rideMap) return;
    this.rideMap = L.map('ride-map', { zoomControl: false, attributionControl: true }).setView([-6.2, 106.8], 14);
    const GoogleRoad = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google'
    });
    const GoogleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google'
    });
    this._layers = { standard: GoogleRoad, hybrid: GoogleHybrid };
    this._layers.standard.addTo(this.rideMap);
    L.control.zoom({ position: 'topright' }).addTo(this.rideMap);
    this._previewLine = L.polyline([], { color: '#FF6E14', weight: 5, opacity: 0.9 }).addTo(this.rideMap);
    this._dot = L.circleMarker([0, 0], { radius: 7, color: '#fff', fillColor: '#FF6E14', fillOpacity: 1, weight: 3 }).addTo(this.rideMap);
    this._locateRideUser();
  },

  _updateMapPreview() {
    if (!this.rideMap || !this._previewLine) return;
    const pts = (this.ridePath || []).slice();
    if (pts.length === 0) return;
    this._dot.setLatLng(pts[pts.length - 1]);
    this._previewLine.setLatLngs(pts);
    const pad = 0.25;
    if (pts.length === 1) this.rideMap.setView(pts[0], 16);
    else this.rideMap.fitBounds(L.latLngBounds(pts).pad(pad));
  },

  _locateRideUser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        if (this._dot) { this._dot.setLatLng(ll); }
        if (this._previewLine) this._previewLine.setLatLngs([ll]);
        if (this.rideMap) this.rideMap.setView(ll, 15);
        this._appendPoint(ll);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  },

  _ensureMinuteMarker() {
    if (this.rideMinuteMarker) return;
    const marker = L.circleMarker([-6.2, 106.8], {
      radius: 9, color: '#fff', fillColor: '#16a34a', fillOpacity: 0.95, weight: 3
    }).addTo(this.rideMap || this._initRideMap());
    this.rideMinuteMarker = marker;
    if (this.rideMap) this.rideMap.setView([-6.2, 106.8], 15);
    this._appendPoint([-6.2, 106.8]);
  },

  _estimateDistanceMeters() {
    const arr = this.ridePath || [];
    let sum = 0;
    for (let i = 1; i < arr.length; i++) sum += this._haversine(arr[i - 1], arr[i]);
    return sum;
  },

  _haversine(a, b) {
    const R = 6371e3;
    const toRad = (v) => v * Math.PI / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  },

  _formatDurationFromNow() {
    if (!this.rideStart) return '00:00';
    const s = Math.floor((Date.now() - this.rideStart) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  },

  _startTimer() {
    this._stopTimer();
    const tick = () => {
      const dur = byId('live-duration');
      const sp = byId('live-speed');
      const dist = byId('live-distance');
      if (dur) dur.textContent = this._formatDurationFromNow();
      if (!dur && !sp && !dist) return;
      this._appendLiveStats(sp ? parseFloat(sp.textContent || 0) : 0, 0);
      this.rideTimer = requestAnimationFrame(tick);
    };
    this.rideTimer = requestAnimationFrame(tick);
  },

  _stopTimer() {
    if (this.rideTimer) { cancelAnimationFrame(this.rideTimer); this.rideTimer = null; }
  },

  _afterStopReset() {
    this._stopTimer();
    this.ridePath = [];
    this.rideStart = Date.now();
    this.active = false;
    const btn = byId('ride-start');
    if (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = '<span>START</span>';
    }
    const panel = byId('ride-live-panel');
    if (panel) panel.classList.remove('show');
    const sp = byId('live-speed'); if (sp) sp.innerHTML = '0 <span class="live-unit">km/h</span>';
    const dist = byId('live-distance'); if (dist) dist.innerHTML = '0 <span class="live-unit">m</span>';
    const dur = byId('live-duration'); if (dur) dur.textContent = '00:00';
    if (this._previewLine) this._previewLine.setLatLngs([]);
  },

  _bind() {
    if (this._bound) return;
    this._bound = true;
    byId('ride-start')?.addEventListener('click', () => this.toggleStartStop());
    byId('ride-close')?.addEventListener('click', () => this.close());
    byId('ride-locate')?.addEventListener('click', () => {
      if (!this.rideMap) return;
      this._locateRideUser();
      byId('ride-locate')?.setAttribute('aria-pressed', 'true');
      setTimeout(() => byId('ride-locate')?.setAttribute('aria-pressed', 'false'), 1200);
    });
    byId('ride-layers')?.addEventListener('click', () => {
      this._toggleMapLayer();
      const btn = byId('ride-layers');
      if (btn) btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') !== 'true' ? 'true' : 'false');
    });
    byId('ride-3d')?.addEventListener('click', () => {
      this._openGoogleMapsView();
      const btn = byId('ride-3d');
      if (btn) btn.setAttribute('aria-pressed', 'true');
    });
    byId('ride-spotify')?.addEventListener('click', () => {
      this._openSpotify();
      const btn = byId('ride-spotify');
      if (btn) btn.setAttribute('aria-pressed', 'true');
    });
    byId('ride-heart')?.addEventListener('click', () => {
      this._openHealthConnect();
      const btn = byId('ride-heart');
      if (btn) btn.setAttribute('aria-pressed', 'true');
    });
    const tools = ['ride-route','ride-bike','ride-heart','ride-live','ride-spotify'];
    tools.forEach(id => {
      byId(id)?.addEventListener('click', () => {
        const btn = byId(id);
        const was = btn?.getAttribute('aria-pressed') === 'true';
        tools.forEach(t => byId(t)?.setAttribute('aria-pressed','false'));
        if (!was) btn?.setAttribute('aria-pressed','true');
      });
      if (byId(id)) byId(id).setAttribute('aria-pressed','false');
    });
    byId('ride-route')?.addEventListener('click', () => this._shareRide('route'));
    byId('ride-live')?.addEventListener('click', () => this._shareRide('live'));
    byId('ride-refresh')?.addEventListener('click', () => this._refreshRide());
    byId('ride-settings')?.addEventListener('click', () => this._openSettings());
    window.addEventListener('keydown', this._onKey);
  },

  _unbind() {
    this._bound = false;
    window.removeEventListener('keydown', this._onKey);
  },

  _onKey(e) {
    if (!this.rideMode) return;
    if (e.key === 'Escape') this.close();
  },

  _toggleMapLayer() {
    if (!this.rideMap || !this._layers) return;
    Object.values(this._layers).forEach(l => { if (this.rideMap.hasLayer(l)) this.rideMap.removeLayer(l); });
    const target = this._layerToggleRole === 'hybrid' ? this._layers.standard : this._layers.hybrid;
    target.addTo(this.rideMap);
    this._layerToggleRole = this._layerToggleRole === 'hybrid' ? 'standard' : 'hybrid';
  },

  _openGoogleMapsView() {
    try {
      const last = this.ridePath.at(-1);
      if (!last) { this._fallbackShare(); return; }
      const latLng = `${last[0]},${last[1]}`;
      if (this._isAndroid()) {
        window.open(`geo:0,0?q=${latLng}`, '_blank');
      } else if (this._isiOS()) {
        window.open(`comgooglemaps://?q=${latLng}`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${latLng}`, '_blank');
      }
    } catch (err) { this._fallbackShare(); }
  },

  _openSpotify() {
    // Minimal intent to avoid WooCommerce backend integration per brief.
    const intent = {
      action: 'open',
      payload: { app: 'spotify', target: 'app' }
    };
    window.postMessage({ source: 'RideManager', ...intent }, location.origin);
    this._emitEvent('ride_intent', intent);
    if (this._isAndroid()) {
      window.open('intent://open?package=com.spotify.music#Intent;scheme=spotify;package=com.spotify.music;end', '_blank');
    } else if (this._isiOS()) {
      window.open('spotify://', '_blank');
    } else {
      window.open('https://open.spotify.com', '_blank');
    }
  },

  _openHealthConnect() {
    const intent = {
      action: 'open',
      payload: { app: 'health_connect', platform: /Android/i.test(navigator.userAgent) ? 'android' : (/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'unknown') }
    };
    window.postMessage({ source: 'RideManager', ...intent }, location.origin);
    if (this._isAndroid()) {
      window.open('intent://open?package=com.google.android.apps.health#Intent;scheme=healthconnect;package=com.google.android.apps.health;end', '_blank');
    } else if (this._isiOS()) {
      window.open('x-apple-health://', '_blank');
    } else {
      alert('HealthConnect biasanya hanya tersedia di Android.');
    }
  },

  _shareRide(type) {
    const payload = {
      durationMs: this._isOpenRideNow() ? Date.now() - (this.rideStart || Date.now()) : 0,
      distanceM: this._estimateDistanceMeters(),
      path: this.ridePath.slice(-400),
      source: type,
      createdAt: Date.now()
    };
    this._emitEvent('ride_share', payload);
    if (!navigator.share) {
      this._fallbackShare(type, payload);
      return;
    }
    const start = this.ridePath[0];
    const end = this.ridePath[this.ridePath.length - 1];
    const mapsUrl = 'https://www.google.com/maps/dir/?api=1';
    navigator.share({ title: `RuteMu ${type}`, text: type === 'live' ? 'Sedang naik sepeda' : 'Rute sepeda', url: mapsUrl }).catch(() => {
      this._fallbackShare(type, payload);
    });
  },

  _refreshRide() {
    this.rideStart = Date.now();
    this.ridePath = [];
    this._afterStopReset();
    this._locateRideUser();
  },

  _openSettings() {
    this._emitEvent('ride_settings', {});
    const intent = { action: 'settings', payload: { source: 'RideManager' } };
    window.postMessage({ source: 'RideManager', ...intent }, location.origin);
  },

  _emitEvent(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {}
    if (App?.socket?.connected) {
      App.socket.emit('ride-event', { name, detail, ts: Date.now() });
    }
  },

  _isAndroid() { return /Android/i.test(navigator.userAgent); },
  _isiOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); },
  _isOpenRideNow() { return this.rideMode === true; },
  _fallbackShare(type, payload) {
    const path = payload?.path || this.ridePath;
    if (!path || path.length < 2) { alert('Belum ada rute yang tercatat.'); return; }
    const text = `${type === 'live' ? 'Live' : 'Route'}: ${path.length} poin`;
    let link;
    try {
      const last = path[path.length - 1];
      link = prompt('Salin tautan rute Google Maps:', `https://www.google.com/maps/dir/?api=1&destination=${last[0]},${last[1]}`) || '';
    } catch (e) { link = ''; }
    this._emitEvent('ride_share_fallback', { type, length: path.length, link: !!link });
  }
};

window.RideManager = RideManager;
