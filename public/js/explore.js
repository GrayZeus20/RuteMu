class Explore {
  constructor() {
    this.container = document.getElementById('bottom-sheet');
    this.titleEl = document.getElementById('sheet-title');
    this.subtitleEl = document.getElementById('sheet-subtitle');
    this.badgeEl = document.getElementById('sheet-badge');
    this.listEl = document.getElementById('sheet-list');
    this.searchInput = document.getElementById('search-input');
    this.searchClear = document.getElementById('search-clear');
    this.quickFilters = document.getElementById('quick-filters');
    this.map = App?.mapManager?.map || null;
    this.searchMarkers = [];
    this.currentFilter = 'all';
    this.currentQuery = '';
    this._bind();
  }

  _bind() {
    if (!this.searchInput || !this.searchClear || !this.quickFilters) return;
    this.searchInput.addEventListener('input', () => {
      this.searchClear.classList.toggle('show', this.searchInput.value.length > 0);
      this._load();
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.searchInput.value = ''; this.searchClear.classList.remove('show'); this._load(); }
    });
    this.searchClear.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchClear.classList.remove('show');
      this._load();
      this.searchInput.focus();
    });
    this.quickFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      this.quickFilters.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      this.currentFilter = btn.dataset.filter || 'all';
      this._load();
    });
  }

  setMap(map) { this.map = map; }

  bindSheetInteractions() {
    // Bottom sheet removed — no interactions needed
  }

  bindOverlayButtons() {
    // Compass & directions buttons removed — no longer in HTML
  }

  _markerIcon(initial, color) {
    const svg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="${color || '#6366f1'}" stroke="white" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/></svg>`;
    return L.divIcon({ className: '', html: svg, iconSize: [28, 28], iconAnchor: [14, 28] });
  }

  async _load() {
    this.currentQuery = this.searchInput?.value || '';
    const lat = this.map?.getCenter()?.lat;
    const lng = this.map?.getCenter()?.lng;
    let items = [];

    if (this.currentFilter === 'all' || this.currentFilter === 'history') {
      const history = this.currentFilter === 'history'
        ? await API.getExploreHistory()
        : await API.getExplorePlaces({ q: this.currentQuery, type: this.currentFilter === 'all' ? undefined : this.currentFilter, lat, lng, limit: 20 });
      items = items.concat(history.map(x => ({ ...x, _src: 'history' })));
    } else {
      const methods = { supplier: API.getExploreSuppliers, payment: API.getExplorePayments };
      const fn = methods[this.currentFilter];
      if (fn) items = items.concat((await fn()).map(x => ({ ...x, _src: this.currentFilter })));
    }

    if (this.currentQuery && this.currentFilter === 'all') {
      const search = await API.getExplorePlaces({ q: this.currentQuery, lat, lng, limit: 20 });
      const searchIds = new Set(search.map(x => x._id || x.id));
      items = [...search.map(x => ({ ...x, _src: 'search' })), ...items.filter(x => (x._id || x.id) && !searchIds.has(x._id || x.id))];
    }

    const uniq = [];
    const seen = new Set();
    for (const x of items) {
      const key = x._id || x.id || `${x.lat}-${x.lng}-${x.name}`;
      if (!seen.has(key)) { seen.add(key); uniq.push(x); }
    }
    items = uniq.slice(0, 30);

    if (this.badgeEl) this.badgeEl.textContent = String(items.length || 0);
    this._render(this._resolveHeader(items), items);
    this._renderMapMarkers(items);
  }

  _resolveHeader(items) {
    if (this.currentQuery) return `Hasil: "${this.currentQuery}"`;
    if (this.currentFilter === 'supplier') return 'Supplier';
    if (this.currentFilter === 'payment') return 'Pembayaran';
    if (this.currentFilter === 'history') return 'Riwayat';
    return 'Wilayah';
  }

  _render(title, items) {
    if (!this.listEl) return;
    this._renderMapMarkers(items);
  }

  _chip(item) {
    if ((item.type === 'supplier' || item._src === 'supplier') && item.transactions) return `<div class="place-chip">${item.transactions} transaksi</div>`;
    if (item.rating > 4.5) return `<div class="place-chip">Rating tertinggi</div>`;
    if (item.lastVisit) return `<div class="place-chip">Dikunjungi</div>`;
    return '';
  }

  _renderMapMarkers(items) {
    if (!this.map) return;
    this.searchMarkers.forEach(m => this.map.removeLayer(m));
    this.searchMarkers = [];
    items.forEach(item => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      const icon = this._markerIcon((item.name || '?')[0], item.color);
      const marker = L.marker([item.lat, item.lng], { icon, zIndexOffset: 2000 }).addTo(this.map);
      marker.bindPopup(`<div style="font-family:inherit;min-width:120px"><div style="font-weight:700;font-size:13px;margin-bottom:4px">${item.name || ''}</div><div style="font-size:11px;color:#64748b">${item.address || item.category || ''}</div></div>`);
      this.searchMarkers.push(marker);
    });
  }

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
}

window.Explore = Explore;
