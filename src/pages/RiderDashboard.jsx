import { useState, useEffect, useRef } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../config/firebase';
import { generateSensorReading, calculateEcoScore, calculateTripStats, getEcoScoreColor } from '../utils/ecoScoring';
import { calculateDistance } from '../services/locationService';
import { useStore } from '../store';
import RiderLeaderboard from "../components/RiderLeaderboard";
import SOSModal from "../components/SOSModal";
import EnvironmentalImpactHub from '../components/EnvironmentalImpactHub';
import CoachingTipsSystem from '../components/CoachingTipsSystem';
import TripSummaryCard from '../components/TripSummaryCard';
import { getCoachingTips } from '../utils/ecoImpactCalculations';
import './RiderDashboard.css';

// Ather Rizta Z Battery Specs
const BATTERY_SPECS = {
  capacity: 3700, // Wh (3.7 kWh)
  consumption: {
    eco: 33,
    normal: 37,
    aggressive: 46,
  },
};

export default function RiderDashboard({ riderName }) {
  const [isSharing, setIsSharing] = useState(false);
  const [battery, setBattery] = useState(85);
  const [location, setLocation] = useState(null);
  const [ecoScore, setEcoScore] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [readings, setReadings] = useState([]);
  const [tripDuration, setTripDuration] = useState(0);
  const [tripStarted, setTripStarted] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sosModalOpen, setSOSModalOpen] = useState(false);
  const [tripData, setTripData] = useState(null);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const batteryRef = useRef(battery);
  const watchIdRef = useRef(null);
  const lastLocationRef = useRef(null);
  const tripStartTimeRef = useRef(null);
  const simulationIntervalRef = useRef(null);

  const tripHistory = useStore((state) => state.tripHistory);
  const addCompletedTrip = useStore((state) => state.addCompletedTrip);
  const setCoachingTips = useStore((state) => state.setCoachingTips);
  const currentCoachingTips = useStore((state) => state.currentCoachingTips);

  useEffect(() => {}, [tripHistory]);
  useEffect(() => { batteryRef.current = battery; }, [battery]);

  const riderId = riderName?.toLowerCase().replace(/\s+/g, '-') || 'rider-1';

  // --- FIXED: avg speed from distance / elapsed time ---
  // Returns km/h. Returns 0 if trip hasn't started or duration is zero.
  const getAvgSpeed = () => {
    if (tripDuration <= 0 || tripDistance <= 0) return 0;
    return (tripDistance / (tripDuration / 3600)); // km / hours
  };

  const getBatteryTheme = () => {
    if (battery >= 50) return 'battery-healthy';
    if (battery >= 20) return 'battery-warning';
    return 'battery-critical';
  };
  const batteryTheme = getBatteryTheme();

  // Trip duration timer
  useEffect(() => {
    if (!tripStarted) return;
    const interval = setInterval(() => {
      setTripDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [tripStarted]);

  // Sensor readings interval
  useEffect(() => {
    if (!isSharing) return;
    const interval = setInterval(() => {
      const reading = generateSensorReading();
      setReadings((prev) => [...prev, reading]);
      const score = calculateEcoScore(reading.throttle, reading.speed, reading.accel);
      setEcoScore(score);
    }, 5000);
    return () => clearInterval(interval);
  }, [isSharing]);

  // Geolocation watcher
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

        if (lastLocationRef.current) {
          try {
            const distDelta = calculateDistance(
              lastLocationRef.current.latitude,
              lastLocationRef.current.longitude,
              latitude,
              longitude
            );
            setTripDistance((prev) => prev + distDelta);
          } catch (err) {
            console.error('Distance calc error:', err);
          }
        }

        lastLocationRef.current = { latitude, longitude };

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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
    setReadings([]);
    setTripDuration(0);
    setError(null);
    tripStartTimeRef.current = Date.now();
    lastLocationRef.current = null;
  };

  const handleStopSharing = async () => {
    if (!isSharing) return;
    setIsSharing(false);
    setTripStarted(false);

    // Snapshot avg speed at stop time using current state values.
    // We read tripDistance and tripDuration directly from state via closure —
    // they are accurate at the moment of calling handleStopSharing.
    const finalAvgSpeed = tripDuration > 0 && tripDistance > 0
      ? parseFloat((tripDistance / (tripDuration / 3600)).toFixed(1))
      : 0;

    try {
      const tripId = `trip-${Date.now()}`;
      const tripRef = ref(db, `riders/${riderId}/trips/${tripId}`);
      const tripStats = calculateTripStats(readings);
      const tripEcoScore = tripStats.avg;
      const worstAxis = tripStats.worstAxis;

      const getRideStyle = () => {
        if (tripEcoScore >= 80) return 'eco';
        if (tripEcoScore >= 60) return 'normal';
        return 'aggressive';
      };
      const rideStyle = getRideStyle();

      const consumptionRate = BATTERY_SPECS.consumption[rideStyle];
      const batteryUsedWh = tripDistance * consumptionRate;
      const batteryUsedPercent = (batteryUsedWh / BATTERY_SPECS.capacity) * 100;
      const batteryRemaining = batteryRef.current - batteryUsedPercent;

      const tripDataObj = {
        timestamp: new Date().toISOString(),
        distanceKm: parseFloat(tripDistance.toFixed(2)),
        avgSpeedKmh: finalAvgSpeed,  // FIXED: real distance/time speed
        score: tripEcoScore,
        readingCount: readings.length,
        durationSeconds: tripDuration,
        startLat: location?.latitude ?? null,
        startLon: location?.longitude ?? null,
        worstAxis,
        rideStyle,
        consumptionWh: consumptionRate,
        batteryUsedPercent: parseFloat(batteryUsedPercent.toFixed(1)),
        batteryRemaining: Math.max(0, parseFloat(batteryRemaining.toFixed(1))),
      };

      await set(tripRef, tripDataObj);

      addCompletedTrip({
        riderName,
        distance: tripDataObj.distanceKm,
        duration: tripDataObj.durationSeconds,
        ecoScore: tripDataObj.score,
        avgSpeed: tripDataObj.avgSpeedKmh,
        battery: batteryRef.current,
        batteryUsed: tripDataObj.batteryUsedPercent,
        worstAxis,
        timestamp: tripDataObj.timestamp,
      });

      const tips = getCoachingTips(
        tripEcoScore,
        worstAxis,
        finalAvgSpeed,
        readings.map(r => r.throttle),
        tripDistance
      );
      setCoachingTips(tips);

      setTripData({
        riderName,
        distance: tripDataObj.distanceKm,
        duration: tripDataObj.durationSeconds,
        ecoScore: tripEcoScore,
        avgSpeed: tripDataObj.avgSpeedKmh,
        batteryUsed: tripDataObj.batteryUsedPercent,
        batteryRemaining: tripDataObj.batteryRemaining,
        worstAxis,
        timestamp: tripDataObj.timestamp,
      });
      setShowTripSummary(true);

      const statusRef = ref(db, `riders/${riderId}/status`);
      await set(statusRef, 'offline');

      setReadings([]);
    } catch (error) {
      console.error('Error saving trip:', error);
      setError(`Failed to save trip: ${error.message}`);
    }
  };

  const handleSimulateTrip = async () => {
    setIsSimulating(true);
    try {
      const DEMO_PROFILES = [
        { distance: 3.2, duration: 600,  ecoScore: 82, speedAvg: 19.2, style: 'eco',        name: 'Eco Ride' },
        { distance: 5.8, duration: 900,  ecoScore: 65, speedAvg: 23.2, style: 'normal',     name: 'Normal Ride' },
        { distance: 2.1, duration: 420,  ecoScore: 42, speedAvg: 18.0, style: 'aggressive', name: 'Aggressive Ride' },
        { distance: 4.5, duration: 720,  ecoScore: 55, speedAvg: 22.5, style: 'normal',     name: 'Mixed Ride' },
        { distance: 6.3, duration: 1080, ecoScore: 88, speedAvg: 21.0, style: 'eco',        name: 'Very Eco Ride' },
        { distance: 3.8, duration: 540,  ecoScore: 35, speedAvg: 25.3, style: 'aggressive', name: 'City Rush' },
        { distance: 2.5, duration: 480,  ecoScore: 48, speedAvg: 18.75,style: 'normal',     name: 'Moderate Ride' },
      ];

      const profile = DEMO_PROFILES[Math.floor(Math.random() * DEMO_PROFILES.length)];

      // speedAvg is already distance/time derived from profile constants —
      // verify it's consistent: profile.distance / (profile.duration / 3600)
      const derivedSpeed = parseFloat((profile.distance / (profile.duration / 3600)).toFixed(1));

      const simulatedReadings = [];
      const readingsCount = Math.ceil(profile.duration / 5);

      for (let i = 0; i < readingsCount; i++) {
        let throttle, speed, accel;
        if (profile.style === 'eco') {
          throttle = 20 + Math.random() * 30 + Math.sin(i * 0.1) * 10;
          speed    = 19 + Math.random() * 6  + Math.cos(i * 0.08) * 3;
          accel    = (Math.random() - 0.5) * 0.3;
        } else if (profile.style === 'aggressive') {
          throttle = 50 + Math.random() * 45 + Math.sin(i * 0.2) * 15;
          speed    = 15 + Math.random() * 25 + Math.sin(i * 0.15) * 8;
          accel    = (Math.random() - 0.5) * 0.8;
        } else {
          throttle = 35 + Math.random() * 35 + Math.sin(i * 0.12) * 10;
          speed    = 20 + Math.random() * 15 + Math.cos(i * 0.1) * 5;
          accel    = (Math.random() - 0.5) * 0.5;
        }
        simulatedReadings.push({
          throttle: Math.max(0, Math.min(100, throttle)),
          speed:    Math.max(0, Math.min(60, speed)),
          accel:    Math.max(-1, Math.min(1, accel)),
        });
      }

      const tripId   = `trip-${Date.now()}`;
      const tripRef  = ref(db, `riders/${riderId}/trips/${tripId}`);
      const tripStats    = calculateTripStats(simulatedReadings);
      const tripEcoScore = tripStats.avg;
      const worstAxis    = tripStats.worstAxis;

      const consumptionRate    = BATTERY_SPECS.consumption[profile.style];
      const batteryUsedWh      = profile.distance * consumptionRate;
      const batteryUsedPercent = (batteryUsedWh / BATTERY_SPECS.capacity) * 100;
      const newBattery         = Math.max(5, battery - batteryUsedPercent);

      const tripDataObj = {
        timestamp: new Date().toISOString(),
        distanceKm: parseFloat(profile.distance.toFixed(2)),
        avgSpeedKmh: derivedSpeed,  // FIXED: consistent distance/time value
        score: tripEcoScore,
        readingCount: simulatedReadings.length,
        durationSeconds: profile.duration,
        startLat: 18.5204 + (Math.random() - 0.5) * 0.05,
        startLon: 73.8567 + (Math.random() - 0.5) * 0.05,
        worstAxis,
        rideStyle: profile.style,
        consumptionWh: consumptionRate,
        batteryUsedPercent: parseFloat(batteryUsedPercent.toFixed(1)),
        batteryRemaining: parseFloat(newBattery.toFixed(1)),
        isSimulated: true,
      };

      await set(tripRef, tripDataObj);

      setBattery(newBattery);
      batteryRef.current = newBattery;

      addCompletedTrip({
        riderName,
        distance:    tripDataObj.distanceKm,
        duration:    tripDataObj.durationSeconds,
        ecoScore:    tripDataObj.score,
        avgSpeed:    tripDataObj.avgSpeedKmh,
        battery:     battery,
        batteryUsed: tripDataObj.batteryUsedPercent,
        worstAxis,
        timestamp:   tripDataObj.timestamp,
      });

      const tips = getCoachingTips(
        tripEcoScore,
        worstAxis,
        derivedSpeed,
        simulatedReadings.map(r => r.throttle),
        profile.distance
      );
      setCoachingTips(tips);

      setTripData({
        riderName,
        distance:        tripDataObj.distanceKm,
        duration:        tripDataObj.durationSeconds,
        ecoScore:        tripEcoScore,
        avgSpeed:        tripDataObj.avgSpeedKmh,
        batteryUsed:     tripDataObj.batteryUsedPercent,
        batteryRemaining:tripDataObj.batteryRemaining,
        worstAxis,
        timestamp:       tripDataObj.timestamp,
      });
      setShowTripSummary(true);
      setError(null);
    } catch (error) {
      console.error('Simulation error:', error);
      setError(`Simulation failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins  = Math.floor((seconds % 3600) / 60);
    const secs  = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const ecoScoreColor = getEcoScoreColor(ecoScore);
  const avgSpeed = getAvgSpeed(); // live value for display

  const ecoCardStyle = {
    background: 'rgba(0, 0, 0, 0.30)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '16px',
  };
  const ecoLabelStyle = {
    fontSize: '14px', color: '#c8e6c9', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '4px',
  };
  const ecoBarTrackStyle = {
    background: 'rgba(255, 255, 255, 0.22)', height: '10px',
    borderRadius: '5px', overflow: 'hidden', marginBottom: '6px',
  };
  const ecoBarFillStyle = {
    background: ecoScoreColor.color, width: `${ecoScore}%`, height: '100%',
    borderRadius: '5px', transition: 'width 0.4s ease, background 0.3s ease',
  };
  const ecoStatusLabelStyle = {
    margin: '6px 0 0', fontSize: '13px', color: '#e0e0e0', fontWeight: '500',
  };

  return (
    <div className={`rider-dashboard ${batteryTheme}`}>
      <div className="dashboard-tabs">
        <button className={`tab-btn ${activeTab === 'dashboard'   ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>🚴 Dashboard</button>
        <button className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>🏆 Leaderboard</button>
        <button className={`tab-btn ${activeTab === 'impact'      ? 'active' : ''}`} onClick={() => setActiveTab('impact')}>🌱 Impact Hub</button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <h1>🚴 Rider Dashboard</h1>
          <p className="rider-name-badge">{riderName}</p>

          <div className="battery-section">
            <p><strong>🔋 Battery Status</strong></p>
            <div className="battery-gauge">
              <div className="battery-circle">
                <svg viewBox="0 0 100 100" className="battery-circle-svg">
                  <circle cx="50" cy="50" r="45" className="battery-circle-bg" />
                  <circle cx="50" cy="50" r="45" className="battery-circle-fill"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 45}`,
                      strokeDashoffset: `${2 * Math.PI * 45 * (1 - battery / 100)}`,
                    }}
                  />
                </svg>
                <div className="battery-circle-text">
                  <div className="battery-percent">{battery}%</div>
                  <div className="battery-label">Battery</div>
                </div>
              </div>
              <div className="battery-info">
                <div className="battery-stat"><strong>Range:</strong> ~{Math.round((battery / 100) * 160)} km</div>
                <div className={`battery-stat ${battery < 20 ? 'warning' : ''}`}>
                  {battery >= 50 && '✓ Good condition - Continue riding'}
                  {battery >= 20 && battery < 50 && '⚠ Medium level - Find charger soon'}
                  {battery < 20 && '🔴 Critical - Charge immediately!'}
                </div>
                <div className="battery-stat"><strong>Estimated Time:</strong> {Math.round((battery / 100) * 180)} min</div>
              </div>
            </div>
            <div className="battery-bar">
              <div className="battery-fill" style={{ width: `${battery}%` }} />
            </div>
            <input type="range" min="0" max="100" value={battery}
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
            <button onClick={handleStartSharing}  disabled={isSharing}                  className="btn btn-start">
              {isSharing ? '✓ Sharing...' : '▶️ Start Sharing'}
            </button>
            <button onClick={handleStopSharing}   disabled={!isSharing}                 className="btn btn-stop">⏹️ Stop Sharing</button>
            <button onClick={handleSimulateTrip}  disabled={isSharing || isSimulating}  className="btn btn-simulate"
              title="Generate realistic demo trip data">
              {isSimulating ? '⏳ Simulating...' : '🎬 Simulate Trip'}
            </button>
          </div>

          <button className="btn btn-sos" onClick={() => setSOSModalOpen(true)}>🆘 SOS Emergency</button>

          {location && (
            <div className="location-display">
              <p>📍 Lat: {location.latitude.toFixed(4)}</p>
              <p>📍 Lon: {location.longitude.toFixed(4)}</p>
              <p>📡 Accuracy: ±{Math.round(location.accuracy)} m</p>
            </div>
          )}

          {error && <div className="error-box"><p>⚠️ {error}</p></div>}

          {isSharing && (
            <div className="live-stats">
              <h3>📊 Live Trip Stats</h3>
              <div style={ecoCardStyle}>
                <div className="eco-score-header">
                  <span style={ecoLabelStyle}>🌿 Eco-Score</span>
                  <span className="eco-score-value" style={{ color: ecoScoreColor.color }}>
                    {Math.round(ecoScore)}/100
                  </span>
                </div>
                <div style={ecoBarTrackStyle}>
                  <div style={ecoBarFillStyle} />
                </div>
                <p style={ecoStatusLabelStyle}>{ecoScoreColor.label}</p>
              </div>
              <p>📏 Distance: <strong>{tripDistance.toFixed(2)} km</strong></p>
              {/* FIXED: shows real distance/time avg speed */}
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

          {showTripSummary && tripData && (
            <TripSummaryModal
              tripData={tripData}
              riderId={riderId}
              onClose={() => setShowTripSummary(false)}
            />
          )}
        </>
      ) : activeTab === 'leaderboard' ? (
        <RiderLeaderboard />
      ) : (
        <EnvironmentalImpactHub
          tripHistory={tripHistory}
          currentTrip={{
            distance:   tripDistance,
            duration:   tripDuration,
            ecoScore:   Math.round(ecoScore),
            avgSpeed:   avgSpeed,  // FIXED: real value
            batteryUsed: 100 - battery,
          }}
        />
      )}

      {isSharing && currentCoachingTips.length > 0 && (
        <CoachingTipsSystem tips={currentCoachingTips} ecoScore={Math.round(ecoScore)} />
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

function TripSummaryModal({ tripData, riderId, onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        background: '#1a1a1a', borderRadius: '12px', maxWidth: '600px',
        width: '100%', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px', borderBottom: '1px solid #333',
          position: 'sticky', top: 0, background: '#1a1a1a',
        }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>✓ Trip Complete!</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
        <div style={{ padding: '20px' }}>
          <TripSummaryCard trip={tripData} riderId={riderId} />
        </div>
      </div>
    </div>
  );
}