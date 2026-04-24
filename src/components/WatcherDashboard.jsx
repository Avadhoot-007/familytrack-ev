import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../config/firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './WatcherDashboard.css';
import { isInsideGeofence } from '../services/locationService';
import { geofences } from '../data/geofences';
import { fetchChargingStations } from '../services/chargingStations';
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
      background:${color};color:white;border-radius:50% 50% 50% 0;
      width:28px;height:28px;display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:bold;transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);">
      <span style="transform:rotate(45deg)">${label}</span>
    </div>`,
    iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -30],
  });

const createChargingIcon = () =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:#2e7d32;color:white;border-radius:50%;
      width:26px;height:26px;display:flex;align-items:center;justify-content:center;
      font-size:14px;border:2px solid #81c784;
      box-shadow:0 1px 6px rgba(46,125,50,0.6);">
      ⚡
    </div>`,
    iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16],
  });

// Battery thresholds (same as RiderDashboard)
const BATTERY_CRITICAL = 10;
const BATTERY_LOW      = 25;
const DRAIN_BASELINE   = 37; // Wh/km
const DRAIN_ALERT_RATIO = 1.20;

// ── Weather helpers ──────────────────────────────────────────────────────────
const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const RAIN_CODES = new Set([
  200,201,202,210,211,212,221,230,231,232,
  300,301,302,310,311,312,313,314,321,
  500,501,502,503,504,511,520,521,522,531,
]);
const isRaining = (id) => RAIN_CODES.has(id);

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
  } catch { return null; }
};

function RainPrompt({ prompts, onDismiss }) {
  if (!prompts.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
      {prompts.map((p) => (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
          border: '1px solid #3949ab', borderRadius: '8px', color: 'white', fontSize: '14px',
          boxShadow: '0 2px 8px rgba(26,35,126,0.3)', animation: 'slideDown 0.3s ease',
        }}>
          <span>🌧️ <strong>Weather Alert:</strong> {p.message}</span>
          <button onClick={() => onDismiss(p.id)} style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: 'white', borderRadius: '4px', cursor: 'pointer',
            padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>✕ Dismiss</button>
        </div>
      ))}
    </div>
  );
}

function MapController({ onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (onMapReady) onMapReady(map);
    const fallback = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(fallback);
  }, [map, onMapReady]);
  return null;
}

function SOSAlertModal({ sosRider, onResolve, onClose }) {
  if (!sosRider) return null;
  const raw = sosRider.sosLocation;
  const loc = raw ? { lat: raw.lat ?? raw.latitude ?? null, lon: raw.lon ?? raw.lng ?? raw.longitude ?? null } : null;
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
          {sosRider.sosTimestamp && <p>🕐 <strong>Time:</strong> {new Date(sosRider.sosTimestamp).toLocaleTimeString()}</p>}
          {hasCoords
            ? <p>📍 <strong>Location:</strong> {Number(loc.lat).toFixed(4)}, {Number(loc.lon).toFixed(4)}</p>
            : <p>📍 <strong>Location:</strong> Not available</p>}
          {sosRider.sosBattery != null && <p>🔋 <strong>Battery:</strong> {sosRider.sosBattery}%</p>}
        </div>
        <div className="sos-button-group">
          {mapsUrl
            ? <a href={mapsUrl} target="_blank" rel="noreferrer" className="maps-btn">📍 Open in Google Maps</a>
            : <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '13px', color: '#999', textAlign: 'center', border: '1px solid #444' }}>📍 Location unavailable</div>}
          <button onClick={onResolve} className="resolve-btn">✓ Mark as Resolved</button>
          <button onClick={onClose}   className="dismiss-btn">Dismiss (keep monitoring)</button>
        </div>
      </div>
    </div>
  );
}

function TripStatsSummary({ trips, filterDays }) {
  const now = Date.now();
  const windowMs = filterDays * 24 * 60 * 60 * 1000;
  const filtered = trips.filter((t) => now - new Date(t.timestamp).getTime() <= windowMs);
  if (!filtered.length) return null;

  const totalTrips    = filtered.length;
  const totalDistance = filtered.reduce((s, t) => s + (Number(t.distanceKm) || 0), 0);
  const avgSpeed      = filtered.reduce((s, t) => s + (Number(t.avgSpeedKmh) || 0), 0) / totalTrips;
  const avgScore      = filtered.reduce((s, t) => s + (Number(t.score) || 0), 0) / totalTrips;
  const bestScore     = Math.max(...filtered.map((t) => Number(t.score || 0)));
  const worstScore    = Math.min(...filtered.map((t) => Number(t.score || 0)));

  const StatBox = ({ emoji, label, value }) => (
    <div style={{ background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{emoji}</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#999' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
      <StatBox emoji="🚴" label="Total Trips"    value={totalTrips} />
      <StatBox emoji="🌿" label="Avg Score"      value={avgScore.toFixed(0)} />
      <StatBox emoji="⬆️" label="Best Score"    value={bestScore} />
      <StatBox emoji="⬇️" label="Worst Score"   value={worstScore} />
      <StatBox emoji="📏" label="Total Distance" value={`${totalDistance.toFixed(2)} km`} />
      <StatBox emoji="⚡" label="Avg Speed"      value={`${avgSpeed.toFixed(1)} km/h`} />
    </div>
  );
}

function TripHistoryTable({ trips, filterDays, onTripClick, onExportPDF }) {
  const now = Date.now();
  const windowMs = filterDays * 24 * 60 * 60 * 1000;
  const filtered = trips
    .filter((t) => now - new Date(t.timestamp).getTime() <= windowMs)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (!filtered.length) return <p style={{ color: '#999', fontSize: '14px' }}>No trips in this period.</p>;
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
            <tr key={trip.id} style={{ borderBottom: '1px solid #eee' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = ''}>
              <td style={{ padding: '8px', fontWeight: 'bold', color: trip.riderColor || '#333' }}>
                {trip.riderName || trip.riderId}
              </td>
              <td style={{ padding: '8px' }}>
                {new Date(trip.timestamp).toLocaleDateString()}{' '}
                {new Date(trip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <span style={{ color: scoreColor(trip.score), fontWeight: 'bold' }}>🌿 {trip.score}</span>
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>{trip.distanceKm ?? '—'}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>{trip.avgSpeedKmh ?? '—'}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <button onClick={() => onTripClick(trip)} style={{ padding: '4px 8px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}>View</button>
                <button onClick={() => onExportPDF(trip)} style={{ padding: '4px 8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>PDF</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WatcherDashboard() {
  const [riders, setRiders]                   = useState({});
  const [alerts, setAlerts]                   = useState([]);
  const [allTrips, setAllTrips]               = useState([]);
  const [filterDays, setFilterDays]           = useState(7);
  const [firstOnlineRider, setFirstOnlineRider] = useState(null);
  const [selectedTrip, setSelectedTrip]       = useState(null);
  const [sosRider, setSosRider]               = useState(null);

  // Weather
  const [riderWeather, setRiderWeather]       = useState({});
  const [rainPrompts, setRainPrompts]         = useState([]);
  const rainPromptedRef                       = useRef({});

  // Charging stations on map
  const [chargingStations, setChargingStations] = useState([]);
  const chargingFetchedRef                    = useRef(false);

  // Per-rider alert tracking (prevent duplicate alerts)
  const batteryAlertedRef = useRef({}); // { [riderId]: { low: bool, critical: bool } }
  const drainAlertedRef   = useRef({}); // { [riderId]: bool }
  const rangeAlertedRef   = useRef({}); // { [riderId]: bool }

  const mapRef          = useRef(null);
  const riderIndexMap   = useRef({});
  const riderColorMap   = useRef({});
  const previousInsideRef = useRef({});
  const sosProcessedRef = useRef({});

  const handleMapReady = useCallback((m) => { mapRef.current = m; }, []);

  // ── Fetch charging stations for map ───────────────────────────────────────
  const fetchMapStations = useCallback(async (lat, lon) => {
    if (chargingFetchedRef.current) return;
    chargingFetchedRef.current = true;
    try {
      const results = await fetchChargingStations(lat, lon, 3);
      setChargingStations(results);
    } catch (e) {
      console.error('Charging fetch error:', e);
    }
  }, []);

  // ── Weather polling ────────────────────────────────────────────────────────
  const pollWeather = useCallback(async (currentRiders) => {
    if (!OWM_KEY) return;
    const onlineEntries = Object.entries(currentRiders).filter(([, r]) => {
      if (r.status !== 'online' || !r.location) return false;
      return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
    });
    if (!onlineEntries.length) return;

    await Promise.all(onlineEntries.map(async ([riderId, riderData]) => {
      const lat = riderData.location.lat;
      const lon = riderData.location.lon ?? riderData.location.lng;
      const riderName = riderData.location.name || riderId;
      const weather = await fetchWeather(lat, lon);
      if (!weather) return;
      setRiderWeather((prev) => ({ ...prev, [riderId]: weather }));

      if (isRaining(weather.id) && !rainPromptedRef.current[riderId]) {
        rainPromptedRef.current[riderId] = true;
        const promptId = `rain-${riderId}-${Date.now()}`;
        const message = `It's raining near ${riderName} (${weather.description}, ${weather.temp}°C) — send a reminder to slow down?`;
        setRainPrompts((prev) => [...prev, { id: promptId, message }]);
        addAlert(`🌧️ Rain near ${riderName}: ${weather.description}, ${weather.temp}°C. Remind them to slow down.`, 'warning');
      }
      if (!isRaining(weather.id)) rainPromptedRef.current[riderId] = false;
    }));
  }, []);

  const dismissRainPrompt = useCallback((id) => setRainPrompts((p) => p.filter((r) => r.id !== id)), []);

  // ── Alert helper ──────────────────────────────────────────────────────────
  const addAlert = (message, type = 'warning') => {
    setAlerts((prev) => [
      { id: `alert-${Date.now()}-${Math.random()}`, message, type },
      ...prev.slice(0, 49),
    ]);
  };

  // ── Firebase listener ─────────────────────────────────────────────────────
  useEffect(() => {
    const ridersRef = ref(db, 'riders');
    const unsubscribe = onValue(ridersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Assign colours
      Object.keys(data).forEach((riderId) => {
        if (riderIndexMap.current[riderId] === undefined) {
          const idx = Object.keys(riderIndexMap.current).length;
          riderIndexMap.current[riderId] = idx;
          riderColorMap.current[riderId] = getRiderColor(idx);
        }
      });

      setRiders(data);

      Object.entries(data).forEach(([riderId, riderData]) => {
        // ── SOS ──
        if (riderData.sosTriggered === true && !sosProcessedRef.current[riderId]) {
          sosProcessedRef.current[riderId] = true;
          setSosRider({ riderId, ...riderData });
          addAlert(`🚨 SOS ALERT from ${riderData.sosRiderName || riderData.location?.name || riderId}!`, 'danger');
        } else if (riderData.sosTriggered === false) {
          sosProcessedRef.current[riderId] = false;
        }

        const loc = riderData.location;
        const isOnline = riderData.status === 'online';
        if (!loc) return;
        const lon = loc.lon ?? loc.lng;
        const riderName = loc.name || riderId;
        if (!validCoords(loc.lat, lon)) return;

        // ── Battery alerts ──
        const bat = Number(loc.battery ?? 100);
        if (!batteryAlertedRef.current[riderId]) batteryAlertedRef.current[riderId] = {};
        const ba = batteryAlertedRef.current[riderId];

        if (bat <= BATTERY_CRITICAL && !ba.critical) {
          ba.critical = true;
          addAlert(`🚨 ${riderName} battery CRITICAL (${bat}%)! They need to stop and charge immediately.`, 'danger');
        } else if (bat <= BATTERY_LOW && bat > BATTERY_CRITICAL && !ba.low) {
          ba.low = true;
          addAlert(`🔋 ${riderName} battery is low (${bat}%). Consider sending a charging reminder.`, 'warning');
        }
        // Reset flags when battery rises (e.g. after simulated charging)
        if (bat > BATTERY_LOW) { ba.low = false; ba.critical = false; }
        else if (bat > BATTERY_CRITICAL) { ba.critical = false; }

        // ── Fetch charging stations for map once low battery online rider found ──
        if (isOnline && bat <= BATTERY_LOW) {
          fetchMapStations(loc.lat, lon);
        }

        // ── Trip-based alerts: drain rate + projected range ──
        const trips = riderData.trips ? Object.values(riderData.trips) : [];
        if (trips.length > 0) {
          const latest = trips.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

          // Drain rate alert
          if (latest.consumptionWh && latest.distanceKm > 0) {
            const drainWh = Number(latest.consumptionWh);
            if (drainWh > DRAIN_BASELINE * DRAIN_ALERT_RATIO && !drainAlertedRef.current[riderId]) {
              drainAlertedRef.current[riderId] = true;
              addAlert(`⚡ ${riderName} is draining battery fast (${drainWh} Wh/km vs ${DRAIN_BASELINE} normal). They may be riding aggressively.`, 'warning');
            } else if (drainWh <= DRAIN_BASELINE * DRAIN_ALERT_RATIO) {
              drainAlertedRef.current[riderId] = false;
            }
          }

          // Projected range alert
          if (latest.batteryRemaining != null) {
            const remainingWh = (Number(latest.batteryRemaining) / 100) * 3700;
            const drainRate   = latest.consumptionWh || DRAIN_BASELINE;
            const projRange   = remainingWh / drainRate;
            if (projRange < 5 && !rangeAlertedRef.current[riderId]) {
              rangeAlertedRef.current[riderId] = true;
              addAlert(`📍 ${riderName} has less than 5 km range remaining! Send them to a charging station.`, 'danger');
            } else if (projRange >= 5) {
              rangeAlertedRef.current[riderId] = false;
            }
          }
        }

        // ── Geofence alerts ──
        if (!previousInsideRef.current[riderId]) previousInsideRef.current[riderId] = {};
        geofences.forEach((zone) => {
          const inside  = isInsideGeofence(loc.lat, lon, zone.lat, zone.lng, zone.radiusKm);
          const wasInside = previousInsideRef.current[riderId][zone.id] || false;
          if (inside && !wasInside) {
            addAlert(`✓ ${riderName} entered ${zone.name}`, 'success');
            previousInsideRef.current[riderId][zone.id] = true;
          } else if (!inside && wasInside) {
            addAlert(`✗ ${riderName} left ${zone.name}`, 'warning');
            previousInsideRef.current[riderId][zone.id] = false;
          }
        });
      });

      // Trips aggregation
      const trips = Object.entries(data).flatMap(([riderId, riderData]) => {
        if (!riderData.trips) return [];
        const riderName = riderData.location?.name || riderId;
        return Object.entries(riderData.trips).map(([tripId, trip]) => ({
          id: tripId, riderId, riderName,
          riderColor: riderColorMap.current[riderId], ...trip,
        }));
      });
      setAllTrips(trips);

      const onlineEntry = Object.entries(data).find(([, r]) => {
        if (r.status !== 'online' || !r.location) return false;
        return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
      });
      if (onlineEntry) {
        const loc = onlineEntry[1].location;
        setFirstOnlineRider((prev) => prev ?? { ...loc, lon: loc.lon ?? loc.lng });
      }
    });
    return () => unsubscribe();
  }, [fetchMapStations]);

  // ── Weather polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!OWM_KEY) return;
    const ridersRef2 = ref(db, 'riders');
    let latestRiders = {};
    const unsub = onValue(ridersRef2, (snap) => { latestRiders = snap.val() || {}; });
    const init  = setTimeout(() => pollWeather(latestRiders), 3000);
    const poll  = setInterval(() => pollWeather(latestRiders), 5 * 60 * 1000);
    return () => { unsub(); clearTimeout(init); clearInterval(poll); };
  }, [pollWeather]);

  const defaultCenter = [18.5204, 73.8567];
  const mapCenter = firstOnlineRider && validCoords(firstOnlineRider.lat, firstOnlineRider.lon)
    ? [firstOnlineRider.lat, firstOnlineRider.lon] : defaultCenter;

  const onlineRiders  = Object.entries(riders).filter(([, r]) => {
    if (r.status !== 'online' || !r.location) return false;
    return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
  });
  const offlineRiders = Object.entries(riders).filter(([, r]) => {
    if (r.status === 'online' || !r.location) return false;
    return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
  });

  const handleExportPDF = (trip) => {
    try {
      downloadTripPDF({
        riderName: trip.riderName || trip.riderId,
        distance: trip.distanceKm || 0, duration: trip.durationSeconds || 0,
        ecoScore: trip.score || 0, avgSpeed: trip.avgSpeedKmh || 0,
        timestamp: trip.timestamp, battery: trip.batteryRemaining || 85,
        batteryUsed: trip.batteryUsedPercent || 15, worstAxis: trip.worstAxis || 'speed',
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

      <RainPrompt prompts={rainPrompts} onDismiss={dismissRainPrompt} />

      {!OWM_KEY && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '13px', color: '#856404' }}>
          ⚠️ <strong>Weather overlay disabled.</strong> Add <code>VITE_OPENWEATHER_API_KEY</code> to your <code>.env</code> to enable rain alerts.
        </div>
      )}

      {/* Rider status pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {Object.entries(riders).map(([riderId, riderData]) => {
          const isOnline = riderData.status === 'online';
          const color    = riderColorMap.current[riderId] || '#999';
          const name     = riderData.location?.name || riderId;
          const hasSOS   = riderData.sosTriggered && !riderData.sosResolved;
          const bat      = Number(riderData.location?.battery ?? 100);
          const weather  = riderWeather[riderId];
          const rain     = weather && isRaining(weather.id);
          const batIcon  = bat <= 10 ? '🚨' : bat <= 25 ? '⚠️' : '';
          return (
            <span key={riderId} style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '13px',
              background: hasSOS ? '#dc3545' : isOnline ? color : '#eee',
              color: (isOnline || hasSOS) ? 'white' : '#999',
              border: `1px solid ${hasSOS ? '#dc3545' : isOnline ? color : '#ddd'}`,
              fontWeight: hasSOS ? 'bold' : 'normal',
              animation: hasSOS ? 'pulse 1s infinite' : 'none',
            }}>
              {hasSOS ? '🚨' : isOnline ? '🟢' : '⚫'} {name}
              {batIcon && isOnline && <span style={{ marginLeft: '4px' }}>{batIcon}{bat}%</span>}
              {weather && isOnline && (
                <span style={{ marginLeft: '6px', opacity: 0.9 }}>{rain ? '🌧️' : '☀️'} {weather.temp}°C</span>
              )}
            </span>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div className="map-wrapper">
          <button onClick={handleRecenterMap} className="recenter-btn" title="Recenter map">📍 Recenter</button>

          {chargingStations.length > 0 && (
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}>
              ⚡ {chargingStations.length} chargers nearby
            </div>
          )}

          <MapContainer center={mapCenter} zoom={13} className="map-container">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
              maxZoom={19} crossOrigin={true}
            />
            <MapController onMapReady={handleMapReady} />

            {/* Online riders */}
            {onlineRiders.map(([riderId, riderData]) => {
              const hasSOS = riderData.sosTriggered && !riderData.sosResolved;
              const bat    = Number(riderData.location.battery ?? 100);
              const color  = hasSOS ? '#dc3545' : bat <= BATTERY_CRITICAL ? '#ff5722' : bat <= BATTERY_LOW ? '#ff9800' : (riderColorMap.current[riderId] || '#e53935');
              const name   = riderData.location.name || riderId;
              const lon    = riderData.location.lon ?? riderData.location.lng;
              const weather = riderWeather[riderId];
              const rain   = weather && isRaining(weather.id);
              return (
                <Marker key={riderId} position={[riderData.location.lat, lon]} icon={createDivIcon(color, name.charAt(0).toUpperCase())}>
                  <Popup>
                    <strong>{name}</strong><br />
                    🔋 {bat}%{bat <= BATTERY_CRITICAL ? ' 🚨 CRITICAL' : bat <= BATTERY_LOW ? ' ⚠️ Low' : ''}<br />
                    🟢 Online
                    {weather && <><br />{rain ? '🌧️' : '☀️'} {weather.description}, {weather.temp}°C</>}
                    {hasSOS && <><br /><span style={{ color: 'red', fontWeight: 'bold' }}>🚨 SOS ACTIVE</span></>}
                  </Popup>
                </Marker>
              );
            })}

            {/* Offline riders */}
            {offlineRiders.map(([riderId, riderData]) => {
              const name = riderData.location?.name || riderId;
              const lon  = riderData.location.lon ?? riderData.location.lng;
              return (
                <Marker key={riderId} position={[riderData.location.lat, lon]} icon={createDivIcon('#9e9e9e', name.charAt(0).toUpperCase())} opacity={0.5}>
                  <Popup><strong>{name}</strong><br />🔋 {riderData.location.battery}%<br />⚫ Offline</Popup>
                </Marker>
              );
            })}

            {/* Geofences */}
            {geofences.map((zone) => (
              <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radiusKm * 1000} fillColor="blue" fillOpacity={0.1} color="blue">
                <Popup>{zone.name}</Popup>
              </Circle>
            ))}

            {/* Charging Stations */}
            {chargingStations.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lon]} icon={createChargingIcon()}>
                <Popup>
                  <strong>⚡ {s.name}</strong><br />
                  📍 {s.distanceKm} km away
                  {s.operator && <><br />🏢 {s.operator}</>}
                  {s.sockets && <><br />🔌 {s.sockets} sockets</>}
                  <br />
                  <a href={`https://www.google.com/maps?q=${s.lat},${s.lon}`} target="_blank" rel="noreferrer" style={{ color: '#2196F3' }}>
                    Open in Google Maps →
                  </a>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Alerts panel */}
        <div>
          <h3>Recent Alerts</h3>
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {!alerts.length && <p style={{ color: '#999', fontSize: '14px' }}>No alerts yet.</p>}
            {alerts.map((alert) => {
              const bgColor     = alert.type === 'danger' ? '#f8d7da' : alert.type === 'success' ? '#d4edda' : '#fff3cd';
              const borderColor = alert.type === 'danger' ? '#f5c6cb' : alert.type === 'success' ? '#28a745' : '#ffc107';
              return (
                <div key={alert.id} style={{
                  padding: '10px', margin: '5px 0', background: bgColor,
                  border: `1px solid ${borderColor}`, borderRadius: '4px', fontSize: '14px',
                  fontWeight: alert.type === 'danger' ? 'bold' : 'normal',
                }}>
                  {alert.message}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trip history */}
      <div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📊 Trip History</h3>
          <select id="filter-days" name="filter-days" value={filterDays}
            onChange={(e) => setFilterDays(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={365}>All time</option>
          </select>
        </div>
        <TripStatsSummary trips={allTrips} filterDays={filterDays} />
        <TripHistoryTable trips={allTrips} filterDays={filterDays} onTripClick={setSelectedTrip} onExportPDF={handleExportPDF} />
      </div>

      {selectedTrip && (() => {
        const tripForCard = {
          distance: selectedTrip.distanceKm || 0, duration: selectedTrip.durationSeconds || 0,
          ecoScore: selectedTrip.score || 0, batteryUsed: selectedTrip.batteryUsedPercent || 15,
          batteryRemaining: selectedTrip.batteryRemaining || 85, timestamp: selectedTrip.timestamp,
          avgSpeed: selectedTrip.avgSpeedKmh || 0, riderName: selectedTrip.riderName || 'Rider',
        };
        return (
          <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>{selectedTrip.riderName || selectedTrip.riderId}</h2>
                <button onClick={() => setSelectedTrip(null)} style={{ background: '#f0f0f0', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>✕</button>
              </div>
              <TripSummaryCard trip={tripForCard} riderId={selectedTrip.riderId} />
              <CoachingTipCard ecoScore={selectedTrip.score} tripData={selectedTrip} riderId={selectedTrip.riderId} watcherId="parent" />
            </div>
          </div>
        );
      })()}

      {sosRider && <SOSAlertModal sosRider={sosRider} onResolve={handleSOSResolve} onClose={() => setSosRider(null)} />}
    </div>
  );
}