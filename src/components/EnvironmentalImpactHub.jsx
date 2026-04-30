import React, { useState, useEffect, useRef } from "react";
import {
  calculateCO2Savings,
  calculateTreeEquivalents,
  getEcoBadges,
  getNextBadgeTarget,
  getCoachingTips,
  generateImpactReport,
  downloadTripPDF,
} from "../utils/ecoImpactCalculations";

// ---------------------------------------------------------------------------
// Badge unlock animation overlay
// ---------------------------------------------------------------------------
function BadgeUnlockOverlay({ badge, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        animation: "badgeOverlayIn 0.3s ease",
      }}
    >
      <div
        style={{
          textAlign: "center",
          animation: "badgeBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          style={{
            fontSize: "80px",
            lineHeight: 1,
            marginBottom: "16px",
            animation: "badgeSpin 0.6s ease 0.2s both",
          }}
        >
          🏅
        </div>
        <div
          style={{
            background: "linear-gradient(135deg,#ffc107,#ffb300)",
            color: "#1a1a1a",
            borderRadius: "16px",
            padding: "20px 32px",
            boxShadow: "0 8px 40px rgba(255,193,7,0.5)",
            animation: "badgeGlow 1s ease infinite alternate",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "13px",
              fontWeight: "600",
              opacity: 0.7,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Badge Unlocked!
          </p>
          <h2
            style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: "800" }}
          >
            {badge.label}
          </h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.85 }}>
            {badge.desc}
          </p>
        </div>
        <p style={{ color: "#888", fontSize: "12px", marginTop: "16px" }}>
          Tap anywhere to continue
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Social Share Modal
// ---------------------------------------------------------------------------
function ShareModal({ isOpen, onClose, stats }) {
  const [copied, setCopied] = useState(false);
  const [shareState, setShareState] = useState("idle"); // idle | sharing | done | error

  if (!isOpen) return null;

  const {
    savedCO2,
    treeEquiv,
    totalDistance,
    totalTrips,
    avgEcoScore,
    bestEcoScore,
    unlockedBadges,
  } = stats;

  const shareText = `🌱 My EV Impact on FamilyTrack EV

♻️ CO₂ Saved: ${savedCO2} kg
🌳 Tree Equivalents: ${treeEquiv}
📏 Total Distance: ${totalDistance} km
🚴 Trips Completed: ${totalTrips}
🌿 Avg Eco Score: ${avgEcoScore}/100
⭐ Best Score: ${bestEcoScore}/100${unlockedBadges.length > 0 ? `\n🏅 Badges: ${unlockedBadges.map((b) => b.label).join(", ")}` : ""}

Riding green every day! 🔋⚡`;

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    setShareState("sharing");
    try {
      await navigator.share({
        title: "My EV Environmental Impact",
        text: shareText,
      });
      setShareState("done");
      setTimeout(() => setShareState("idle"), 2000);
    } catch (e) {
      if (e.name !== "AbortError") setShareState("error");
      else setShareState("idle");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = shareText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
    );
  };

  const handleTwitter = () => {
    const tweet = `🌱 I've saved ${savedCO2} kg CO₂ riding my EV! That's ${treeEquiv} tree equivalents 🌳 Eco Score: ${avgEcoScore}/100 #EVRiding #GreenCommute #FamilyTrackEV`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
      "_blank",
    );
  };

  const handleTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent("https://familytrack-ev.web.app")}&text=${encodeURIComponent(shareText)}`,
      "_blank",
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e1e1e",
          borderRadius: "16px",
          padding: "28px 24px",
          maxWidth: "420px",
          width: "100%",
          border: "1px solid #333",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, color: "#fff", fontSize: "18px" }}>
            🌱 Share Your Impact
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              fontSize: "22px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Preview card */}
        <div
          style={{
            background: "linear-gradient(135deg, #1a3a1a, #2a2a2a)",
            border: "1px solid #2a5a2a",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              color: "#4CAF50",
              fontWeight: "700",
              fontSize: "15px",
            }}
          >
            🌱 My EV Impact
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {[
              { icon: "♻️", label: "CO₂ Saved", val: `${savedCO2} kg` },
              { icon: "🌳", label: "Tree Equiv.", val: treeEquiv },
              { icon: "📏", label: "Distance", val: `${totalDistance} km` },
              { icon: "🌿", label: "Eco Score", val: `${avgEcoScore}/100` },
            ].map(({ icon, label, val }) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                  padding: "10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>
                  {icon}
                </div>
                <div
                  style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}
                >
                  {val}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#888",
                    textTransform: "uppercase",
                    marginTop: "2px",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          {unlockedBadges.length > 0 && (
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
              }}
            >
              {unlockedBadges.map((b) => (
                <span
                  key={b.id}
                  style={{
                    fontSize: "11px",
                    background: "rgba(255,193,7,0.15)",
                    border: "1px solid rgba(255,193,7,0.3)",
                    color: "#ffc107",
                    borderRadius: "12px",
                    padding: "2px 8px",
                  }}
                >
                  🏅 {b.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Share buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Native share — mobile only */}
          {navigator.share && (
            <button
              onClick={handleNativeShare}
              style={{
                width: "100%",
                padding: "12px",
                border: "none",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #4CAF50, #45a049)",
                color: "#fff",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              {shareState === "sharing"
                ? "⏳ Sharing..."
                : shareState === "done"
                  ? "✓ Shared!"
                  : "📤 Share via..."}
            </button>
          )}

          {/* Platform buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
            }}
          >
            <button onClick={handleWhatsApp} style={platformBtn("#25D366")}>
              <span style={{ fontSize: "20px" }}>💬</span>
              <span style={{ fontSize: "11px" }}>WhatsApp</span>
            </button>
            <button onClick={handleTwitter} style={platformBtn("#1DA1F2")}>
              <span style={{ fontSize: "20px" }}>🐦</span>
              <span style={{ fontSize: "11px" }}>Twitter / X</span>
            </button>
            <button onClick={handleTelegram} style={platformBtn("#0088cc")}>
              <span style={{ fontSize: "20px" }}>✈️</span>
              <span style={{ fontSize: "11px" }}>Telegram</span>
            </button>
          </div>

          {/* Copy text */}
          <button
            onClick={handleCopy}
            style={{
              width: "100%",
              padding: "11px",
              border: "1px solid #444",
              borderRadius: "8px",
              background: copied ? "#1a3a1a" : "#2a2a2a",
              color: copied ? "#4CAF50" : "#ccc",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copied ? "✓ Copied to clipboard!" : "📋 Copy text"}
          </button>
        </div>
      </div>
    </div>
  );
}

const platformBtn = (color) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  padding: "10px 6px",
  background: `${color}22`,
  border: `1px solid ${color}55`,
  borderRadius: "8px",
  color: "#e0e0e0",
  cursor: "pointer",
  transition: "background 0.2s",
  fontFamily: "Arial, sans-serif",
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const EnvironmentalImpactHub = ({
  tripHistory = [],
  currentTrip = null,
  allRiders = [],
}) => {
  const [viewMode, setViewMode] = useState("overview");
  const [showBadges, setShowBadges] = useState(false);
  const [showCoachingTips, setShowCoachingTips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripLimit, setTripLimit] = useState(5);
  const [showShareModal, setShowShareModal] = useState(false);

  // Badge animation state
  const [newlyUnlocked, setNewlyUnlocked] = useState(null);
  const prevUnlockedIdsRef = useRef(null);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const totalDistance = tripHistory.reduce(
    (sum, t) => sum + (t.distanceKm || t.distance || 0),
    0,
  );
  const totalTrips = tripHistory.length;
  const avgEcoScore =
    totalTrips > 0
      ? Math.round(
          tripHistory.reduce(
            (sum, t) => sum + (t.score || t.ecoScore || 0),
            0,
          ) / totalTrips,
        )
      : 0;
  const bestEcoScore =
    totalTrips > 0
      ? Math.max(...tripHistory.map((t) => t.score || t.ecoScore || 0))
      : 0;
  const totalDuration = tripHistory.reduce(
    (sum, t) => sum + (t.duration || t.durationSeconds || 0),
    0,
  );
  const totalDurationHrs = (totalDuration / 3600).toFixed(1);

  const { savedCO2, petrolEquivalent } = calculateCO2Savings(totalDistance);
  const treeEquiv = calculateTreeEquivalents(savedCO2);
  const badges = getEcoBadges(savedCO2);
  const nextBadge = getNextBadgeTarget(savedCO2);

  // ── Detect newly unlocked badges ─────────────────────────────────────────
  useEffect(() => {
    const currentUnlockedIds = new Set(
      badges.filter((b) => b.unlocked).map((b) => b.id),
    );
    if (prevUnlockedIdsRef.current === null) {
      prevUnlockedIdsRef.current = currentUnlockedIds;
      return;
    }
    for (const id of currentUnlockedIds) {
      if (!prevUnlockedIdsRef.current.has(id)) {
        const badge = badges.find((b) => b.id === id);
        if (badge) setNewlyUnlocked(badge);
        break;
      }
    }
    prevUnlockedIdsRef.current = currentUnlockedIds;
  }, [savedCO2]);

  // ── Coaching tips ────────────────────────────────────────────────────────
  let currentTips = [];
  if (currentTrip) {
    currentTips = getCoachingTips(
      currentTrip.ecoScore || 0,
      currentTrip.worstAxis || "speed",
      currentTrip.avgSpeed || 0,
      currentTrip.throttle || [],
      currentTrip.distance || 0,
    );
  } else if (totalTrips > 0) {
    const last = tripHistory[tripHistory.length - 1];
    currentTips = getCoachingTips(
      last.score || last.ecoScore || 0,
      last.worstAxis || "speed",
      last.avgSpeed || 0,
      last.throttle || [],
      last.distanceKm || last.distance || 0,
    );
  } else {
    currentTips = getCoachingTips();
  }

  const unlockedBadges = badges.filter((b) => b.unlocked);

  // ── Leaderboard ──────────────────────────────────────────────────────────
  const riderMap = {};
  tripHistory.forEach((t) => {
    const name = t.riderName || "Unknown";
    if (!riderMap[name])
      riderMap[name] = { name, co2: 0, trips: 0, totalScore: 0 };
    const dist = t.distanceKm || t.distance || 0;
    riderMap[name].co2 += calculateCO2Savings(dist).savedCO2;
    riderMap[name].trips += 1;
    riderMap[name].totalScore += t.score || t.ecoScore || 0;
  });
  const leaderboardData = Object.values(riderMap)
    .map((r) => ({
      name: r.name,
      co2Saved: parseFloat(r.co2.toFixed(2)),
      trees: parseFloat(calculateTreeEquivalents(r.co2).toFixed(2)),
      trips: r.trips,
      avgScore: r.trips > 0 ? Math.round(r.totalScore / r.trips) : 0,
    }))
    .sort((a, b) => b.co2Saved - a.co2Saved)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const handleExportTrip = (trip) => downloadTripPDF(trip);
  const scoreColor = (s) =>
    s >= 80 ? "#4CAF50" : s >= 60 ? "#ffc107" : "#dc3545";

  const shareStats = {
    savedCO2: savedCO2.toFixed(2),
    treeEquiv: treeEquiv.toFixed(2),
    totalDistance: totalDistance.toFixed(1),
    totalTrips,
    avgEcoScore,
    bestEcoScore,
    unlockedBadges,
  };

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#1a1a1a",
        minHeight: "100vh",
        padding: "20px",
        color: "#e0e0e0",
      }}
    >
      {newlyUnlocked && (
        <BadgeUnlockOverlay
          badge={newlyUnlocked}
          onDone={() => setNewlyUnlocked(null)}
        />
      )}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        stats={shareStats}
      />

      <style>{`
        @keyframes badgeOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes badgeBounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes badgeSpin {
          from { transform: rotate(-20deg) scale(0.8); }
          to   { transform: rotate(0deg) scale(1); }
        }
        @keyframes badgeGlow {
          from { box-shadow: 0 8px 40px rgba(255,193,7,0.4); }
          to   { box-shadow: 0 8px 60px rgba(255,193,7,0.8); }
        }
        @keyframes badgeCardPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,193,7,0); }
          50%       { box-shadow: 0 0 0 8px rgba(255,193,7,0.25); }
        }
        .badge-new { animation: badgeCardPulse 1.5s ease 3; }
        .eco-card {
          background: #2a2a2a; border-radius: 12px; padding: 20px;
          margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border: 1px solid #404040;
        }
        .eco-card h2 { color: #fff; margin: 0 0 16px; font-size: 18px; }
        .impact-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;
        }
        .impact-box {
          color: white; padding: 18px; border-radius: 10px;
          text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .impact-box h3 { margin: 0 0 8px; font-size: 13px; opacity: 0.9; font-weight: 500; }
        .impact-box .big-num { font-size: 28px; font-weight: bold; }
        .impact-box .sub { font-size: 11px; opacity: 0.8; margin-top: 4px; }
        .overview-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px; margin-bottom: 20px;
        }
        .stat-tile {
          background: #333; border: 1px solid #444; border-radius: 8px;
          padding: 14px; text-align: center;
        }
        .stat-tile .val { font-size: 24px; font-weight: 700; color: #fff; }
        .stat-tile .lbl { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
        .badge-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 10px; margin-top: 14px;
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
          padding: 10px 20px; background: none; border: none; cursor: pointer;
          font-size: 14px; font-weight: 500; color: #888;
          border-bottom: 3px solid transparent; transition: all 0.2s;
        }
        .tab.active { color: #4CAF50; border-bottom-color: #4CAF50; }
        .tab:hover  { color: #aaa; }
        .leaderboard-table { width: 100%; border-collapse: collapse; }
        .leaderboard-table th {
          background: #1a1a1a; padding: 12px; text-align: left;
          font-size: 12px; font-weight: 600; color: #4CAF50; border-bottom: 2px solid #404040;
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
          padding: 12px; background: #333; border-radius: 8px; margin-bottom: 10px;
          display: flex; gap: 10px; align-items: flex-start;
        }
        .btn-primary {
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white; border: none; padding: 10px 20px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;
        }
        .btn-secondary {
          background: #404040; color: #e0e0e0; border: 1px solid #555;
          padding: 10px 20px; border-radius: 6px; cursor: pointer;
          font-size: 13px; font-weight: 600; transition: all 0.2s;
        }
        .btn-share {
          background: linear-gradient(135deg, #1a7e32, #28a745);
          color: white; border: none; padding: 10px 20px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;
          transition: all 0.2s; display: flex; align-items: center; gap: 6px;
        }
        .btn-share:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(40,167,69,0.4); }
        .btn-small {
          background: #404040; color: #e0e0e0; border: 1px solid #555;
          padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;
        }
        .btn-small:hover { background: #555; }
        .trip-card { padding: 14px; background: #333; border-radius: 8px; margin-bottom: 10px; }
        .trip-card-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(100px,1fr));
          gap: 10px; margin-bottom: 8px;
        }
        .trip-card-field { font-size: 12px; }
        .trip-card-field .f-label { color: #888; margin-bottom: 2px; }
        .trip-card-field .f-val   { font-weight: 600; color: #e0e0e0; }
        .no-data { color: #666; text-align: center; padding: 30px 0; font-size: 14px; }
      `}</style>

      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="eco-card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid #4CAF50",
            paddingBottom: "16px",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", color: "#4CAF50" }}>
              🌱 Environmental Impact Hub
            </h1>
            <p style={{ margin: "4px 0 0", color: "#888", fontSize: "13px" }}>
              Track your EV's positive impact on the planet
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="btn-share"
              onClick={() => setShowShareModal(true)}
              disabled={totalTrips === 0}
              style={{
                opacity: totalTrips === 0 ? 0.4 : 1,
                cursor: totalTrips === 0 ? "not-allowed" : "pointer",
              }}
            >
              📤 Share Impact
            </button>
            <div style={{ fontSize: "44px" }}>♻️</div>
          </div>
        </div>

        {/* ── Top metrics ────────────────────────────────────────────────── */}
        <div className="eco-card">
          <h2>Your Impact</h2>
          <div className="impact-grid">
            <div
              className="impact-box"
              style={{ background: "linear-gradient(135deg,#1a7e32,#28a745)" }}
            >
              <h3>CO₂ Saved vs Petrol</h3>
              <div className="big-num">{savedCO2.toFixed(2)} kg</div>
              <div className="sub">
                Petrol would emit {petrolEquivalent.toFixed(2)} kg
              </div>
            </div>
            <div
              className="impact-box"
              style={{ background: "linear-gradient(135deg,#4CAF50,#66BB6A)" }}
            >
              <h3>Tree Equivalents</h3>
              <div className="big-num">{treeEquiv.toFixed(2)}</div>
              <div className="sub">annual absorption capacity</div>
            </div>
            <div
              className="impact-box"
              style={{ background: "linear-gradient(135deg,#2196F3,#64B5F6)" }}
            >
              <h3>Total Distance</h3>
              <div className="big-num">{totalDistance.toFixed(1)} km</div>
              <div className="sub">
                across {totalTrips} trip{totalTrips !== 1 ? "s" : ""}
              </div>
            </div>
            <div
              className="impact-box"
              style={{ background: "linear-gradient(135deg,#9c27b0,#ba68c8)" }}
            >
              <h3>Avg Eco Score</h3>
              <div className="big-num">{avgEcoScore}/100</div>
              <div className="sub">best: {bestEcoScore}</div>
            </div>
          </div>
        </div>

        {/* ── Badges ─────────────────────────────────────────────────────── */}
        <div className="eco-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <h2 style={{ margin: 0 }}>🏆 Carbon Offset Badges</h2>
            <button
              className="btn-secondary"
              onClick={() => setShowBadges(!showBadges)}
            >
              {showBadges ? "Hide" : "View All"}
            </button>
          </div>

          {unlockedBadges.length > 0 ? (
            <>
              <p
                style={{
                  color: "#888",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  margin: "0 0 10px",
                }}
              >
                Unlocked
              </p>
              <div className="badge-grid">
                {unlockedBadges.map((b) => (
                  <div
                    key={b.id}
                    className={`badge-unlocked ${newlyUnlocked?.id === b.id ? "badge-new" : ""}`}
                  >
                    <div style={{ fontSize: "22px", marginBottom: "4px" }}>
                      🏅
                    </div>
                    <div style={{ fontSize: "12px" }}>{b.label}</div>
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: "normal",
                        marginTop: "2px",
                        opacity: 0.8,
                      }}
                    >
                      {b.desc}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: "#666", fontSize: "13px", margin: "0 0 4px" }}>
              No badges unlocked yet. Start riding!
            </p>
          )}

          {showBadges &&
            (() => {
              const lockedBadges = badges.filter((b) => !b.unlocked);
              if (!lockedBadges.length) return null;
              return (
                <div style={{ marginTop: "16px" }}>
                  <p
                    style={{
                      color: "#888",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      margin: "0 0 10px",
                    }}
                  >
                    Locked — Progress
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {lockedBadges.map((b) => {
                      const pct = Math.min(99, Math.max(0, b.progress ?? 0));
                      return (
                        <div
                          key={b.id}
                          style={{
                            background: "#333",
                            border: "1px solid #444",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "6px",
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  color: "#aaa",
                                }}
                              >
                                🔒 {b.label}
                              </span>
                              <span
                                style={{
                                  marginLeft: "8px",
                                  fontSize: "11px",
                                  color: "#666",
                                }}
                              >
                                {b.desc}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#4CAF50",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                                marginLeft: "12px",
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div
                            style={{
                              background: "#404040",
                              borderRadius: "4px",
                              height: "6px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                background:
                                  "linear-gradient(90deg,#4CAF50,#66BB6A)",
                                height: "100%",
                                width: `${pct}%`,
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                          <p
                            style={{
                              margin: "5px 0 0",
                              fontSize: "11px",
                              color: "#666",
                            }}
                          >
                            Target: {b.co2} kg CO₂ —{" "}
                            {(b.co2 - savedCO2 * (pct / 100)).toFixed(2)} kg
                            remaining
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          {nextBadge?.maxReached && (
            <div
              style={{
                marginTop: "14px",
                padding: "14px",
                background: "linear-gradient(135deg,#ffc107,#ffb300)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                }}
              >
                🎉 All Badges Unlocked! Carbon Champion!
              </p>
            </div>
          )}
        </div>

        {/* ── Coaching Tips ───────────────────────────────────────────────── */}
        {currentTips.length > 0 && (
          <div className="eco-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <h2 style={{ margin: 0 }}>💡 Coaching Tips</h2>
              <button
                className="btn-primary"
                onClick={() => setShowCoachingTips(!showCoachingTips)}
              >
                {showCoachingTips ? "Hide Tips" : "Show Tips"}
              </button>
            </div>
            {showCoachingTips &&
              currentTips.slice(0, 3).map((tip, i) => (
                <div
                  key={i}
                  className="coaching-tip-row"
                  style={{
                    borderLeft: `3px solid ${
                      tip.priority === "critical"
                        ? "#dc3545"
                        : tip.priority === "high"
                          ? "#ff9800"
                          : tip.priority === "info"
                            ? "#2196F3"
                            : "#28a745"
                    }`,
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{tip.icon}</span>
                  <div>
                    <p
                      style={{
                        margin: "0 0 3px",
                        fontWeight: "600",
                        fontSize: "13px",
                        color: "#fff",
                      }}
                    >
                      {tip.title}
                    </p>
                    <p
                      style={{
                        margin: "0 0 3px",
                        fontSize: "12px",
                        color: "#aaa",
                      }}
                    >
                      {tip.tip}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#777" }}>
                      {tip.metric}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="tabs">
          <button
            className={`tab ${viewMode === "overview" ? "active" : ""}`}
            onClick={() => setViewMode("overview")}
          >
            📊 Overview
          </button>
          <button
            className={`tab ${viewMode === "detailed" ? "active" : ""}`}
            onClick={() => {
              setViewMode("detailed");
              setTripLimit(5);
            }}
          >
            📈 Trip Details
          </button>
          <button
            className={`tab ${viewMode === "leaderboard" ? "active" : ""}`}
            onClick={() => setViewMode("leaderboard")}
          >
            🏅 Leaderboard
          </button>
        </div>

        {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
        {viewMode === "overview" && (
          <div className="eco-card">
            <h2>Riding Summary</h2>
            {totalTrips === 0 ? (
              <p className="no-data">
                No trips recorded yet. Start a trip or simulate one.
              </p>
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
                    <div
                      className="val"
                      style={{ color: scoreColor(avgEcoScore) }}
                    >
                      {avgEcoScore}
                    </div>
                    <div className="lbl">Avg Eco Score</div>
                  </div>
                  <div className="stat-tile">
                    <div className="val" style={{ color: "#4CAF50" }}>
                      {bestEcoScore}
                    </div>
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

                <h2 style={{ marginBottom: "12px" }}>Score Distribution</h2>
                {(() => {
                  const eco = tripHistory.filter(
                    (t) => (t.score || t.ecoScore || 0) >= 80,
                  ).length;
                  const good = tripHistory.filter((t) => {
                    const s = t.score || t.ecoScore || 0;
                    return s >= 60 && s < 80;
                  }).length;
                  const poor = tripHistory.filter(
                    (t) => (t.score || t.ecoScore || 0) < 60,
                  ).length;
                  const pct = (n) =>
                    totalTrips > 0 ? Math.round((n / totalTrips) * 100) : 0;
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {[
                        { label: "Eco (80+)", count: eco, color: "#4CAF50" },
                        {
                          label: "Good (60–79)",
                          count: good,
                          color: "#ffc107",
                        },
                        { label: "Poor (<60)", count: poor, color: "#dc3545" },
                      ].map((row) => (
                        <div key={row.label}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "12px",
                              marginBottom: "4px",
                            }}
                          >
                            <span style={{ color: "#ccc" }}>{row.label}</span>
                            <span style={{ color: row.color }}>
                              {row.count} trips ({pct(row.count)}%)
                            </span>
                          </div>
                          <div
                            style={{
                              background: "#404040",
                              borderRadius: "4px",
                              height: "8px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                background: row.color,
                                height: "100%",
                                width: `${pct(row.count)}%`,
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <h2 style={{ margin: "20px 0 12px" }}>Recent Trips</h2>
                {tripHistory
                  .slice(-3)
                  .reverse()
                  .map((t, i) => {
                    const s = t.score || t.ecoScore || 0;
                    const dist = (t.distanceKm || t.distance || 0).toFixed(2);
                    const dur = Math.floor(
                      (t.duration || t.durationSeconds || 0) / 60,
                    );
                    const name = t.riderName || "Rider";
                    const date = new Date(t.timestamp);
                    const dateStr = isNaN(date)
                      ? "—"
                      : date.toLocaleDateString();
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          background: "#333",
                          borderRadius: "6px",
                          marginBottom: "8px",
                          borderLeft: `3px solid ${scoreColor(s)}`,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontWeight: "600",
                              color: "#fff",
                              fontSize: "13px",
                            }}
                          >
                            {name}
                          </span>
                          <span
                            style={{
                              color: "#888",
                              fontSize: "11px",
                              marginLeft: "8px",
                            }}
                          >
                            {dateStr}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            fontSize: "12px",
                            color: "#bbb",
                          }}
                        >
                          <span>📏 {dist} km</span>
                          <span>⏱ {dur}m</span>
                          <span
                            style={{ color: scoreColor(s), fontWeight: "600" }}
                          >
                            🌿 {s}/100
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        )}

        {/* ── TRIP DETAILS TAB ────────────────────────────────────────────── */}
        {viewMode === "detailed" && (
          <div className="eco-card">
            <h2>Trip History</h2>
            {totalTrips === 0 ? (
              <p className="no-data">No trips recorded yet.</p>
            ) : (
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {tripHistory
                  .slice()
                  .reverse()
                  .slice(0, tripLimit)
                  .map((trip, idx) => {
                    const s = trip.score || trip.ecoScore || 0;
                    const dist = trip.distanceKm || trip.distance || 0;
                    const dur = trip.duration || trip.durationSeconds || 0;
                    const speed = trip.avgSpeed || trip.avgSpeedKmh || 0;
                    const battery =
                      trip.batteryUsed || trip.batteryUsedPercent || 0;
                    const name = trip.riderName || "Rider";
                    const co2 = calculateCO2Savings(dist).savedCO2;
                    const date = new Date(trip.timestamp);
                    const dateStr = isNaN(date)
                      ? "—"
                      : date.toLocaleDateString();
                    const timeStr = isNaN(date)
                      ? ""
                      : date.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                    return (
                      <div
                        key={idx}
                        className="trip-card"
                        style={{ borderLeft: `4px solid ${scoreColor(s)}` }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "10px",
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontWeight: "700",
                                color: "#fff",
                                fontSize: "14px",
                              }}
                            >
                              {name}
                            </span>
                            {trip.isSimulated && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  fontSize: "10px",
                                  background: "#404040",
                                  color: "#aaa",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                SIM
                              </span>
                            )}
                          </div>
                          <span style={{ color: "#888", fontSize: "11px" }}>
                            {dateStr} {timeStr}
                          </span>
                        </div>
                        <div className="trip-card-grid">
                          <div className="trip-card-field">
                            <div className="f-label">Distance</div>
                            <div className="f-val">{dist.toFixed(2)} km</div>
                          </div>
                          <div className="trip-card-field">
                            <div className="f-label">Duration</div>
                            <div className="f-val">
                              {Math.floor(dur / 60)}m {dur % 60}s
                            </div>
                          </div>
                          <div className="trip-card-field">
                            <div className="f-label">Avg Speed</div>
                            <div className="f-val">
                              {parseFloat(speed).toFixed(1)} km/h
                            </div>
                          </div>
                          <div className="trip-card-field">
                            <div className="f-label">Eco Score</div>
                            <div
                              className="f-val"
                              style={{ color: scoreColor(s) }}
                            >
                              {s}/100
                            </div>
                          </div>
                          <div className="trip-card-field">
                            <div className="f-label">CO₂ Saved</div>
                            <div className="f-val">{co2.toFixed(2)} kg</div>
                          </div>
                          <div className="trip-card-field">
                            <div className="f-label">Battery Used</div>
                            <div className="f-val">
                              {parseFloat(battery).toFixed(1)}%
                            </div>
                          </div>
                          {trip.worstAxis && (
                            <div className="trip-card-field">
                              <div className="f-label">Focus Area</div>
                              <div
                                className="f-val"
                                style={{ textTransform: "capitalize" }}
                              >
                                {trip.worstAxis}
                              </div>
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "4px",
                          }}
                        >
                          <button
                            className="btn-small"
                            onClick={() => handleExportTrip(trip)}
                          >
                            📄 Export PDF
                          </button>
                          <button
                            className="btn-small"
                            onClick={() =>
                              setSelectedTrip(
                                selectedTrip?.timestamp === trip.timestamp
                                  ? null
                                  : trip,
                              )
                            }
                            style={{
                              background:
                                selectedTrip?.timestamp === trip.timestamp
                                  ? "#4CAF50"
                                  : "#404040",
                            }}
                          >
                            {selectedTrip?.timestamp === trip.timestamp
                              ? "▲ Less"
                              : "▼ More"}
                          </button>
                        </div>
                        {selectedTrip?.timestamp === trip.timestamp && (
                          <div
                            style={{
                              marginTop: "10px",
                              padding: "10px",
                              background: "#2a2a2a",
                              borderRadius: "6px",
                              fontSize: "12px",
                              color: "#aaa",
                              lineHeight: "1.7",
                            }}
                          >
                            <div>
                              🛢 Ride Style:{" "}
                              <strong
                                style={{
                                  color: "#e0e0e0",
                                  textTransform: "capitalize",
                                }}
                              >
                                {trip.rideStyle || "—"}
                              </strong>
                            </div>
                            <div>
                              ⚡ Consumption:{" "}
                              <strong style={{ color: "#e0e0e0" }}>
                                {trip.consumptionWh || "—"} Wh/km
                              </strong>
                            </div>
                            <div>
                              🔋 Battery Remaining:{" "}
                              <strong style={{ color: "#e0e0e0" }}>
                                {trip.batteryRemaining ?? "—"}%
                              </strong>
                            </div>
                            <div>
                              🌲 Tree Equiv:{" "}
                              <strong style={{ color: "#4CAF50" }}>
                                {calculateTreeEquivalents(co2).toFixed(3)}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            {totalTrips > 5 && (
              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                {tripLimit < totalTrips && (
                  <button
                    className="btn-secondary"
                    onClick={() => setTripLimit((prev) => prev + 5)}
                  >
                    Load 5 More ({totalTrips - tripLimit} remaining)
                  </button>
                )}
                {tripLimit > 5 && (
                  <button className="btn-small" onClick={() => setTripLimit(5)}>
                    Show Less
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── LEADERBOARD TAB ─────────────────────────────────────────────── */}
        {viewMode === "leaderboard" && (
          <div className="eco-card">
            <h2>🏅 Eco Leaderboard</h2>
            {leaderboardData.length === 0 ? (
              <p className="no-data">
                No trip data yet — complete or simulate a trip to appear here.
              </p>
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
                  {leaderboardData.map((entry) => (
                    <tr key={entry.rank}>
                      <td>
                        {entry.rank <= 3 ? (
                          <span className="rank-badge">
                            {["🥇", "🥈", "🥉"][entry.rank - 1]}
                          </span>
                        ) : (
                          <span style={{ color: "#888" }}>#{entry.rank}</span>
                        )}
                      </td>
                      <td
                        style={{
                          fontWeight: entry.rank <= 3 ? "700" : "400",
                          color: "#fff",
                        }}
                      >
                        {entry.name}
                      </td>
                      <td>{entry.co2Saved} kg</td>
                      <td>{entry.trees}</td>
                      <td>{entry.trips}</td>
                      <td
                        style={{
                          color: scoreColor(entry.avgScore),
                          fontWeight: "600",
                        }}
                      >
                        {entry.avgScore}/100
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <p
          style={{
            textAlign: "center",
            color: "#555",
            fontSize: "12px",
            marginTop: "20px",
          }}
        >
          Keep riding green! Every km counts. 🌍
        </p>
      </div>
    </div>
  );
};

export default EnvironmentalImpactHub;
