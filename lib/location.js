// Haversine distance between two lat/lng points, in miles.
export function distanceMiles(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null)) return null;
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Gets the browser's current position, wrapped in a Promise.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location not supported on this device')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { timeout: 8000 }
    );
  });
}

// Adds a small random offset (roughly 100-300 feet) so a listing's stored
// location can't be used to pinpoint someone's exact dorm room or apartment,
// while distance calculations stay accurate to within a block or two.
export function jitterLocation(lat, lng) {
  const jitterDegrees = 0.0005 + Math.random() * 0.0005; // ~55-110m per axis
  const angle = Math.random() * 2 * Math.PI;
  return {
    lat: lat + jitterDegrees * Math.cos(angle),
    lng: lng + jitterDegrees * Math.sin(angle),
  };
}

// Simple arithmetic midpoint — accurate enough at campus/city scale (a few
// miles), no need for the more complex spherical-midpoint formula.
export function midpoint(lat1, lng1, lat2, lng2) {
  return { lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 };
}
