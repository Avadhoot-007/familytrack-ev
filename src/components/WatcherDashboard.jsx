// ---------------------------------------------------------------------------
// WatcherDashboard.jsx
// Main monitoring interface for family watchers.
// Displays: live rider map, geofences, alerts, trip history, eco trends,
// charging stations, SOS handling, weather alerts, and route replay animation.
//
// KEY FIX: handleExportPDF now explicitly maps `batteryRemaining` from the
// Firebase trip object. Previously it passed a `battery` field (wrong name),
// causing downloadTripPDF to always fall back to (100 - batteryUsed), which
// assumed every trip started at 100% battery — now corrected.
// ---------------------------------------------------------------------------

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
import { normalizeRiderId } from "../services/locationService";

// ── Rider & geofence color palettes ──────────────────────────────────────────
// Each rider gets a unique color from RIDER_COLORS by their index order.
// Geofence zones cycle through GEOFENCE_COLORS independently.
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

// Helper: get rider color by insertion order index
const getRiderColor = (index) => RIDER_COLORS[index % RIDER_COLORS.length];
// Helper: get geofence zone color by zone index
const getZoneColor = (index) => GEOFENCE_COLORS[index % GEOFENCE_COLORS.length];

// ── Coordinate validation guards ──────────────────────────────────────────────
// validCoords: ensures lat/lon are non-null, non-NaN numbers before any map ops.
// Used everywhere a Leaflet marker or circle is rendered to prevent crashes.
const validCoords = (lat, lon) =>
  lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon));

// validRoute: ensures a route array has ≥2 valid [lat,lon] pairs for Polyline.
// Leaflet throws if given a single-point or malformed route.
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

// ── Leaflet custom icons ──────────────────────────────────────────────────────

// createDivIcon: teardrop-shaped marker colored per rider.
// The label (first letter of name) is rotated back to upright after the
// teardrop 45° CSS rotation so text always reads correctly.
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

// createChargingIcon: green circle with lightning bolt for charging stations.
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

// createReplayIcon: animated pulsing scooter emoji for the replay head marker.
// Uses a CSS keyframe animation injected inline so it works without a stylesheet.
const createReplayIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:34px;height:34px;border-radius:50%;
      background:${color};
      border:3px solid white;
      display:flex;align-items:center;justify-content:center;
      font-size:17px;line-height:1;
      box-shadow:0 2px 10px ${color}99, 0 0 0 4px ${color}33;
      animation:replayRing 1.2s ease infinite;">
      🛵
    </div>
    <style>
      @keyframes replayRing {
        0%,100% { box-shadow:0 2px 10px ${color}99, 0 0 0 4px ${color}33; }
        50%      { box-shadow:0 2px 16px ${color}cc, 0 0 0 8px ${color}11; }
      }
    </style>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

// ── Battery / drain alert thresholds ─────────────────────────────────────────
// Mirror the RiderDashboard constants so alert logic is consistent app-wide.
const BATTERY_CRITICAL = 10; // % — critical alert threshold
const BATTERY_LOW = 25; // % — low battery warning threshold
const DRAIN_BASELINE = 37; // Wh/km expected for Ather Rizta Z normal mode
const DRAIN_ALERT_RATIO = 1.2; // alert fires when drain > baseline × 1.2

// ── OpenWeatherMap key ────────────────────────────────────────────────────────
// Weather features are silently disabled if the key is missing from .env.
const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

// WMO rain condition code set — covers thunderstorm, drizzle, and rain categories.
// Sourced from OWM's weather.id field documentation.
const RAIN_CODES = new Set([
  200, 201, 202, 210, 211, 212, 221, 230, 231, 232, 300, 301, 302, 310, 311,
  312, 313, 314, 321, 500, 501, 502, 503, 504, 511, 520, 521, 522, 531,
]);
const isRaining = (id) => RAIN_CODES.has(id);

// ── fetchWeather ──────────────────────────────────────────────────────────────
// Fetches current weather from OWM for a given GPS coordinate.
// Returns { id, description, temp } or null on any failure.
// Called on mount and every 5 minutes per online rider via pollWeather().
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

// ── ecoScoreColor ─────────────────────────────────────────────────────────────
// Maps eco score to a traffic-light hex color for inline styling.
const ecoScoreColor = (score) => {
  if (score >= 80) return "#4CAF50";
  if (score >= 60) return "#ffc107";
  if (score >= 40) return "#ff9800";
  return "#dc3545";
};

// ── TAB_STYLE ─────────────────────────────────────────────────────────────────
// Returns an inline style object for the History/Stats/Trends tab buttons.
// active flag controls the highlighted vs ghost appearance.
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

// ── Replay speed table ────────────────────────────────────────────────────────
// Maps speed levels 1–10 to milliseconds per route point.
// Lower ms = faster playback. Speed 5 (300ms) is the default "Normal" feel.
const SPEED_MS = [800, 600, 450, 350, 300, 220, 160, 120, 90, 60];
const speedToMs = (speed) => SPEED_MS[Math.max(0, Math.min(9, speed - 1))];

// ─────────────────────────────────────────────────────────────────────────────
// ReplayPanner
// Hook-only component that lives inside MapContainer.
// Watches the replay head position and calls map.panTo() on each change.
// Uses animate:true for smooth following without jarring position jumps.
// Skips the pan if the position hasn't actually changed to avoid redundant calls.
// ─────────────────────────────────────────────────────────────────────────────
function ReplayPanner({ headPos }) {
  const map = useMap();
  const lastPosRef = useRef(null);

  useEffect(() => {
    if (!headPos) return;
    const [lat, lon] = headPos;
    if (!validCoords(lat, lon)) return;

    // Skip if position unchanged — prevents redundant map.panTo calls
    const prev = lastPosRef.current;
    if (prev && prev[0] === lat && prev[1] === lon) return;
    lastPosRef.current = headPos;

    map.panTo([lat, lon], { animate: true, duration: 0.5, easeLinearity: 0.5 });
  }, [headPos, map]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TripScoreChart
// SVG line chart showing eco score trend for a single rider's last 10 trips.
// Renders: area fill, score polyline, dot markers, date labels, trend arrow.
// Falls back to a placeholder card when fewer than 2 trips are available.
// ─────────────────────────────────────────────────────────────────────────────
function TripScoreChart({ trips, riderName, color }) {
  // Filter trips to this rider and take the most recent 10, oldest-first
  const last10 = trips
    .filter((t) => (t.riderName || t.riderId) === riderName)
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

  // ── SVG coordinate system ─────────────────────────────────────────────────
  const W = 280,
    H = 70;
  const PAD = { top: 8, right: 10, bottom: 18, left: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const scores = last10.map((t) => Number(t.score || t.ecoScore || 0));

  // Dynamic Y-axis range — pads 10 points above/below data range for readability
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const scoreRange = maxScore - minScore || 1;

  // Map data index/score → SVG pixel coordinates
  const toX = (i) => PAD.left + (i / (last10.length - 1)) * chartW;
  const toY = (s) => PAD.top + chartH - ((s - minScore) / scoreRange) * chartH;

  const polyPoints = last10
    .map((t, i) => `${toX(i)},${toY(Number(t.score || t.ecoScore || 0))}`)
    .join(" ");

  // Closed SVG path for the gradient area fill beneath the score line
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
  // Positive trend = latest score higher than first score in the window
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
      {/* Chart header: rider name dot, avg score badge, trend arrow */}
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
        {/* Dashed horizontal reference lines at 0, 50, 100 — only if in visible range */}
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
        {/* Semi-transparent area fill below the line */}
        <path d={areaPath} fill={color} fillOpacity="0.08" />
        {/* Main score polyline */}
        <polyline
          points={polyPoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Dot markers — last point is larger and shows its value */}
        {last10.map((t, i) => {
          const s = Number(t.score || t.ecoScore || 0);
          const cx = toX(i),
            cy = toY(s);
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
        {/* X-axis date labels at first and last data point */}
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

// ─────────────────────────────────────────────────────────────────────────────
// TripScoreCharts
// Renders one TripScoreChart per unique rider name found in allTrips.
// Resolves each rider's assigned color from the shared riderColorMap ref.
// ─────────────────────────────────────────────────────────────────────────────
function TripScoreCharts({ allTrips, riderColorMap }) {
  // Deduplicate rider names from the trip list
  const riderNames = [
    ...new Set(allTrips.map((t) => t.riderName || t.riderId).filter(Boolean)),
  ];

  if (riderNames.length === 0)
    return <p style={{ color: "#666", fontSize: "14px" }}>No trip data yet.</p>;

  // Look up riderId for a display name so we can fetch its color
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

// ─────────────────────────────────────────────────────────────────────────────
// RainPrompt
// Dismissible banner strip shown when rain is detected near any online rider.
// Each prompt has a unique `id` so individual banners can be closed independently
// without clearing other riders' rain alerts.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MapController
// Hook-only component that fires onMapReady with the Leaflet map instance
// once the MapContainer mounts. Also schedules a fallback invalidateSize() call
// after 300ms to fix partial tile rendering that can occur on first render.
// ─────────────────────────────────────────────────────────────────────────────
function MapController({ onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (onMapReady) onMapReady(map);
    const fallback = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(fallback);
  }, [map, onMapReady]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOSAlertModal
// Full-screen emergency modal shown when a rider triggers the SOS button.
// Normalises sosLocation field names (Firebase may store lat/lon or lat/lng).
// Provides: Google Maps directions link, resolve button, and dismiss-to-banner.
// Dismiss does NOT resolve — it moves the SOS to the pending banner strip
// so the watcher keeps monitoring without the full modal blocking the screen.
// ─────────────────────────────────────────────────────────────────────────────
function SOSAlertModal({ sosRider, onResolve, onClose }) {
  if (!sosRider) return null;

  // Normalise location field names — Firebase may store lat/lon or lat/lng
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

// ─────────────────────────────────────────────────────────────────────────────
// PendingSOSBanner
// Compact persistent banner for SOS events that were dismissed from the modal
// but not yet resolved. Stays visible in the alerts panel until the watcher
// explicitly clicks "Mark as Resolved".
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// TripStatsSummary
// Aggregated stats box (trips, distance, avg/best/worst scores, speed) for the
// selected time window. Filters allTrips by filterDays before computing —
// keeps it consistent with the trip table time-window filter.
// ─────────────────────────────────────────────────────────────────────────────
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

  // Reusable stat tile sub-component — keeps the grid DRY
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

// ─────────────────────────────────────────────────────────────────────────────
// TripHistoryTable
// Filterable, sortable trip list with View, PDF export, and Replay (▶) buttons.
// Replay button only renders for trips that have a valid stored route array (≥2 pts).
// Rows are sorted newest-first and filtered by the current filterDays window.
// ─────────────────────────────────────────────────────────────────────────────
function TripHistoryTable({
  trips,
  filterDays,
  onTripClick,
  onExportPDF,
  onReplay,
}) {
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

  // Traffic-light color for the eco score column
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
                {/* View: opens full TripSummaryCard modal */}
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
                {/* PDF: downloads trip summary as PDF */}
                <button
                  onClick={() => onExportPDF(trip)}
                  style={{
                    padding: "4px 8px",
                    background: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "4px",
                    fontSize: "12px",
                  }}
                >
                  PDF
                </button>
                {/* Replay: only shown when the trip has a valid stored GPS route */}
                {validRoute(trip.route) && (
                  <button
                    onClick={() => onReplay(trip)}
                    title="Animate this trip route on the map"
                    style={{
                      padding: "4px 8px",
                      background: "#8e24aa",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    ▶ Replay
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AlertItem
// Single alert row with optional contextual action buttons.
// actionType controls which button renders:
//   charging_reminder → send low battery tip to rider
//   critical_battery  → send critical alert + maps link
//   drain_warning     → send eco throttle tip
//   rain_tip          → send rain safety tip
// ─────────────────────────────────────────────────────────────────────────────
function AlertItem({ alert, onSendReminder, onDismiss, sentTipsRef }) {
  const [localSent, setLocalSent] = useState(
    new Set(
      Object.keys(sentTipsRef.current)
        .filter((k) => k.startsWith(`${alert.riderId}_`))
        .map((k) => k.replace(`${alert.riderId}_`, "")),
    ),
  );

  const handleSend = (riderId, riderName, tipType) => {
    const key = `${riderId}_${tipType}`;
    if (sentTipsRef.current[key]) return;
    sentTipsRef.current[key] = true;
    setLocalSent((prev) => new Set([...prev, tipType]));
    onSendReminder(riderId, riderName, tipType);
  };

  const isSent = (tipType) => {
    const key = `${alert.riderId}_${tipType}`;
    return sentTipsRef.current[key] || localSent.has(tipType);
  };

  // Helper: returns consistent button style — green "sent" state vs active color
  const btnStyle = (tipType, color) => ({
    padding: "4px 10px",
    background: isSent(tipType) ? "#2a5a2a" : color,
    border: "none",
    borderRadius: "4px",
    cursor: isSent(tipType) ? "not-allowed" : "pointer",
    fontSize: "12px",
    fontWeight: "600",
    color: isSent(tipType)
      ? "#81c784"
      : tipType === "low_battery"
        ? "#1a1a1a"
        : "white",
    opacity: isSent(tipType) ? 0.75 : 1,
    transition: "all 0.2s",
  });

  // Background/border/text color derived from alert severity type
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: alert.actionType ? "8px" : 0,
        }}
      >
        <span>{alert.message}</span>
        <button
          onClick={() => onDismiss(alert.id)}
          style={{
            background: "none",
            border: "none",
            color: "#666",
            cursor: "pointer",
            fontSize: "14px",
            lineHeight: 1,
            marginLeft: "8px",
            flexShrink: 0,
          }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Low battery — charging reminder + nearest station link */}
      {alert.actionType === "charging_reminder" && alert.riderId && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() =>
              handleSend(alert.riderId, alert.riderName, "low_battery")
            }
            disabled={isSent("low_battery")}
            style={btnStyle("low_battery", "#ffc107")}
          >
            {isSent("low_battery") ? "✓ Sent" : "💬 Send Charging Reminder"}
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

      {/* Critical battery — urgent alert + maps link */}
      {alert.actionType === "critical_battery" && alert.riderId && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() =>
              handleSend(alert.riderId, alert.riderName, "critical_battery")
            }
            disabled={isSent("critical_battery")}
            style={btnStyle("critical_battery", "#dc3545")}
          >
            {isSent("critical_battery") ? "✓ Sent" : "🚨 Send Critical Alert"}
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

      {/* Drain rate — eco throttle coaching tip */}
      {alert.actionType === "drain_warning" && alert.riderId && (
        <button
          onClick={() =>
            handleSend(alert.riderId, alert.riderName, "drain_warning")
          }
          disabled={isSent("drain_warning")}
          style={btnStyle("drain_warning", "#fd7e14")}
        >
          {isSent("drain_warning") ? "✓ Sent" : "💬 Send Eco Tip"}
        </button>
      )}

      {/* Rain — safety tip */}
      {alert.actionType === "rain_tip" && alert.riderId && (
        <button
          onClick={() => handleSend(alert.riderId, alert.riderName, "rain_tip")}
          disabled={isSent("rain_tip")}
          style={btnStyle("rain_tip", "#1565c0")}
        >
          {isSent("rain_tip") ? "✓ Sent" : "🌧️ Send Rain Warning"}
        </button>
      )}
    </div>
  );
}

// ── Coaching tip payloads sent to rider inbox via Firebase ────────────────────
// Each entry maps a tipType string to a full coaching tip object.
// Pushed to riders/{riderId}/coachingTips by handleSendReminder.
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

// ─────────────────────────────────────────────────────────────────────────────
// RouteLegend
// Small overlay inside the map showing which online riders have active GPS routes.
// Displays rider name + color swatch + recorded point count.
// Only renders when at least one online rider has a valid route.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// ReplayOverlay
// Compact floating control panel shown during route replay animation.
// Positioned bottom-left of the map wrapper.
// Shows: rider name, growing progress bar, point counter, speed slider (1–10).
// Speed slider drives SPEED_MS lookup — higher value = faster animation.
// ─────────────────────────────────────────────────────────────────────────────
function ReplayOverlay({ replay, onStop, onSpeedChange }) {
  if (!replay.active) return null;

  // Progress % = current point index / total points
  const pct = Math.round(
    (replay.currentIndex / Math.max(replay.totalPoints - 1, 1)) * 100,
  );
  const msPerPt = speedToMs(replay.speed);
  const speedLabel =
    replay.speed <= 2
      ? "Slow"
      : replay.speed <= 5
        ? "Normal"
        : replay.speed <= 8
          ? "Fast"
          : "Max";

  return (
    <div
      style={{
        position: "absolute",
        bottom: "70px",
        left: "10px",
        zIndex: 1000,
        background: "rgba(10,10,15,0.90)",
        border: `1px solid ${replay.color}`,
        borderRadius: "10px",
        padding: "10px 12px",
        minWidth: "170px",
        maxWidth: "190px",
        color: "#fff",
        fontSize: "11px",
        boxShadow: `0 4px 16px ${replay.color}33`,
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Header: icon + label + stop button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "7px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "14px" }}>🛵</span>
          <span
            style={{ fontWeight: "700", color: replay.color, fontSize: "11px" }}
          >
            Route Replay
          </span>
        </div>
        <button
          onClick={onStop}
          style={{
            background: "rgba(255,80,80,0.15)",
            border: "1px solid rgba(255,80,80,0.4)",
            color: "#ff6060",
            borderRadius: "5px",
            padding: "2px 7px",
            cursor: "pointer",
            fontSize: "10px",
            fontWeight: "600",
          }}
        >
          ■ Stop
        </button>
      </div>

      {/* Rider name — truncated with ellipsis if too long */}
      <p
        style={{
          margin: "0 0 6px",
          color: "#bbb",
          fontSize: "10px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {replay.riderName}
      </p>

      {/* Progress bar — width transitions in sync with interval timing */}
      <div
        style={{
          background: "#222",
          borderRadius: "3px",
          height: "4px",
          marginBottom: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${replay.color}99, ${replay.color})`,
            borderRadius: "3px",
            transition: `width ${msPerPt}ms linear`,
          }}
        />
      </div>

      {/* Point counter + percentage */}
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "10px",
          color: "#666",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          Pt {replay.currentIndex + 1} / {replay.totalPoints}
        </span>
        <span style={{ color: replay.color, fontWeight: "600" }}>{pct}%</span>
      </p>

      {/* Speed slider */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "9px", color: "#555", whiteSpace: "nowrap" }}>
          Slow
        </span>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={replay.speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: replay.color, cursor: "pointer" }}
        />
        <span style={{ fontSize: "9px", color: "#555", whiteSpace: "nowrap" }}>
          Fast
        </span>
      </div>
      <p
        style={{
          margin: "3px 0 0",
          fontSize: "9px",
          color: "#555",
          textAlign: "center",
        }}
      >
        {speedLabel} · {msPerPt}ms / pt
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WatcherDashboard — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function WatcherDashboard({ sentTipsRef: externalSentTipsRef }) {
  // Pull familyId from Zustand store to scope Firebase geofence reads
  const familyId = useStore((s) => s.familyId);

  // ── Core state ─────────────────────────────────────────────────────────────
  const [riders, setRiders] = useState({}); // live Firebase rider data
  const [alerts, setAlerts] = useState([]); // alert log, max 50 entries
  const [allTrips, setAllTrips] = useState([]); // flattened trips across all riders
  const [filterDays, setFilterDays] = useState(7); // trip table time window (days)
  const [activeTab, setActiveTab] = useState("history");
  const [firstOnlineRider, setFirstOnlineRider] = useState(null); // map initial center anchor
  const [selectedTrip, setSelectedTrip] = useState(null); // trip detail modal data
  const [sosRider, setSosRider] = useState(null); // active SOS modal data
  const [reminderStatus, setReminderStatus] = useState({}); // per-rider tip send status
  const [pendingSosRiders, setPendingSosRiders] = useState({}); // dismissed-but-unresolved SOS
  const [resolvingRiderIds, setResolvingRiderIds] = useState(new Set()); // SOS resolve in-flight set
  const [riderWeather, setRiderWeather] = useState({}); // OWM weather per riderId
  const [rainPrompts, setRainPrompts] = useState([]); // dismissible rain banners
  const [chargingStations, setChargingStations] = useState([]); // Overpass API results
  const [showRoutes, setShowRoutes] = useState(true); // route polyline visibility toggle
  const [firebaseGeofences, setFirebaseGeofences] = useState([]); // family-specific zones from Firebase
  const [showGeofenceEditor, setShowGeofenceEditor] = useState(false);

  // ── Route replay state ─────────────────────────────────────────────────────
  // visibleRoute grows one point per interval tick — creates the line-drawing effect.
  const [replay, setReplay] = useState({
    active: false, // whether replay is currently running
    route: [], // full route array from the trip
    currentIndex: 0, // index of the head point currently shown
    totalPoints: 0, // total route points (used for progress %)
    color: "#8e24aa", // rider color for the replay polyline and icon
    riderName: "", // displayed in the ReplayOverlay panel
    speed: 5, // 1–10 speed level; maps to SPEED_MS interval
    visibleRoute: [], // growing slice shown on the map (creates draw effect)
  });

  // Ref for the replay setInterval ID — kept outside state to avoid re-renders
  const replayIntervalRef = useRef(null);

  // ── Persistent refs ────────────────────────────────────────────────────────
  // Using refs (not state) for dedup flags prevents effect re-triggers and
  // avoids stale-closure issues in the Firebase onValue callback.
  const rainPromptedRef = useRef({}); // riderId → bool, prevents duplicate rain banners
  const chargingFetchedRef = useRef(false); // prevents duplicate Overpass fetches per session
  const batteryAlertedRef = useRef({}); // riderId → { low, critical } dedup flags
  const drainAlertedRef = useRef({}); // riderId → bool, dedup drain rate alerts
  const rangeAlertedRef = useRef({}); // riderId → bool, dedup range-critical alerts
  const mapRef = useRef(null); // Leaflet map instance (set by MapController)
  const riderIndexMap = useRef({}); // riderId → insertion order index (for stable color)
  const riderColorMap = useRef({}); // riderId → hex color string
  const previousInsideRef = useRef({}); // riderId → { zoneId: bool } — last known geofence state
  const sosProcessedRef = useRef({}); // riderId → bool — prevents duplicate SOS modals
  const sosTimestampRef = useRef({}); // riderId → timestamp of last SOS — used to reset sosProcessed after 30 mins
  const internalRef = useRef({});
  const sentTipsRef = externalSentTipsRef ?? internalRef; // riderId_tipType → bool — global sent guard

  // Active geofences: use family-specific Firebase zones if available,
  // otherwise fall back to the hardcoded static defaults in data/geofences.js
  const activeGeofences =
    familyId && firebaseGeofences.length > 0
      ? firebaseGeofences
      : staticGeofences;

  const activeGeofencesRef = useRef(activeGeofences);

  useEffect(() => {
    activeGeofencesRef.current = activeGeofences;
  }, [activeGeofences]);

  // Stable callback passed to MapController — avoids recreating on every render
  const handleMapReady = useCallback((m) => {
    mapRef.current = m;
  }, []);

  // ── Firebase: family geofences listener ───────────────────────────────────
  // Reads families/{familyId}/geofences and normalises the Firebase object
  // into the same shape as staticGeofences: { id, name, lat, lng, radiusKm }
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

  // ── fetchMapStations ──────────────────────────────────────────────────────
  // Queries the Overpass API for nearby EV charging stations.
  // chargingFetchedRef guards against duplicate fetches within a session
  // (Overpass has rate limits and the data changes slowly).
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

  // ── pollWeather ───────────────────────────────────────────────────────────
  // Fetches OWM weather for all currently online riders with valid GPS.
  // On first rain detection per rider: fires a dismissible banner + alert.
  // Resets the rain flag when rain clears so it can re-fire on the next event.
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

        // Fire rain prompt only once per rain event per rider (deduped by ref)
        if (isRaining(weather.id) && !rainPromptedRef.current[riderId]) {
          rainPromptedRef.current[riderId] = true;
          const promptId = `rain-${riderId}-${Date.now()}`;
          const message = `It's raining near ${riderName} (${weather.description}, ${weather.temp}°C) — send a reminder to slow down?`;
          setRainPrompts((prev) => [...prev, { id: promptId, message }]);
          addAlertRef.current(
            `🌧️ Rain near ${riderName}: ${weather.description}, ${weather.temp}°C.`,
            "warning",
            { actionType: "rain_tip", riderId, riderName },
          );
        }
        // Reset flag when rain clears so it can fire again on the next rain event
        if (!isRaining(weather.id)) rainPromptedRef.current[riderId] = false;
      }),
    );
  }, []);

  const dismissRainPrompt = useCallback(
    (id) => setRainPrompts((p) => p.filter((r) => r.id !== id)),
    [],
  );

  // addAlert: prepend a new alert object to the top of the log, capped at 50.
  // extra: optional extra fields merged in (actionType, riderId, stationUrl, etc.)
  const addAlert = (message, type = "warning", extra = {}) => {
    setAlerts((prev) => [
      { id: `alert-${Date.now()}-${Math.random()}`, message, type, ...extra },
      ...prev.slice(0, 49),
    ]);
  };
  const addAlertRef = useRef(null);
  addAlertRef.current = addAlert;

  // ── handleSendReminder ────────────────────────────────────────────────────
  // Pushes a coaching tip to riders/{riderId}/coachingTips in Firebase.
  // Rider sees it immediately in their RiderTipsInbox drawer.
  // reminderStatus tracks in-flight/success/error per unique key for UI feedback.
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
      // Auto-clear after 4 s so the strip doesn't stay permanently cluttered
      setTimeout(
        () =>
          setReminderStatus((prev) => {
            const n = { ...prev };
            delete n[key];
            return n;
          }),
        4000,
      );
    } catch (err) {
      console.error("Failed to send reminder:", err);
      setReminderStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  // ── Firebase: main riders listener ────────────────────────────────────────
  // Single onValue on the entire riders/ node. On each update:
  //   1. Assigns stable color index to new rider IDs (first-seen order)
  //   2. Detects sosTriggered === true → shows SOS modal (once per event)
  //   3. Fires low/critical battery alerts with action buttons (deduped)
  //   4. Detects abnormal drain rate from the latest trip
  //   5. Projects remaining range — alerts if < 5 km
  //   6. Evaluates geofence entry/exit for each configured zone
  //   7. Flattens all rider trips into allTrips for the history table
  useEffect(() => {
    const ridersRef = ref(db, "riders");
    const unsubscribe = onValue(ridersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // ── Assign deterministic color index by first-seen order ────────────
      Object.keys(data).forEach((riderId) => {
        if (riderIndexMap.current[riderId] === undefined) {
          const idx = Object.keys(riderIndexMap.current).length;
          riderIndexMap.current[riderId] = idx;
          riderColorMap.current[riderId] = getRiderColor(idx);
        }
      });

      setRiders(data);

      Object.entries(data).forEach(([riderId, riderData]) => {
        // ── SOS detection ──────────────────────────────────────────────────
        // sosProcessedRef prevents the modal from re-opening on every Firebase
        // snapshot while the same SOS event is active. It resets to false when
        // the watcher resolves the event (handleSOSResolve sets sosTriggered=false).
        if (
          riderData.sosTriggered === true &&
          !sosProcessedRef.current[riderId]
        ) {
          const ts = riderData.sosTimestamp || "";
          if (sosTimestampRef.current[riderId] !== ts) {
            sosTimestampRef.current[riderId] = ts;
            sosProcessedRef.current[riderId] = true;
            setSosRider({ riderId, ...riderData });
            addAlertRef.current(
              `🚨 SOS ALERT from ${riderData.sosRiderName || riderData.location?.name || riderId}!`,
              "danger",
            );
          }
        } else if (riderData.sosTriggered === false) {
          // SOS resolved by watcher — clear processed flag and pending banner
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

        // ── Battery alerts ────────────────────────────────────────────────
        // Flags { low, critical } per rider prevent duplicate alerts
        // from firing on every Firebase snapshot while battery stays low.
        const bat = Number(loc.battery ?? 100);
        if (!batteryAlertedRef.current[riderId]) {
          batteryAlertedRef.current[riderId] = {
            low: bat <= BATTERY_LOW,
            critical: bat <= BATTERY_CRITICAL,
          };
        }
        const ba = batteryAlertedRef.current[riderId];

        if (bat <= BATTERY_CRITICAL && !ba.critical) {
          ba.critical = true;
          addAlertRef.current(
            `🚨 ${riderName} battery CRITICAL (${Math.round(bat * 10) / 10}%)! They need to stop and charge immediately.`,
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
          addAlertRef.current(
            `🔋 ${riderName} battery is low (${Math.round(bat * 10) / 10}%). Consider sending a charging reminder.`,
            "warning",
            {
              actionType: "charging_reminder",
              riderId,
              riderName,
              stationUrl: `https://www.google.com/maps/search/EV+charging+station/@${loc.lat},${lon},15z`,
            },
          );
        }

        // Reset alert flags when battery recovers above the threshold
        if (bat > BATTERY_LOW) {
          ba.low = false;
          ba.critical = false;
        } else if (bat > BATTERY_CRITICAL) {
          ba.critical = false;
        }

        if (isOnline && bat <= BATTERY_LOW) fetchMapStations(loc.lat, lon);

        // ── Drain rate + range alerts from latest trip ──────────────────
        const trips = riderData.trips ? Object.values(riderData.trips) : [];
        if (trips.length > 0) {
          const latest = trips.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
          )[0];

          // Drain rate alert: fires once when consumption > 1.2× normal baseline
          if (latest.consumptionWh && latest.distanceKm > 0) {
            const drainWh = Number(latest.consumptionWh);
            if (
              drainWh > DRAIN_BASELINE * DRAIN_ALERT_RATIO &&
              !drainAlertedRef.current[riderId]
            ) {
              drainAlertedRef.current[riderId] = true;
              addAlertRef.current(
                `⚡ ${riderName} is draining battery fast (${drainWh} Wh/km vs ${DRAIN_BASELINE} normal).`,
                "warning",
                { actionType: "drain_warning", riderId, riderName },
              );
            } else if (drainWh <= DRAIN_BASELINE * DRAIN_ALERT_RATIO) {
              drainAlertedRef.current[riderId] = false;
            }
          }

          // Range projection: fires when estimated remaining range drops below 5 km
          if (latest.batteryRemaining != null) {
            const remainingWh = (Number(latest.batteryRemaining) / 100) * 3700;
            const drainRate = latest.consumptionWh || DRAIN_BASELINE;
            const projRange = remainingWh / drainRate;
            if (projRange < 5 && !rangeAlertedRef.current[riderId]) {
              rangeAlertedRef.current[riderId] = true;
              addAlertRef.current(
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

        // ── Geofence entry/exit detection ─────────────────────────────────
        // previousInsideRef[riderId][zoneId] stores the last known inside state.
        // On first Firebase update for a rider+zone, we just initialise — no alert.
        if (!previousInsideRef.current[riderId])
          previousInsideRef.current[riderId] = {};
        const riderZoneState = previousInsideRef.current[riderId];

        activeGeofencesRef.current.forEach((zone) => {
          const inside = isInsideGeofence(
            loc.lat,
            lon,
            zone.lat,
            zone.lng,
            zone.radiusKm,
          );
          if (!(zone.id in riderZoneState)) {
            riderZoneState[zone.id] = inside;
            return;
          }
          const wasInside = riderZoneState[zone.id];
          if (inside && !wasInside) {
            addAlertRef.current(
              `✓ ${riderName} entered ${zone.name}`,
              "success",
            );
            riderZoneState[zone.id] = true;
          }
          if (!inside && wasInside) {
            addAlertRef.current(`✗ ${riderName} left ${zone.name}`, "warning");
            riderZoneState[zone.id] = false;
          }
        });
      });

      // ── Flatten all rider trips for the history table ──────────────────
      // Attaches riderId, riderName, and riderColor so the table can display
      // and color-code rows without needing to look up each rider separately.
      const trips = Object.entries(data).flatMap(([riderId, riderData]) => {
        if (!riderData.trips) return [];
        const riderName =
          riderData.profile?.name || riderData.location?.name || riderId;
        return Object.entries(riderData.trips).map(([tripId, trip]) => ({
          id: tripId,
          riderId,
          riderName,
          riderColor: riderColorMap.current[riderId],
          ...trip,
        }));
      });
      setAllTrips(trips);

      // Set the first online rider as the map center anchor (only on first online event)
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

  // ── Weather polling effect ─────────────────────────────────────────────────
  // Initialises 3 s after mount, then polls every 5 minutes.
  // Uses a separate onValue listener so it always reads the freshest riders data
  // without coupling to the main listener's execution cycle.
  useEffect(() => {
    if (!OWM_KEY) return;
    const init = setTimeout(() => pollWeather(riders), 3000);
    const poll = setInterval(() => pollWeather(riders), 5 * 60 * 1000);
    return () => {
      clearTimeout(init);
      clearInterval(poll);
    };
  }, [pollWeather, riders]);

  // ─────────────────────────────────────────────────────────────────────────
  // Route Replay Engine
  //
  // Model: 1 route point added per interval tick.
  // Interval duration = speedToMs(speed) ms.
  //   speed=1  → 800ms/pt  (slow)
  //   speed=5  → 300ms/pt  (default)
  //   speed=10 → 60ms/pt   (fast-forward)
  //
  // visibleRoute grows by 1 point each tick — creates a line-drawing effect.
  // ReplayPanner (inside MapContainer) pans the map to follow the head.
  // ─────────────────────────────────────────────────────────────────────────

  // handleStartReplay: called from TripHistoryTable ▶ button.
  // Validates route, stops any prior replay, zooms map to route start, resets state.
  const handleStartReplay = useCallback((trip) => {
    if (!validRoute(trip.route)) return;
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);

    const color = trip.riderColor || "#8e24aa";
    const totalPoints = trip.route.length;

    // Zoom map to the first route point before animation starts
    if (mapRef.current && trip.route[0]) {
      mapRef.current.setView(trip.route[0], 15, {
        animate: true,
        duration: 0.8,
      });
    }

    setReplay({
      active: true,
      route: trip.route,
      currentIndex: 0,
      totalPoints,
      color,
      riderName: trip.riderName || trip.riderId || "Rider",
      speed: 5,
      visibleRoute: [trip.route[0]],
    });
  }, []);

  // stepReplay: advances visibleRoute by exactly 1 point.
  // Stops automatically (clears interval + sets active:false) at end of route.
  const stepReplay = useCallback(() => {
    setReplay((prev) => {
      if (!prev.active) return prev;
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.totalPoints) {
        // End of route reached — clean up
        if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
        return { ...prev, active: false, visibleRoute: [] };
      }
      return {
        ...prev,
        currentIndex: nextIndex,
        visibleRoute: prev.route.slice(0, nextIndex + 1),
      };
    });
  }, []);

  // Effect: (re)starts interval whenever replay becomes active or speed changes.
  // Always clears the old interval before creating a new one to prevent drift.
  useEffect(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    if (!replay.active) return;
    replayIntervalRef.current = setInterval(
      stepReplay,
      speedToMs(replay.speed),
    );
    return () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, [replay.active, replay.speed, stepReplay]);

  // handleReplaySpeedChange: updates speed; the effect above restarts interval automatically
  const handleReplaySpeedChange = useCallback((newSpeed) => {
    setReplay((prev) => ({ ...prev, speed: newSpeed }));
  }, []);

  const handleStopReplay = useCallback(() => {
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    replayIntervalRef.current = null;
    setReplay((prev) => ({
      ...prev,
      active: false,
      visibleRoute: [],
      currentIndex: 0,
    }));
  }, []);

  // Cleanup interval on component unmount
  useEffect(
    () => () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    },
    [],
  );

  // Replay head = last point of the growing visibleRoute — fed to ReplayPanner
  const replayHeadPos =
    replay.active && replay.visibleRoute.length > 0
      ? replay.visibleRoute[replay.visibleRoute.length - 1]
      : null;

  // ── Map center and rider filtering ────────────────────────────────────────
  const defaultCenter = [18.5204, 73.8567]; // Pune, India — fallback when no riders online
  const mapCenter =
    firstOnlineRider && validCoords(firstOnlineRider.lat, firstOnlineRider.lon)
      ? [firstOnlineRider.lat, firstOnlineRider.lon]
      : defaultCenter;

  // Split riders into online/offline lists for different marker styles
  const onlineRiders = Object.entries(riders).filter(
    ([, r]) =>
      r.status === "online" &&
      r.location &&
      validCoords(r.location.lat, r.location.lon ?? r.location.lng),
  );
  const offlineRiders = Object.entries(riders).filter(
    ([, r]) =>
      r.status !== "online" &&
      r.location &&
      validCoords(r.location.lat, r.location.lon ?? r.location.lng),
  );

  const handleExportPDF = (trip) => {
    try {
      downloadTripPDF({
        riderName: trip.riderName || trip.riderId || "Rider",
        distance: trip.distanceKm || 0,
        duration: trip.durationSeconds || 0,
        ecoScore: trip.score || 0,
        avgSpeed: trip.avgSpeedKmh || 0,
        timestamp: trip.timestamp,
        batteryUsed: trip.batteryUsedPercent || 0, // % drained during trip
        batteryRemaining: trip.batteryRemaining ?? null, // % left after trip — FIX
        worstAxis: trip.worstAxis || "speed",
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF");
    }
  };

  // ── handleSOSResolve ──────────────────────────────────────────────────────
  // Writes sosTriggered=false to Firebase, clears the modal, removes the rider
  // from the pending banner strip, and resets the processed flag so a future
  // SOS from the same rider will show the modal again.
  const handleSOSResolve = async (riderIdOverride) => {
    const targetId = riderIdOverride ?? sosRider?.riderId;
    if (!targetId) return;
    setResolvingRiderIds((prev) => new Set([...prev, targetId]));
    try {
      await update(ref(db, `riders/${targetId}`), { sosTriggered: false });
      sosProcessedRef.current[targetId] = false;
      setPendingSosRiders((prev) => {
        const n = { ...prev };
        delete n[targetId];
        return n;
      });
      if (sosRider?.riderId === targetId) setSosRider(null);
    } catch (error) {
      console.error("Failed to resolve SOS:", error);
      alert("Failed to mark SOS as resolved");
    } finally {
      setResolvingRiderIds((prev) => {
        const n = new Set(prev);
        n.delete(targetId);
        return n;
      });
    }
  };

  // handleSOSModalClose (Dismiss): moves SOS to pendingSosRiders without resolving.
  // The watcher keeps monitoring but the full-screen modal closes.
  const handleSOSModalClose = (dismissedSosRider) => {
    if (dismissedSosRider?.riderId) {
      setPendingSosRiders((prev) => ({
        ...prev,
        [dismissedSosRider.riderId]: dismissedSosRider,
      }));
    }
    setSosRider(null);
  };

  // handleRecenterMap: pans map to first online rider or default center
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

  // handleFitAll: fits all riders (online + offline) into the map viewport.
  // Uses fitBounds for multiple riders, setView for a single rider.
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="watcher-dashboard">
      {/* Dashboard header with geofence editor toggle button */}
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

      {/* Rain alert banners — one per online rider with detected rain */}
      <RainPrompt prompts={rainPrompts} onDismiss={dismissRainPrompt} />

      {/* Warning strip when OWM key is absent — weather features silently disabled */}
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

      {/* Geofence editor — conditionally shown below the header */}
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

      {/* Rider status pills — online/offline, SOS flag, battery %, live eco score, weather */}
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

      {/* ── Map + Alerts two-column grid ──────────────────────────────────── */}
      <div className="watcher-map-alerts-grid">
        <div className="map-wrapper">
          {/* Map control buttons — bottom-right corner of map wrapper */}
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

          {/* Route visibility toggle — top-right corner of map */}
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

          {/* Charging station count badge — top-left corner */}
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

          {/* Compact replay control panel — bottom-left of map */}
          <ReplayOverlay
            replay={replay}
            onStop={handleStopReplay}
            onSpeedChange={handleReplaySpeedChange}
          />

          {/* ── Leaflet MapContainer ─────────────────────────────────────── */}
          <MapContainer center={mapCenter} zoom={13} className="map-container">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              maxZoom={19}
              crossOrigin={true}
            />
            {/* MapController fires onMapReady callback + deferred invalidateSize */}
            <MapController onMapReady={handleMapReady} />
            {/* ReplayPanner smoothly follows replay head — only active during replay */}
            {replay.active && replayHeadPos && (
              <ReplayPanner headPos={replayHeadPos} />
            )}

            {/* Live route polylines for online riders */}
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

            {/* Ghost routes (dashed) for offline riders — shows last known trip path */}
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

            {/* ── Replay route layers (3 overlapping) ─────────────────────
                1. Ghost — full dashed route (shows where trip will go)
                2. Solid growing line — the line-drawing animation effect
                3. Scooter head marker — animated dot at visibleRoute tail */}
            {replay.active && validRoute(replay.route) && (
              <>
                <Polyline
                  key="replay-ghost"
                  positions={replay.route}
                  pathOptions={{
                    color: replay.color,
                    weight: 3,
                    opacity: 0.18,
                    dashArray: "4 6",
                    lineJoin: "round",
                    lineCap: "round",
                    smoothFactor: 1,
                  }}
                />
                {validRoute(replay.visibleRoute) && (
                  <Polyline
                    key="replay-line"
                    positions={replay.visibleRoute}
                    pathOptions={{
                      color: replay.color,
                      weight: 5,
                      opacity: 0.95,
                      lineJoin: "round",
                      lineCap: "round",
                      smoothFactor: 1,
                    }}
                  />
                )}
                {replayHeadPos && (
                  <Marker
                    key="replay-head"
                    position={replayHeadPos}
                    icon={createReplayIcon(replay.color)}
                  />
                )}
              </>
            )}

            {/* Online rider markers — color shifts on low/critical battery or SOS */}
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

            {/* Offline rider markers — greyed out at 50% opacity */}
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

            {/* Geofence zone circles — color-coded by index, alert fires on enter/exit */}
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

            {/* Charging station markers from Overpass API */}
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

          {/* Route legend overlay inside map wrapper */}
          {showRoutes && (
            <RouteLegend riders={riders} riderColorMap={riderColorMap} />
          )}
        </div>

        {/* ── Alerts panel ──────────────────────────────────────────────── */}
        <div>
          <h3 style={{ margin: "0 0 12px", color: "#fff" }}>Recent Alerts</h3>

          {/* Unresolved SOS banners — remain visible until watcher resolves */}
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

          {/* Send reminder status strip — in-flight / sent / error per tip */}
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

          {/* Scrollable alert log */}
          {alerts.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "6px",
              }}
            >
              <button
                onClick={() => setAlerts([])}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: "600",
                  background: "transparent",
                  border: "1px solid #444",
                  borderRadius: "4px",
                  color: "#888",
                  cursor: "pointer",
                }}
              >
                🗑️ Clear All
              </button>
            </div>
          )}
          <div className="watcher-alerts-scroll">
            {!alerts.length && (
              <p style={{ color: "#666", fontSize: "14px" }}>No alerts yet.</p>
            )}
            {alerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onSendReminder={handleSendReminder}
                onDismiss={(id) =>
                  setAlerts((prev) => prev.filter((a) => a.id !== id))
                }
                sentTipsRef={sentTipsRef}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Trip History section ──────────────────────────────────────────── */}
      <div>
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
          {/* Tab switcher: History / Stats / Trends */}
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
          {/* Time-window filter — hidden on Trends tab (always uses all data) */}
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

        {activeTab === "history" && (
          <TripHistoryTable
            trips={allTrips}
            filterDays={filterDays}
            onTripClick={setSelectedTrip}
            onExportPDF={handleExportPDF}
            onReplay={handleStartReplay}
          />
        )}
        {activeTab === "stats" && (
          <TripStatsSummary trips={allTrips} filterDays={filterDays} />
        )}
        {activeTab === "trends" && (
          <TripScoreCharts allTrips={allTrips} riderColorMap={riderColorMap} />
        )}
      </div>

      {/* ── Trip detail modal ─────────────────────────────────────────────── */}
      {selectedTrip &&
        (() => {
          // Normalise Firebase field names to TripSummaryCard's expected shape before opening modal
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
                  riderId={
                    selectedTrip.riderName
                      ? normalizeRiderId(selectedTrip.riderName)
                      : selectedTrip.riderId
                  }
                  watcherId="parent"
                />
              </div>
            </div>
          );
        })()}

      {/* SOS full-screen modal — shown on first detection of sosTriggered=true */}
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
