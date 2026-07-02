class Tracker {
  constructor() {
    this.watchId = null;
    this.active = false;
    this.currentPosition = null;
    this.onPositionChange = null;
    this.options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 };
  }

  start() {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by your browser');
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
      this.options
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
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0,
          accuracy: pos.coords.accuracy || 0,
          altitude: pos.coords.altitude || 0
        }),
        reject,
        this.options
      );
    });
  }
}
