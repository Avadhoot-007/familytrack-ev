// Simulate sensor data during ride
export const generateSensorReading = () => ({
  throttle: Math.random() * 100,        // 0–100%
  speed: Math.random() * 60,            // 0–60 km/h
  accel: (Math.random() - 0.5) * 2,    // -1 to +1 G
});

// Calculate eco-score from sensor data
export const calculateEcoScore = (throttle, speed, accel) => {
  let score = 100;

  // High throttle = aggressive = bad
  if (throttle > 70) score -= 20;
  else if (throttle > 50) score -= 10;

  // High speed = wasteful = bad
  if (speed > 50) score -= 15;
  else if (speed > 40) score -= 8;

  // High accel = jerky = bad
  if (Math.abs(accel) > 0.7) score -= 15;
  else if (Math.abs(accel) > 0.4) score -= 8;

  return Math.max(0, Math.min(100, score));
};

// Batch calculate avg eco-score over time window
export const calculateTripEcoScore = (readings) => {
  if (readings.length === 0) return 0;
  const scores = readings.map((r) => calculateEcoScore(r.throttle, r.speed, r.accel));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
};

// Get color + label for score
export const getEcoScoreColor = (score) => {
  if (score >= 80) return { color: '#28a745', label: 'Eco Champion 🌿' };
  if (score >= 60) return { color: '#ffc107', label: 'Good Riding 👍' };
  return { color: '#dc3545', label: 'Aggressive 🚀' };
};