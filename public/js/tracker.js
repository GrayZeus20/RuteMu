class Tracker {
  constructor() {
    this.watchId = null;
    this.active = false;
    this.currentPosition = null;
    this.onPositionChange = null;
    this.wakeLock = null;
    this.highAccuracyOpts = { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 };
    this.lowAccuracyOpts = { enableHighAccuracy: false, maximumAge: 15000, timeout: 10000 };
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          console.log('Wake Lock released');
        });
        console.log('Wake Lock acquired');
      }
    } catch (err) {
      console.warn('Wake Lock failed:', err.message);
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  start() {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung browser Anda');
      return false;
    }
    this.active = true;
    this.requestWakeLock();
    this._startWatching();
    return true;
  }

  _startWatching() {
    if (this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.currentPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0,
          accuracy: pos.coords.accuracy || 0,
          altitude: pos.coords.altitude || 0
        };
        if (this.onPositionChange) this.onPositionChange(this.currentPosition);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        if (this.active && err.code !== 1) {
          setTimeout(() => this._startWatching(), 3000);
        }
      },
      this.highAccuracyOpts
    );
  }

  stop() {
    this.releaseWakeLock();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.active = false;
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(this._extractPos(pos)),
        async () => {
          try {
            const pos = await this._getPositionLowAccuracy();
            resolve(pos);
          } catch {
            reject();
          }
        },
        this.highAccuracyOpts
      );
    });
  }

  _getPositionLowAccuracy() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(this._extractPos(pos)),
        reject,
        this.lowAccuracyOpts
      );
    });
  }

  _extractPos(pos) {
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      speed: pos.coords.speed || 0,
      heading: pos.coords.heading || 0,
      accuracy: pos.coords.accuracy || 0,
      altitude: pos.coords.altitude || 0
    };
  }
}