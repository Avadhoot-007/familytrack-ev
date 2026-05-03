// Charging Stations Service — queries OpenStreetMap Overpass API
// Implements progressive radius fallback and 5-min caching
// Throws on network errors so UI can handle retries
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE = new Map(); // key: `${lat},${lon},${radius}` → { stations, fetchedAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Build OSM Overpass query for charging stations (amenity='charging_station' or fuel with electric)
const buildQuery = (lat, lon, radiusM) => `
[out:json][timeout:25];
(
  node["amenity"="charging_station"](around:${radiusM},${lat},${lon});
  node["amenity"="fuel"]["fuel:electric"="yes"](around:${radiusM},${lat},${lon});
  way["amenity"="charging_station"](around:${radiusM},${lat},${lon});
);
out center 20;
`;

/**
 * Fetch nearest charging stations.
 * Tries radiusKm first, then doubles twice if no results found.
 * Returns array of { id, name, lat, lon, distanceKm, operator, brand }
 * Throws on network failure so caller can show retry UI.
 */
export const fetchChargingStations = async (lat, lon, radiusKm = 3) => {
  // Try progressively wider radii: requested → 2x → 4x (max 15km)
  const radii = [
    radiusKm,
    Math.min(radiusKm * 2, 15),
    Math.min(radiusKm * 4, 15),
  ];

  for (const r of radii) {
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${r}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      if (cached.stations.length > 0) return cached.stations;
      continue; // cached empty — try wider radius
    }

    const radiusM = r * 1000;
    const query   = buildQuery(lat, lon, radiusM);

    // Use GET with encoded query — avoids CORS preflight issues
    const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

    const data = await res.json();

    const stations = (data.elements || [])
      .map((el) => {
        // ways have center coords, nodes have direct lat/lon
        const stLat = el.lat ?? el.center?.lat;
        const stLon = el.lon ?? el.center?.lon;
        if (stLat == null || stLon == null) return null;

        const distKm = haversineKm(lat, lon, stLat, stLon);
        return {
          id:          el.id,
          lat:         stLat,
          lon:         stLon,
          distanceKm:  parseFloat(distKm.toFixed(2)),
          name:        el.tags?.name || el.tags?.brand || el.tags?.operator || 'Charging Station',
          operator:    el.tags?.operator  || null,
          brand:       el.tags?.brand     || null,
          sockets:     el.tags?.['capacity:charging'] || el.tags?.capacity || null,
          network:     el.tags?.network   || null,
          access:      el.tags?.access    || null,
        };
      })
      .filter(Boolean)
      .filter((s) => s.distanceKm <= r)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 10);

    CACHE.set(cacheKey, { stations, fetchedAt: Date.now() });

    if (stations.length > 0) return stations;
    // else continue loop with wider radius
  }

  return []; // nothing found even at max radius
};

// Open directions URL in Google Maps
export const buildMapsUrl = (fromLat, fromLon, toLat, toLon) =>
  `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}&travelmode=driving`;

// Haversine distance in km (also used in locationService.js)
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};