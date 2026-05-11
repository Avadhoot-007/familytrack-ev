// Calculate distance between two GPS coordinates using Haversine formula
// Returns distance in kilometers
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    throw new Error("All coordinates must be numbers");
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Check if rider is within a geofence radius (alerts watcher if they leave)
export const isInsideGeofence = (
  riderLat,
  riderLon,
  centerLat,
  centerLon,
  radiusKm,
) => {
  const distance = calculateDistance(riderLat, riderLon, centerLat, centerLon);
  return distance <= radiusKm;
};

// Sanitize rider name for use as Firebase key (lowercase, no spaces, alphanumeric only)
export const sanitizeRiderId = (name) => {
  if (typeof name !== "string") {
    throw new Error("Name must be a string");
  }
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
};

// Alias — use this everywhere riderId is derived from a display name
export const normalizeRiderId = sanitizeRiderId;
