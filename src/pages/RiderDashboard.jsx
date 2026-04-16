import { useState, useEffect, useRef } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../config/firebase';
import { generateSensorReading, calculateEcoScore, calculateTripEcoScore, getEcoScoreColor } from '../utils/ecoScoring';
import './RiderDashboard.css';

export default function RiderDashboard({ riderName }) {
  const [isSharing, setIsSharing] = useState(false);
  const [battery, setBattery] = useState(85);
  const [location, setLocation] = useState(null);
  const [ecoScore, setEcoScore] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [speedSum, setSpeedSum] = useState(0);
  const [readingCount, setReadingCount] = useState(0);
  const [readings, setReadings] = useState([]);
  const [tripDuration, setTripDuration] = useState(0);
  const [tripStarted, setTripStarted] = useState(false);
  const [error, setError] = useState(null);

  const batteryRef = useRef(battery);
  const watchIdRef = useRef(null);

  useEffect(() => { batteryRef.current = battery; }, [battery]);

  const riderId = riderName?.toLowerCase().replace(/\s+/g, '-') || 'rider-1';
  const avgSpeed = readingCount > 0 ? speedSum / readingCount : 0;

  // Trip duration timer
  useEffect(() => {
    if (!tripStarted) return;
    const interval = setInterval(() => {
      setTripDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [tripStarted]);

  // Generate eco-score every 5 seconds during trip
  useEffect(() => {
    if (!isSharing) return;

    const interval = setInterval(() => {
      const reading = generateSensorReading();
      setReadings((prev) => [...prev, reading]);

      const score = calculateEcoScore(reading.throttle, reading.speed, reading.accel);
      setEcoScore(score);
      setTripDistance((prev) => prev + 0.05);
      setSpeedSum((prev) => prev + reading.speed);
      setReadingCount((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [isSharing]);

  // watchPosition for continuous GPS + Firebase sync
  useEffect(() => {
    if (!isSharing) return;

    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ latitude, longitude, accuracy });
        setError(null);

        const locationRef = ref(db, `riders/${riderId}/location`);
        set(locationRef, {
          lat: latitude,
          lon: longitude,
          name: riderName,
          timestamp: new Date().toISOString(),
          battery: batteryRef.current,
          accuracy,
        }).catch((err) => setError(err.message));

        const statusRef = ref(db, `riders/${riderId}/status`);
        set(statusRef, 'online').catch((err) => setError(err.message));
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(`GPS Error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    watchIdRef.current = id;

    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, [isSharing, riderName, riderId]);

  const handleStartSharing = () => {
    setIsSharing(true);
    setTripStarted(true);
    setEcoScore(0);
    setTripDistance(0);
    setSpeedSum(0);
    setReadingCount(0);
    setReadings([]);
    setTripDuration(0);
    setError(null);
  };

  const handleStopSharing = async () => {
    if (!isSharing) return;
    setIsSharing(false);
    setTripStarted(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const tripId = `trip-${Date.now()}`;
    const tripRef = ref(db, `riders/${riderId}/trips/${tripId}`);
    const tripEcoScore = calculateTripEcoScore(readings);

    await set(tripRef, {
      timestamp: new Date().toISOString(),
      distanceKm: parseFloat(tripDistance.toFixed(2)),
      avgSpeedKmh: parseFloat(avgSpeed.toFixed(1)),
      score: tripEcoScore,
      readingCount: readings.length,
      durationSeconds: tripDuration,
      startLat: location?.latitude ?? null,
      startLon: location?.longitude ?? null,
    });

    const statusRef = ref(db, `riders/${riderId}/status`);
    set(statusRef, 'offline');

    setReadings([]);
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const ecoScoreColor = getEcoScoreColor(ecoScore);

  return (
    <div className="rider-dashboard">
      <h1>🚴 Rider Dashboard</h1>

      <p className="rider-name-badge">{riderName}</p>

      {/* Battery Section */}
      <div className="battery-section">
        <p><strong>🔋 Battery: {battery}%</strong></p>
        <div className="battery-bar">
          <div
            className="battery-fill"
            style={{
              width: `${battery}%`,
              backgroundColor: battery > 60 ? '#4CAF50' : battery > 30 ? '#FFC107' : '#f44336',
            }}
          />
        </div>
        <input
          type="range" min="0" max="100" value={battery}
          onChange={(e) => setBattery(Number(e.target.value))}
          className="battery-slider"
        />
      </div>

      {/* Trip Timer */}
      {tripStarted && (
        <div className="trip-timer">
          <p className="timer-label">⏱️ Trip Duration</p>
          <p className="timer-value">{formatDuration(tripDuration)}</p>
        </div>
      )}

      {/* Start/Stop buttons */}
      <div className="button-group">
        <button
          onClick={handleStartSharing}
          disabled={isSharing}
          className="btn btn-start"
        >
          {isSharing ? '✓ Sharing...' : '▶️ Start Sharing'}
        </button>
        <button
          onClick={handleStopSharing}
          disabled={!isSharing}
          className="btn btn-stop"
        >
          ⏹️ Stop Sharing
        </button>
      </div>

      {/* SOS Button */}
      <button className="btn btn-sos">🆘 SOS Emergency</button>

      {/* Location Display */}
      {location && (
        <div className="location-display">
          <p>📍 Lat: {location.latitude.toFixed(4)}</p>
          <p>📍 Lon: {location.longitude.toFixed(4)}</p>
          <p>📡 Accuracy: ±{Math.round(location.accuracy)} m</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-box">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Live Trip Stats */}
      {isSharing && (
        <div className="live-stats">
          <h3>📊 Live Trip Stats</h3>

          <div className="eco-score-section">
            <div className="eco-score-header">
              <span><strong>🌿 Eco-Score</strong></span>
              <span className="eco-score-value" style={{ color: ecoScoreColor.color }}>
                {Math.round(ecoScore)}/100
              </span>
            </div>
            <div className="eco-bar">
              <div
                className="eco-fill"
                style={{ background: ecoScoreColor.color, width: `${ecoScore}%` }}
              />
            </div>
            <p className="eco-label">{ecoScoreColor.label}</p>
          </div>

          <p>📏 Distance: <strong>{tripDistance.toFixed(2)} km</strong></p>
          <p>⚡ Avg Speed: <strong>{avgSpeed.toFixed(1)} km/h</strong></p>
        </div>
      )}

      {/* Status Box */}
      <div className="status-box">
        {isSharing ? (
          <>
            <p className="status-active">✓ Location Sharing Active</p>
            <p className="status-sub">Syncing to Firebase continuously</p>
          </>
        ) : (
          <p className="status-inactive">○ Not Sharing Location</p>
        )}
      </div>

      {/* Trip Ended Summary */}
      {!isSharing && tripDistance > 0 && (
        <div className="trip-ended">
          ✓ Trip ended! Distance: {tripDistance.toFixed(2)} km | Duration: {formatDuration(tripDuration)} | Final Eco-Score: {Math.round(ecoScore)}/100
        </div>
      )}
    </div>
  );
}