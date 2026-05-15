// Predefined geofences for testing (Home, Office, College)
// Frozen to prevent accidental mutations
export const geofences = Object.freeze([
  { id: 1, name: "Home", lat: 18.5204, lng: 73.8567, radiusKm: 2.0 },
  { id: 2, name: "Office", lat: 18.535, lng: 73.87, radiusKm: 2.0 },
  { id: 3, name: "College", lat: 18.505, lng: 73.84, radiusKm: 2.0 },
]);

// Fast O(1) geofence lookup by id
export const geofenceMap = new Map(geofences.map((g) => [g.id, g]));
