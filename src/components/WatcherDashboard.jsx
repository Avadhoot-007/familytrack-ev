import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../config/firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './WatcherDashboard.css';
import { isInsideGeofence } from '../services/locationService';
import { geofences } from '../data/geofences';
import TripSummaryCard from './TripSummaryCard.jsx';
import CoachingTipCard from './CoachingTipCard.jsx';
import { downloadTripPDF } from '../utils/tripPDFExport';

const RIDER_COLORS = ['#e53935', '#1e88e5', '#8e24aa', '#f4511e', '#00897b'];

const getRiderColor = (index) => RIDER_COLORS[index % RIDER_COLORS.length];

const validCoords = (lat, lon) =>
  lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon));

const createDivIcon = (color, label) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      color:white;
      border-radius:50% 50% 50% 0;
      width:28px;height:28px;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:bold;
      transform:rotate(-45deg);
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">
      <span style="transform:rotate(45deg)">${label}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });

// ─── Weather helpers ──────────────────────────────────────────────────────────

const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

// Rain weather condition codes: https://openweathermap.org/weather-conditions
const RAIN_CODES = new Set([
  200, 201, 202, 210, 211, 212, 221, 230, 231, 232, // Thunderstorm
  300, 301, 302, 310, 311, 312, 313, 314, 321,       // Drizzle
  500, 501, 502, 503, 504, 511, 520, 521, 522, 531,  // Rain
]);

const isRaining = (weatherId) => RAIN_CODES.has(weatherId);

/**
 * Fetch current weather for a lat/lon pair.
 * Returns { id, description, temp } or null on failure.
 */
const fetchWeather = async (lat, lon) => {
  if (!OWM_KEY) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const w = data.weather?.[0];
    return w ? { id: w.id, description: w.description, temp: Math.round(data.main?.temp ?? 0) } : null;
  } catch {
    return null;
  }
};

// ─── Weather Prompt Banner ────────────────────────────────────────────────────

function RainPrompt({ prompts, onDismiss }) {
  if (prompts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
      {prompts.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
            border: '1px solid #3949ab',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(26,35,126,0.3)',
            animation: 'slideDown 0.3s ease',
          }}
        >
          <span>
            🌧️ <strong>Weather Alert:</strong> {p.message}
          </span>
          <button
            onClick={() => onDismiss(p.id)}
            title="Dismiss"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '4px 10px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ✕ Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Existing components (unchanged) ─────────────────────────────────────────

function MapController({ onMapReady }) {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) onMapReady(map);
    const handleLoad = () => map.invalidateSize();
    map.once('load', handleLoad);
    const fallback = setTimeout(() => map.invalidateSize(), 300);
    return () => {
      clearTimeout(fallback);
      map.off('load', handleLoad);
    };
  }, [map, onMapReady]);

  return null;
}

function SOSAlertModal({ sosRider, onResolve, onClose }) {
  if (!sosRider) return null;

  const raw = sosRider.sosLocation;
  const loc = raw
    ? { lat: raw.lat ?? raw.latitude ?? null, lon: raw.lon ?? raw.lng ?? raw.longitude ?? null }
    : null;
  const hasCoords = loc && validCoords(loc.lat, loc.lon);
  const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${loc.lat},${loc.lon}` : null;

  return (
    <div className="sos-modal">
      <div className="sos-modal-content">
        <div style={{ fontSize: '56px', marginBottom: '8px' }}>🚨</div>
        <h2>SOS EMERGENCY</h2>
        <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          {sosRider.sosRiderName || sosRider.riderId} needs help!
        </p>
        <div className="sos-info-box">
          {sosRider.sosTimestamp && (
            <p>🕐 <strong>Time:</strong>{' '}{new Date(sosRider.sosTimestamp).toLocaleTimeString()}</p>
          )}
          {hasCoords ? (
            <p>📍 <strong>Location:</strong> {Number(loc.lat).toFixed(4)}, {Number(loc.lon).toFixed(4)}</p>
          ) : (
            <p>📍 <strong>Location:</strong> Not available</p>
          )}
          {sosRider.sosBattery != null && (
            <p>🔋 <strong>Battery:</strong> {sosRider.sosBattery}%</p>
          )}
        </div>
        <div className="sos-button-group">
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="maps-btn">
              📍 Open in Google Maps
            </a>
          ) : (
            <div style={{
              padding: '12px', background: 'rgba(255,255,255,0.05)',
              borderRadius: '6px', fontSize: '13px', color: '#999',
              textAlign: 'center', border: '1px solid #444',
            }}>
              📍 Location unavailable
            </div>
          )}
          <button onClick={onResolve} className="resolve-btn">✓ Mark as Resolved</button>
          <button onClick={onClose} className="dismiss-btn">Dismiss (keep monitoring)</button>
        </div>
      </div>
    </div>
  );
}

function TripStatsSummary({ trips, filterDays }) {
  const now = Date.now();
  const windowMs = filterDays * 24 * 60 * 60 * 1000;
  const filtered = trips.filter((t) => now - new Date(t.timestamp).getTime() <= windowMs);
  if (filtered.length === 0) return null;

  const totalTrips = filtered.length;
  const totalDistance = filtered.reduce((s, t) => s + (Number(t.distanceKm) || 0), 0);
  const avgSpeed = filtered.reduce((s, t) => s + (Number(t.avgSpeedKmh) || 0), 0) / totalTrips;
  const avgScore = filtered.reduce((s, t) => s + (Number(t.score) || 0), 0) / totalTrips;
  const bestScore = Math.max(...filtered.map((t) => Number(t.score || 0)));
  const worstScore = Math.min(...filtered.map((t) => Number(t.score || 0)));

  const StatBox = ({ emoji, label, value }) => (
    <div style={{
      background: '#f9f9f9', border: '1px solid #ddd',
      borderRadius: '8px', padding: '12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{emoji}</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#999' }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px', marginBottom: '20px',
    }}>
      <StatBox emoji="🚴" label="Total Trips" value={totalTrips} />
      <StatBox emoji="🌿" label="Avg Score" value={avgScore.toFixed(0)} />
      <StatBox emoji="⬆️" label="Best Score" value={bestScore} />
      <StatBox emoji="⬇️" label="Worst Score" value={worstScore} />
      <StatBox emoji="📏" label="Total Distance" value={`${totalDistance.toFixed(2)} km`} />
      <StatBox emoji="⚡" label="Avg Speed" value={`${avgSpeed.toFixed(1)} km/h`} />
    </div>
  );
}

function TripHistoryTable({ trips, filterDays, onTripClick, onExportPDF }) {
  const now = Date.now();
  const windowMs = filterDays * 24 * 60 * 60 * 1000;
  const filtered = trips
    .filter((t) => now - new Date(t.timestamp).getTime() <= windowMs)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (filtered.length === 0) return <p style={{ color: '#999', fontSize: '14px' }}>No trips in this period.</p>;

  const scoreColor = (s) => s >= 70 ? '#28a745' : s >= 40 ? '#ffc107' : '#dc3545';

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>Rider</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>Score</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>Distance (km)</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>Avg Speed (km/h)</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((trip) => (
            <tr
              key={trip.id}
              style={{ borderBottom: '1px solid #eee' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = ''}
            >
              <td style={{ padding: '8px', fontWeight: 'bold', color: trip.riderColor || '#333' }}>
                {trip.riderName || trip.riderId}
              </td>
              <td style={{ padding: '8px' }}>
                {new Date(trip.timestamp).toLocaleDateString()}{' '}
                {new Date(trip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <span style={{ color: scoreColor(trip.score), fontWeight: 'bold' }}>
                  🌿 {trip.score}
                </span>
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>{trip.distanceKm ?? '—'}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>{trip.avgSpeedKmh ?? '—'}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <button
                  onClick={() => onTripClick(trip)}
                  style={{
                    padding: '4px 8px', background: '#007bff', color: 'white',
                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                    marginRight: '4px', fontSize: '12px',
                  }}
                >
                  View
                </button>
                <button
                  onClick={() => onExportPDF(trip)}
                  style={{
                    padding: '4px 8px', background: '#28a745', color: 'white',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                  }}
                >
                  PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WatcherDashboard() {
  const [riders, setRiders] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [filterDays, setFilterDays] = useState(7);
  const [firstOnlineRider, setFirstOnlineRider] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [sosRider, setSosRider] = useState(null);

  // ── Weather state ──────────────────────────────────────────────────────────
  // riderWeather: { [riderId]: { id, description, temp } }
  const [riderWeather, setRiderWeather] = useState({});
  // rainPrompts: array of { id, message } — dismissible banners
  const [rainPrompts, setRainPrompts] = useState([]);
  // track which riders already have an active rain prompt so we don't spam
  const rainPromptedRef = useRef({});
  // ──────────────────────────────────────────────────────────────────────────

  const mapRef = useRef(null);
  const riderIndexMap = useRef({});
  const riderColorMap = useRef({});
  const previousInsideRef = useRef({});
  const sosProcessedRef = useRef({});

  const handleMapReady = useCallback((mapInstance) => {
    mapRef.current = mapInstance;
  }, []);

  // ── Weather polling ────────────────────────────────────────────────────────
  /**
   * Called whenever riders state updates.
   * Polls OWM for every online rider and updates riderWeather.
   * If rain detected and no active prompt for that rider → adds banner + alert.
   */
  const pollWeather = useCallback(async (currentRiders) => {
    if (!OWM_KEY) return;

    const onlineEntries = Object.entries(currentRiders).filter(([, r]) => {
      if (r.status !== 'online' || !r.location) return false;
      const lon = r.location.lon ?? r.location.lng;
      return validCoords(r.location.lat, lon);
    });

    if (onlineEntries.length === 0) return;

    await Promise.all(
      onlineEntries.map(async ([riderId, riderData]) => {
        const lat = riderData.location.lat;
        const lon = riderData.location.lon ?? riderData.location.lng;
        const riderName = riderData.location.name || riderId;

        const weather = await fetchWeather(lat, lon);
        if (!weather) return;

        setRiderWeather((prev) => ({ ...prev, [riderId]: weather }));

        if (isRaining(weather.id) && !rainPromptedRef.current[riderId]) {
          rainPromptedRef.current[riderId] = true;

          const promptId = `rain-${riderId}-${Date.now()}`;
          const message = `It's starting to rain near ${riderName} (${weather.description}, ${weather.temp}°C)—send a reminder to slow down?`;

          // Add dismissible banner
          setRainPrompts((prev) => [...prev, { id: promptId, message }]);

          // Also log to alerts panel
          setAlerts((prev) => [
            {
              id: promptId,
              message: `🌧️ Rain near ${riderName}: ${weather.description}, ${weather.temp}°C. Remind them to slow down.`,
              type: 'warning',
            },
            ...prev.slice(0, 49),
          ]);
        }

        // Reset flag when rain stops so a new prompt can appear next time
        if (!isRaining(weather.id)) {
          rainPromptedRef.current[riderId] = false;
        }
      })
    );
  }, []);

  const dismissRainPrompt = useCallback((promptId) => {
    setRainPrompts((prev) => prev.filter((p) => p.id !== promptId));
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const ridersRef = ref(db, 'riders');

    const unsubscribe = onValue(ridersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      Object.keys(data).forEach((riderId) => {
        if (riderIndexMap.current[riderId] === undefined) {
          const idx = Object.keys(riderIndexMap.current).length;
          riderIndexMap.current[riderId] = idx;
          riderColorMap.current[riderId] = getRiderColor(idx);
        }
      });

      setRiders(data);

      Object.entries(data).forEach(([riderId, riderData]) => {
        if (riderData.sosTriggered === true && !sosProcessedRef.current[riderId]) {
          sosProcessedRef.current[riderId] = true;
          setSosRider({ riderId, ...riderData });
          setAlerts((prev) => [
            {
              id: `${riderId}-sos-${Date.now()}`,
              message: `🚨 SOS ALERT from ${riderData.sosRiderName || riderData.location?.name || riderId}!`,
              type: 'danger',
            },
            ...prev.slice(0, 49),
          ]);
        } else if (riderData.sosTriggered === false) {
          sosProcessedRef.current[riderId] = false;
        }
      });

      Object.entries(data).forEach(([riderId, riderData]) => {
        if (!riderData.location) return;
        const lat = riderData.location.lat;
        const lon = riderData.location.lon ?? riderData.location.lng;
        const riderName = riderData.location.name || riderId;

        if (!validCoords(lat, lon)) return;

        if (!previousInsideRef.current[riderId]) {
          previousInsideRef.current[riderId] = {};
        }

        geofences.forEach((zone) => {
          const isInside = isInsideGeofence(lat, lon, zone.lat, zone.lng, zone.radiusKm);
          const wasInside = previousInsideRef.current[riderId][zone.id] || false;

          if (isInside && !wasInside) {
            setAlerts((prev) => [
              { id: `${riderId}-${zone.id}-${Date.now()}`, message: `✓ ${riderName} entered ${zone.name}`, type: 'success' },
              ...prev.slice(0, 49),
            ]);
            previousInsideRef.current[riderId][zone.id] = true;
          } else if (!isInside && wasInside) {
            setAlerts((prev) => [
              { id: `${riderId}-${zone.id}-${Date.now()}`, message: `✗ ${riderName} left ${zone.name}`, type: 'warning' },
              ...prev.slice(0, 49),
            ]);
            previousInsideRef.current[riderId][zone.id] = false;
          }
        });
      });

      const trips = Object.entries(data).flatMap(([riderId, riderData]) => {
        if (!riderData.trips) return [];
        const riderName = riderData.location?.name || riderId;
        return Object.entries(riderData.trips).map(([tripId, trip]) => ({
          id: tripId,
          riderId,
          riderName,
          riderColor: riderColorMap.current[riderId],
          ...trip,
        }));
      });
      setAllTrips(trips);

      const onlineEntry = Object.entries(data).find(([, r]) => {
        if (r.status !== 'online' || !r.location) return false;
        const lon = r.location.lon ?? r.location.lng;
        return validCoords(r.location.lat, lon);
      });
      if (onlineEntry) {
        const loc = onlineEntry[1].location;
        setFirstOnlineRider((prev) => prev ?? { ...loc, lon: loc.lon ?? loc.lng });
      }
    });

    return () => unsubscribe();
  }, []);

  // ── Weather: poll on mount, then every 5 minutes ───────────────────────────
  useEffect(() => {
    if (!OWM_KEY) return;

    // Use a ref so the interval always sees latest riders
    const ridersRef2 = ref(db, 'riders');
    let latestRiders = {};

    const unsub = onValue(ridersRef2, (snap) => {
      latestRiders = snap.val() || {};
    });

    const runPoll = () => pollWeather(latestRiders);

    // Initial poll after a short delay (let Firebase load first)
    const initTimer = setTimeout(runPoll, 3000);
    // Then every 5 minutes
    const interval = setInterval(runPoll, 5 * 60 * 1000);

    return () => {
      unsub();
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [pollWeather]);
  // ──────────────────────────────────────────────────────────────────────────

  const defaultCenter = [18.5204, 73.8567];
  const mapCenter =
    firstOnlineRider && validCoords(firstOnlineRider.lat, firstOnlineRider.lon)
      ? [firstOnlineRider.lat, firstOnlineRider.lon]
      : defaultCenter;

  const onlineRiders = Object.entries(riders).filter(([, r]) => {
    if (r.status !== 'online' || !r.location) return false;
    const lon = r.location.lon ?? r.location.lng;
    return validCoords(r.location.lat, lon);
  });

  const offlineRiders = Object.entries(riders).filter(([, r]) => {
    if (r.status === 'online' || !r.location) return false;
    const lon = r.location.lon ?? r.location.lng;
    return validCoords(r.location.lat, lon);
  });

  const handleExportPDF = (trip) => {
    try {
      downloadTripPDF({
        riderName: trip.riderName || trip.riderId,
        distance: trip.distanceKm || 0,
        duration: trip.durationSeconds || 0,
        ecoScore: trip.score || 0,
        avgSpeed: trip.avgSpeedKmh || 0,
        timestamp: trip.timestamp,
        battery: trip.batteryRemaining || 85,
        batteryUsed: trip.batteryUsedPercent || 15,
        worstAxis: trip.worstAxis || 'speed',
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF');
    }
  };

  const handleSOSResolve = async () => {
    if (!sosRider?.riderId) return;
    try {
      await update(ref(db, `riders/${sosRider.riderId}`), { sosTriggered: false });
      sosProcessedRef.current[sosRider.riderId] = false;
      setSosRider(null);
    } catch (error) {
      console.error('Failed to resolve SOS:', error);
      alert('Failed to mark SOS as resolved');
    }
  };

  const handleSOSDismiss = () => setSosRider(null);

  const handleRecenterMap = () => {
    if (!mapRef.current) return;
    if (firstOnlineRider && validCoords(firstOnlineRider.lat, firstOnlineRider.lon)) {
      mapRef.current.setView([firstOnlineRider.lat, firstOnlineRider.lon], 13);
    } else {
      mapRef.current.setView(defaultCenter, 13);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Watcher Dashboard</h1>

      {/* ── Rain Prompt Banners ─────────────────────────────────────────────── */}
      <RainPrompt prompts={rainPrompts} onDismiss={dismissRainPrompt} />

      {/* ── No API key warning (dev only) ──────────────────────────────────── */}
      {!OWM_KEY && (
        <div style={{
          padding: '10px 14px', marginBottom: '12px',
          background: '#fff3cd', border: '1px solid #ffc107',
          borderRadius: '6px', fontSize: '13px', color: '#856404',
        }}>
          ⚠️ <strong>Weather overlay disabled.</strong> Add <code>VITE_OPENWEATHER_API_KEY</code> to your <code>.env</code> to enable rain alerts.
        </div>
      )}

      {/* ── Rider status pills ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {Object.entries(riders).map(([riderId, riderData]) => {
          const isOnline = riderData.status === 'online';
          const color = riderColorMap.current[riderId] || '#999';
          const name = riderData.location?.name || riderId;
          const hasSOS = riderData.sosTriggered && !riderData.sosResolved;
          const weather = riderWeather[riderId];
          const rain = weather && isRaining(weather.id);
          return (
            <span key={riderId} style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '13px',
              background: hasSOS ? '#dc3545' : isOnline ? color : '#eee',
              color: (isOnline || hasSOS) ? 'white' : '#999',
              border: `1px solid ${hasSOS ? '#dc3545' : isOnline ? color : '#ddd'}`,
              fontWeight: hasSOS ? 'bold' : 'normal',
              animation: hasSOS ? 'pulse 1s infinite' : 'none',
              title: weather ? `${weather.description}, ${weather.temp}°C` : '',
            }}>
              {hasSOS ? '🚨' : isOnline ? '🟢' : '⚫'} {name}
              {weather && isOnline && (
                <span style={{ marginLeft: '6px', opacity: 0.9 }}>
                  {rain ? '🌧️' : '☀️'} {weather.temp}°C
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div className="map-wrapper">
          <button
            onClick={handleRecenterMap}
            className="recenter-btn"
            title={firstOnlineRider ? 'Recenter on first online rider' : 'Recenter on default location'}
          >
            📍 Recenter
          </button>

          <MapContainer center={mapCenter} zoom={13} className="map-container">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
              maxZoom={19}
              crossOrigin={true}
            />
            <MapController onMapReady={handleMapReady} />

            {onlineRiders.map(([riderId, riderData]) => {
              const hasSOS = riderData.sosTriggered && !riderData.sosResolved;
              const color = hasSOS ? '#dc3545' : (riderColorMap.current[riderId] || '#e53935');
              const name = riderData.location.name || riderId;
              const lon = riderData.location.lon ?? riderData.location.lng;
              const weather = riderWeather[riderId];
              const rain = weather && isRaining(weather.id);
              return (
                <Marker
                  key={riderId}
                  position={[riderData.location.lat, lon]}
                  icon={createDivIcon(color, name.charAt(0).toUpperCase())}
                >
                  <Popup>
                    <strong>{name}</strong><br />
                    🔋 {riderData.location.battery}%<br />
                    🟢 Online
                    {weather && (
                      <><br />{rain ? '🌧️' : '☀️'} {weather.description}, {weather.temp}°C</>
                    )}
                    {hasSOS && <><br /><span style={{ color: 'red', fontWeight: 'bold' }}>🚨 SOS ACTIVE</span></>}
                  </Popup>
                </Marker>
              );
            })}
            {offlineRiders.map(([riderId, riderData]) => {
              const name = riderData.location?.name || riderId;
              const lon = riderData.location.lon ?? riderData.location.lng;
              return (
                <Marker
                  key={riderId}
                  position={[riderData.location.lat, lon]}
                  icon={createDivIcon('#9e9e9e', name.charAt(0).toUpperCase())}
                  opacity={0.5}
                >
                  <Popup>
                    <strong>{name}</strong><br />
                    🔋 {riderData.location.battery}%<br />
                    ⚫ Offline
                  </Popup>
                </Marker>
              );
            })}
            {geofences.map((zone) => (
              <Circle
                key={zone.id}
                center={[zone.lat, zone.lng]}
                radius={zone.radiusKm * 1000}
                fillColor="blue"
                fillOpacity={0.1}
                color="blue"
              >
                <Popup>{zone.name}</Popup>
              </Circle>
            ))}
          </MapContainer>
        </div>

        <div>
          <h3>Recent Alerts</h3>
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {alerts.length === 0 && (
              <p style={{ color: '#999', fontSize: '14px' }}>No alerts yet.</p>
            )}
            {alerts.map((alert) => {
              const bgColor =
                alert.type === 'danger' ? '#f8d7da' :
                alert.type === 'success' ? '#d4edda' : '#fff3cd';
              const borderColor =
                alert.type === 'danger' ? '#f5c6cb' :
                alert.type === 'success' ? '#28a745' : '#ffc107';
              return (
                <div
                  key={alert.id}
                  style={{
                    padding: '10px', margin: '5px 0',
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '4px', fontSize: '14px',
                    fontWeight: alert.type === 'danger' ? 'bold' : 'normal',
                  }}
                >
                  {alert.message}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📊 Trip History</h3>
          <select
            id="filter-days"
            name="filter-days"
            value={filterDays}
            onChange={(e) => setFilterDays(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={365}>All time</option>
          </select>
        </div>
        <TripStatsSummary trips={allTrips} filterDays={filterDays} />
        <TripHistoryTable
          trips={allTrips}
          filterDays={filterDays}
          onTripClick={setSelectedTrip}
          onExportPDF={handleExportPDF}
        />
      </div>

      {selectedTrip && (() => {
        const tripForCard = {
          distance: selectedTrip.distanceKm || 0,
          duration: selectedTrip.durationSeconds || 0,
          ecoScore: selectedTrip.score || 0,
          batteryUsed: selectedTrip.batteryUsedPercent || 15,
          batteryRemaining: selectedTrip.batteryRemaining || 85,
          timestamp: selectedTrip.timestamp,
          avgSpeed: selectedTrip.avgSpeedKmh || 0,
          riderName: selectedTrip.riderName || 'Rider',
        };
        return (
          <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>{selectedTrip.riderName || selectedTrip.riderId}</h2>
                <button
                  onClick={() => setSelectedTrip(null)}
                  style={{
                    background: '#f0f0f0', border: 'none',
                    fontSize: '20px', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: '4px',
                  }}
                >
                  ✕
                </button>
              </div>
              <TripSummaryCard trip={tripForCard} riderId={selectedTrip.riderId} />
              <CoachingTipCard
                ecoScore={selectedTrip.score}
                tripData={selectedTrip}
                riderId={selectedTrip.riderId}
                watcherId="parent"
              />
            </div>
          </div>
        );
      })()}

      {sosRider && (
        <SOSAlertModal
          sosRider={sosRider}
          onResolve={handleSOSResolve}
          onClose={handleSOSDismiss}
        />
      )}
    </div>
  );
}