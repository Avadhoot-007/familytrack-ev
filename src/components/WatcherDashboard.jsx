import { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue, update, push } from "firebase/database";
import { db } from "../config/firebase";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./WatcherDashboard.css";
import { isInsideGeofence } from "../services/locationService";
import { geofences as staticGeofences } from "../data/geofences";
import { fetchChargingStations } from "../services/chargingStations";
import TripSummaryCard from "./TripSummaryCard.jsx";
import CoachingTipCard from "./CoachingTipCard.jsx";
import { downloadTripPDF } from "../utils/tripPDFExport";
import GeofenceEditor from "./GeofenceEditor.jsx";
import { useStore } from "../store";

const RIDER_COLORS = ["#e53935", "#1e88e5", "#8e24aa", "#f4511e", "#00897b"];
const GEOFENCE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];
const getRiderColor = (index) => RIDER_COLORS[index % RIDER_COLORS.length];
const getZoneColor = (index) => GEOFENCE_COLORS[index % GEOFENCE_COLORS.length];

const validCoords = (lat, lon) =>
  lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon));

const validRoute = (route) =>
  Array.isArray(route) &&
  route.length >= 2 &&
  route.every(
    (p) =>
      Array.isArray(p) &&
      p.length === 2 &&
      !isNaN(Number(p[0])) &&
      !isNaN(Number(p[1])),
  );

const createDivIcon = (color, label) =>
  L.divIcon({
    className: "",
    html: `<div style="
      background:${color};color:white;border-radius:50% 50% 50% 0;
      width:28px;height:28px;display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:bold;transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);">
      <span style="transform:rotate(45deg)">${label}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });

const createChargingIcon = () =>
  L.divIcon({
    className: "",
    html: `<div style="
      background:#2e7d32;color:white;border-radius:50%;
      width:26px;height:26px;display:flex;align-items:center;justify-content:center;
      font-size:14px;border:2px solid #81c784;
      box-shadow:0 1px 6px rgba(46,125,50,0.6);">
      ⚡
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  });

const BATTERY_CRITICAL = 10;
const BATTERY_LOW = 25;
const DRAIN_BASELINE = 37;
const DRAIN_ALERT_RATIO = 1.2;

const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const RAIN_CODES = new Set([
  200, 201, 202, 210, 211, 212, 221, 230, 231, 232, 300, 301, 302, 310, 311,
  312, 313, 314, 321, 500, 501, 502, 503, 504, 511, 520, 521, 522, 531,
]);
const isRaining = (id) => RAIN_CODES.has(id);

const fetchWeather = async (lat, lon) => {
  if (!OWM_KEY) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const w = data.weather?.[0];
    return w
      ? {
          id: w.id,
          description: w.description,
          temp: Math.round(data.main?.temp ?? 0),
        }
      : null;
  } catch {
    return null;
  }
};

const ecoScoreColor = (score) => {
  if (score >= 80) return "#4CAF50";
  if (score >= 60) return "#ffc107";
  if (score >= 40) return "#ff9800";
  return "#dc3545";
};

// ── Tab button style helper ───────────────────────────────────────────────────
const TAB_STYLE = (active) => ({
  padding: "6px 16px",
  fontSize: "13px",
  fontWeight: active ? "700" : "500",
  background: active ? "#2a2d3a" : "transparent",
  border: active ? "1px solid #444" : "1px solid transparent",
  borderRadius: "6px",
  color: active ? "#fff" : "#888",
  cursor: "pointer",
  transition: "all 0.15s",
  whiteSpace: "nowrap",
});

// ── Trip Score Chart ──────────────────────────────────────────────────────────
function TripScoreChart({ trips, riderName, color }) {
  const last10 = trips
    .filter((t) => t.riderName === riderName || t.riderId === riderName)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-10);

  if (last10.length < 2) {
    return (
      <div
        style={{
          background: "#232323",
          border: "1px solid #333",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "10px",
        }}
      >
        <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>
          {riderName} — need 2+ trips for chart
        </p>
      </div>
    );
  }

  const W = 280;
  const H = 70;
  const PAD = { top: 8, right: 10, bottom: 18, left: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const scores = last10.map((t) => Number(t.score || t.ecoScore || 0));
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const scoreRange = maxScore - minScore || 1;

  const toX = (i) => PAD.left + (i / (last10.length - 1)) * chartW;
  const toY = (s) => PAD.top + chartH - ((s - minScore) / scoreRange) * chartH;

  const polyPoints = last10
    .map((t, i) => `${toX(i)},${toY(Number(t.score || t.ecoScore || 0))}`)
    .join(" ");

  const areaPath = [
    `M ${toX(0)} ${toY(scores[0])}`,
    ...last10
      .slice(1)
      .map(
        (t, i) => `L ${toX(i + 1)} ${toY(Number(t.score || t.ecoScore || 0))}`,
      ),
    `L ${toX(last10.length - 1)} ${PAD.top + chartH}`,
    `L ${toX(0)} ${PAD.top + chartH}`,
    "Z",
  ].join(" ");

  const avgScore = Math.round(
    scores.reduce((a, b) => a + b, 0) / scores.length,
  );
  const trend = scores[scores.length - 1] - scores[0];

  return (
    <div
      style={{
        background: "#1e1e1e",
        border: `1px solid ${color}44`,
        borderRadius: "10px",
        padding: "12px 14px",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: color,
            }}
          />
          <span
            style={{ fontSize: "13px", fontWeight: "600", color: "#e0e0e0" }}
          >
            {riderName}
          </span>
        </div>
        <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
          <span style={{ color: "#888" }}>
            Avg:{" "}
            <span style={{ color: ecoScoreColor(avgScore), fontWeight: "700" }}>
              {avgScore}
            </span>
          </span>
          <span style={{ color: trend >= 0 ? "#4CAF50" : "#f44336" }}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(Math.round(trend))} pts
          </span>
        </div>
      </div>

      <svg
        width={W}
        height={H}
        style={{ display: "block", overflow: "visible" }}
      >
        {[0, 50, 100].map((val) => {
          const y = toY(val);
          if (y < PAD.top || y > PAD.top + chartH) return null;
          return (
            <g key={val}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke="#2a2a2a"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 4}
                y={y + 3}
                fontSize="9"
                fill="#555"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={color} fillOpacity="0.08" />

        <polyline
          points={polyPoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {last10.map((t, i) => {
          const s = Number(t.score || t.ecoScore || 0);
          const cx = toX(i);
          const cy = toY(s);
          const isLast = i === last10.length - 1;
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={isLast ? 4 : 3}
                fill={isLast ? color : "#1e1e1e"}
                stroke={color}
                strokeWidth="2"
              />
              {isLast && (
                <text
                  x={cx}
                  y={cy - 7}
                  fontSize="10"
                  fill={color}
                  textAnchor="middle"
                  fontWeight="700"
                >
                  {s}
                </text>
              )}
            </g>
          );
        })}

        {last10.length > 0 && (
          <>
            <text
              x={toX(0)}
              y={H - 2}
              fontSize="9"
              fill="#555"
              textAnchor="start"
            >
              {new Date(last10[0].timestamp).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </text>
            <text
              x={toX(last10.length - 1)}
              y={H - 2}
              fontSize="9"
              fill="#555"
              textAnchor="end"
            >
              {new Date(last10[last10.length - 1].timestamp).toLocaleDateString(
                [],
                { month: "short", day: "numeric" },
              )}
            </text>
          </>
        )}
      </svg>

      <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#666" }}>
        Last {last10.length} trips
      </p>
    </div>
  );
}

function TripScoreCharts({ allTrips, riderColorMap }) {
  const riderNames = [
    ...new Set(allTrips.map((t) => t.riderName || t.riderId).filter(Boolean)),
  ];

  if (riderNames.length === 0)
    return <p style={{ color: "#666", fontSize: "14px" }}>No trip data yet.</p>;

  const getRiderIdForName = (name) => {
    const trip = allTrips.find((t) => (t.riderName || t.riderId) === name);
    return trip?.riderId || null;
  };

  return (
    <div>
      {riderNames.map((name) => {
        const riderId = getRiderIdForName(name);
        const color = (riderId && riderColorMap.current[riderId]) || "#4CAF50";
        return (
          <TripScoreChart
            key={name}
            trips={allTrips}
            riderName={name}
            color={color}
          />
        );
      })}
    </div>
  );
}

function RainPrompt({ prompts, onDismiss }) {
  if (!prompts.length) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginBottom: "16px",
      }}
    >
      {prompts.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px 16px",
            background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
            border: "1px solid #3949ab",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
            boxShadow: "0 2px 8px rgba(26,35,126,0.3)",
            animation: "slideDown 0.3s ease",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            🌧️ <strong>Weather Alert:</strong> {p.message}
          </span>
          <button
            onClick={() => onDismiss(p.id)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              borderRadius: "4px",
              cursor: "pointer",
              padding: "4px 10px",
              fontSize: "12px",
              whiteSpace: "nowrap",
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
  const loc = raw
    ? {
        lat: raw.lat ?? raw.latitude ?? null,
        lon: raw.lon ?? raw.lng ?? raw.longitude ?? null,
      }
    : null;
  const hasCoords = loc && validCoords(loc.lat, loc.lon);
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${loc.lat},${loc.lon}`
    : null;

  return (
    <div className="sos-modal">
      <div className="sos-modal-content">
        <div style={{ fontSize: "56px", marginBottom: "8px" }}>🚨</div>
        <h2>SOS EMERGENCY</h2>
        <p
          style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}
        >
          {sosRider.sosRiderName || sosRider.riderId} needs help!
        </p>
        <div className="sos-info-box">
          {sosRider.sosTimestamp && (
            <p>
              🕐 <strong>Time:</strong>{" "}
              {new Date(sosRider.sosTimestamp).toLocaleTimeString()}
            </p>
          )}
          {hasCoords ? (
            <p>
              📍 <strong>Location:</strong> {Number(loc.lat).toFixed(4)},{" "}
              {Number(loc.lon).toFixed(4)}
            </p>
          ) : (
            <p>
              📍 <strong>Location:</strong> Not available
            </p>
          )}
          {sosRider.sosBattery != null && (
            <p>
              🔋 <strong>Battery:</strong> {sosRider.sosBattery}%
            </p>
          )}
        </div>
        <div className="sos-button-group">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="maps-btn"
            >
              📍 Open in Google Maps
            </a>
          ) : (
            <div
              style={{
                padding: "12px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#999",
                textAlign: "center",
                border: "1px solid #444",
              }}
            >
              📍 Location unavailable
            </div>
          )}
          <button onClick={onResolve} className="resolve-btn">
            ✓ Mark as Resolved
          </button>
          <button onClick={() => onClose(sosRider)} className="dismiss-btn">
            Dismiss (keep monitoring)
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingSOSBanner({ sosRider, onResolve, resolving }) {
  const raw = sosRider.sosLocation;
  const loc = raw
    ? {
        lat: raw.lat ?? raw.latitude ?? null,
        lon: raw.lon ?? raw.lng ?? raw.longitude ?? null,
      }
    : null;
  const hasCoords = loc && validCoords(loc.lat, loc.lon);
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${loc.lat},${loc.lon}`
    : null;
  const name = sosRider.sosRiderName || sosRider.riderId;
  const time = sosRider.sosTimestamp
    ? new Date(sosRider.sosTimestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      style={{
        background: "#2d0a0a",
        border: "2px solid #dc3545",
        borderRadius: "8px",
        padding: "12px 14px",
        marginBottom: "10px",
        animation: "pulse 2s infinite",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div>
          <span
            style={{ color: "#ff5252", fontWeight: "700", fontSize: "13px" }}
          >
            🚨 SOS — {name}
          </span>
          <span style={{ color: "#888", fontSize: "11px", marginLeft: "8px" }}>
            at {time}
          </span>
        </div>
        {sosRider.sosBattery != null && (
          <span
            style={{ fontSize: "11px", color: "#ff8a80", whiteSpace: "nowrap" }}
          >
            🔋 {sosRider.sosBattery}%
          </span>
        )}
      </div>
      {hasCoords && (
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#aaa" }}>
          📍 {Number(loc.lat).toFixed(4)}, {Number(loc.lon).toFixed(4)}
        </p>
      )}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={() => onResolve(sosRider.riderId)}
          disabled={resolving}
          style={{
            padding: "5px 12px",
            background: resolving ? "#444" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: resolving ? "not-allowed" : "pointer",
            fontSize: "12px",
            fontWeight: "600",
            transition: "background 0.15s",
          }}
        >
          {resolving ? "⏳ Resolving..." : "✓ Mark as Resolved"}
        </button>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "5px 12px",
              background: "#1565c0",
              color: "white",
              borderRadius: "5px",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            📍 Open Maps
          </a>
        )}
      </div>
    </div>
  );
}

function TripStatsSummary({ trips, filterDays }) {
  const now = Date.now();
  const windowMs = filterDays * 24 * 60 * 60 * 1000;
  const filtered = trips.filter(
    (t) => now - new Date(t.timestamp).getTime() <= windowMs,
  );
  if (!filtered.length)
    return (
      <p style={{ color: "#666", fontSize: "14px" }}>
        No trips in this period.
      </p>
    );

  const totalTrips = filtered.length;
  const totalDistance = filtered.reduce(
    (s, t) => s + (Number(t.distanceKm) || 0),
    0,
  );
  const avgSpeed =
    filtered.reduce((s, t) => s + (Number(t.avgSpeedKmh) || 0), 0) / totalTrips;
  const avgScore =
    filtered.reduce((s, t) => s + (Number(t.score) || 0), 0) / totalTrips;
  const bestScore = Math.max(...filtered.map((t) => Number(t.score || 0)));
  const worstScore = Math.min(...filtered.map((t) => Number(t.score || 0)));

  const StatBox = ({ emoji, label, value }) => (
    <div
      style={{
        background: "#2a2a2a",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "24px", marginBottom: "4px" }}>{emoji}</div>
      <div
        style={{
          fontSize: "18px",
          fontWeight: "bold",
          color: "#fff",
          marginBottom: "4px",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "#999" }}>{label}</div>
    </div>
  );

  return (
    <div className="watcher-stats-grid">
      <StatBox emoji="🚴" label="Total Trips" value={totalTrips} />
      <StatBox emoji="🌿" label="Avg Score" value={avgScore.toFixed(0)} />
      <StatBox emoji="⬆️" label="Best Score" value={bestScore} />
      <StatBox emoji="⬇️" label="Worst Score" value={worstScore} />
      <StatBox
        emoji="📏"
        label="Total Distance"
        value={`${totalDistance.toFixed(2)} km`}
      />
      <StatBox
        emoji="⚡"
        label="Avg Speed"
        value={`${avgSpeed.toFixed(1)} km/h`}
      />
    </div>
  );
}

function TripHistoryTable({ trips, filterDays, onTripClick, onExportPDF }) {
  const now = Date.now();
  const windowMs = filterDays * 24 * 60 * 60 * 1000;
  const filtered = trips
    .filter((t) => now - new Date(t.timestamp).getTime() <= windowMs)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (!filtered.length)
    return (
      <p style={{ color: "#999", fontSize: "14px" }}>
        No trips in this period.
      </p>
    );
  const scoreColor = (s) =>
    s >= 70 ? "#28a745" : s >= 40 ? "#ffc107" : "#dc3545";

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}
      >
        <thead>
          <tr style={{ background: "#1a1a1a", borderBottom: "2px solid #333" }}>
            <th style={{ padding: "8px", textAlign: "left", color: "#fff" }}>
              Rider
            </th>
            <th style={{ padding: "8px", textAlign: "left", color: "#fff" }}>
              Date
            </th>
            <th style={{ padding: "8px", textAlign: "center", color: "#fff" }}>
              Score
            </th>
            <th
              className="trip-col-distance"
              style={{ padding: "8px", textAlign: "center", color: "#fff" }}
            >
              Distance (km)
            </th>
            <th
              className="trip-col-speed"
              style={{ padding: "8px", textAlign: "center", color: "#fff" }}
            >
              Avg Speed (km/h)
            </th>
            <th style={{ padding: "8px", textAlign: "center", color: "#fff" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((trip) => (
            <tr
              key={trip.id}
              style={{ borderBottom: "1px solid #2a2a2a" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#1a1a1a")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <td
                style={{
                  padding: "8px",
                  fontWeight: "bold",
                  color: trip.riderColor || "#fff",
                }}
              >
                {trip.riderName || trip.riderId}
              </td>
              <td style={{ padding: "8px", color: "#ccc" }}>
                {new Date(trip.timestamp).toLocaleDateString()}{" "}
                {new Date(trip.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                <span
                  style={{ color: scoreColor(trip.score), fontWeight: "bold" }}
                >
                  🌿 {trip.score}
                </span>
              </td>
              <td
                className="trip-col-distance"
                style={{ padding: "8px", textAlign: "center", color: "#ccc" }}
              >
                {trip.distanceKm ?? "—"}
              </td>
              <td
                className="trip-col-speed"
                style={{ padding: "8px", textAlign: "center", color: "#ccc" }}
              >
                {trip.avgSpeedKmh ?? "—"}
              </td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                <button
                  onClick={() => onTripClick(trip)}
                  style={{
                    padding: "4px 8px",
                    background: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "4px",
                    fontSize: "12px",
                  }}
                >
                  View
                </button>
                <button
                  onClick={() => onExportPDF(trip)}
                  style={{
                    padding: "4px 8px",
                    background: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
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

function AlertItem({ alert, onSendReminder }) {
  const bgColor =
    alert.type === "danger"
      ? "#3d1a1a"
      : alert.type === "success"
        ? "#1a3d1a"
        : "#3d3200";
  const borderColor =
    alert.type === "danger"
      ? "#f5c6cb"
      : alert.type === "success"
        ? "#28a745"
        : "#ffc107";
  const textColor =
    alert.type === "danger"
      ? "#ffcdd2"
      : alert.type === "success"
        ? "#c8e6c9"
        : "#ffe082";

  return (
    <div
      style={{
        padding: "10px 12px",
        margin: "5px 0",
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "6px",
        fontSize: "13px",
        color: textColor,
        fontWeight: alert.type === "danger" ? "bold" : "normal",
      }}
    >
      <div style={{ marginBottom: alert.actionType ? "8px" : 0 }}>
        {alert.message}
      </div>

      {alert.actionType === "charging_reminder" && alert.riderId && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() =>
              onSendReminder(alert.riderId, alert.riderName, "low_battery")
            }
            style={{
              padding: "4px 10px",
              background: "#ffc107",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
              color: "#1a1a1a",
            }}
          >
            💬 Send Charging Reminder
          </button>
          {alert.stationUrl && (
            <a
              href={alert.stationUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "4px 10px",
                background: "#17a2b8",
                color: "white",
                borderRadius: "4px",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              🗺️ Nearest Station
            </a>
          )}
        </div>
      )}

      {alert.actionType === "critical_battery" && alert.riderId && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() =>
              onSendReminder(alert.riderId, alert.riderName, "critical_battery")
            }
            style={{
              padding: "4px 10px",
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            🚨 Send Critical Alert
          </button>
          {alert.stationUrl && (
            <a
              href={alert.stationUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "4px 10px",
                background: "#17a2b8",
                color: "white",
                borderRadius: "4px",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              🗺️ Open Station in Maps
            </a>
          )}
        </div>
      )}

      {alert.actionType === "drain_warning" && alert.riderId && (
        <button
          onClick={() =>
            onSendReminder(alert.riderId, alert.riderName, "drain_warning")
          }
          style={{
            marginTop: "2px",
            padding: "4px 10px",
            background: "#fd7e14",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          💬 Send Eco Tip
        </button>
      )}

      {alert.actionType === "rain_tip" && alert.riderId && (
        <button
          onClick={() =>
            onSendReminder(alert.riderId, alert.riderName, "rain_tip")
          }
          style={{
            marginTop: "2px",
            padding: "4px 10px",
            background: "#1565c0",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          🌧️ Send Rain Warning
        </button>
      )}
    </div>
  );
}

const REMINDER_TIPS = {
  low_battery: {
    title: "Low Battery — Find a Charger",
    message:
      "Your battery is getting low. Please find a charging station soon or head home.",
    category: "battery",
    priority: "high",
  },
  critical_battery: {
    title: "🚨 Critical Battery — Stop Now",
    message:
      "Battery is critically low! Stop riding immediately and find the nearest charging station.",
    category: "battery",
    priority: "high",
  },
  drain_warning: {
    title: "⚡ Ease Off Throttle",
    message:
      "You're draining battery faster than normal. Smooth acceleration and lower speeds will extend your range significantly.",
    category: "throttle",
    priority: "medium",
  },
  rain_tip: {
    title: "🌧️ Rain Alert — Slow Down",
    message:
      "It's raining in your area. Reduce speed, increase following distance, and avoid sharp braking. Stay safe!",
    category: "weather",
    priority: "high",
  },
};

function RouteLegend({ riders, riderColorMap }) {
  const onlineWithRoutes = Object.entries(riders).filter(
    ([, r]) => r.status === "online" && validRoute(r.currentRoute),
  );
  if (!onlineWithRoutes.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        borderRadius: "6px",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {onlineWithRoutes.map(([riderId, r]) => {
        const name = r.location?.name || riderId;
        const color = riderColorMap.current[riderId] || "#e53935";
        return (
          <div
            key={riderId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#e0e0e0",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "3px",
                background: color,
                borderRadius: "2px",
              }}
            />
            <span>
              {name} ({r.currentRoute.length} pts)
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WatcherDashboard() {
  const familyId = useStore((s) => s.familyId);

  const [riders, setRiders] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [filterDays, setFilterDays] = useState(7);
  const [activeTab, setActiveTab] = useState("history"); // "history" | "stats" | "trends"
  const [firstOnlineRider, setFirstOnlineRider] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [sosRider, setSosRider] = useState(null);
  const [reminderStatus, setReminderStatus] = useState({});
  const [pendingSosRiders, setPendingSosRiders] = useState({});
  const [resolvingRiderIds, setResolvingRiderIds] = useState(new Set());
  const [riderWeather, setRiderWeather] = useState({});
  const [rainPrompts, setRainPrompts] = useState([]);
  const rainPromptedRef = useRef({});
  const [chargingStations, setChargingStations] = useState([]);
  const chargingFetchedRef = useRef(false);
  const [showRoutes, setShowRoutes] = useState(true);

  const [firebaseGeofences, setFirebaseGeofences] = useState([]);
  const [showGeofenceEditor, setShowGeofenceEditor] = useState(false);

  const activeGeofences =
    familyId && firebaseGeofences.length > 0
      ? firebaseGeofences
      : staticGeofences;

  const batteryAlertedRef = useRef({});
  const drainAlertedRef = useRef({});
  const rangeAlertedRef = useRef({});
  const mapRef = useRef(null);
  const riderIndexMap = useRef({});
  const riderColorMap = useRef({});
  const previousInsideRef = useRef({});
  const sosProcessedRef = useRef({});

  const handleMapReady = useCallback((m) => {
    mapRef.current = m;
  }, []);

  useEffect(() => {
    if (!familyId) {
      setFirebaseGeofences([]);
      return;
    }
    const zonesRef = ref(db, `families/${familyId}/geofences`);
    const unsub = onValue(zonesRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setFirebaseGeofences([]);
        return;
      }
      const list = Object.entries(data).map(([id, z]) => ({
        id,
        name: z.name,
        lat: z.lat,
        lng: z.lng,
        radiusKm: z.radiusKm,
      }));
      setFirebaseGeofences(list);
    });
    return () => unsub();
  }, [familyId]);

  const fetchMapStations = useCallback(async (lat, lon) => {
    if (chargingFetchedRef.current) return;
    chargingFetchedRef.current = true;
    try {
      const results = await fetchChargingStations(lat, lon, 3);
      setChargingStations(results);
    } catch (e) {
      console.error("Charging fetch error:", e);
    }
  }, []);

  const pollWeather = useCallback(async (currentRiders) => {
    if (!OWM_KEY) return;
    const onlineEntries = Object.entries(currentRiders).filter(([, r]) => {
      if (r.status !== "online" || !r.location) return false;
      return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
    });
    if (!onlineEntries.length) return;

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
          const message = `It's raining near ${riderName} (${weather.description}, ${weather.temp}°C) — send a reminder to slow down?`;
          setRainPrompts((prev) => [...prev, { id: promptId, message }]);
          addAlert(
            `🌧️ Rain near ${riderName}: ${weather.description}, ${weather.temp}°C.`,
            "warning",
            { actionType: "rain_tip", riderId, riderName },
          );
        }
        if (!isRaining(weather.id)) rainPromptedRef.current[riderId] = false;
      }),
    );
  }, []);

  const dismissRainPrompt = useCallback(
    (id) => setRainPrompts((p) => p.filter((r) => r.id !== id)),
    [],
  );

  const addAlert = (message, type = "warning", extra = {}) => {
    setAlerts((prev) => [
      { id: `alert-${Date.now()}-${Math.random()}`, message, type, ...extra },
      ...prev.slice(0, 49),
    ]);
  };

  const handleSendReminder = async (riderId, riderName, tipType) => {
    const key = `${riderId}_${tipType}`;
    setReminderStatus((prev) => ({ ...prev, [key]: "sending" }));
    const tip = REMINDER_TIPS[tipType];
    if (!tip) return;
    try {
      const tipsRef = ref(db, `riders/${riderId}/coachingTips`);
      await push(tipsRef, {
        ...tip,
        sentBy: "watcher",
        sentAt: new Date().toISOString(),
        read: false,
      });
      setReminderStatus((prev) => ({ ...prev, [key]: "sent" }));
      setTimeout(
        () =>
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          }),
        4000,
      );
    } catch (err) {
      console.error("Failed to send reminder:", err);
      setReminderStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  // ── Riders Firebase listener ──────────────────────────────────────────────
  useEffect(() => {
    const ridersRef = ref(db, "riders");
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
        if (
          riderData.sosTriggered === true &&
          !sosProcessedRef.current[riderId]
        ) {
          sosProcessedRef.current[riderId] = true;
          setSosRider({ riderId, ...riderData });
          addAlert(
            `🚨 SOS ALERT from ${riderData.sosRiderName || riderData.location?.name || riderId}!`,
            "danger",
          );
        } else if (riderData.sosTriggered === false) {
          sosProcessedRef.current[riderId] = false;
          setPendingSosRiders((prev) => {
            if (!prev[riderId]) return prev;
            const next = { ...prev };
            delete next[riderId];
            return next;
          });
        }

        const loc = riderData.location;
        const isOnline = riderData.status === "online";
        if (!loc) return;
        const lon = loc.lon ?? loc.lng;
        const riderName = loc.name || riderId;
        if (!validCoords(loc.lat, lon)) return;

        const bat = Number(loc.battery ?? 100);
        if (!batteryAlertedRef.current[riderId])
          batteryAlertedRef.current[riderId] = {};
        const ba = batteryAlertedRef.current[riderId];

        if (bat <= BATTERY_CRITICAL && !ba.critical) {
          ba.critical = true;
          addAlert(
            `🚨 ${riderName} battery CRITICAL (${bat}%)! They need to stop and charge immediately.`,
            "danger",
            {
              actionType: "critical_battery",
              riderId,
              riderName,
              stationUrl: `https://www.google.com/maps/search/EV+charging+station/@${loc.lat},${lon},15z`,
            },
          );
          if (isOnline) fetchMapStations(loc.lat, lon);
        } else if (bat <= BATTERY_LOW && bat > BATTERY_CRITICAL && !ba.low) {
          ba.low = true;
          addAlert(
            `🔋 ${riderName} battery is low (${bat}%). Consider sending a charging reminder.`,
            "warning",
            {
              actionType: "charging_reminder",
              riderId,
              riderName,
              stationUrl: `https://www.google.com/maps/search/EV+charging+station/@${loc.lat},${lon},15z`,
            },
          );
        }

        if (bat > BATTERY_LOW) {
          ba.low = false;
          ba.critical = false;
        } else if (bat > BATTERY_CRITICAL) {
          ba.critical = false;
        }

        if (isOnline && bat <= BATTERY_LOW) fetchMapStations(loc.lat, lon);

        const trips = riderData.trips ? Object.values(riderData.trips) : [];
        if (trips.length > 0) {
          const latest = trips.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
          )[0];

          if (latest.consumptionWh && latest.distanceKm > 0) {
            const drainWh = Number(latest.consumptionWh);
            if (
              drainWh > DRAIN_BASELINE * DRAIN_ALERT_RATIO &&
              !drainAlertedRef.current[riderId]
            ) {
              drainAlertedRef.current[riderId] = true;
              addAlert(
                `⚡ ${riderName} is draining battery fast (${drainWh} Wh/km vs ${DRAIN_BASELINE} normal).`,
                "warning",
                { actionType: "drain_warning", riderId, riderName },
              );
            } else if (drainWh <= DRAIN_BASELINE * DRAIN_ALERT_RATIO) {
              drainAlertedRef.current[riderId] = false;
            }
          }

          if (latest.batteryRemaining != null) {
            const remainingWh = (Number(latest.batteryRemaining) / 100) * 3700;
            const drainRate = latest.consumptionWh || DRAIN_BASELINE;
            const projRange = remainingWh / drainRate;
            if (projRange < 5 && !rangeAlertedRef.current[riderId]) {
              rangeAlertedRef.current[riderId] = true;
              addAlert(
                `📍 ${riderName} has less than 5 km range remaining!`,
                "danger",
                {
                  actionType: "critical_battery",
                  riderId,
                  riderName,
                  stationUrl: `https://www.google.com/maps/search/EV+charging+station/@${loc.lat},${lon},15z`,
                },
              );
            } else if (projRange >= 5) {
              rangeAlertedRef.current[riderId] = false;
            }
          }
        }

        if (!previousInsideRef.current[riderId])
          previousInsideRef.current[riderId] = {};
        activeGeofences.forEach((zone) => {
          const zoneLng = zone.lng;
          const inside = isInsideGeofence(
            loc.lat,
            lon,
            zone.lat,
            zoneLng,
            zone.radiusKm,
          );
          const wasInside =
            previousInsideRef.current[riderId][zone.id] || false;
          if (inside && !wasInside) {
            addAlert(`✓ ${riderName} entered ${zone.name}`, "success");
            previousInsideRef.current[riderId][zone.id] = true;
          } else if (!inside && wasInside) {
            addAlert(`✗ ${riderName} left ${zone.name}`, "warning");
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
        if (r.status !== "online" || !r.location) return false;
        return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
      });
      if (onlineEntry) {
        const loc = onlineEntry[1].location;
        setFirstOnlineRider(
          (prev) => prev ?? { ...loc, lon: loc.lon ?? loc.lng },
        );
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMapStations]);

  useEffect(() => {
    if (!OWM_KEY) return;
    const ridersRef2 = ref(db, "riders");
    let latestRiders = {};
    const unsub = onValue(ridersRef2, (snap) => {
      latestRiders = snap.val() || {};
    });
    const init = setTimeout(() => pollWeather(latestRiders), 3000);
    const poll = setInterval(() => pollWeather(latestRiders), 5 * 60 * 1000);
    return () => {
      unsub();
      clearTimeout(init);
      clearInterval(poll);
    };
  }, [pollWeather]);

  const defaultCenter = [18.5204, 73.8567];
  const mapCenter =
    firstOnlineRider && validCoords(firstOnlineRider.lat, firstOnlineRider.lon)
      ? [firstOnlineRider.lat, firstOnlineRider.lon]
      : defaultCenter;

  const onlineRiders = Object.entries(riders).filter(([, r]) => {
    if (r.status !== "online" || !r.location) return false;
    return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
  });
  const offlineRiders = Object.entries(riders).filter(([, r]) => {
    if (r.status === "online" || !r.location) return false;
    return validCoords(r.location.lat, r.location.lon ?? r.location.lng);
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
        worstAxis: trip.worstAxis || "speed",
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF");
    }
  };

  const handleSOSResolve = async (riderIdOverride) => {
    const targetId = riderIdOverride ?? sosRider?.riderId;
    if (!targetId) return;
    setResolvingRiderIds((prev) => new Set([...prev, targetId]));
    try {
      await update(ref(db, `riders/${targetId}`), { sosTriggered: false });
      sosProcessedRef.current[targetId] = false;
      setPendingSosRiders((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      if (sosRider?.riderId === targetId) setSosRider(null);
    } catch (error) {
      console.error("Failed to resolve SOS:", error);
      alert("Failed to mark SOS as resolved");
    } finally {
      setResolvingRiderIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  const handleSOSModalClose = (dismissedSosRider) => {
    if (dismissedSosRider?.riderId) {
      setPendingSosRiders((prev) => ({
        ...prev,
        [dismissedSosRider.riderId]: dismissedSosRider,
      }));
    }
    setSosRider(null);
  };

  const handleRecenterMap = () => {
    if (!mapRef.current) return;
    if (
      firstOnlineRider &&
      validCoords(firstOnlineRider.lat, firstOnlineRider.lon)
    ) {
      mapRef.current.setView([firstOnlineRider.lat, firstOnlineRider.lon], 13);
    } else {
      mapRef.current.setView(defaultCenter, 13);
    }
  };

  const handleFitAll = () => {
    if (!mapRef.current) return;
    const allWithCoords = Object.entries(riders)
      .filter(
        ([, r]) =>
          r.location &&
          validCoords(r.location.lat, r.location.lon ?? r.location.lng),
      )
      .map(([, r]) => [
        Number(r.location.lat),
        Number(r.location.lon ?? r.location.lng),
      ]);
    if (!allWithCoords.length) {
      mapRef.current.setView(defaultCenter, 13);
      return;
    }
    if (allWithCoords.length === 1) {
      mapRef.current.setView(allWithCoords[0], 14);
    } else {
      mapRef.current.fitBounds(allWithCoords, { padding: [50, 50] });
    }
  };

  const pendingSosEntries = Object.entries(pendingSosRiders);

  return (
    <div className="watcher-dashboard">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>
          Watcher Dashboard
        </h1>
        <button
          onClick={() => setShowGeofenceEditor((v) => !v)}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "600",
            background: showGeofenceEditor ? "#3b82f6" : "#2a2d3a",
            border: `1px solid ${showGeofenceEditor ? "#3b82f6" : "#3a3d4a"}`,
            color: showGeofenceEditor ? "#fff" : "#aaa",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          📍 {showGeofenceEditor ? "Hide Geofences" : "Manage Geofences"}
          {familyId && firebaseGeofences.length > 0 && (
            <span
              style={{
                marginLeft: "6px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "10px",
                padding: "1px 6px",
                fontSize: "11px",
              }}
            >
              {firebaseGeofences.length}
            </span>
          )}
        </button>
      </div>

      <RainPrompt prompts={rainPrompts} onDismiss={dismissRainPrompt} />

      {!OWM_KEY && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: "12px",
            background: "#2a2200",
            border: "1px solid #ffc107",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#ffe082",
          }}
        >
          ⚠️ <strong>Weather overlay disabled.</strong> Add{" "}
          <code>VITE_OPENWEATHER_API_KEY</code> to your <code>.env</code> to
          enable rain alerts.
        </div>
      )}

      {showGeofenceEditor && (
        <div style={{ marginBottom: "24px" }}>
          <GeofenceEditor familyId={familyId} />
          {!familyId && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "12px",
                color: "#666",
                textAlign: "center",
              }}
            >
              Showing {staticGeofences.length} default zones. Sign in with
              Google and join a family to create custom zones.
            </p>
          )}
          {familyId && firebaseGeofences.length === 0 && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "12px",
                color: "#666",
                textAlign: "center",
              }}
            >
              No custom zones yet — using {staticGeofences.length} default zone
              {staticGeofences.length !== 1 ? "s" : ""} for alerts.
            </p>
          )}
        </div>
      )}

      {/* Rider status pills */}
      <div className="watcher-pills-container">
        {Object.entries(riders).map(([riderId, riderData]) => {
          const isOnline = riderData.status === "online";
          const color = riderColorMap.current[riderId] || "#999";
          const name = riderData.location?.name || riderId;
          const hasSOS = riderData.sosTriggered && !riderData.sosResolved;
          const bat = Number(riderData.location?.battery ?? 100);
          const weather = riderWeather[riderId];
          const rain = weather && isRaining(weather.id);
          const batIcon = bat <= 10 ? "🚨" : bat <= 25 ? "⚠️" : "";
          const liveScore = riderData.currentEcoScore;
          return (
            <span
              key={riderId}
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "13px",
                background: hasSOS ? "#dc3545" : isOnline ? color : "#2a2a2a",
                color: isOnline || hasSOS ? "white" : "#999",
                border: `1px solid ${hasSOS ? "#dc3545" : isOnline ? color : "#444"}`,
                fontWeight: hasSOS ? "bold" : "normal",
                animation: hasSOS ? "pulse 1s infinite" : "none",
              }}
            >
              {hasSOS ? "🚨" : isOnline ? "🟢" : "⚫"} {name}
              {batIcon && isOnline && (
                <span style={{ marginLeft: "4px" }}>
                  {batIcon}
                  {bat}%
                </span>
              )}
              {liveScore != null && isOnline && (
                <span
                  style={{
                    marginLeft: "6px",
                    color: ecoScoreColor(liveScore),
                    fontWeight: "700",
                  }}
                >
                  🌿{liveScore}
                </span>
              )}
              {weather && isOnline && (
                <span style={{ marginLeft: "6px", opacity: 0.9 }}>
                  {rain ? "🌧️" : "☀️"} {weather.temp}°C
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Map + Alerts grid */}
      <div className="watcher-map-alerts-grid">
        <div className="map-wrapper">
          <div
            style={{
              position: "absolute",
              bottom: "15px",
              right: "15px",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <button
              onClick={handleFitAll}
              className="recenter-btn"
              title="Zoom to show all riders"
            >
              🗺️ Fit All
            </button>
            <button
              onClick={handleRecenterMap}
              className="recenter-btn"
              title="Recenter on first online rider"
            >
              📍 Recenter
            </button>
          </div>

          <button
            onClick={() => setShowRoutes((v) => !v)}
            style={{
              position: "absolute",
              top: "50px",
              right: "10px",
              zIndex: 1000,
              padding: "5px 10px",
              fontSize: "12px",
              fontWeight: "600",
              background: showRoutes
                ? "rgba(76,175,80,0.85)"
                : "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "5px",
              color: "white",
              cursor: "pointer",
            }}
          >
            {showRoutes ? "🛣️ Routes ON" : "🛣️ Routes OFF"}
          </button>

          {chargingStations.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                zIndex: 1000,
                background: "rgba(0,0,0,0.7)",
                color: "white",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "12px",
              }}
            >
              ⚡ {chargingStations.length} chargers nearby
            </div>
          )}

          <MapContainer center={mapCenter} zoom={13} className="map-container">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              maxZoom={19}
              crossOrigin={true}
            />
            <MapController onMapReady={handleMapReady} />

            {showRoutes &&
              onlineRiders.map(([riderId, riderData]) => {
                const route = riderData.currentRoute;
                if (!validRoute(route)) return null;
                const color = riderColorMap.current[riderId] || "#e53935";
                return (
                  <Polyline
                    key={`route-live-${riderId}`}
                    positions={route}
                    pathOptions={{
                      color,
                      weight: 4,
                      opacity: 0.85,
                      lineJoin: "round",
                      lineCap: "round",
                    }}
                  />
                );
              })}

            {showRoutes &&
              Object.entries(riders).map(([riderId, riderData]) => {
                if (riderData.status === "online") return null;
                const trips = riderData.trips
                  ? Object.values(riderData.trips)
                  : [];
                if (!trips.length) return null;
                const lastTrip = trips.sort(
                  (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
                )[0];
                if (!validRoute(lastTrip.route)) return null;
                const color = riderColorMap.current[riderId] || "#999";
                return (
                  <Polyline
                    key={`route-last-${riderId}`}
                    positions={lastTrip.route}
                    pathOptions={{
                      color,
                      weight: 3,
                      opacity: 0.4,
                      dashArray: "6 8",
                      lineJoin: "round",
                    }}
                  />
                );
              })}

            {onlineRiders.map(([riderId, riderData]) => {
              const hasSOS = riderData.sosTriggered && !riderData.sosResolved;
              const bat = Number(riderData.location.battery ?? 100);
              const color = hasSOS
                ? "#dc3545"
                : bat <= BATTERY_CRITICAL
                  ? "#ff5722"
                  : bat <= BATTERY_LOW
                    ? "#ff9800"
                    : riderColorMap.current[riderId] || "#e53935";
              const name = riderData.location.name || riderId;
              const lon = riderData.location.lon ?? riderData.location.lng;
              const weather = riderWeather[riderId];
              const rain = weather && isRaining(weather.id);
              const liveScore = riderData.currentEcoScore;
              return (
                <Marker
                  key={riderId}
                  position={[riderData.location.lat, lon]}
                  icon={createDivIcon(color, name.charAt(0).toUpperCase())}
                >
                  <Popup>
                    <strong>{name}</strong>
                    <br />
                    🔋 {bat}%
                    {bat <= BATTERY_CRITICAL
                      ? " 🚨 CRITICAL"
                      : bat <= BATTERY_LOW
                        ? " ⚠️ Low"
                        : ""}
                    <br />
                    {liveScore != null ? (
                      <span
                        style={{
                          color: ecoScoreColor(liveScore),
                          fontWeight: "bold",
                        }}
                      >
                        🌿 Live Eco: {liveScore}/100
                        <br />
                      </span>
                    ) : (
                      <span style={{ color: "#888" }}>
                        🌿 Eco: no active trip
                        <br />
                      </span>
                    )}
                    🟢 Online
                    {weather && (
                      <>
                        <br />
                        {rain ? "🌧️" : "☀️"} {weather.description},{" "}
                        {weather.temp}°C
                      </>
                    )}
                    {hasSOS && (
                      <>
                        <br />
                        <span style={{ color: "red", fontWeight: "bold" }}>
                          🚨 SOS ACTIVE
                        </span>
                      </>
                    )}
                    {validRoute(riderData.currentRoute) && (
                      <>
                        <br />
                        🛣️ {riderData.currentRoute.length} route points
                      </>
                    )}
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
                  icon={createDivIcon("#9e9e9e", name.charAt(0).toUpperCase())}
                  opacity={0.5}
                >
                  <Popup>
                    <strong>{name}</strong>
                    <br />
                    🔋 {riderData.location.battery}%<br />⚫ Offline
                  </Popup>
                </Marker>
              );
            })}

            {activeGeofences.map((zone, i) => {
              const zoneLng = zone.lng;
              if (!validCoords(zone.lat, zoneLng)) return null;
              const color = getZoneColor(i);
              return (
                <Circle
                  key={zone.id}
                  center={[zone.lat, zoneLng]}
                  radius={zone.radiusKm * 1000}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>{zone.name}</strong>
                    <br />
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      {familyId && firebaseGeofences.length > 0
                        ? "Custom zone"
                        : "Default zone"}{" "}
                      · {zone.radiusKm} km
                    </span>
                  </Popup>
                </Circle>
              );
            })}

            {chargingStations.map((s) => (
              <Marker
                key={s.id}
                position={[s.lat, s.lon]}
                icon={createChargingIcon()}
              >
                <Popup>
                  <strong>⚡ {s.name}</strong>
                  <br />
                  📍 {s.distanceKm} km away
                  {s.operator && (
                    <>
                      <br />
                      🏢 {s.operator}
                    </>
                  )}
                  {s.sockets && (
                    <>
                      <br />
                      🔌 {s.sockets} sockets
                    </>
                  )}
                  <br />
                  <a
                    href={`https://www.google.com/maps?q=${s.lat},${s.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2196F3" }}
                  >
                    Open in Google Maps →
                  </a>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {showRoutes && (
            <RouteLegend riders={riders} riderColorMap={riderColorMap} />
          )}
        </div>

        {/* Alerts panel */}
        <div>
          <h3 style={{ margin: "0 0 12px", color: "#fff" }}>Recent Alerts</h3>

          {pendingSosEntries.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "11px",
                  color: "#ff5252",
                  textTransform: "uppercase",
                  fontWeight: "700",
                  letterSpacing: "0.5px",
                }}
              >
                ⚠️ Unresolved SOS ({pendingSosEntries.length})
              </p>
              {pendingSosEntries.map(([riderId, sosData]) => (
                <PendingSOSBanner
                  key={riderId}
                  sosRider={sosData}
                  onResolve={handleSOSResolve}
                  resolving={resolvingRiderIds.has(riderId)}
                />
              ))}
            </div>
          )}

          <div className="watcher-reminder-strip">
            {Object.entries(reminderStatus).map(([key, status]) => (
              <div
                key={key}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  background:
                    status === "sent"
                      ? "#1a3d1a"
                      : status === "error"
                        ? "#3d1a1a"
                        : "#3d3200",
                  border: `1px solid ${status === "sent" ? "#28a745" : status === "error" ? "#dc3545" : "#ffc107"}`,
                  color:
                    status === "sent"
                      ? "#c8e6c9"
                      : status === "error"
                        ? "#ffcdd2"
                        : "#ffe082",
                }}
              >
                {status === "sending" && "⏳ Sending reminder..."}
                {status === "sent" && "✓ Reminder sent to rider"}
                {status === "error" && "✕ Failed to send — check connection"}
              </div>
            ))}
          </div>

          <div className="watcher-alerts-scroll">
            {!alerts.length && (
              <p style={{ color: "#666", fontSize: "14px" }}>No alerts yet.</p>
            )}
            {alerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onSendReminder={handleSendReminder}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Trip History — tabbed ─────────────────────────────────────────── */}
      <div>
        {/* Header: title + tabs + filter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, color: "#fff", whiteSpace: "nowrap" }}>
            📊 Trip History
          </h3>

          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveTab("history")}
              style={TAB_STYLE(activeTab === "history")}
            >
              🗂 History
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              style={TAB_STYLE(activeTab === "stats")}
            >
              📊 Stats
            </button>
            <button
              onClick={() => setActiveTab("trends")}
              style={TAB_STYLE(activeTab === "trends")}
            >
              📈 Trends
            </button>
          </div>

          {/* Filter hidden on Trends tab — no filterDays concept there */}
          {activeTab !== "trends" && (
            <select
              id="filter-days"
              name="filter-days"
              value={filterDays}
              onChange={(e) => setFilterDays(Number(e.target.value))}
              style={{
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #444",
                fontSize: "14px",
                background: "#2a2a2a",
                color: "#e0e0e0",
                marginLeft: "auto",
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={365}>All time</option>
            </select>
          )}
        </div>

        {/* Tab panels */}
        {activeTab === "history" && (
          <TripHistoryTable
            trips={allTrips}
            filterDays={filterDays}
            onTripClick={setSelectedTrip}
            onExportPDF={handleExportPDF}
          />
        )}

        {activeTab === "stats" && (
          <TripStatsSummary trips={allTrips} filterDays={filterDays} />
        )}

        {activeTab === "trends" && (
          <TripScoreCharts allTrips={allTrips} riderColorMap={riderColorMap} />
        )}
      </div>

      {/* Trip detail modal */}
      {selectedTrip &&
        (() => {
          const tripForCard = {
            distance: selectedTrip.distanceKm || 0,
            duration: selectedTrip.durationSeconds || 0,
            ecoScore: selectedTrip.score || 0,
            batteryUsed: selectedTrip.batteryUsedPercent || 15,
            batteryRemaining: selectedTrip.batteryRemaining || 85,
            timestamp: selectedTrip.timestamp,
            avgSpeed: selectedTrip.avgSpeedKmh || 0,
            riderName: selectedTrip.riderName || "Rider",
          };
          return (
            <div
              className="modal-overlay"
              onClick={() => setSelectedTrip(null)}
            >
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h2 style={{ margin: 0, color: "#fff" }}>
                    {selectedTrip.riderName || selectedTrip.riderId}
                  </h2>
                  <button
                    onClick={() => setSelectedTrip(null)}
                    style={{
                      background: "#2a2a2a",
                      border: "1px solid #444",
                      color: "#ccc",
                      fontSize: "20px",
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    ✕
                  </button>
                </div>
                <TripSummaryCard
                  trip={tripForCard}
                  riderId={selectedTrip.riderId}
                />
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
          onResolve={() => handleSOSResolve()}
          onClose={handleSOSModalClose}
        />
      )}
    </div>
  );
}
