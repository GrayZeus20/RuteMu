class MapManager {
  constructor(containerId) {
    this.map = L.map(containerId, {
      zoomControl: false,
      attributionControl: true
    }).setView([-6.2, 106.8], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      className: 'map-tiles'
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.markers = {};
    this.trailPolylines = {};
    this.routeLines = {};
    this.vehicleColors = {};
    this.popups = {};
  }

  setVehicleColor(vehicleId, color) {
    this.vehicleColors[vehicleId] = color;
    if (this.markers[vehicleId]) {
      this.markers[vehicleId].setIcon(this._createIcon(color, 'vehicle'));
    }
  }

  _createIcon(color, type) {
    if (type === 'arrow' || type === 'vehicle') {
      const isArrow = type === 'arrow';
      const size = isArrow ? 26 : 18;
      const svg = isArrow
        ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L4 20h16L12 2z"/></svg>`
        : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`;
      return L.divIcon({
        className: '',
        html: svg,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }
    return L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px rgba(0,0,0,0.4);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  updatePosition(vehicleId, lat, lng, speed, heading) {
    const color = this.vehicleColors[vehicleId] || '#6366f1';

    if (this.markers[vehicleId]) {
      this.markers[vehicleId].setLatLng([lat, lng]);
      if (heading) {
        this.markers[vehicleId].setIcon(this._createIcon(color, 'arrow'));
        const el = this.markers[vehicleId].getElement();
        if (el) {
          const svg = el.querySelector('svg');
          if (svg) svg.style.transform = `rotate(${heading}deg)`;
        }
      }
    } else {
      const icon = heading ? this._createIcon(color, 'arrow') : this._createIcon(color, 'vehicle');
      const marker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
      const label = this.vehicleLabels?.[vehicleId] || vehicleId.slice(0, 6);
      const speedText = speed ? `${(speed * 3.6).toFixed(1)} km/h` : '';
      const popupHtml = `
        <div style="font-family:system-ui;min-width:120px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${label}</div>
          <div style="font-size:11px;color:#64748b;">
            ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
            ${speedText ? 'Speed: ' + speedText : ''}
          </div>
        </div>`;
      marker.bindPopup(popupHtml);
      this.markers[vehicleId] = marker;
    }

    if (!this.trailPolylines[vehicleId]) {
      this.trailPolylines[vehicleId] = L.polyline([], {
        color,
        weight: 3,
        opacity: 0.5,
        smoothFactor: 1
      }).addTo(this.map);
    }
    this.trailPolylines[vehicleId].addLatLng([lat, lng]);

    return this.markers[vehicleId];
  }

  showRoute(positions, color) {
    const key = 'route_' + (color || 'default');
    if (this.routeLines[key]) this.map.removeLayer(this.routeLines[key]);
    const coords = positions.map(p => [p.lat, p.lng]);
    this.routeLines[key] = L.polyline(coords, {
      color: color || '#6366f1',
      weight: 5,
      opacity: 0.85,
      smoothFactor: 1.5
    }).addTo(this.map);
    this.map.fitBounds(this.routeLines[key].getBounds().pad(0.12));
    return this.routeLines[key];
  }

  clearRoute(color) {
    const key = 'route_' + (color || 'default');
    if (this.routeLines[key]) { this.map.removeLayer(this.routeLines[key]); delete this.routeLines[key]; }
  }

  clearTrail(vehicleId) {
    if (this.trailPolylines[vehicleId]) { this.map.removeLayer(this.trailPolylines[vehicleId]); delete this.trailPolylines[vehicleId]; }
  }

  removeVehicle(vehicleId) {
    if (this.markers[vehicleId]) { this.map.removeLayer(this.markers[vehicleId]); delete this.markers[vehicleId]; }
    this.clearTrail(vehicleId);
  }

  flyTo(lat, lng, zoom) {
    this.map.flyTo([lat, lng], zoom || 15, { duration: 1 });
  }

  fitAllVehicles() {
    const all = Object.values(this.markers).filter(Boolean);
    if (all.length === 0) return;
    const group = L.featureGroup(all);
    this.map.fitBounds(group.getBounds().pad(0.12));
  }

  locateUser() {
    this.map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
  }
}
