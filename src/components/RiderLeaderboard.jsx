// =============================================================================
// RiderLeaderboard.jsx
// =============================================================================
// Displays a ranked table of all riders in the family based on eco-score,
// trip count, or total distance. Data is pulled from two sources:
//
//   1. Firebase Realtime Database — riders/{riderId}/trips/
//      Written by tripFirebaseSync.js after every completed real/simulated trip.
//
//   2. Zustand local store — tripHistory[]
//      Persisted to localStorage; may contain trips not yet synced to Firebase
//      (e.g. offline trips, first-session trips before Firebase write completes).
//
// Both sources are MERGED into a single riderMap keyed by a normalized rider ID
// so the same rider never appears twice regardless of casing or spacing
// differences between the Firebase key and the local riderName string.
//
// The component auto-refreshes every 10 seconds via setInterval so the
// leaderboard stays live without requiring a manual reload.
// =============================================================================

import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { db } from "../config/firebase";
import { useStore } from "../store";
import "./RiderLeaderboard.css";

export default function RiderLeaderboard() {
  const [riders, setRiders] = useState([]); // final merged + sorted rider list
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("avgScore");
  const [error, setError] = useState(null);

  const medals = ["🥇", "🥈", "🥉"];

  // Pull local trip history and riderName from Zustand.
  // Both are used to merge locally-held trips that Firebase may not have yet.
  // localRiderName is the fallback display name when a trip has no riderName field.
  const localTripHistory = useStore((s) => s.tripHistory);
  const localRiderName = useStore((s) => s.riderName);

  // ── Auto-refresh ────────────────────────────────────────────────────────
  // Dependency array includes BOTH localTripHistory AND localRiderName.
  // Including localRiderName here ensures loadLeaderboardData re-runs and
  // re-groups local trips under the correct current name whenever it changes.
  useEffect(() => {
    loadLeaderboardData();
    const interval = setInterval(loadLeaderboardData, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTripHistory, localRiderName]);

  // ── normalizeId ──────────────────────────────────────────────────────────
  // Converts any rider name or Firebase key into a stable, lowercase,
  // hyphenated identifier with no special characters.
  // Must match the output of sanitizeRiderId() in locationService.js so that
  // Firebase keys and Zustand-derived IDs collapse to the same map key.
  const normalizeId = (str) =>
    (str || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-") // spaces → hyphens (matches Firebase key format)
      .replace(/[^a-z0-9-]/g, ""); // strip anything not alphanumeric or hyphen

  // ── buildRiderMap ────────────────────────────────────────────────────────
  // Aggregates trip statistics for a single rider and writes/updates their
  // entry in the shared riderMap object.
  //
  // Parameters:
  //   map          — the shared accumulator object (mutated in place)
  //   normalizedId — stable key derived from normalizeId(); prevents duplicates
  //   displayName  — human-readable name shown in the UI
  //   tripsList    — array of trip objects for this rider
  //
  // Merge strategy:
  //   If the rider already exists in the map (can happen when Firebase and
  //   Zustand both have data for them), the entry with MORE trips wins.
  //   More trips = more complete data = more accurate averages.
  //   We do NOT sum both sources because that would double-count trips that
  //   exist in both Firebase and local storage simultaneously.
  const buildRiderMap = (map, normalizedId, displayName, tripsList) => {
    if (!tripsList.length) return;

    const totalTrips = tripsList.length;

    // Sum distances; support both field name variants:
    //   distanceKm — written by RiderDashboard.handleStopSharing / handleSimulateTrip
    //   distance   — legacy field name used in some older trip objects
    const totalDistance = tripsList.reduce(
      (sum, t) => sum + (t.distanceKm || t.distance || 0),
      0,
    );

    // Average eco score across all trips.
    // Supports both field names: score (new) and ecoScore (legacy).
    const avgScore = Math.round(
      tripsList.reduce((sum, t) => sum + (t.score || t.ecoScore || 0), 0) /
        totalTrips,
    );

    const bestScore = Math.max(
      ...tripsList.map((t) => t.score || t.ecoScore || 0),
    );
    const worstScore = Math.min(
      ...tripsList.map((t) => t.score || t.ecoScore || 0),
    );

    // Parse timestamps to ms for the "last trip" column.
    // Filter out NaN values from malformed or missing timestamps.
    const timestamps = tripsList
      .map((t) => new Date(t.timestamp).getTime())
      .filter((t) => !isNaN(t));
    if (!timestamps.length) return; // skip rider if no valid timestamps

    const lastTripTime = Math.max(...timestamps);

    // Write or overwrite the entry.
    // Overwrite only if this source has MORE trips than whatever is already
    // in the map — ensures we always show the most complete dataset.
    if (!map[normalizedId] || tripsList.length > map[normalizedId].totalTrips) {
      map[normalizedId] = {
        normalizedId, // stable key used as React list key
        name: displayName || normalizedId,
        avgScore,
        bestScore,
        worstScore,
        totalTrips,
        totalDistance: parseFloat(totalDistance.toFixed(1)),
        lastTripTime,
      };
    }
  };

  // ── loadLeaderboardData ──────────────────────────────────────────────────
  // Main data-loading function. Reads Firebase, reads Zustand, merges both
  // into a single de-duplicated riderMap, then sets component state.
  //
  // Called on mount, every 10 s via setInterval, and immediately whenever
  // localTripHistory or localRiderName changes (see useEffect above).
  const loadLeaderboardData = async () => {
    try {
      setLoading(true);

      // riderMap is the single accumulator for all rider data.
      // Key = normalizedId (e.g. "keys", "john-doe")
      // Value = rider stats object built by buildRiderMap()
      const riderMap = {};

      // ── Source 1: Firebase Realtime Database ───────────────────────────
      // Read the entire `riders/` node. Each child key is a riderId (Firebase key).
      // Structure: riders/{riderId}/trips/{tripId} → trip object
      // Structure: riders/{riderId}/profile → { name }
      // Structure: riders/{riderId}/location → { name, lat, lon, ... }
      const snapshot = await get(ref(db, "riders"));
      if (snapshot.exists()) {
        const ridersData = snapshot.val();

        for (const [riderId, riderData] of Object.entries(ridersData)) {
          // Firebase stores trips as an object keyed by tripId; convert to array
          const trips = riderData.trips ? Object.values(riderData.trips) : [];
          if (!trips.length) continue;

          // Resolve the best available display name for this rider.
          // Priority: profile.name > riderName on any trip > location.name > raw key.
          // profile.name is written by RiderDashboard.handleStopSharing() as:
          //   set(ref(db, `riders/${riderId}/profile`), { name: riderName })
          const displayName =
            riderData.profile?.name ||
            trips.find((t) => t.riderName)?.riderName ||
            riderData.location?.name ||
            riderId;

          // Normalize the Firebase key before using it as a map key.
          // Firebase keys are already slugified by sanitizeRiderId() in
          // locationService.js, but we normalize again here for safety.
          const normalizedId = normalizeId(riderId);
          buildRiderMap(riderMap, normalizedId, displayName, trips);
        }
      }

      // ── Source 2: Zustand local trip history ───────────────────────────
      // Zustand holds trips that may not be in Firebase yet (e.g. trip just
      // completed and Firebase write is in-flight, or the user is offline).
      // Merge these in so the leaderboard reflects the latest local state.
      if (localTripHistory.length > 0) {
        // Derive the current user's normalized ID from localRiderName.
        // Uses the same normalizeId() so it matches the Firebase key format.
        const localRiderId = normalizeId(localRiderName || "local-rider");
        const displayName = localRiderName || localRiderId;

        // Group local trips by their per-trip riderId field (normalized).
        // Most trips carry the current user's riderId, but a single device
        // shared by multiple family members may have trips from different riders.
        const localByRider = {};
        localTripHistory.forEach((t) => {
          // t.riderId may be undefined for very old trips — fall back to
          // the current user's ID derived from localRiderName.
          const rawId = t.riderId || localRiderName || "local-rider";
          const id = normalizeId(rawId); // normalize to prevent key mismatches
          const name = t.riderName || displayName;

          if (!localByRider[id]) localByRider[id] = { name, trips: [] };
          localByRider[id].trips.push(t);
        });

        // Merge each local rider group into riderMap.
        // buildRiderMap's "more trips wins" logic handles both cases:
        //   - Rider not in Firebase → adds from local
        //   - Rider exists in both  → whichever has more trips wins
        // This guards against double-counting trips present in both sources.
        for (const [id, { name, trips }] of Object.entries(localByRider)) {
          buildRiderMap(riderMap, id, name, trips);
        }
      }

      // Convert map → array for React state; sorting happens in getSortedRiders()
      setRiders(Object.values(riderMap));
      setError(null);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── getSortedRiders ──────────────────────────────────────────────────────
  // Returns a sorted copy of the riders array based on the current sortBy value.
  // Always sorts descending (highest value first) so rank 1 = best performer.
  const getSortedRiders = () => {
    const sorted = [...riders];
    switch (sortBy) {
      case "avgScore":
        return sorted.sort((a, b) => b.avgScore - a.avgScore);
      case "totalTrips":
        return sorted.sort((a, b) => b.totalTrips - a.totalTrips);
      case "totalDistance":
        return sorted.sort((a, b) => b.totalDistance - a.totalDistance);
      default:
        return sorted;
    }
  };

  // ── Score colour helper ──────────────────────────────────────────────────
  // Maps eco score ranges to traffic-light colours consistent with the
  // rest of the app (RiderDashboard, EnvironmentalImpactHub, WatcherDashboard).
  const getScoreColor = (score) => {
    if (score >= 90) return "#1a7e32"; // dark green — Eco Champion
    if (score >= 70) return "#28a745"; // green      — Good Riding
    if (score >= 50) return "#ffc107"; // amber      — Room to Improve
    return "#dc3545"; // red        — Aggressive
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return "Eco Champion";
    if (score >= 70) return "Good Riding";
    if (score >= 50) return "Room to Improve";
    return "Aggressive";
  };

  // ── formatTime ───────────────────────────────────────────────────────────
  // Converts a Unix timestamp (ms) to a human-readable relative string.
  // Used for the "Last Trip" column. Shows days → hours → "just now".
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Invalid time";
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "just now";
  };

  const sortedRiders = getSortedRiders();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rider-leaderboard">
      <div className="leaderboard-header">
        <h2>🏆 Rider Leaderboard</h2>
        {/* Sort selector — triggers re-sort on already-loaded data,
            no Firebase re-fetch needed since riders state is already populated */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="sort-select"
        >
          <option value="avgScore">Avg Eco Score</option>
          <option value="totalTrips">Most Trips</option>
          <option value="totalDistance">Most Distance</option>
        </select>
      </div>

      {error && <div className="error-box">⚠️ {error}</div>}

      {loading ? (
        <div className="loading">Loading leaderboard...</div>
      ) : sortedRiders.length === 0 ? (
        <div className="empty-state">
          No trips recorded yet. Start sharing to appear on the leaderboard!
        </div>
      ) : (
        <>
          {/* ── Leaderboard table ──────────────────────────────────────── */}
          <div className="leaderboard-table">
            {/* Header row — uses CSS Grid (defined in RiderLeaderboard.css),
                not a real <thead>, so column widths are shared with data rows */}
            <div className="leaderboard-row header-row">
              <div className="col rank">Rank</div>
              <div className="col name">Rider</div>
              <div className="col avg-score">Avg Score</div>
              <div className="col trips">Trips</div>
              <div className="col distance">Distance (km)</div>
              <div className="col last-trip">Last Trip</div>
            </div>

            {/* One row per rider. Key uses normalizedId (stable, unique across
                both Firebase and Zustand sources). rank-0/1/2 CSS classes apply
                gold/silver/bronze row background tinting. */}
            {sortedRiders.map((rider, index) => (
              <div
                key={rider.normalizedId}
                className={`leaderboard-row rank-${index}`}
              >
                <div className="col rank">
                  {/* Medal emoji for top 3 only; numeric rank always shown */}
                  {index < 3 && <span className="medal">{medals[index]}</span>}
                  <span className="rank-number">#{index + 1}</span>
                </div>
                <div className="col name">{rider.name}</div>
                <div
                  className="col avg-score"
                  style={{
                    color: getScoreColor(rider.avgScore),
                    fontWeight: "600",
                  }}
                >
                  {rider.avgScore}
                  <span className="score-label">
                    {getScoreLabel(rider.avgScore)}
                  </span>
                </div>
                <div className="col trips">{rider.totalTrips}</div>
                <div className="col distance">{rider.totalDistance}</div>
                <div className="col last-trip">
                  {formatTime(rider.lastTripTime)}
                </div>
              </div>
            ))}
          </div>

          {/* ── Summary stats strip ────────────────────────────────────── */}
          {/* Aggregate totals across ALL riders — gives a quick family overview.
              avgScore here is the mean of per-rider averages (not per-trip),
              so every rider has equal weight in the family score regardless
              of how many trips each rider has completed. */}
          <div className="leaderboard-stats">
            <div className="stat">
              <span className="stat-label">Total Riders</span>
              <span className="stat-value">{sortedRiders.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Trips</span>
              <span className="stat-value">
                {sortedRiders.reduce((sum, r) => sum + r.totalTrips, 0)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Combined Distance</span>
              <span className="stat-value">
                {sortedRiders
                  .reduce((sum, r) => sum + r.totalDistance, 0)
                  .toFixed(1)}{" "}
                km
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Avg Eco Score</span>
              <span className="stat-value">
                {Math.round(
                  sortedRiders.reduce((sum, r) => sum + r.avgScore, 0) /
                    sortedRiders.length,
                )}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
