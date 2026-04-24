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

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const totalDistance = tripHistory.reduce((sum, t) => sum + (t.distanceKm || t.distance || 0), 0);
  const totalTrips    = tripHistory.length;
  const avgEcoScore   = totalTrips > 0
    ? Math.round(tripHistory.reduce((sum, t) => sum + (t.score || t.ecoScore || 0), 0) / totalTrips)
    : 0;
  const bestEcoScore  = totalTrips > 0
    ? Math.max(...tripHistory.map(t => t.score || t.ecoScore || 0))
    : 0;
  const totalDuration = tripHistory.reduce((sum, t) => sum + (t.duration || t.durationSeconds || 0), 0);
  const totalDurationHrs = (totalDuration / 3600).toFixed(1);

  const { savedCO2, petrolEquivalent } = calculateCO2Savings(totalDistance);
  const treeEquiv   = calculateTreeEquivalents(savedCO2);
  const badges      = getEcoBadges(savedCO2);
  const nextBadge   = getNextBadgeTarget(savedCO2);

  // ── Coaching tips ────────────────────────────────────────────────────────
  let currentTips = [];
  if (currentTrip) {
    currentTips = getCoachingTips(
      currentTrip.ecoScore || 0,
      currentTrip.worstAxis || 'speed',
      currentTrip.avgSpeed || 0,
      currentTrip.throttle || [],
      currentTrip.distance || 0
    );
  } else if (totalTrips > 0) {
    const last = tripHistory[tripHistory.length - 1];
    currentTips = getCoachingTips(
      last.score || last.ecoScore || 0,
      last.worstAxis || 'speed',
      last.avgSpeed || 0,
      last.throttle || [],
      last.distanceKm || last.distance || 0
    );
  } else {
    currentTips = getCoachingTips();
  }

  const unlockedBadges    = badges.filter(b => b.unlocked);
  const nextUnlockedBadge = badges.find(b => !b.unlocked);

  // ── Leaderboard: aggregate from tripHistory by riderName ────────────────
  const riderMap = {};
  tripHistory.forEach(t => {
    const name = t.riderName || 'Unknown';
    if (!riderMap[name]) riderMap[name] = { name, co2: 0, trips: 0, totalScore: 0 };
    const dist = t.distanceKm || t.distance || 0;
    riderMap[name].co2        += calculateCO2Savings(dist).savedCO2;
    riderMap[name].trips      += 1;
    riderMap[name].totalScore += (t.score || t.ecoScore || 0);
  });
  const leaderboardData = Object.values(riderMap)
    .map(r => ({
      name:     r.name,
      co2Saved: parseFloat(r.co2.toFixed(2)),
      trees:    parseFloat(calculateTreeEquivalents(r.co2).toFixed(2)),
      trips:    r.trips,
      avgScore: r.trips > 0 ? Math.round(r.totalScore / r.trips) : 0,
    }))
    .sort((a, b) => b.co2Saved - a.co2Saved)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const handleExportTrip = (trip) => downloadTripPDF(trip);

  const scoreColor = (s) => s >= 80 ? '#4CAF50' : s >= 60 ? '#ffc107' : '#dc3545';

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#1a1a1a', minHeight: '100vh', padding: '20px', color: '#e0e0e0' }}>
      <style>{`
        .eco-card {
          background: #2a2a2a;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border: 1px solid #404040;
        }
        .eco-card h2 { color: #fff; margin: 0 0 16px; font-size: 18px; }
        .impact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
        }
        .impact-box {
          color: white; padding: 18px; border-radius: 10px;
          text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .impact-box h3 { margin: 0 0 8px; font-size: 13px; opacity: 0.9; font-weight: 500; }
        .impact-box .big-num { font-size: 28px; font-weight: bold; }
        .impact-box .sub { font-size: 11px; opacity: 0.8; margin-top: 4px; }
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-tile {
          background: #333; border: 1px solid #444; border-radius: 8px;
          padding: 14px; text-align: center;
        }
        .stat-tile .val  { font-size: 24px; font-weight: 700; color: #fff; }
        .stat-tile .lbl  { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
        .badge-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-top: 14px;
        }
        .badge-unlocked {
          background: linear-gradient(135deg, #ffc107, #ffb300);
          color: #1a1a1a; font-weight: bold;
          box-shadow: 0 4px 12px rgba(255,193,7,0.3);
          border-radius: 8px; padding: 12px; text-align: center; cursor: pointer;
          transition: transform 0.2s;
        }
        .badge-unlocked:hover { transform: scale(1.05); }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #404040; }
        .tab {
          padding: 10px 20px; background: none; border: none;
          cursor: pointer; font-size: 14px; font-weight: 500;
          color: #888; border-bottom: 3px solid transparent; transition: all 0.2s;
        }
        .tab.active { color: #4CAF50; border-bottom-color: #4CAF50; }
        .tab:hover  { color: #aaa; }
        .leaderboard-table { width: 100%; border-collapse: collapse; }
        .leaderboard-table th {
          background: #1a1a1a; padding: 12px; text-align: left;
          font-size: 12px; font-weight: 600; color: #4CAF50;
          border-bottom: 2px solid #404040;
        }
        .leaderboard-table td { padding: 12px; border-bottom: 1px solid #404040; color: #e0e0e0; }
        .leaderboard-table tr:hover { background: #333; }
        .rank-badge {
          display: inline-flex; width: 28px; height: 28px;
          background: linear-gradient(135deg, #ffc107, #ffb300);
          border-radius: 50%; align-items: center; justify-content: center;
          font-weight: bold; color: #1a1a1a; font-size: 12px;
        }
        .coaching-tip-row {
          padding: 12px; background: #333;
          border-radius: 8px; margin-bottom: 10px;
          display: flex; gap: 10px; align-items: flex-start;
        }
        .btn-primary {
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white; border: none; padding: 10px 20px;
          border-radius: 6px; cursor: pointer; font-size: 13px;
          font-weight: 600; transition: all 0.2s;
        }
        .btn-secondary {
          background: #404040; color: #e0e0e0; border: 1px solid #555;
          padding: 10px 20px; border-radius: 6px; cursor: pointer;
          font-size: 13px; font-weight: 600; transition: all 0.2s;
        }
        .btn-small {
          background: #404040; color: #e0e0e0; border: 1px solid #555;
          padding: 5px 10px; border-radius: 4px; cursor: pointer;
          font-size: 11px; transition: all 0.2s;
        }
        .btn-small:hover { background: #555; }
        .trip-card {
          padding: 14px; background: #333; border-radius: 8px;
          margin-bottom: 10px;
        }
        .trip-card-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(100px,1fr));
          gap: 10px; margin-bottom: 8px;
        }
        .trip-card-field { font-size: 12px; }
        .trip-card-field .f-label { color: #888; margin-bottom: 2px; }
        .trip-card-field .f-val   { font-weight: 600; color: #e0e0e0; }
        .no-data { color: #666; text-align: center; padding: 30px 0; font-size: 14px; }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="eco-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: '2px solid #4CAF50', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#4CAF50' }}>🌱 Environmental Impact Hub</h1>
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>Track your EV's positive impact on the planet</p>
          </div>
          <div style={{ fontSize: '44px' }}>♻️</div>
        </div>

        {/* ── Always-visible top metrics ──────────────────────────────────── */}
        <div className="eco-card">
          <h2>Your Impact</h2>
          <div className="impact-grid">
            <div className="impact-box" style={{ background: 'linear-gradient(135deg,#1a7e32,#28a745)' }}>
              <h3>CO₂ Saved vs Petrol</h3>
              <div className="big-num">{savedCO2.toFixed(2)} kg</div>
              <div className="sub">Petrol would emit {petrolEquivalent.toFixed(2)} kg</div>
            </div>
            <div className="impact-box" style={{ background: 'linear-gradient(135deg,#4CAF50,#66BB6A)' }}>
              <h3>Tree Equivalents</h3>
              <div className="big-num">{treeEquiv.toFixed(2)}</div>
              <div className="sub">annual absorption capacity</div>
            </div>
            <div className="impact-box" style={{ background: 'linear-gradient(135deg,#2196F3,#64B5F6)' }}>
              <h3>Total Distance</h3>
              <div className="big-num">{totalDistance.toFixed(1)} km</div>
              <div className="sub">across {totalTrips} trip{totalTrips !== 1 ? 's' : ''}</div>
            </div>
            <div className="impact-box" style={{ background: 'linear-gradient(135deg,#9c27b0,#ba68c8)' }}>
              <h3>Avg Eco Score</h3>
              <div className="big-num">{avgEcoScore}/100</div>
              <div className="sub">best: {bestEcoScore}</div>
            </div>
          </div>
        </div>

        {/* ── Badges ─────────────────────────────────────────────────────── */}
        <div className="eco-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <h2 style={{ margin: 0 }}>🏆 Carbon Offset Badges</h2>
            <button className="btn-secondary" onClick={() => setShowBadges(!showBadges)}>
              {showBadges ? 'Hide' : 'View All'}
            </button>
          </div>
          {unlockedBadges.length > 0 ? (
            <div className="badge-grid">
              {unlockedBadges.map(b => (
                <div key={b.id} className="badge-unlocked">
                  <div style={{ fontSize:'22px', marginBottom:'4px' }}>🏅</div>
                  <div style={{ fontSize:'12px' }}>{b.label}</div>
                  <div style={{ fontSize:'10px', fontWeight:'normal', marginTop:'2px', opacity:0.8 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color:'#666', fontSize:'13px', margin:0 }}>Complete trips to unlock badges.</p>
          )}
          {nextUnlockedBadge && !nextBadge?.maxReached && (
            <div style={{ marginTop:'14px', padding:'14px', background:'#333', border:'1px solid #404040', borderRadius:'8px' }}>
              <p style={{ margin:'0 0 6px', fontSize:'12px', fontWeight:'600', color:'#4CAF50' }}>
                🎯 Next: {nextUnlockedBadge.label} — {nextBadge?.remaining.toFixed(2)} kg CO₂ to go
              </p>
              <div style={{ background:'#404040', borderRadius:'4px', height:'8px', overflow:'hidden' }}>
                <div style={{
                  background: 'linear-gradient(90deg,#4CAF50,#66BB6A)',
                  height: '100%',
                  width: `${Math.max(0, 100 - (nextBadge?.remaining / nextUnlockedBadge.co2) * 100)}%`,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
          {nextBadge?.maxReached && (
            <div style={{ marginTop:'14px', padding:'14px', background:'linear-gradient(135deg,#ffc107,#ffb300)', borderRadius:'8px', textAlign:'center' }}>
              <p style={{ margin:0, fontSize:'13px', fontWeight:'600', color:'#1a1a1a' }}>🎉 All Badges Unlocked! Carbon Champion!</p>
            </div>
          )}
        </div>

        {/* ── Coaching Tips ───────────────────────────────────────────────── */}
        {currentTips.length > 0 && (
          <div className="eco-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <h2 style={{ margin:0 }}>💡 Coaching Tips</h2>
              <button className="btn-primary" onClick={() => setShowCoachingTips(!showCoachingTips)}>
                {showCoachingTips ? 'Hide Tips' : 'Show Tips'}
              </button>
            </div>
            {showCoachingTips && currentTips.slice(0, 3).map((tip, i) => (
              <div key={i} className="coaching-tip-row" style={{
                borderLeft: `3px solid ${
                  tip.priority === 'critical' ? '#dc3545' :
                  tip.priority === 'high'     ? '#ff9800' :
                  tip.priority === 'info'     ? '#2196F3' : '#28a745'
                }`,
              }}>
                <span style={{ fontSize:'20px' }}>{tip.icon}</span>
                <div>
                  <p style={{ margin:'0 0 3px', fontWeight:'600', fontSize:'13px', color:'#fff' }}>{tip.title}</p>
                  <p style={{ margin:'0 0 3px', fontSize:'12px', color:'#aaa' }}>{tip.tip}</p>
                  <p style={{ margin:0, fontSize:'11px', color:'#777' }}>{tip.metric}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="tabs">
          <button className={`tab ${viewMode === 'overview'   ? 'active' : ''}`} onClick={() => setViewMode('overview')}>📊 Overview</button>
          <button className={`tab ${viewMode === 'detailed'   ? 'active' : ''}`} onClick={() => setViewMode('detailed')}>📈 Trip Details</button>
          <button className={`tab ${viewMode === 'leaderboard'? 'active' : ''}`} onClick={() => setViewMode('leaderboard')}>🏅 Leaderboard</button>
        </div>

        {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
        {viewMode === 'overview' && (
          <div className="eco-card">
            <h2>Riding Summary</h2>
            {totalTrips === 0 ? (
              <p className="no-data">No trips recorded yet. Start a trip or simulate one.</p>
            ) : (
              <>
                <div className="overview-grid">
                  <div className="stat-tile">
                    <div className="val">{totalTrips}</div>
                    <div className="lbl">Total Trips</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val">{totalDistance.toFixed(1)} km</div>
                    <div className="lbl">Distance</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val">{totalDurationHrs} h</div>
                    <div className="lbl">Time Riding</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val" style={{ color: scoreColor(avgEcoScore) }}>{avgEcoScore}</div>
                    <div className="lbl">Avg Eco Score</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val" style={{ color: '#4CAF50' }}>{bestEcoScore}</div>
                    <div className="lbl">Best Score</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val">{savedCO2.toFixed(2)} kg</div>
                    <div className="lbl">CO₂ Saved</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val">{treeEquiv.toFixed(2)}</div>
                    <div className="lbl">Tree Equiv.</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val">{unlockedBadges.length}</div>
                    <div className="lbl">Badges Earned</div>
                  </div>
                </div>

                {/* Score distribution */}
                <h2 style={{ marginBottom:'12px' }}>Score Distribution</h2>
                {(() => {
                  const eco        = tripHistory.filter(t => (t.score || t.ecoScore || 0) >= 80).length;
                  const good       = tripHistory.filter(t => { const s = t.score || t.ecoScore || 0; return s >= 60 && s < 80; }).length;
                  const poor       = tripHistory.filter(t => (t.score || t.ecoScore || 0) < 60).length;
                  const pct = (n) => totalTrips > 0 ? Math.round((n / totalTrips) * 100) : 0;
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {[
                        { label:'Eco (80+)',  count: eco,  color:'#4CAF50' },
                        { label:'Good (60–79)',count: good, color:'#ffc107' },
                        { label:'Poor (<60)', count: poor, color:'#dc3545' },
                      ].map(row => (
                        <div key={row.label}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                            <span style={{ color:'#ccc' }}>{row.label}</span>
                            <span style={{ color: row.color }}>{row.count} trips ({pct(row.count)}%)</span>
                          </div>
                          <div style={{ background:'#404040', borderRadius:'4px', height:'8px', overflow:'hidden' }}>
                            <div style={{ background: row.color, height:'100%', width:`${pct(row.count)}%`, transition:'width 0.3s' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Recent 3 trips quick view */}
                <h2 style={{ margin:'20px 0 12px' }}>Recent Trips</h2>
                {tripHistory.slice(-3).reverse().map((t, i) => {
                  const s    = t.score || t.ecoScore || 0;
                  const dist = (t.distanceKm || t.distance || 0).toFixed(2);
                  const dur  = Math.floor((t.duration || t.durationSeconds || 0) / 60);
                  const name = t.riderName || 'Rider';
                  const date = new Date(t.timestamp);
                  const dateStr = isNaN(date) ? '—' : date.toLocaleDateString();
                  return (
                    <div key={i} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'10px 12px', background:'#333', borderRadius:'6px',
                      marginBottom:'8px', borderLeft:`3px solid ${scoreColor(s)}`,
                    }}>
                      <div>
                        <span style={{ fontWeight:'600', color:'#fff', fontSize:'13px' }}>{name}</span>
                        <span style={{ color:'#888', fontSize:'11px', marginLeft:'8px' }}>{dateStr}</span>
                      </div>
                      <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:'#bbb' }}>
                        <span>📏 {dist} km</span>
                        <span>⏱ {dur}m</span>
                        <span style={{ color: scoreColor(s), fontWeight:'600' }}>🌿 {s}/100</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── TRIP DETAILS TAB ────────────────────────────────────────────── */}
        {viewMode === 'detailed' && (
          <div className="eco-card">
            <h2>Trip History</h2>
            {totalTrips === 0 ? (
              <p className="no-data">No trips recorded yet.</p>
            ) : (
              <div style={{ maxHeight:'500px', overflowY:'auto' }}>
                {tripHistory.slice().reverse().map((trip, idx) => {
                  const s        = trip.score || trip.ecoScore || 0;
                  const dist     = (trip.distanceKm || trip.distance || 0);
                  const dur      = trip.duration || trip.durationSeconds || 0;
                  const speed    = trip.avgSpeed || trip.avgSpeedKmh || 0;
                  const battery  = trip.batteryUsed || trip.batteryUsedPercent || 0;
                  const name     = trip.riderName || 'Rider';
                  const co2      = calculateCO2Savings(dist).savedCO2;
                  const date     = new Date(trip.timestamp);
                  const dateStr  = isNaN(date) ? '—' : date.toLocaleDateString();
                  const timeStr  = isNaN(date) ? '' : date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

                  return (
                    <div key={idx} className="trip-card" style={{ borderLeft:`4px solid ${scoreColor(s)}` }}>
                      {/* Header row: rider + date */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                        <div>
                          <span style={{ fontWeight:'700', color:'#fff', fontSize:'14px' }}>{name}</span>
                          {trip.isSimulated && (
                            <span style={{ marginLeft:'8px', fontSize:'10px', background:'#404040', color:'#aaa', padding:'2px 6px', borderRadius:'4px' }}>SIM</span>
                          )}
                        </div>
                        <span style={{ color:'#888', fontSize:'11px' }}>{dateStr} {timeStr}</span>
                      </div>

                      {/* Stats grid */}
                      <div className="trip-card-grid">
                        <div className="trip-card-field">
                          <div className="f-label">Distance</div>
                          <div className="f-val">{dist.toFixed(2)} km</div>
                        </div>
                        <div className="trip-card-field">
                          <div className="f-label">Duration</div>
                          <div className="f-val">{Math.floor(dur/60)}m {dur%60}s</div>
                        </div>
                        <div className="trip-card-field">
                          <div className="f-label">Avg Speed</div>
                          <div className="f-val">{parseFloat(speed).toFixed(1)} km/h</div>
                        </div>
                        <div className="trip-card-field">
                          <div className="f-label">Eco Score</div>
                          <div className="f-val" style={{ color: scoreColor(s) }}>{s}/100</div>
                        </div>
                        <div className="trip-card-field">
                          <div className="f-label">CO₂ Saved</div>
                          <div className="f-val">{co2.toFixed(2)} kg</div>
                        </div>
                        <div className="trip-card-field">
                          <div className="f-label">Battery Used</div>
                          <div className="f-val">{parseFloat(battery).toFixed(1)}%</div>
                        </div>
                        {trip.worstAxis && (
                          <div className="trip-card-field">
                            <div className="f-label">Focus Area</div>
                            <div className="f-val" style={{ textTransform:'capitalize' }}>{trip.worstAxis}</div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                        <button className="btn-small" onClick={() => handleExportTrip(trip)}>📄 Export PDF</button>
                        <button
                          className="btn-small"
                          onClick={() => setSelectedTrip(selectedTrip?.timestamp === trip.timestamp ? null : trip)}
                          style={{ background: selectedTrip?.timestamp === trip.timestamp ? '#4CAF50' : '#404040' }}
                        >
                          {selectedTrip?.timestamp === trip.timestamp ? '▲ Less' : '▼ More'}
                        </button>
                      </div>

                      {/* Expanded detail */}
                      {selectedTrip?.timestamp === trip.timestamp && (
                        <div style={{ marginTop:'10px', padding:'10px', background:'#2a2a2a', borderRadius:'6px', fontSize:'12px', color:'#aaa', lineHeight:'1.7' }}>
                          <div>🛢 Ride Style: <strong style={{ color:'#e0e0e0', textTransform:'capitalize' }}>{trip.rideStyle || '—'}</strong></div>
                          <div>⚡ Consumption: <strong style={{ color:'#e0e0e0' }}>{trip.consumptionWh || trip.consumptionWh || '—'} Wh/km</strong></div>
                          <div>🔋 Battery Remaining: <strong style={{ color:'#e0e0e0' }}>{trip.batteryRemaining ?? '—'}%</strong></div>
                          <div>🌲 Tree Equiv: <strong style={{ color:'#4CAF50' }}>{calculateTreeEquivalents(co2).toFixed(3)}</strong></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LEADERBOARD TAB ─────────────────────────────────────────────── */}
        {viewMode === 'leaderboard' && (
          <div className="eco-card">
            <h2>🏅 Eco Leaderboard</h2>
            {leaderboardData.length === 0 ? (
              <p className="no-data">No trip data yet — complete or simulate a trip to appear here.</p>
            ) : (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Rider</th>
                    <th>CO₂ Saved</th>
                    <th>Tree Equiv.</th>
                    <th>Trips</th>
                    <th>Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.map(entry => (
                    <tr key={entry.rank}>
                      <td>
                        {entry.rank <= 3
                          ? <span className="rank-badge">{['🥇','🥈','🥉'][entry.rank-1]}</span>
                          : <span style={{ color:'#888' }}>#{entry.rank}</span>}
                      </td>
                      <td style={{ fontWeight: entry.rank <= 3 ? '700' : '400', color:'#fff' }}>{entry.name}</td>
                      <td>{entry.co2Saved} kg</td>
                      <td>{entry.trees}</td>
                      <td>{entry.trips}</td>
                      <td style={{ color: scoreColor(entry.avgScore), fontWeight:'600' }}>{entry.avgScore}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <p style={{ textAlign:'center', color:'#555', fontSize:'12px', marginTop:'20px' }}>
          Keep riding green! Every km counts. 🌍
        </p>
      </div>
    </div>
  );
};

export default EnvironmentalImpactHub;