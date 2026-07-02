class Tracker {
  constructor() {
    this.watchId = null;
    this.active = false;
    this.currentPosition = null;
    this.onPositionChange = null;
    this.highAccuracyOpts = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 };
    this.lowAccuracyOpts = { enableHighAccuracy: false, maximumAge: 15000, timeout: 10000 };
  }

  start() {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung browser Anda');
      return false;
    }
    this.active = true;
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
      (err) => console.warn('Geolocation error:', err.message),
      this.highAccuracyOpts
    );
    return true;
  }

  stop() {
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