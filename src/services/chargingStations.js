// ---------------------------------------------------------------------------
// Charging Stations Service — OpenStreetMap Overpass API (free, no key)
// ---------------------------------------------------------------------------

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE = new Map(); // key: `${lat},${lon}` → { stations, fetchedAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch nearest charging stations within radiusKm of lat/lon.
 * Returns array of { id, name, lat, lon, distanceKm, operator, brand }
 */
export const fetchChargingStations = async (lat, lon, radiusKm = 2) => {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.stations;
  }

  const radiusM = radiusKm * 1000;
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"="charging_station"](around:${radiusM},${lat},${lon});
      node["amenity"="fuel"]["fuel:electric"="yes"](around:${radiusM},${lat},${lon});
    );
    out body 15;
  `;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const data = await res.json();

    const stations = (data.elements || [])
      .map((el) => {
        const stLat = el.lat;
        const stLon = el.lon;
        const distKm = haversineKm(lat, lon, stLat, stLon);
        return {
          id: el.id,
          lat: stLat,
          lon: stLon,
          distanceKm: parseFloat(distKm.toFixed(2)),
          name: el.tags?.name || el.tags?.brand || el.tags?.operator || 'Charging Station',
          operator: el.tags?.operator || null,
          brand: el.tags?.brand || null,
          sockets: el.tags?.['capacity:charging'] || el.tags?.capacity || null,
          network: el.tags?.network || null,
        };
      })
      .filter((s) => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 10);

    CACHE.set(cacheKey, { stations, fetchedAt: Date.now() });
    return stations;
  } catch (err) {
    console.error('Overpass fetch failed:', err);
    return [];
  }
};

/**
 * Build a Google Maps directions URL from current coords to station.
 */
export const buildMapsUrl = (fromLat, fromLon, toLat, toLon) =>
  `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}&travelmode=driving`;

/**
 * Haversine distance in km.
 */
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};