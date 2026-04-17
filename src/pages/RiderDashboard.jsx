import { useState, useEffect, useRef } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../config/firebase';
import { generateSensorReading, calculateEcoScore, calculateTripEcoScore, getEcoScoreColor } from '../utils/ecoScoring';
import RiderLeaderboard from "../components/RiderLeaderboard";
import SOSModal from "../components/SOSModal";
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sosModalOpen, setSOSModalOpen] = useState(false);

  const batteryRef = useRef(battery);
  const watchIdRef = useRef(null);

  useEffect(() => { batteryRef.current = battery; }, [battery]);

  const riderId = riderName?.toLowerCase().replace(/\s+/g, '-') || 'rider-1';
  const avgSpeed = readingCount > 0 ? speedSum / readingCount : 0;

  useEffect(() => {
    if (!tripStarted) return;
    const interval = setInterval(() => {
      setTripDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [tripStarted]);

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

    // FIX: This cleanup only runs when isSharing becomes false (user stops
    // the trip) — NOT on component unmount, because RiderDashboard is now
    // always mounted. This means switching to Watcher view no longer
    // triggers this cleanup and the GPS watcher stays alive.
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

    // FIX: Removed redundant manual clearWatch from here.
    // Setting isSharing to false triggers the useEffect cleanup above,
    // which already calls clearWatch. Calling it twice was harmless but
    // unnecessary. The useEffect cleanup is now the single source of truth
    // for stopping the GPS watcher.

    try {
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
      await set(statusRef, 'offline');

      setReadings([]);
    } catch (error) {
      console.error('Error saving trip:', error);
      setError(`Failed to save trip: ${error.message}`);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const ecoScoreColor = getEcoScoreColor(ecoScore);

  const ecoCardStyle = {
    background: 'rgba(0, 0, 0, 0.30)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '16px',
  };

  const ecoLabelStyle = {
    fontSize: '14px',
    color: '#c8e6c9',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const ecoBarTrackStyle = {
    background: 'rgba(255, 255, 255, 0.22)',
    height: '10px',
    borderRadius: '5px',
    overflow: 'hidden',
    marginBottom: '6px',
  };

  const ecoBarFillStyle = {
    background: ecoScoreColor.color,
    width: `${ecoScore}%`,
    height: '100%',
    borderRadius: '5px',
    transition: 'width 0.4s ease, background 0.3s ease',
  };

  const ecoStatusLabelStyle = {
    margin: '6px 0 0',
    fontSize: '13px',
    color: '#e0e0e0',
    fontWeight: '500',
  };

  return (
    <div className="rider-dashboard">
      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          🚴 Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 Leaderboard
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <h1>🚴 Rider Dashboard</h1>

          <p className="rider-name-badge">{riderName}</p>

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

          {tripStarted && (
            <div className="trip-timer">
              <p className="timer-label">⏱️ Trip Duration</p>
              <p className="timer-value">{formatDuration(tripDuration)}</p>
            </div>
          )}

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

          <button 
            className="btn btn-sos"
            onClick={() => setSOSModalOpen(true)}
          >
            🆘 SOS Emergency
          </button>

          {location && (
            <div className="location-display">
              <p>📍 Lat: {location.latitude.toFixed(4)}</p>
              <p>📍 Lon: {location.longitude.toFixed(4)}</p>
              <p>📡 Accuracy: ±{Math.round(location.accuracy)} m</p>
            </div>
          )}

          {error && (
            <div className="error-box">
              <p>⚠️ {error}</p>
            </div>
          )}

          {isSharing && (
            <div className="live-stats">
              <h3>📊 Live Trip Stats</h3>

              <div style={ecoCardStyle}>
                <div className="eco-score-header">
                  <span style={ecoLabelStyle}>🌿 Eco-Score</span>
                  <span
                    className="eco-score-value"
                    style={{ color: ecoScoreColor.color }}
                  >
                    {Math.round(ecoScore)}/100
                  </span>
                </div>

                <div style={ecoBarTrackStyle}>
                  <div style={ecoBarFillStyle} />
                </div>

                <p style={ecoStatusLabelStyle}>{ecoScoreColor.label}</p>
              </div>

              <p>📏 Distance: <strong>{tripDistance.toFixed(2)} km</strong></p>
              <p>⚡ Avg Speed: <strong>{avgSpeed.toFixed(1)} km/h</strong></p>
            </div>
          )}

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

          {!isSharing && tripDistance > 0 && (
            <div className="trip-ended">
              ✓ Trip ended! Distance: {tripDistance.toFixed(2)} km | Duration: {formatDuration(tripDuration)} | Final Eco-Score: {Math.round(ecoScore)}/100
            </div>
          )}
        </>
      ) : (
        <RiderLeaderboard />
      )}

      <SOSModal 
        isOpen={sosModalOpen}
        onClose={() => setSOSModalOpen(false)}
        riderName={riderName}
        riderId={riderId}
        location={location}
        battery={battery}
      />
    </div>
  );
}