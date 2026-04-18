// ---------------------------------------------------------------------------
// Sensor simulation
// ---------------------------------------------------------------------------

let _lastReading = null;

const drift = (prev, min, max, maxStep) => {
  const next = prev + (Math.random() - 0.5) * 2 * maxStep;
  return Math.min(max, Math.max(min, next));
};

export const generateSensorReading = () => {
  if (!_lastReading) {
    _lastReading = {
      throttle: Math.random() * 100,      // 0-100 (was 0-50, too safe)
      speed:    Math.random() * 60,       // 0-60 (was 0-30, never reached threshold)
      accel:    (Math.random() - 0.5) * 1.0,  // -0.5 to +0.5 (was -0.2 to +0.2, too smooth)
    };
    return { ..._lastReading };
  }

  _lastReading = {
    throttle: drift(_lastReading.throttle, 0,  100, 15),  // Bigger swings (was 10)
    speed:    drift(_lastReading.speed,    0,   60,  8),  // Bigger variance (was 5)
    accel:    drift(_lastReading.accel,   -1,    1,  0.3), // More volatile (was 0.2)
  };

  return { ..._lastReading };
};

export const resetSensorState = () => { _lastReading = null; };


// ---------------------------------------------------------------------------
// Eco score calculation
// ---------------------------------------------------------------------------

const WEIGHTS    = { throttle: 35, speed: 35, accel: 30 };
const THRESHOLDS = { throttle: 40, speed: 35, accel: 0.3 };
const RANGES     = { throttle: 60, speed: 25, accel: 0.7 };

export const calculateEcoScore = (throttle, speed, accel) => {
  const throttlePenalty = throttle > THRESHOLDS.throttle
    ? Math.min(WEIGHTS.throttle, ((throttle - THRESHOLDS.throttle) / RANGES.throttle) * WEIGHTS.throttle)
    : 0;

  const speedPenalty = speed > THRESHOLDS.speed
    ? Math.min(WEIGHTS.speed, ((speed - THRESHOLDS.speed) / RANGES.speed) * WEIGHTS.speed)
    : 0;

  const absAccel = Math.abs(accel);
  const accelPenalty = absAccel > THRESHOLDS.accel
    ? Math.min(WEIGHTS.accel, ((absAccel - THRESHOLDS.accel) / RANGES.accel) * WEIGHTS.accel)
    : 0;

  return Math.max(0, Math.round(100 - throttlePenalty - speedPenalty - accelPenalty));
};


// ---------------------------------------------------------------------------
// Trip-level aggregation
// ---------------------------------------------------------------------------

export const calculateTripStats = (readings) => {
  if (!readings.length) return { avg: 0, min: 0, max: 0, worstAxis: null };

  const scores = readings.map((r) => calculateEcoScore(r.throttle, r.speed, r.accel));
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  const avgPenalty = (axis, fn) =>
    readings.reduce((sum, r) => sum + fn(r), 0) / readings.length;

  const penalties = {
    throttle: avgPenalty('throttle', (r) => r.throttle > THRESHOLDS.throttle
      ? ((r.throttle - THRESHOLDS.throttle) / RANGES.throttle) * WEIGHTS.throttle : 0),
    speed: avgPenalty('speed', (r) => r.speed > THRESHOLDS.speed
      ? ((r.speed - THRESHOLDS.speed) / RANGES.speed) * WEIGHTS.speed : 0),
    accel: avgPenalty('accel', (r) => {
      const a = Math.abs(r.accel);
      return a > THRESHOLDS.accel ? ((a - THRESHOLDS.accel) / RANGES.accel) * WEIGHTS.accel : 0;
    }),
  };

  const worstAxis = Object.keys(penalties).reduce((a, b) => penalties[a] > penalties[b] ? a : b);
  return { avg, min, max, worstAxis };
};

// Backward-compatible alias
export const calculateTripEcoScore = (readings) => calculateTripStats(readings).avg;


// ---------------------------------------------------------------------------
// Score presentation
// ---------------------------------------------------------------------------

export const getEcoScoreColor = (score) => {
  if (score >= 90) return { color: '#1a7e32', label: 'Eco Champion' };
  if (score >= 70) return { color: '#28a745', label: 'Good Riding' };
  if (score >= 50) return { color: '#ffc107', label: 'Room to Improve' };
  return            { color: '#dc3545', label: 'Aggressive' };
};

export const getTripTip = (worstAxis) => ({
  throttle: 'Ease off the throttle gradually for a smoother, greener ride.',
  speed:    'Keeping speed under 35 km/h saves the most energy.',
  accel:    'Smooth acceleration and braking improves your score significantly.',
}[worstAxis] ?? null);