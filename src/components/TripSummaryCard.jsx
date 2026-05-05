// ---------------------------------------------------------------------------
// TripSummaryCard.jsx
// Post-trip summary card rendered inside TripSummaryModal (RiderDashboard)
// and the trip detail modal in WatcherDashboard.
// Displays: eco score gauge, trip stats, battery projection, action buttons.
// Exports: PDF via downloadTripPDF (tripPDFExport.js)

// ---------------------------------------------------------------------------

import { useState } from "react";
import { ref, set } from "firebase/database";
import { db } from "../config/firebase";
import { downloadTripPDF } from "../utils/tripPDFExport";
import "./TripSummaryCard.css";

// ---------------------------------------------------------------------------
// Ather Rizta Z battery specifications (3.7 kWh total capacity)
// Consumption rates are empirically calibrated per riding style.
// These mirror the values used in RiderDashboard for consistent projections.
// ---------------------------------------------------------------------------
const BATTERY_SPECS = {
  capacity: 3700, // total Wh (3.7 kWh)
  consumption: {
    eco: 33, // Wh/km — gentle riding, max range
    normal: 37, // Wh/km — average mixed riding
    aggressive: 46, // Wh/km — hard acceleration, city stop-start
  },
};

// ---------------------------------------------------------------------------
// TripSummaryCard
// Props:
//   trip      — trip object (see shape below)
//   riderId   — Firebase rider key used when saving trip directly from card
//
// Expected trip shape:
//   { riderName, distance, duration, ecoScore, avgSpeed,
//     batteryUsed, batteryRemaining, timestamp, worstAxis }
// ---------------------------------------------------------------------------
export default function TripSummaryCard({ trip, riderId }) {
  // Local state for the PDF generation in-flight indicator
  const [isGenerating, setIsGenerating] = useState(false);

  // Guard: render placeholder if no trip data is passed
  if (!trip) {
    return <div className="trip-summary-card">No trip data available</div>;
  }

  // ── Destructure trip fields with safe defaults ───────────────────────────
  const distance = trip.distance || 0;
  const duration = trip.duration || 0; // seconds
  const ecoScore = trip.ecoScore || 0;
  const batteryUsed = trip.batteryUsed || 0; // % drained during this trip
  const batteryRemaining = trip.batteryRemaining || 0; // % left after trip ends
  const timestamp = trip.timestamp || new Date().toISOString();
  const avgSpeed = trip.avgSpeed || 0;
  const riderName = trip.riderName || "Rider";

  // ── Derive ride style from eco score ────────────────────────────────────
  // This mirrors the same bucketing logic used in RiderDashboard when saving trips.
  const getRideStyle = () => {
    if (ecoScore >= 80) return "eco";
    if (ecoScore >= 60) return "normal";
    return "aggressive";
  };

  const rideStyle = getRideStyle();
  const consumptionRate = BATTERY_SPECS.consumption[rideStyle]; // Wh/km for this style

  // ── Battery projection calculations ─────────────────────────────────────
  // Convert remaining battery percentage → Watt-hours for projection maths.
  const batteryCapacityWh = BATTERY_SPECS.capacity;
  const batteryRemainingWh = (batteryRemaining / 100) * batteryCapacityWh;

  // calculateProjection
  // Estimates how far and how long the rider can go on the remaining battery
  // at a given consumption rate (Wh/km).
  // Returns: { range (km), hours, mins }
  const calculateProjection = (consumption) => {
    if (batteryRemaining <= 0)
      return { range: "0", minutes: "0", hours: 0, mins: 0 };

    // Range = remaining energy (Wh) ÷ consumption rate (Wh/km)
    const rangeKm = batteryRemainingWh / consumption;

    // Time = range ÷ speed; fall back to 25 km/h if avgSpeed is 0
    const avgSpeedKmh = parseFloat(avgSpeed) || 25;
    const minutes = avgSpeedKmh > 0 ? (rangeKm / avgSpeedKmh) * 60 : 0;
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);

    return {
      range: rangeKm.toFixed(1),
      minutes: minutes.toFixed(0),
      hours,
      mins,
    };
  };

  // Projection at current ride style consumption rate
  const projection = calculateProjection(consumptionRate);
  // Projection if rider switches to full eco mode — shown as a comparison hint
  const ecoProjection = calculateProjection(BATTERY_SPECS.consumption.eco);

  // ── Eco score visual helpers ─────────────────────────────────────────────
  const ecoRating =
    ecoScore >= 80 ? "Excellent" : ecoScore >= 60 ? "Good" : "Poor";
  const ecoColor =
    ecoScore >= 80 ? "#4CAF50" : ecoScore >= 60 ? "#FFC107" : "#f44336";

  // ── Safe date formatting ─────────────────────────────────────────────────
  const tripDate = new Date(timestamp);
  const formattedDate = isNaN(tripDate.getTime())
    ? "Invalid Date"
    : tripDate.toLocaleDateString();

  // formatDuration
  // Converts a raw second count to "Xh Ym" or "Ym" string for display.
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "0m";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // formatTime — renders hours + minutes as human-readable string
  const formatTime = (hours, mins) => {
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // ── handleExportPDF ──────────────────────────────────────────────────────
  // Triggers PDF download via tripPDFExport.js.
  // FIX: batteryRemaining is now explicitly passed so the PDF "Battery Remaining"
  // field reflects the actual post-trip level, not (100 - batteryUsed).
  const handleExportPDF = async () => {
    setIsGenerating(true);
    try {
      downloadTripPDF({
        riderName,
        distance,
        duration,
        ecoScore,
        avgSpeed: parseFloat(avgSpeed),
        batteryUsed,
        batteryRemaining, // <-- explicit actual remaining; fixes the PDF bug
        timestamp,
        worstAxis: trip.worstAxis || "speed",
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── saveTrip ─────────────────────────────────────────────────────────────
  // Allows re-saving a trip from the card UI (e.g. if auto-save failed).
  // Writes to riders/{riderId}/trips/{timestamp} in Firebase.
  // Note: trips are normally persisted automatically by addCompletedTrip in
  // RiderDashboard — this is a manual fallback only.
  const saveTrip = async () => {
    if (!riderId) {
      alert("Rider ID required.");
      return;
    }
    try {
      const tripRef = ref(db, `riders/${riderId}/trips/${Date.now()}`);
      await set(tripRef, {
        distance,
        duration,
        ecoScore,
        batteryUsed,
        batteryRemaining,
        timestamp,
        createdAt: new Date().toISOString(),
        rideStyle,
        consumptionWh: consumptionRate,
      });
      alert("Trip saved ✓");
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="trip-summary-card">
      <h2>Trip Summary</h2>

      {/* ── Top stat grid ─────────────────────────────────────────────────── */}
      <div className="trip-stats-grid">
        <div className="stat-box">
          <p className="stat-label">Distance</p>
          <p className="stat-value">{distance.toFixed(2)} km</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Duration</p>
          <p className="stat-value">{formatDuration(duration)}</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Avg Speed</p>
          <p className="stat-value">{parseFloat(avgSpeed).toFixed(1)} km/h</p>
        </div>

        {/* batteryUsed = how much was drained during the trip */}
        <div className="stat-box">
          <p className="stat-label">Battery Used</p>
          <p className="stat-value">{batteryUsed.toFixed(1)}%</p>
        </div>
      </div>

      {/* ── Eco-Score gauge ───────────────────────────────────────────────── */}
      <div className="eco-score-section">
        <h3>Eco-Score</h3>
        <div className="eco-gauge-container">
          {/* Circular gauge — color reflects score bucket */}
          <div className="eco-gauge" style={{ backgroundColor: ecoColor }}>
            <span className="eco-value">{ecoScore}</span>
            <span className="eco-label">/100</span>
          </div>
          <div className="eco-text">
            <p className="eco-rating">{ecoRating}</p>
            <p className="eco-description">
              {ecoScore >= 80
                ? "🏆 Amazing eco-driving! Keep smooth acceleration."
                : ecoScore >= 60
                  ? "⚡ Good ride. Cruise at 40 km/h for +20% battery."
                  : "⚠️ Aggressive riding. Smooth acceleration saves battery."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Battery projection ────────────────────────────────────────────── */}
      {/* Shows two projections: current style vs full eco mode for comparison */}
      <div className="battery-projection">
        <h3>Battery Projection</h3>

        {/* Current style projection — based on batteryRemaining and ride style */}
        <p>
          Current style{" "}
          <strong>
            ({rideStyle}, {consumptionRate} Wh/km)
          </strong>
          : <strong>{formatTime(projection.hours, projection.mins)}</strong>{" "}
          remaining ({projection.range} km)
        </p>

        {/* Eco mode comparison — helps rider understand the range benefit */}
        <p className="projection-tip">
          💚 Eco-style riding <strong>(33 Wh/km)</strong>:{" "}
          <strong>{formatTime(ecoProjection.hours, ecoProjection.mins)}</strong>{" "}
          ({ecoProjection.range} km)
        </p>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div className="action-buttons">
        {/* Save Trip — manual Firebase write fallback */}
        <button onClick={saveTrip} className="btn btn-primary">
          💾 Save Trip
        </button>

        {/* Export PDF — generates and downloads the trip summary as a PDF file */}
        <button
          onClick={handleExportPDF}
          disabled={isGenerating}
          className="btn btn-secondary"
        >
          {isGenerating ? "⏳ Generating..." : "📄 Export PDF"}
        </button>
      </div>
    </div>
  );
}
