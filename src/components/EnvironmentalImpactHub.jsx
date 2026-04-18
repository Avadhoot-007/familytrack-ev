import React, { useState } from 'react';
import {
  calculateCO2Savings,
  calculateTreeEquivalents,
  getEcoBadges,
  getNextBadgeTarget,
  getCoachingTips,
  generateImpactReport,
  downloadTripPDF,
} from '../utils/ecoImpactCalculations';

const EnvironmentalImpactHub = ({ tripHistory = [], currentTrip = null, allRiders = [] }) => {
  const [viewMode, setViewMode] = useState('overview');
  const [showBadges, setShowBadges] = useState(false);
  const [showCoachingTips, setShowCoachingTips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Aggregate stats from trip history
  const totalDistance = tripHistory.reduce((sum, t) => sum + (t.distance || 0), 0);
  const avgEcoScore = tripHistory.length > 0
    ? Math.round(tripHistory.reduce((sum, t) => sum + (t.ecoScore || 0), 0) / tripHistory.length)
    : 0;

  const { savedCO2, petrolEquivalent } = calculateCO2Savings(totalDistance);
  const treeEquiv = calculateTreeEquivalents(savedCO2);
  const badges = getEcoBadges(savedCO2);
  const nextBadge = getNextBadgeTarget(savedCO2);

  // Coaching tips from historical data or current trip
  let currentTips = [];
  if (currentTrip) {
    const worstAxis = currentTrip.worstAxis || 'speed';
    currentTips = getCoachingTips(
      currentTrip.ecoScore || 0,
      worstAxis,
      currentTrip.avgSpeed || 0,
      currentTrip.throttle || [],
      currentTrip.distance || 0
    );
  } else if (tripHistory.length > 0) {
    // Use last trip data for tips
    const lastTrip = tripHistory[tripHistory.length - 1];
    const worstAxis = lastTrip.worstAxis || 'speed';
    currentTips = getCoachingTips(
      lastTrip.ecoScore || 0,
      worstAxis,
      lastTrip.avgSpeed || 0,
      lastTrip.throttle || [],
      lastTrip.distance || 0
    );
  } else {
    currentTips = getCoachingTips();
  }

  const unlockedBadges = badges.filter(b => b.unlocked);
  const nextUnlockedBadge = badges.find(b => !b.unlocked);

  // Leaderboard data from real riders
  const leaderboardData = allRiders && allRiders.length > 0
    ? allRiders
        .map(rider => ({
          rank: 0,
          rider: rider.name || 'Anonymous',
          co2Saved: rider.totalCO2 || 0,
          trees: calculateTreeEquivalents(rider.totalCO2 || 0),
          badge: rider.badge || '🌱',
        }))
        .sort((a, b) => b.co2Saved - a.co2Saved)
        .map((rider, idx) => ({ ...rider, rank: idx + 1 }))
    : [
        { rank: 1, rider: 'Eco Master', co2Saved: 250, trees: calculateTreeEquivalents(250), badge: '♻️' },
        { rank: 2, rider: 'Green Rider', co2Saved: 180, trees: calculateTreeEquivalents(180), badge: '🌲' },
        { rank: 3, rider: 'Smooth Driver', co2Saved: 150, trees: calculateTreeEquivalents(150), badge: '🌳' },
        { rank: 4, rider: 'Steady Hands', co2Saved: savedCO2, trees: treeEquiv, badge: unlockedBadges[unlockedBadges.length - 1]?.label || '🌱' },
      ];

  const handleExportTrip = (trip) => {
    downloadTripPDF(trip);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#1a1a1a', minHeight: '100vh', padding: '20px', color: '#e0e0e0' }}>
      <style>{`
        .eco-container { max-width: 1200px; margin: 0 auto; }
        .eco-card {
          background: #2a2a2a;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          border: 1px solid #404040;
        }
        .eco-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #4CAF50;
          padding-bottom: 15px;
        }
        .eco-metric {
          text-align: center;
          padding: 15px;
          background: linear-gradient(135deg, #1a7e32 0%, #28a745 100%);
          color: white;
          border-radius: 8px;
          margin-bottom: 10px;
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
        }
        .eco-metric-value { font-size: 28px; font-weight: bold; }
        .eco-metric-label { font-size: 12px; opacity: 0.85; margin-top: 5px; }
        .badge-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-top: 15px;
        }
        .badge-item {
          text-align: center;
          padding: 12px;
          border-radius: 8px;
          transition: transform 0.2s;
          cursor: pointer;
        }
        .badge-item:hover { transform: scale(1.05); }
        .badge-unlocked {
          background: linear-gradient(135deg, #ffc107 0%, #ffb300 100%);
          color: #1a1a1a;
          font-weight: bold;
          box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
        }
        .badge-locked {
          background: #404040;
          color: #888;
          border: 1px solid #555;
        }
        .badge-progress {
          font-size: 11px;
          margin-top: 5px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          height: 4px;
          overflow: hidden;
        }
        .badge-progress-bar {
          background: linear-gradient(90deg, #4CAF50, #66BB6A);
          height: 100%;
        }
        .impact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        .impact-box {
          background: linear-gradient(135deg, #2196F3 0%, #21cbf3 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
        }
        .impact-box h3 { margin: 0 0 10px; font-size: 14px; opacity: 0.9; }
        .impact-box .big-num { font-size: 32px; font-weight: bold; }
        .tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 1px solid #404040;
        }
        .tab {
          padding: 10px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #888;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
        }
        .tab.active {
          color: #4CAF50;
          border-bottom-color: #4CAF50;
        }
        .tab:hover { color: #aaa; }
        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
        }
        .leaderboard-table th {
          background: #1a1a1a;
          padding: 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #4CAF50;
          border-bottom: 2px solid #404040;
        }
        .leaderboard-table td {
          padding: 12px;
          border-bottom: 1px solid #404040;
          color: #e0e0e0;
        }
        .leaderboard-table tr:hover { background: #333; }
        .rank-badge { display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #ffc107, #ffb300); border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; color: #1a1a1a; font-size: 12px; }
        .coaching-card {
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
          color: white;
          padding: 15px;
          border-radius: 8px;
          margin-top: 15px;
          box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
        }
        .coaching-card h4 { margin: 0 0 8px; }
        .coaching-card p { margin: 0; font-size: 13px; }
        .btn-primary {
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
        }
        .btn-primary:hover { background: linear-gradient(135deg, #45a049, #3d8b40); }
        .btn-secondary {
          background: #404040;
          color: #e0e0e0;
          border: 1px solid #555;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-secondary:hover { background: #555; border-color: #666; }
        .btn-small {
          background: #404040;
          color: #e0e0e0;
          border: 1px solid #555;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
        }
        .btn-small:hover { background: #555; }
        .trip-card-action {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
      `}</style>

      <div className="eco-container">
        {/* Header */}
        <div className="eco-card eco-header">
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#4CAF50' }}>🌱 Environmental Impact Hub</h1>
            <p style={{ margin: '5px 0 0', color: '#888', fontSize: '13px' }}>
              Track your EV's positive impact on the planet
            </p>
          </div>
          <div style={{ fontSize: '48px' }}>♻️</div>
        </div>

        {/* Main Metrics */}
        <div className="eco-card">
          <h2 style={{ margin: '0 0 15px', fontSize: '18px' }}>Your Impact</h2>
          <div className="impact-grid">
            <div className="impact-box" style={{ background: 'linear-gradient(135deg, #1a7e32 0%, #28a745 100%)' }}>
              <h3>CO₂ Saved vs. Petrol</h3>
              <div className="big-num">{savedCO2.toFixed(1)} kg</div>
              <p style={{ margin: '8px 0 0', fontSize: '11px' }}>
                vs {petrolEquivalent.toFixed(1)} kg (petrol)
              </p>
            </div>
            <div className="impact-box" style={{ background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)' }}>
              <h3>Tree Equivalents</h3>
              <div className="big-num">{treeEquiv.toFixed(1)}</div>
              <p style={{ margin: '8px 0 0', fontSize: '11px' }}>
                annual absorption capacity
              </p>
            </div>
            <div className="impact-box" style={{ background: 'linear-gradient(135deg, #2196F3 0%, #64B5F6 100%)' }}>
              <h3>Total Distance</h3>
              <div className="big-num">{totalDistance.toFixed(1)} km</div>
              <p style={{ margin: '8px 0 0', fontSize: '11px' }}>
                across {tripHistory.length} trips
              </p>
            </div>
          </div>
        </div>

        {/* Badges Section */}
        <div className="eco-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>🏆 Carbon Offset Badges</h2>
            <button onClick={() => setShowBadges(!showBadges)} className="btn-secondary">
              {showBadges ? 'Hide' : 'View All'}
            </button>
          </div>

          {unlockedBadges.length > 0 && (
            <div>
              <p style={{ margin: '0 0 10px', color: '#888', fontSize: '12px' }}>Unlocked:</p>
              <div className="badge-grid">
                {unlockedBadges.map((b) => (
                  <div key={b.id} className="badge-item badge-unlocked">
                    <div style={{ fontSize: '24px' }}>{b.label.split(' ')[0]}</div>
                    <div style={{ fontSize: '10px', marginTop: '5px', fontWeight: 'normal' }}>{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nextUnlockedBadge && !nextBadge?.maxReached && (
            <div style={{ marginTop: '15px', padding: '15px', background: '#333', border: '1px solid #404040', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '600', color: '#4CAF50' }}>
                🎯 Next Badge: {nextUnlockedBadge.label}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#888' }}>
                {nextBadge?.remaining.toFixed(1)} kg CO₂ to go
              </p>
              <div style={{ background: '#404040', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    background: 'linear-gradient(90deg, #4CAF50, #66BB6A)',
                    height: '100%',
                    width: `${100 - (nextBadge?.remaining / nextUnlockedBadge.co2) * 100}%`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          )}

          {nextBadge?.maxReached && (
            <div style={{ marginTop: '15px', padding: '15px', background: 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#1a1a1a' }}>
                🎉 All Badges Unlocked! Carbon Champion!
              </p>
            </div>
          )}
        </div>

        {/* Coaching Tips */}
        {currentTips.length > 0 && (
          <div className="eco-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>💡 Coaching Tips</h2>
              <button onClick={() => setShowCoachingTips(!showCoachingTips)} className="btn-primary">
                {showCoachingTips ? 'Hide Tips' : 'Show Tips'}
              </button>
            </div>

            {showCoachingTips && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentTips.slice(0, 3).map((tip, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      background: '#333',
                      border: `2px solid ${
                        tip.priority === 'critical' ? '#dc3545' :
                        tip.priority === 'high' ? '#ff9800' :
                        tip.priority === 'info' ? '#2196F3' :
                        '#28a745'
                      }`,
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '18px' }}>{tip.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '13px', color: '#e0e0e0' }}>
                          {tip.title}
                        </p>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#aaa' }}>
                          {tip.tip}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
                          {tip.metric}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setViewMode('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`tab ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setViewMode('detailed')}
          >
            📈 Trip Details
          </button>
          <button
            className={`tab ${viewMode === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setViewMode('leaderboard')}
          >
            🏅 Leaderboard
          </button>
        </div>

        {/* Detailed View */}
        {viewMode === 'detailed' && (
          <div className="eco-card">
            <h2 style={{ margin: '0 0 15px', fontSize: '18px' }}>Trip History</h2>
            {tripHistory.length > 0 ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {tripHistory.slice().reverse().map((trip, idx) => {
                  const tripCO2 = calculateCO2Savings(trip.distance || 0).savedCO2;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        background: '#333',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        borderLeft: `4px solid ${trip.ecoScore >= 80 ? '#28a745' : trip.ecoScore >= 60 ? '#ffc107' : '#dc3545'}`,
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: '#888' }}>Distance</span>
                          <div style={{ fontWeight: '600', color: '#e0e0e0' }}>{trip.distance?.toFixed(1)} km</div>
                        </div>
                        <div>
                          <span style={{ color: '#888' }}>Eco Score</span>
                          <div style={{ fontWeight: '600', color: '#e0e0e0' }}>{trip.ecoScore}/100</div>
                        </div>
                        <div>
                          <span style={{ color: '#888' }}>CO₂ Saved</span>
                          <div style={{ fontWeight: '600', color: '#e0e0e0' }}>{tripCO2.toFixed(1)} kg</div>
                        </div>
                      </div>
                      <div className="trip-card-action">
                        <button
                          className="btn-small"
                          onClick={() => handleExportTrip(trip)}
                        >
                          📄 Export PDF
                        </button>
                        <button
                          className="btn-small"
                          onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
                          style={{ background: selectedTrip?.id === trip.id ? '#4CAF50' : '#404040' }}
                        >
                          {selectedTrip?.id === trip.id ? '✓ Details' : '👁 View'}
                        </button>
                      </div>
                      {selectedTrip?.id === trip.id && (
                        <div style={{ marginTop: '8px', padding: '8px', background: '#404040', borderRadius: '4px', fontSize: '11px', color: '#aaa' }}>
                          <p>⏱ Duration: {Math.floor((trip.duration || 0) / 60)}m {(trip.duration || 0) % 60}s</p>
                          <p>🚴 Avg Speed: {trip.avgSpeed?.toFixed(1)} km/h</p>
                          <p>🔋 Battery Used: {trip.batteryUsed || 0}%</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#666', textAlign: 'center', margin: '20px 0' }}>No trips recorded yet.</p>
            )}
          </div>
        )}

        {/* Leaderboard View */}
        {viewMode === 'leaderboard' && (
          <div className="eco-card">
            <h2 style={{ margin: '0 0 15px', fontSize: '18px' }}>🏅 Eco-Leaderboard</h2>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Rider</th>
                  <th>CO₂ Saved</th>
                  <th>Trees</th>
                  <th>Badge</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((entry) => (
                  <tr key={entry.rank}>
                    <td>
                      <span className="rank-badge">{entry.rank}</span>
                    </td>
                    <td style={{ fontWeight: entry.rank <= 3 ? '600' : '400' }}>{entry.rider}</td>
                    <td>{entry.co2Saved.toFixed(1)} kg</td>
                    <td>{entry.trees.toFixed(1)}</td>
                    <td>{entry.badge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', marginTop: '30px' }}>
          <p>Keep riding green! Every km counts toward a sustainable future. 🌍</p>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentalImpactHub;