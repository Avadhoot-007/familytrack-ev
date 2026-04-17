import { useState, useEffect } from 'react';
import { ref, query, get, set, remove } from 'firebase/database';
import { db } from '../config/firebase';
import './RiderLeaderboard.css';

export default function RiderLeaderboard() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('avgScore'); // avgScore | totalTrips | totalDistance
  const [error, setError] = useState(null);

  const medals = ['🥇', '🥈', '🥉'];

  useEffect(() => {
    loadLeaderboardData();
    const interval = setInterval(loadLeaderboardData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboardData = async () => {
    try {
      setLoading(true);
      const ridersRef = ref(db, 'riders');
      const snapshot = await get(ridersRef);

      if (!snapshot.exists()) {
        setRiders([]);
        setLoading(false);
        return;
      }

      const ridersData = snapshot.val();
      const leaderboardData = [];

      // Process each rider
      for (const [riderId, riderData] of Object.entries(ridersData)) {
        const trips = riderData.trips || {};
        const tripsList = Object.values(trips);

        if (tripsList.length === 0) continue;

        const totalTrips = tripsList.length;
        const totalDistance = tripsList.reduce((sum, trip) => sum + (trip.distanceKm || 0), 0);
        const avgScore = Math.round(
          tripsList.reduce((sum, trip) => sum + (trip.score || 0), 0) / totalTrips
        );
        const bestScore = Math.max(...tripsList.map((t) => t.score || 0));
        const worstScore = Math.min(...tripsList.map((t) => t.score || 0));

        const timestamps = tripsList.map((t) => new Date(t.timestamp).getTime()).filter(t => !isNaN(t));
        if (timestamps.length === 0) continue;
        const lastTripTime = Math.max(...timestamps);

        leaderboardData.push({
          riderId,
          name: riderData.location?.name || riderId,
          avgScore,
          bestScore,
          worstScore,
          totalTrips,
          totalDistance: parseFloat(totalDistance.toFixed(1)),
          lastTripTime: Math.max(...tripsList.map((t) => new Date(t.timestamp).getTime())),
        });
      }

      setRiders(leaderboardData);
      setError(null);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSortedRiders = () => {
    const sorted = [...riders];
    switch (sortBy) {
      case 'avgScore':
        return sorted.sort((a, b) => b.avgScore - a.avgScore);
      case 'totalTrips':
        return sorted.sort((a, b) => b.totalTrips - a.totalTrips);
      case 'totalDistance':
        return sorted.sort((a, b) => b.totalDistance - a.totalDistance);
      default:
        return sorted;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#1a7e32';
    if (score >= 70) return '#28a745';
    if (score >= 50) return '#ffc107';
    return '#dc3545';
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Eco Champion';
    if (score >= 70) return 'Good Riding';
    if (score >= 50) return 'Room to Improve';
    return 'Aggressive';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid time';
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'just now';
  };

  const sortedRiders = getSortedRiders();

  return (
    <div className="rider-leaderboard">
      <div className="leaderboard-header">
        <h2>🏆 Rider Leaderboard</h2>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="avgScore">Avg Eco Score</option>
          <option value="totalTrips">Most Trips</option>
          <option value="totalDistance">Most Distance</option>
        </select>
      </div>

      {error && <div className="error-box">⚠️ {error}</div>}

      {loading ? (
        <div className="loading">Loading leaderboard...</div>
      ) : sortedRiders.length === 0 ? (
        <div className="empty-state">No trips recorded yet. Start sharing to appear on the leaderboard!</div>
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
              <div key={rider.riderId} className={`leaderboard-row rank-${index}`}>
                <div className="col rank">
                  {index < 3 && <span className="medal">{medals[index]}</span>}
                  <span className="rank-number">#{index + 1}</span>
                </div>
                <div className="col name">{rider.name}</div>
                <div
                  className="col avg-score"
                  style={{ color: getScoreColor(rider.avgScore), fontWeight: '600' }}
                >
                  {rider.avgScore}
                  <span className="score-label">{getScoreLabel(rider.avgScore)}</span>
                </div>
                <div className="col trips">{rider.totalTrips}</div>
                <div className="col distance">{rider.totalDistance}</div>
                <div className="col last-trip">{formatTime(rider.lastTripTime)}</div>
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
              <span className="stat-value">{sortedRiders.reduce((sum, r) => sum + r.totalTrips, 0)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Combined Distance</span>
              <span className="stat-value">{sortedRiders.reduce((sum, r) => sum + r.totalDistance, 0).toFixed(1)} km</span>
            </div>
            <div className="stat">
              <span className="stat-label">Avg Eco Score</span>
              <span className="stat-value">
                {Math.round(sortedRiders.reduce((sum, r) => sum + r.avgScore, 0) / sortedRiders.length)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}