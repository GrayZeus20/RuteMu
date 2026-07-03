const App = {
  socket: null,
  tracker: new Tracker(),
  mapManager: null,
  dashboard: new Dashboard(),
  vehicles: [],
  currentVehicle: null,
  currentTrip: null,
  trackingActive: false,
  selectedVehicleId: null,

  async init() {
    this.mapManager = new MapManager('map');

    this._setupUI();
    this._connectSocket();

    await this._loadVehicles();

    this.tracker.onPositionChange = (pos) => this._onPosition(pos);

    setInterval(() => this.dashboard.refreshStats(), 15000);
    setInterval(() => this._cleanStale(), 30000);
    setInterval(() => this._swKeepAlive(), 25000);

    this._registerSW();
  },

  _registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  },

  _swKeepAlive() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('keepalive');
    }
  },

  _setupUI() {
    byId('btn-add-vehicle').addEventListener('click', () => this._showAddVehicleModal());
    byId('btn-start-trip').addEventListener('click', () => this._toggleTracking());
    byId('btn-stop-trip').addEventListener('click', () => this._stopTracking());
    byId('btn-fit-all').addEventListener('click', () => this.mapManager.fitAllVehicles());
    byId('btn-locate').addEventListener('click', () => this.mapManager.locateUser());
    byId('btn-toggle-drawer').addEventListener('click', () => this._toggleDrawer());

    // Bottom actions when sidebar is hidden
    byId('bottom-actions').addEventListener('click', (e) => {
      const btn = e.target.closest('.bottom-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'vehicles' || action === 'dashboard') {
        this._showSidebarAndOpenTab(action);
      } else if (action === 'add-vehicle') {
        this._showSidebarAndOpenTab('vehicles');
        this._showAddVehicleModal();
      } else if (action === 'locate') {
        this.mapManager.locateUser();
      }
    });

    // Tab switching
    const mainEl = document.querySelector('.main');
    document.querySelectorAll('.drawer-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const wasActive = tab.classList.contains('active');
        if (wasActive) {
          mainEl.classList.toggle('drawer-full');
          return;
        }
        document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        byId(`tab-${tab.dataset.tab}`).classList.add('active');
        mainEl.classList.add('drawer-full');
      });
    });

    // Modal
    const modal = byId('vehicle-modal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
    byId('modal-add-btn').addEventListener('click', () => this._addVehicle());
    byId('modal-vehicle-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._addVehicle();
    });

    // Inline add vehicle
    byId('add-vehicle-btn').addEventListener('click', () => this._addVehicleInline());
    byId('add-vehicle-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._addVehicleInline();
    });
  },

  _connectSocket() {
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000
    });
    this.socket.on('connect', () => {
      console.log('Socket connected');
      if (this.currentVehicle) {
        this.socket.emit('register-vehicle', { vehicleId: this.currentVehicle.id, name: this.currentVehicle.name });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });

    this.socket.on('position', (data) => {
      if (data.vehicleId !== this.currentVehicle?.id) {
        this.mapManager.updatePosition(data.vehicleId, data.lat, data.lng, data.speed, data.heading);
      }
    });

    this.socket.on('vehicles-online', (online) => {
      this._updateOnlineStatus(online);
    });
  },

  async _loadVehicles() {
    try {
      this.vehicles = await API.getVehicles();
      this._renderVehicles();
      this.dashboard.refreshStats();
    } catch (e) { console.error('Load vehicles failed:', e); }
  },

  _renderVehicles() {
    const container = byId('vehicle-list');
    if (!container) return;
    if (this.vehicles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/><path d="M19 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/><path d="M3 10h4l3-5h4l3 5h4"/><path d="M3 10v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path d="M7 10V6h10v4"/></svg>
          </div>
          <div class="empty-state-text">No vehicles yet.<br>Add one to start tracking!</div>
        </div>`;
      return;
    }
    container.innerHTML = this.vehicles.map(v => {
      const active = this.selectedVehicleId === v.id ? 'active' : '';
      const initial = (v.name || '?')[0].toUpperCase();
      return `<div class="vehicle-card ${active}" data-id="${v.id}">
        <div class="vehicle-avatar" style="background:${v.color || '#6366f1'};color:white;font-weight:700;font-size:16px;">${initial}</div>
        <div class="vehicle-info">
          <div class="vehicle-name">${this._escapeHtml(v.name)}</div>
          <div class="vehicle-meta">${v.id.slice(0, 8)}</div>
        </div>
        <div class="vehicle-status offline" id="status-${v.id}">offline</div>
        <button class="btn-delete-vehicle" data-id="${v.id}" title="Delete vehicle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>`;
    }).join('');

    container.querySelectorAll('.vehicle-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-vehicle')) return;
        this._selectVehicle(card.dataset.id);
      });
    });

    container.querySelectorAll('.btn-delete-vehicle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._deleteVehicle(btn.dataset.id);
      });
    });
  },

  _selectVehicle(vehicleId) {
    if (this.trackingActive) {
      this.toast('Hentikan trip sebelum ganti kendaraan', 'warning');
      return;
    }
    this.selectedVehicleId = vehicleId;
    this.currentVehicle = this.vehicles.find(v => v.id === vehicleId);
    if (!this.currentVehicle) return;

    this.mapManager.setVehicleColor(vehicleId, this.currentVehicle.color);
    this.mapManager.vehicleLabels = this.mapManager.vehicleLabels || {};
    this.mapManager.vehicleLabels[vehicleId] = this.currentVehicle.name;

    if (this.currentTrip) this._endCurrentTrip();

    this.dashboard.refreshTrips(vehicleId);
    if (this.socket?.connected) {
      this.socket.emit('register-vehicle', { vehicleId, name: this.currentVehicle.name });
    }

    document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('active'));
    const card = document.querySelector(`.vehicle-card[data-id="${vehicleId}"]`);
    if (card) card.classList.add('active');

    this._updateMiniBar();
    this.toast(`Terpilih: ${this.currentVehicle.name}`, 'info');
  },

  _updateMiniBar() {
    const bar = byId('mini-vehicle-bar');
    const headerName = byId('header-vehicle-name');
    if (!bar) return;
    if (!this.currentVehicle) {
      bar.style.display = 'none';
      if (headerName) { headerName.classList.remove('show'); headerName.textContent = ''; }
      return;
    }
    bar.style.display = 'flex';
    const avatar = byId('mini-v-avatar');
    const name = byId('mini-v-name');
    const meta = byId('mini-v-meta');
    const status = byId('mini-v-status');
    if (avatar) {
      avatar.textContent = (this.currentVehicle.name || '?')[0].toUpperCase();
      avatar.style.background = this.currentVehicle.color || '#6366f1';
    }
    if (name) name.textContent = this.currentVehicle.name;
    if (meta) meta.textContent = this.currentVehicle.id.slice(0, 8);
    if (status) {
      status.textContent = 'offline';
      status.className = 'mini-v-status offline';
    }
    if (headerName) {
      headerName.textContent = this.currentVehicle.name;
      headerName.classList.add('show');
    }
  },


  _showAddVehicleModal() {
    byId('vehicle-modal').classList.add('show');
    byId('modal-vehicle-name').value = '';
    byId('modal-vehicle-color').value = '#6366f1';
    setTimeout(() => byId('modal-vehicle-name').focus(), 100);
  },

  async _addVehicle() {
    const name = byId('modal-vehicle-name').value.trim();
    const color = byId('modal-vehicle-color').value;
    if (!name) return;
    const vehicle = await this._createVehicle(name, color);
    if (vehicle) {
      byId('vehicle-modal').classList.remove('show');
    }
  },

  async _addVehicleInline() {
    const name = byId('add-vehicle-name').value.trim();
    const color = byId('add-vehicle-color').value;
    if (!name) return;
    const vehicle = await this._createVehicle(name, color);
    if (vehicle) {
      byId('add-vehicle-name').value = '';
    }
  },

  async _createVehicle(name, color) {
    try {
      const vehicle = await API.addVehicle(name, color);
      this.vehicles.push(vehicle);
      this._renderVehicles();
      this._selectVehicle(vehicle.id);
      this.dashboard.refreshStats();
      this.toast(`Kendaraan "${name}" ditambahkan`, 'success');
      return vehicle;
    } catch (e) {
      this.toast('Gagal menambahkan kendaraan', 'error');
      return null;
    }
  },

  _toggleDrawer() {
    const mainEl = document.querySelector('.main');
    mainEl.classList.toggle('drawer-hidden');
  },

  _showSidebarAndOpenTab(tab) {
    const mainEl = document.querySelector('.main');
    if (mainEl.classList.contains('drawer-hidden')) {
      mainEl.classList.remove('drawer-hidden');
    }
    document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    const targetTab = document.querySelector(`.drawer-tab[data-tab="${tab}"]`);
    if (targetTab) targetTab.classList.add('active');
    const content = byId(`tab-${tab}`);
    if (content) content.classList.add('active');
  },

  async _toggleTracking() {
    if (this.trackingActive) {
      this._stopTracking();
    } else {
      await this._startTracking();
    }
  },

  async _startTracking() {
    if (!this.currentVehicle) {
      this.toast('Pilih kendaraan terlebih dahulu', 'warning');
      return;
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      this.toast('Geolokasi butuh HTTPS. Buka via https://', 'error');
      return;
    }

    const ok = this.tracker.start();
    if (!ok) {
      this.toast('Geolokasi tidak didukung', 'error');
      return;
    }

    try {
      const pos = await this.tracker.getCurrentPosition();
      this.currentTrip = await API.startTrip(this.currentVehicle.id);
      this.trackingActive = true;
      this.dashboard.resetTrip();
      this.dashboard.updateTripProgress(pos);
      this.dashboard.showLivePanel();
      this._startKeepAlive();
      this._handleVisibility();
      window.addEventListener('beforeunload', this._beforeUnload);

      this._updateTrackingUI(true);
      this.mapManager.flyTo(pos.lat, pos.lng, 16);
      this.mapManager.updatePosition(this.currentVehicle.id, pos.lat, pos.lng, pos.speed, pos.heading);
      this.toast('Trip dimulai', 'success');
    } catch (e) {
      this.tracker.stop();
      const isHttp = location.protocol !== 'https:' && location.hostname !== 'localhost';
      const msg = isHttp
        ? 'Geolokasi butuh HTTPS. Buka via https://'
        : 'Gagal dapat GPS. Cek izin lokasi & coba di luar ruangan.';
      this.toast(msg, 'error');
    }
  },

  _stopTracking() {
    this.tracker.stop();
    this.trackingActive = false;
    this._updateTrackingUI(false);
    this._stopKeepAlive();
    window.removeEventListener('beforeunload', this._beforeUnload);
    this._endCurrentTrip();
  },

  _beforeUnload(e) {
    if (this.trackingActive) {
      e.preventDefault();
      e.returnValue = 'Trip sedang berlangsung! Yakin ingin keluar?';
      return e.returnValue;
    }
  },

  async _endCurrentTrip() {
    if (this.currentTrip) {
      try {
        const trip = await API.endTrip(this.currentTrip.id);
        const dist = trip.distance > 1000
          ? `${(trip.distance / 1000).toFixed(2)} km`
          : `${Math.round(trip.distance)} m`;
        this.toast(`Trip selesai · ${dist} ditempuh`, 'success');
        this.dashboard.refreshTrips(this.currentVehicle?.id);
        this.dashboard.refreshStats();
      } catch (e) { /* silent */ }
      this.currentTrip = null;
    }
    this.dashboard.resetTrip();
  },

  _updateTrackingUI(active) {
    const btn = byId('btn-start-trip');
    if (active) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg><span>Berhenti</span>`;
      btn.className = 'btn btn-danger btn-recording';
    } else {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Mulai Trip</span>`;
      btn.className = 'btn btn-success';
    }
  },

  _onPosition(pos) {
    if (!this.currentVehicle || !this.currentTrip) return;

    this.mapManager.updatePosition(this.currentVehicle.id, pos.lat, pos.lng, pos.speed, pos.heading);
    this.dashboard.updateTripProgress(pos);

    const meta = byId('mini-v-meta');
    if (meta) meta.textContent = `${(pos.speed * 3.6).toFixed(1)} km/h`;

    if (this.socket?.connected) {
      this.socket.emit('position-update', {
        vehicleId: this.currentVehicle.id,
        tripId: this.currentTrip.id,
        ...pos
      });
    }
  },

  _updateOnlineStatus(online) {
    const onlineIds = new Set(online.map(v => v.id));
    this.vehicles.forEach(v => {
      const el = byId(`status-${v.id}`);
      if (!el) return;
      const isOnline = onlineIds.has(v.id);
      el.textContent = isOnline ? 'online' : 'offline';
      el.className = `vehicle-status ${isOnline ? 'online' : 'offline'}`;
    });
    if (this.currentVehicle) {
      const miniStatus = byId('mini-v-status');
      if (miniStatus) {
        const isOnline = onlineIds.has(this.currentVehicle.id);
        miniStatus.textContent = isOnline ? 'online' : 'offline';
        miniStatus.className = `mini-v-status ${isOnline ? 'online' : 'offline'}`;
      }
    }
  },

  async _deleteVehicle(vehicleId) {
    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    if (!confirm(`Hapus kendaraan "${vehicle.name}"?\nSemua data tracking akan dihapus.`)) return;

    try {
      if (this.currentVehicle?.id === vehicleId) {
        if (this.trackingActive) this._stopTracking();
        this.currentVehicle = null;
        this.selectedVehicleId = null;
        this.currentTrip = null;
        this._updateMiniBar();
      }
      await API.deleteVehicle(vehicleId);
      this.mapManager.removeVehicle(vehicleId);
      this.vehicles = this.vehicles.filter(v => v.id !== vehicleId);
      this._renderVehicles();
      this.dashboard.refreshStats();
      this.toast(`Kendaraan "${vehicle.name}" dihapus`, 'info');
    } catch (e) {
      this.toast('Gagal menghapus kendaraan', 'error');
    }
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _cleanStale() {
    // placeholder for periodic cleanup
  },

  _startKeepAlive() {
    this._stopKeepAlive();
    this._keepAliveId = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
      if (this.trackingActive && !this.tracker.active) {
        console.warn('Tracker stopped unexpectedly, restarting...');
        this.tracker.start();
      }
    }, 10000);
  },

  _stopKeepAlive() {
    if (this._keepAliveId) {
      clearInterval(this._keepAliveId);
      this._keepAliveId = null;
    }
  },

  _handleVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.trackingActive) {
        console.log('Tracking continues in background...');
      } else if (!document.hidden && this.trackingActive && !this.tracker.active) {
        console.log('Page visible, restarting tracker...');
        this.tracker.start();
      }
    });
  },

  toast(message, type = 'info') {
    const container = byId('toast-container');
    if (!container) return;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: '○' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = `${icons[type] || ''} ${message}`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => el.remove(), 200);
    }, 3000);
  }
};

function byId(id) {
  return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', () => App.init());
