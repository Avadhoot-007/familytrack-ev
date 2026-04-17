export const geofences = Object.freeze([
  { id: 1, name: 'Home',    lat: 18.6702, lng: 73.7902, radiusKm: 0.5 },
  { id: 2, name: 'Office',  lat: 18.6615, lng: 73.7685, radiusKm: 0.3 },
  { id: 3, name: 'College', lat: 18.6213, lng: 73.9121, radiusKm: 0.4 },
]);

// Fast lookup by id
export const geofenceMap = new Map(geofences.map(g => [g.id, g]));