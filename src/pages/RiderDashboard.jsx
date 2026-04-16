import { useState, useEffect, useRef } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../config/firebase';
import { generateSensorReading, calculateEcoScore, calculateTripEcoScore, getEcoScoreColor } from '../utils/ecoScoring';

export default function RiderDashboard({ riderName }) {
  const [isSharing, setIsSharing] = useState(false);
  const [battery, setBattery] = useState(85);
  const [location, setLocation] = useState(null);
  const [ecoScore, setEcoScore] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [speedSum, setSpeedSum] = useState(0);
  const [readingCount, setReadingCount] = useState(0);
  const [readings, setReadings] = useState([]);

  const batteryRef = useRef(battery);
  useEffect(() => { batteryRef.current = battery; }, [battery]);

  const riderId = riderName?.toLowerCase().replace(/\s+/g, '-') || 'rider-1';
  const avgSpeed = readingCount > 0 ? speedSum / readingCount : 0;

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

  // Update Firebase with location every 30s
  useEffect(() => {
    if (!isSharing) return;

    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ latitude, longitude });

            const locationRef = ref(db, `riders/${riderId}/location`);
            set(locationRef, {
              lat: latitude,
              lon: longitude,
              name: riderName,
              timestamp: new Date().toISOString(),
              battery: batteryRef.current,
            });

            const statusRef = ref(db, `riders/${riderId}/status`);
            set(statusRef, 'online');
          },
          (err) => console.error('Geolocation error:', err.message)
        );
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isSharing, riderName, riderId]);

  const handleStartSharing = () => {
    setIsSharing(true);
    setEcoScore(0);
    setTripDistance(0);
    setSpeedSum(0);
    setReadingCount(0);
    setReadings([]);
  };

  const handleStopSharing = async () => {
    if (!isSharing) return;
    setIsSharing(false);

    const tripId = `trip-${Date.now()}`;
    const tripRef = ref(db, `riders/${riderId}/trips/${tripId}`);
    const tripEcoScore = calculateTripEcoScore(readings);

    await set(tripRef, {
      timestamp: new Date().toISOString(),
      distanceKm: parseFloat(tripDistance.toFixed(2)),
      avgSpeedKmh: parseFloat(avgSpeed.toFixed(1)),
      score: tripEcoScore,
      readingCount: readings.length,
    });

    const statusRef = ref(db, `riders/${riderId}/status`);
    set(statusRef, 'offline');
    
    setReadings([]);
  };

  const ecoScoreColor = getEcoScoreColor(ecoScore);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🚴 Rider Dashboard</h1>
      <p style={{
        display: 'inline-block', background: '#e8f5e9', padding: '4px 12px',
        borderRadius: '20px', fontSize: '14px', color: '#2e7d32', marginBottom: '16px',
      }}>
        {riderName}
      </p>

      {/* Battery slider */}
      <div style={{ marginBottom: '20px' }}>
        <p><strong>🔋 Battery: {battery}%</strong></p>
        <input
          type="range" min="0" max="100" value={battery}
          onChange={(e) => setBattery(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Start/Stop buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={handleStartSharing}
          style={{
            flex: 1, padding: '10px 20px',
            background: isSharing ? '#ccc' : '#4CAF50',
            color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px', borderRadius: '4px',
          }}
          disabled={isSharing}
        >
          {isSharing ? '✓ Sharing...' : 'Start Sharing'}
        </button>

        <button
          onClick={handleStopSharing}
          style={{
            flex: 1, padding: '10px 20px',
            background: isSharing ? '#f44336' : '#ccc',
            color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px', borderRadius: '4px',
          }}
          disabled={!isSharing}
        >
          Stop Sharing
        </button>
      </div>

      {/* Location display */}
      {location && (
        <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px' }}>
          <p style={{ margin: '4px 0' }}>📍 Lat: {location.latitude.toFixed(4)}</p>
          <p style={{ margin: '4px 0' }}>📍 Lon: {location.longitude.toFixed(4)}</p>
        </div>
      )}

      {/* Live trip stats (only when sharing) */}
      {isSharing && (
        <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px' }}>📊 Live Trip Stats</h3>

          {/* Eco-score gauge */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold' }}>🌿 Eco-Score</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: ecoScoreColor.color }}>
                {Math.round(ecoScore)}/100
              </span>
            </div>
            <div style={{ background: '#ddd', height: '8px', borderRadius: '4px', marginTop: '4px', overflow: 'hidden' }}>
              <div style={{ background: ecoScoreColor.color, height: '100%', width: `${ecoScore}%`, transition: 'width 0.3s' }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{ecoScoreColor.label}</p>
          </div>

          <p style={{ margin: '4px 0' }}>📏 Distance: <strong>{tripDistance.toFixed(2)} km</strong></p>
          <p style={{ margin: '4px 0' }}>⚡ Avg Speed: <strong>{avgSpeed.toFixed(1)} km/h</strong></p>
        </div>
      )}

      {/* Trip ended message */}
      {!isSharing && tripDistance > 0 && (
        <div style={{ background: '#d4edda', padding: '12px', borderRadius: '6px', color: '#155724' }}>
          ✓ Trip ended! Distance: {tripDistance.toFixed(2)} km | Final Eco-Score: {Math.round(ecoScore)}/100
        </div>
      )}
    </div>
  );
}