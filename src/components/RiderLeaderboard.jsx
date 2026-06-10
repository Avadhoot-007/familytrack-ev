import { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../config/firebase";
import { useStore } from "../store";
import "./RiderLeaderboard.css";

export default function RiderLeaderboard() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("avgScore");
  const [error, setError] = useState(null);

  const medals = ["🥇", "🥈", "🥉"];

  const localTripHistory = useStore((s) => s.tripHistory);
  const localRiderName = useStore((s) => s.riderName);

  // Holds latest Firebase snapshot — updated by onValue listener
  const firebaseRidersRef = useRef({});

  const normalizeId = (str) =>
    (str || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const buildLeaderboard = useCallback(() => {
    try {
      // riderMap: normalizedId → { name, trips: [] }
      const riderMap = {};

      // Source 1: Firebase
      Object.entries(firebaseRidersRef.current).forEach(
        ([riderId, riderData]) => {
          const trips = riderData.trips ? Object.values(riderData.trips) : [];
          if (!trips.length) return;

          const displayName =
            riderData.profile?.name ||
            trips.find((t) => t.riderName)?.riderName ||
            riderData.location?.name ||
            riderId;

          const id = normalizeId(riderId);
          if (!riderMap[id])
            riderMap[id] = { name: displayName, tripSet: new Map() };
          else riderMap[id].name = displayName; // Firebase name wins

          trips.forEach((t) => {
            const key = t.id || `${t.timestamp}-${t.distanceKm}`;
            riderMap[id].tripSet.set(key, t);
          });
        },
      );

      // Source 2: Zustand local — merge without duplicating
      if (localTripHistory.length > 0) {
        localTripHistory.forEach((t) => {
          const rawId =
            t.riderId || normalizeId(localRiderName || "local-rider");
          const id = normalizeId(rawId);
          const name = t.riderName || localRiderName || id;

          if (!riderMap[id]) riderMap[id] = { name, tripSet: new Map() };

          const key = t.id || `${t.timestamp}-${t.distanceKm || t.distance}`;
          riderMap[id].tripSet.set(key, t);
        });
      }

      // Build stats from deduplicated tripSet
      const result = Object.entries(riderMap)
        .map(([normalizedId, { name, tripSet }]) => {
          const trips = Array.from(tripSet.values());
          if (!trips.length) return null;

          const timestamps = trips
            .map((t) => new Date(t.timestamp).getTime())
            .filter((t) => !isNaN(t));
          if (!timestamps.length) return null;

          const totalTrips = trips.length;
          const totalDistance = trips.reduce(
            (sum, t) => sum + (Number(t.distanceKm) || Number(t.distance) || 0),
            0,
          );
          const avgScore = Math.round(
            trips.reduce(
              (sum, t) => sum + (Number(t.score) || Number(t.ecoScore) || 0),
              0,
            ) / totalTrips,
          );
          const bestScore = Math.max(
            ...trips.map((t) => Number(t.score || t.ecoScore || 0)),
          );
          const lastTripTime = Math.max(...timestamps);

          return {
            normalizedId,
            name,
            avgScore,
            bestScore,
            totalTrips,
            totalDistance: parseFloat(totalDistance.toFixed(1)),
            lastTripTime,
          };
        })
        .filter(Boolean);

      setRiders(result);
      setError(null);
    } catch (err) {
      console.error("Leaderboard build error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [localTripHistory, localRiderName]);

  // Firebase live listener — replaces get() + setInterval
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onValue(
      ref(db, "riders"),
      (snapshot) => {
        firebaseRidersRef.current = snapshot.val() || {};
        buildLeaderboard();
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [buildLeaderboard]);

  // Rebuild when local trips change (Firebase listener already covers Firebase changes)
  useEffect(() => {
    buildLeaderboard();
  }, [buildLeaderboard]);

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

  const getScoreColor = (score) => {
    if (score >= 90) return "#1a7e32";
    if (score >= 70) return "#28a745";
    if (score >= 50) return "#ffc107";
    return "#dc3545";
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return "Eco Champion";
    if (score >= 70) return "Good Riding";
    if (score >= 50) return "Room to Improve";
    return "Aggressive";
  };

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

  return (
    <div className="rider-leaderboard">
      <div className="leaderboard-header">
        <h2>🏆 Rider Leaderboard</h2>
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
          No trips recorded yet. Start a trip or simulate one!
        </div>
      ) : (
        <>
          <div className="leaderboard-table">
            <div className="leaderboard-row header-row">
              <div className="col rank">Rank</div>
              <div className="col name">Rider</div>
              <div className="col avg-score">Avg Score</div>
              <div className="col trips">Trips</div>
              <div className="col distance">Distance (km)</div>
              <div className="col last-trip">Last Trip</div>
            </div>

            {sortedRiders.map((rider, index) => (
              <div
                key={rider.normalizedId}
                className={`leaderboard-row rank-${index}`}
              >
                <div className="col rank">
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
