import { useState, useEffect, useRef } from "react";
import { ref, onValue, set, remove, push, update } from "firebase/database";
import { db } from "../config/firebase";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// ── Fly to location when search result selected ────────────────────────────
function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.setView([target.lat, target.lon], 15, { animate: true });
    }
  }, [target, map]);
  return null;
}

// ── Location search bar using Nominatim (free, no key) ─────────────────────
function LocationSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const search = async (q) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
        { headers: { "Accept-Language": "en" } },
      );
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handlePick = (result) => {
    setQuery(result.display_name.split(",")[0]);
    setResults([]);
    onSelect({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      name: result.display_name.split(",")[0],
    });
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
  };

  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <div style={{ position: "relative" }}>
        <input
          style={{
            width: "100%",
            padding: "10px 36px 10px 12px",
            background: "#111318",
            border: "1px solid #3b82f6",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "14px",
            boxSizing: "border-box",
            fontFamily: "Arial",
            outline: "none",
          }}
          type="text"
          placeholder="🔍 Search location to place zone..."
          value={query}
          onChange={handleChange}
          autoComplete="off"
        />
        {query && (
          <button
            onClick={handleClear}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "#555",
              cursor: "pointer",
              fontSize: "14px",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {searching && (
        <p style={{ color: "#888", fontSize: "12px", margin: "4px 0 0 2px" }}>
          Searching...
        </p>
      )}
      {results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "44px",
            left: 0,
            right: 0,
            background: "#1a1d27",
            border: "1px solid #2a2d3a",
            borderRadius: "8px",
            zIndex: 9999,
            maxHeight: "200px",
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {results.map((r) => (
            <div
              key={r.place_id}
              onClick={() => handlePick(r)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: "13px",
                color: "#e0e0e0",
                borderBottom: "1px solid #1e2130",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#2a2d3a")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              📍 {r.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Crosshair icon for placing ─────────────────────────────────────────────
const crosshairIcon = L.divIcon({
  className: "",
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

const ZONE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

const DEFAULT_CENTER = [18.5204, 73.8567];

export default function GeofenceEditor({ familyId }) {
  const [zones, setZones] = useState([]);
  const [isPlacing, setIsPlacing] = useState(false);
  const [pendingLat, setPendingLat] = useState(null);
  const [pendingLon, setPendingLon] = useState(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingRadius, setPendingRadius] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const mapRef = useRef(null);

  // ── Firebase listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!familyId) return;
    const zonesRef = ref(db, `families/${familyId}/geofences`);
    const unsub = onValue(zonesRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setZones([]);
        return;
      }
      const list = Object.entries(data).map(([id, z]) => ({ id, ...z }));
      setZones(list);
    });
    return () => unsub();
  }, [familyId]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleMapClick = (lat, lon) => {
    setPendingLat(lat);
    setPendingLon(lon);
    setIsPlacing(false);
  };

  // ── Search result selected — fly map + pre-fill form ──────────────────────
  const handleSearchSelect = ({ lat, lon, name }) => {
    setPendingLat(lat);
    setPendingLon(lon);
    if (!pendingName) setPendingName(name);
    setIsPlacing(false);
    setError("");
    setFlyTarget({ lat, lon });
  };

  const handleSave = async () => {
    if (!pendingName.trim()) {
      setError("Enter a zone name.");
      return;
    }
    if (pendingLat === null || pendingLon === null) {
      setError("Select a location via search or map click.");
      return;
    }
    if (!familyId) {
      setError("No family ID — sign in with Google.");
      return;
    }
    if (!editingZoneId && zones.length >= 10) {
      setError("Maximum 10 zones allowed.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const savedName = pendingName.trim();
      if (editingZoneId) {
        await set(ref(db, `families/${familyId}/geofences/${editingZoneId}`), {
          name: savedName,
          lat: pendingLat,
          lng: pendingLon,
          radiusKm: pendingRadius,
          updatedAt: new Date().toISOString(),
        });
        showSuccess(`Zone "${savedName}" updated.`);
      } else {
        const zonesRef = ref(db, `families/${familyId}/geofences`);
        await push(zonesRef, {
          name: savedName,
          lat: pendingLat,
          lng: pendingLon,
          radiusKm: pendingRadius,
          createdAt: new Date().toISOString(),
        });
        showSuccess(`Zone "${savedName}" saved.`);
      }
      setPendingLat(null);
      setPendingLon(null);
      setPendingName("");
      setPendingRadius(0.5);
      setEditingZoneId(null);
      setFlyTarget(null);
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
    setPendingName("");
    setPendingRadius(0.5);
    setError("");
    setEditingZoneId(null);
    setFlyTarget(null);
  };

  const handleEditZone = (zone) => {
    setPendingLat(zone.lat);
    setPendingLon(zone.lng);
    setPendingName(zone.name);
    setPendingRadius(zone.radiusKm);
    setEditingZoneId(zone.id);
    setIsPlacing(false);
    setFlyTarget({ lat: zone.lat, lon: zone.lng });
  };

  const mapCenter =
    zones.length > 0 ? [zones[0].lat, zones[0].lng] : DEFAULT_CENTER;

  return (
    <div style={styles.wrap}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>📍 Geofence Zones</h3>
          <p style={styles.sub}>
            {familyId
              ? `${zones.length} zone${zones.length !== 1 ? "s" : ""} configured for your family`
              : "Sign in with Google to manage family geofences"}
          </p>
        </div>
        {familyId && !isPlacing && !editingZoneId && (
          <button
            style={styles.addBtn}
            onClick={() => {
              setIsPlacing(true);
              setError("");
            }}
          >
            + Add Zone
          </button>
        )}
        {(isPlacing || pendingLat !== null) && (
          <button style={styles.cancelBtn} onClick={handleCancelPlace}>
            ✕ Cancel
          </button>
        )}
      </div>

      {/* ── Status messages ───────────────────────────────────────────────── */}
      {error && <div style={styles.errorBox}>⚠️ {error}</div>}
      {success && <div style={styles.successBox}>✓ {success}</div>}

      {/* ── Location search bar ───────────────────────────────────────────── */}
      {familyId && <LocationSearch onSelect={handleSearchSelect} />}

      {/* ── Placing instruction banner ────────────────────────────────────── */}
      {isPlacing && (
        <div style={styles.placingBanner}>
          🖱️ Click anywhere on the map to place the zone center
        </div>
      )}

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <div
        style={{ ...styles.mapWrap, cursor: isPlacing ? "crosshair" : "grab" }}
      >
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: "100%", width: "100%", borderRadius: "10px" }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <MapClickHandler onMapClick={handleMapClick} isPlacing={isPlacing} />
          {flyTarget && <MapFlyTo target={flyTarget} />}

          {/* Existing zones */}
          {zones.map((zone, i) => {
            const color = ZONE_COLORS[i % ZONE_COLORS.length];
            const isBeingEdited = editingZoneId === zone.id;
            return (
              <Circle
                key={zone.id}
                center={[zone.lat, zone.lng]}
                radius={zone.radiusKm * 1000}
                pathOptions={{
                  color: isBeingEdited ? "#f59e0b" : color,
                  fillColor: isBeingEdited ? "#f59e0b" : color,
                  fillOpacity: isBeingEdited ? 0.25 : 0.15,
                  weight: isBeingEdited ? 3 : 2,
                  dashArray: isBeingEdited ? "6 4" : undefined,
                }}
              >
                <Popup>
                  <div style={{ textAlign: "center", minWidth: "120px" }}>
                    <strong style={{ color: "#1a1a1a" }}>{zone.name}</strong>
                    <br />
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      Radius: {zone.radiusKm} km
                    </span>
                    <br />
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        marginTop: "8px",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => handleEditZone(zone)}
                        style={{
                          padding: "4px 10px",
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(zone.id, zone.name)}
                        disabled={deletingId === zone.id}
                        style={{
                          padding: "4px 10px",
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        {deletingId === zone.id ? "⏳" : "🗑️ Delete"}
                      </button>
                    </div>
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
                  color: "#f59e0b",
                  fillColor: "#f59e0b",
                  fillOpacity: 0.12,
                  weight: 2,
                  dashArray: "6 4",
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* ── Zone form (new or edit) ───────────────────────────────────────── */}
      {pendingLat !== null && (
        <div style={styles.formCard}>
          <p style={styles.formTitle}>
            {editingZoneId ? "✏️ Edit Zone" : "🆕 Configure New Zone"}
          </p>

          <div style={styles.coordRow}>
            <span style={styles.coordChip}>
              📍 {pendingLat.toFixed(4)}, {pendingLon.toFixed(4)}
            </span>
            <button
              style={styles.replaceBtn}
              onClick={() => {
                setIsPlacing(true);
                // intentionally do NOT reset pendingName here
              }}
            >
              Move
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
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />

          <label style={styles.label}>
            Radius —{" "}
            <strong style={{ color: "#f59e0b" }}>{pendingRadius} km</strong>
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
            <span>100 m</span>
            <span>5 km</span>
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
              {saving
                ? "⏳ Saving…"
                : editingZoneId
                  ? "✓ Update Zone"
                  : "✓ Save Zone"}
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
                    {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)} ·{" "}
                    {zone.radiusKm} km radius
                  </span>
                </div>
                <button
                  style={{ ...styles.actionBtn, color: "#3b82f6" }}
                  onClick={() => handleEditZone(zone)}
                  title="Edit zone"
                >
                  ✏️
                </button>
                <button
                  style={styles.actionBtn}
                  onClick={() => handleDelete(zone.id, zone.name)}
                  disabled={deletingId === zone.id}
                  title="Delete zone"
                >
                  {deletingId === zone.id ? "⏳" : "🗑️"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {zones.length === 0 && !isPlacing && familyId && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗺️</div>
          <p style={{ margin: 0, color: "#555", fontSize: "14px" }}>
            No zones yet.
          </p>
          <p style={{ margin: "4px 0 0", color: "#444", fontSize: "12px" }}>
            Search a location or click the map, then click "+ Add Zone".
          </p>
        </div>
      )}

      {!familyId && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔒</div>
          <p style={{ margin: 0, color: "#555", fontSize: "14px" }}>
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
    background: "#111318",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #1e2130",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "10px",
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: "16px",
    fontWeight: "700",
  },
  sub: {
    margin: "4px 0 0",
    color: "#555",
    fontSize: "12px",
  },
  addBtn: {
    padding: "8px 16px",
    background: "#3b82f6",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
  },
  cancelBtn: {
    padding: "8px 16px",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#888",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
  },
  placingBanner: {
    padding: "10px 14px",
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: "8px",
    color: "#fbbf24",
    fontSize: "13px",
    fontWeight: "500",
    marginBottom: "12px",
    textAlign: "center",
    animation: "pulse 2s infinite",
  },
  mapWrap: {
    height: "340px",
    borderRadius: "10px",
    overflow: "hidden",
    marginBottom: "16px",
    border: "1px solid #1e2130",
  },
  errorBox: {
    padding: "8px 12px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "6px",
    color: "#f87171",
    fontSize: "13px",
    marginBottom: "12px",
  },
  successBox: {
    padding: "8px 12px",
    background: "rgba(16,185,129,0.1)",
    border: "1px solid rgba(16,185,129,0.3)",
    borderRadius: "6px",
    color: "#34d399",
    fontSize: "13px",
    marginBottom: "12px",
  },
  formCard: {
    background: "#1a1d27",
    border: "1px solid #2a2d3a",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "16px",
  },
  formTitle: {
    margin: "0 0 12px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
  },
  coordRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  coordChip: {
    padding: "5px 10px",
    background: "#111318",
    border: "1px solid #2a2d3a",
    borderRadius: "6px",
    color: "#f59e0b",
    fontSize: "12px",
    fontFamily: "monospace",
    flex: 1,
  },
  replaceBtn: {
    padding: "5px 10px",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#666",
    fontSize: "12px",
    cursor: "pointer",
    flexShrink: 0,
  },
  label: {
    display: "block",
    color: "#888",
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    background: "#111318",
    border: "1px solid #2a2d3a",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
    marginBottom: "14px",
    boxSizing: "border-box",
    fontFamily: "Arial",
    outline: "none",
  },
  slider: {
    width: "100%",
    accentColor: "#f59e0b",
    marginBottom: "4px",
    cursor: "pointer",
  },
  sliderLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "#555",
    marginBottom: "14px",
  },
  formActions: {
    display: "flex",
    gap: "8px",
  },
  cancelSmall: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "1px solid #2a2d3a",
    borderRadius: "8px",
    color: "#666",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  saveBtn: {
    flex: 2,
    padding: "10px",
    background: "#3b82f6",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
  zoneList: {
    background: "#1a1d27",
    border: "1px solid #2a2d3a",
    borderRadius: "10px",
    overflow: "hidden",
  },
  listTitle: {
    margin: 0,
    padding: "12px 14px",
    color: "#666",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    borderBottom: "1px solid #2a2d3a",
  },
  zoneRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 14px",
    borderBottom: "1px solid #1e2130",
  },
  zoneColorDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  zoneInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  zoneName: {
    color: "#e0e0e0",
    fontSize: "13px",
    fontWeight: "600",
  },
  zoneMeta: {
    color: "#555",
    fontSize: "11px",
    fontFamily: "monospace",
  },
  actionBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px",
    flexShrink: 0,
    opacity: 0.6,
    transition: "opacity 0.15s",
  },
  emptyState: {
    textAlign: "center",
    padding: "32px 20px",
    background: "#1a1d27",
    border: "1px solid #2a2d3a",
    borderRadius: "10px",
  },
};
