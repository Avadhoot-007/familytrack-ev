import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, remove, push } from 'firebase/database';
import { db } from '../config/firebase';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Click handler inside map ───────────────────────────────────────────────
function MapClickHandler({ onMapClick, isPlacing }) {
  useMapEvents({
    click(e) {
      if (isPlacing) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// ── Crosshair icon for placing ─────────────────────────────────────────────
const crosshairIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:32px;height:32px;
    border:3px solid #f59e0b;
    border-radius:50%;
    background:rgba(245,158,11,0.2);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 2px rgba(245,158,11,0.4);
  ">
    <div style="width:6px;height:6px;background:#f59e0b;border-radius:50%;"></div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const zoneIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;
    border:2px solid ${color};
    border-radius:50% 50% 50% 0;
    background:${color}cc;
    transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
});

const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const DEFAULT_CENTER = [18.5204, 73.8567];

export default function GeofenceEditor({ familyId }) {
  const [zones, setZones]           = useState([]);
  const [isPlacing, setIsPlacing]   = useState(false);
  const [pendingLat, setPendingLat] = useState(null);
  const [pendingLon, setPendingLon] = useState(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingRadius, setPendingRadius] = useState(0.5);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const mapRef                      = useRef(null);

  // ── Firebase listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!familyId) return;
    const zonesRef = ref(db, `families/${familyId}/geofences`);
    const unsub = onValue(zonesRef, (snap) => {
      const data = snap.val();
      if (!data) { setZones([]); return; }
      const list = Object.entries(data).map(([id, z]) => ({ id, ...z }));
      setZones(list);
    });
    return () => unsub();
  }, [familyId]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleMapClick = (lat, lon) => {
    setPendingLat(lat);
    setPendingLon(lon);
    setIsPlacing(false); // stop placing mode, show form
  };

  const handleSave = async () => {
    if (!pendingName.trim()) { setError('Enter a zone name.'); return; }
    if (pendingLat === null)  { setError('Click the map to place a zone center.'); return; }
    if (!familyId)            { setError('No family ID — sign in with Google.'); return; }

    setSaving(true);
    setError('');
    try {
      const zonesRef = ref(db, `families/${familyId}/geofences`);
      await push(zonesRef, {
        name:      pendingName.trim(),
        lat:       pendingLat,
        lng:       pendingLon,
        radiusKm:  pendingRadius,
        createdAt: new Date().toISOString(),
      });
      // Reset
      setPendingLat(null);
      setPendingLon(null);
      setPendingName('');
      setPendingRadius(0.5);
      showSuccess(`Zone "${pendingName.trim()}" saved.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (zoneId, zoneName) => {
    if (!familyId) return;
    setDeletingId(zoneId);
    try {
      await remove(ref(db, `families/${familyId}/geofences/${zoneId}`));
      showSuccess(`Zone "${zoneName}" deleted.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelPlace = () => {
    setIsPlacing(false);
    setPendingLat(null);
    setPendingLon(null);
    setPendingName('');
    setPendingRadius(0.5);
    setError('');
  };

  const mapCenter = zones.length > 0
    ? [zones[0].lat, zones[0].lng]
    : DEFAULT_CENTER;

  return (
    <div style={styles.wrap}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>📍 Geofence Zones</h3>
          <p style={styles.sub}>
            {familyId
              ? `${zones.length} zone${zones.length !== 1 ? 's' : ''} configured for your family`
              : 'Sign in with Google to manage family geofences'}
          </p>
        </div>
        {familyId && !isPlacing && (
          <button
            style={styles.addBtn}
            onClick={() => { setIsPlacing(true); setError(''); }}
          >
            + Add Zone
          </button>
        )}
        {isPlacing && (
          <button style={styles.cancelBtn} onClick={handleCancelPlace}>
            ✕ Cancel
          </button>
        )}
      </div>

      {/* ── Status messages ───────────────────────────────────────────────── */}
      {error   && <div style={styles.errorBox}>⚠️ {error}</div>}
      {success && <div style={styles.successBox}>✓ {success}</div>}

      {/* ── Placing instruction banner ────────────────────────────────────── */}
      {isPlacing && (
        <div style={styles.placingBanner}>
          🖱️ Click anywhere on the map to place the zone center
        </div>
      )}

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <div style={{ ...styles.mapWrap, cursor: isPlacing ? 'crosshair' : 'grab' }}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%', borderRadius: '10px' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <MapClickHandler onMapClick={handleMapClick} isPlacing={isPlacing} />

          {/* Existing zones */}
          {zones.map((zone, i) => {
            const color = ZONE_COLORS[i % ZONE_COLORS.length];
            return (
              <Circle
                key={zone.id}
                center={[zone.lat, zone.lng]}
                radius={zone.radiusKm * 1000}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 2 }}
              >
                <Popup>
                  <div style={{ textAlign: 'center', minWidth: '120px' }}>
                    <strong style={{ color: '#1a1a1a' }}>{zone.name}</strong><br />
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      Radius: {zone.radiusKm} km
                    </span><br />
                    <button
                      onClick={() => handleDelete(zone.id, zone.name)}
                      disabled={deletingId === zone.id}
                      style={{
                        marginTop: '8px',
                        padding: '4px 10px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      {deletingId === zone.id ? '⏳' : '🗑️ Delete'}
                    </button>
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {/* Pending zone preview */}
          {pendingLat !== null && (
            <>
              <Marker
                position={[pendingLat, pendingLon]}
                icon={crosshairIcon}
              />
              <Circle
                center={[pendingLat, pendingLon]}
                radius={pendingRadius * 1000}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.12,
                  weight: 2,
                  dashArray: '6 4',
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* ── New zone form (shown after map click) ────────────────────────── */}
      {pendingLat !== null && (
        <div style={styles.formCard}>
          <p style={styles.formTitle}>🆕 Configure New Zone</p>

          <div style={styles.coordRow}>
            <span style={styles.coordChip}>
              📍 {pendingLat.toFixed(4)}, {pendingLon.toFixed(4)}
            </span>
            <button
              style={styles.replaceBtn}
              onClick={() => { setIsPlacing(true); }}
            >
              Replace
            </button>
          </div>

          <label style={styles.label}>Zone Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. Home, School, Office…"
            value={pendingName}
            maxLength={40}
            onChange={(e) => setPendingName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />

          <label style={styles.label}>
            Radius — <strong style={{ color: '#f59e0b' }}>{pendingRadius} km</strong>
          </label>
          <input
            style={styles.slider}
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={pendingRadius}
            onChange={(e) => setPendingRadius(parseFloat(e.target.value))}
          />
          <div style={styles.sliderLabels}>
            <span>100 m</span><span>5 km</span>
          </div>

          <div style={styles.formActions}>
            <button style={styles.cancelSmall} onClick={handleCancelPlace}>
              Cancel
            </button>
            <button
              style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ Saving…' : '✓ Save Zone'}
            </button>
          </div>
        </div>
      )}

      {/* ── Zone list ────────────────────────────────────────────────────── */}
      {zones.length > 0 && (
        <div style={styles.zoneList}>
          <p style={styles.listTitle}>Active Zones</p>
          {zones.map((zone, i) => {
            const color = ZONE_COLORS[i % ZONE_COLORS.length];
            return (
              <div key={zone.id} style={styles.zoneRow}>
                <div style={{ ...styles.zoneColorDot, background: color }} />
                <div style={styles.zoneInfo}>
                  <span style={styles.zoneName}>{zone.name}</span>
                  <span style={styles.zoneMeta}>
                    {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)} · {zone.radiusKm} km radius
                  </span>
                </div>
                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(zone.id, zone.name)}
                  disabled={deletingId === zone.id}
                  title="Delete zone"
                >
                  {deletingId === zone.id ? '⏳' : '🗑️'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {zones.length === 0 && !isPlacing && familyId && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
          <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>No zones yet.</p>
          <p style={{ margin: '4px 0 0', color: '#444', fontSize: '12px' }}>
            Click "Add Zone" to define safe areas for your riders.
          </p>
        </div>
      )}

      {!familyId && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
          <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>
            Sign in with Google and join a family to manage geofences.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    background: '#111318',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #1e2130',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  title: {
    margin: 0,
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
  },
  sub: {
    margin: '4px 0 0',
    color: '#555',
    fontSize: '12px',
  },
  addBtn: {
    padding: '8px 16px',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#888',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
  placingBanner: {
    padding: '10px 14px',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: '8px',
    color: '#fbbf24',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '12px',
    textAlign: 'center',
    animation: 'pulse 2s infinite',
  },
  mapWrap: {
    height: '340px',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '16px',
    border: '1px solid #1e2130',
  },
  errorBox: {
    padding: '8px 12px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px',
    color: '#f87171',
    fontSize: '13px',
    marginBottom: '12px',
  },
  successBox: {
    padding: '8px 12px',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '6px',
    color: '#34d399',
    fontSize: '13px',
    marginBottom: '12px',
  },
  formCard: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '16px',
  },
  formTitle: {
    margin: '0 0 12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
  },
  coordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  coordChip: {
    padding: '5px 10px',
    background: '#111318',
    border: '1px solid #2a2d3a',
    borderRadius: '6px',
    color: '#f59e0b',
    fontSize: '12px',
    fontFamily: 'monospace',
    flex: 1,
  },
  replaceBtn: {
    padding: '5px 10px',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#666',
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  label: {
    display: 'block',
    color: '#888',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#111318',
    border: '1px solid #2a2d3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    marginBottom: '14px',
    boxSizing: 'border-box',
    fontFamily: 'Arial',
    outline: 'none',
  },
  slider: {
    width: '100%',
    accentColor: '#f59e0b',
    marginBottom: '4px',
    cursor: 'pointer',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#555',
    marginBottom: '14px',
  },
  formActions: {
    display: 'flex',
    gap: '8px',
  },
  cancelSmall: {
    flex: 1,
    padding: '10px',
    background: 'transparent',
    border: '1px solid #2a2d3a',
    borderRadius: '8px',
    color: '#666',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 2,
    padding: '10px',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  zoneList: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  listTitle: {
    margin: 0,
    padding: '12px 14px',
    color: '#666',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    borderBottom: '1px solid #2a2d3a',
  },
  zoneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderBottom: '1px solid #1e2130',
  },
  zoneColorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  zoneInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  zoneName: {
    color: '#e0e0e0',
    fontSize: '13px',
    fontWeight: '600',
  },
  zoneMeta: {
    color: '#555',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    flexShrink: 0,
    opacity: 0.6,
    transition: 'opacity 0.15s',
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px 20px',
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '10px',
  },
};