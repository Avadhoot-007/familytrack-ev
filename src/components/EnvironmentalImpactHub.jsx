// ---------------------------------------------------------------------------
// EnvironmentalImpactHub.jsx
// Rider-facing environmental analytics dashboard.
// Displays CO2 savings, tree equivalents, badges, coaching tips, leaderboard,
// weekly challenges, and trip history with PDF export.
//
// Props:
//   tripHistory  — array of completed trip objects from Zustand store
//   currentTrip  — live trip object during active ride (or null)
//   allRiders    — reserved for future multi-rider aggregation (unused currently)
// ---------------------------------------------------------------------------

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
// calculateStreak
// Counts how many consecutive days ending today have at least one trip.
// Iterates backward from today up to 365 days; breaks on the first day
// without a trip. Uses a Set of date strings for O(1) lookup per day.
// ---------------------------------------------------------------------------
const calculateStreak = (tripHistory) => {
  if (!tripHistory.length) return 0;

  // Build a set of date strings from all trips that have a valid timestamp
  const tripDates = new Set(
    tripHistory
      .filter((t) => t.timestamp)
      .map((t) => new Date(t.timestamp).toDateString()),
  );

  let streak = 0;
  const today = new Date();

  // Walk backward from today; stop at first day with no trip
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (tripDates.has(d.toDateString())) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

// ---------------------------------------------------------------------------
// getWeeklyProgress
// Aggregates trip stats for the current Sun→Sat calendar week.
// Used by ChallengesTab to evaluate weekly challenge completion.
// Returns: tripCount, highScoreTrips, totalDistance, allAbove70, avgScore, daysRidden
// ---------------------------------------------------------------------------
const getWeeklyProgress = (tripHistory) => {
  const now = new Date();

  // Find the start of the current week (Sunday 00:00:00)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Filter to trips that fall within this week
  const weekTrips = tripHistory.filter(
    (t) => t.timestamp && new Date(t.timestamp) >= weekStart,
  );

  const scores = weekTrips.map((t) => t.score || t.ecoScore || 0);
  const totalDistance = weekTrips.reduce(
    (s, t) => s + (t.distanceKm || t.distance || 0),
    0,
  );

  return {
    tripCount: weekTrips.length,
    // How many trips scored 80 or above (used by Eco Warrior challenge)
    highScoreTrips: scores.filter((s) => s >= 80).length,
    totalDistance,
    // Smooth Operator: all trips this week above 70, minimum 2 trips
    allAbove70: weekTrips.length >= 2 && scores.every((s) => s >= 70),
    avgScore:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0,
    // Unique calendar days ridden this week
    daysRidden: new Set(
      weekTrips.map((t) => new Date(t.timestamp).toDateString()),
    ).size,
  };
};

// ---------------------------------------------------------------------------
// WEEKLY_CHALLENGES
// Static config array for all 6 weekly challenges.
// Each challenge has:
//   getValue(wp, streak) → current progress value
//   target              → value needed to complete
//   isBool              → if true, renders as done/not-done instead of a bar
// ---------------------------------------------------------------------------
const WEEKLY_CHALLENGES = [
  {
    id: "five_trips",
    icon: "🚴",
    title: "5 Trips This Week",
    desc: "Complete 5 trips in a single week",
    target: 5,
    unit: "trips",
    color: "#4CAF50",
    getValue: (wp) => Math.min(wp.tripCount, 5),
  },
  {
    id: "eco_warrior",
    icon: "🌿",
    title: "Eco Warrior",
    desc: "Score 80+ on 3 trips this week",
    target: 3,
    unit: "trips",
    color: "#8BC34A",
    getValue: (wp) => Math.min(wp.highScoreTrips, 3),
  },
  {
    id: "distance_rider",
    icon: "📏",
    title: "Distance Rider",
    desc: "Ride 50 km total this week",
    target: 50,
    unit: "km",
    color: "#2196F3",
    getValue: (wp) => parseFloat(Math.min(wp.totalDistance, 50).toFixed(1)),
  },
  {
    id: "smooth_operator",
    icon: "⚡",
    title: "Smooth Operator",
    desc: "Keep all trips above 70 score (min 2 trips this week)",
    target: 1,
    unit: "",
    color: "#FF9800",
    isBool: true,
    getValue: (wp) => (wp.allAbove70 ? 1 : 0),
  },
  {
    id: "streak_3",
    icon: "🔥",
    title: "3-Day Streak",
    desc: "Ride on 3 consecutive days",
    target: 3,
    unit: "days",
    color: "#F44336",
    // streak is passed as second arg from ChallengesTab
    getValue: (wp, streak) => Math.min(streak, 3),
  },
  {
    id: "daily_rider",
    icon: "📅",
    title: "4 Different Days",
    desc: "Ride on 4 different days this week",
    target: 4,
    unit: "days",
    color: "#9C27B0",
    getValue: (wp) => Math.min(wp.daysRidden, 4),
  },
];

// ---------------------------------------------------------------------------
// daysUntilReset
// Returns how many days until the next Monday (weekly challenge reset).
// Sunday (day 0) → 7 days remaining; all other days → 7 - day.
// ---------------------------------------------------------------------------
const daysUntilReset = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  return day === 0 ? 7 : 7 - day;
};

// ---------------------------------------------------------------------------
// BadgeUnlockOverlay
// Full-screen animated overlay shown for ~2.8 s when a new CO2 badge unlocks.
// Auto-dismisses via setTimeout; onDone clears the newlyUnlocked state above.
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
// ChallengeCompleteOverlay
// Full-screen animated overlay shown for ~2.4 s when a weekly challenge
// is newly completed. Clicking the overlay also dismisses it (onClick={onDone}).
// ---------------------------------------------------------------------------
function ChallengeCompleteOverlay({ challenge, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
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
        zIndex: 9998,
        animation: "badgeOverlayIn 0.3s ease",
      }}
      onClick={onDone}
    >
      <div
        style={{
          textAlign: "center",
          animation: "badgeBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div style={{ fontSize: "72px", lineHeight: 1, marginBottom: "16px" }}>
          {challenge.icon}
        </div>
        <div
          style={{
            background: `linear-gradient(135deg, ${challenge.color}cc, ${challenge.color})`,
            color: "#fff",
            borderRadius: "16px",
            padding: "20px 32px",
            boxShadow: `0 8px 40px ${challenge.color}66`,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "13px",
              fontWeight: "600",
              opacity: 0.85,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Challenge Complete!
          </p>
          <h2
            style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: "800" }}
          >
            {challenge.title}
          </h2>
          <p style={{ margin: 0, fontSize: "13px", opacity: 0.85 }}>
            {challenge.desc}
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
// ShareModal
// Modal for sharing the rider's cumulative environmental impact stats.
// Supports: Web Share API (native), WhatsApp, Twitter/X, Telegram, clipboard copy.
// Stats are pre-formatted strings passed in via the `stats` prop from the
// main component's `shareStats` object.
// ---------------------------------------------------------------------------
function ShareModal({ isOpen, onClose, stats }) {
  const [copied, setCopied] = useState(false);
  const [shareState, setShareState] = useState("idle");

  // Don't render when closed — avoids unnecessary DOM nodes
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

  // Pre-built share message used by all share targets
  const shareText = `🌱 My EV Impact on FamilyTrack EV\n\n♻️ CO₂ Saved: ${savedCO2} kg\n🌳 Tree Equivalents: ${treeEquiv}\n📏 Total Distance: ${totalDistance} km\n🚴 Trips Completed: ${totalTrips}\n🌿 Avg Eco Score: ${avgEcoScore}/100\n⭐ Best Score: ${bestEcoScore}/100${unlockedBadges.length > 0 ? `\n🏅 Badges: ${unlockedBadges.map((b) => b.label).join(", ")}` : ""}\n\nRiding green every day! 🔋⚡`;

  // Web Share API — available on mobile browsers; not on desktop Chrome
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
      // AbortError = user cancelled the share sheet — not an actual error
      if (e.name !== "AbortError") setShareState("error");
      else setShareState("idle");
    }
  };

  // Clipboard copy — falls back to execCommand for older browsers / non-HTTPS
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () =>
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
    );

  const handleTwitter = () => {
    // Twitter has a character limit — keep the tweet concise
    const tweet = `🌱 I've saved ${savedCO2} kg CO₂ riding my EV! That's ${treeEquiv} tree equivalents 🌳 Eco Score: ${avgEcoScore}/100 #EVRiding #GreenCommute #FamilyTrackEV`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
      "_blank",
    );
  };

  const handleTelegram = () =>
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent("https://familytrack-ev.web.app")}&text=${encodeURIComponent(shareText)}`,
      "_blank",
    );

  // Inline style helper for platform buttons — keeps JSX DRY
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

  return (
    // Clicking the backdrop closes the modal
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
      {/* stopPropagation prevents backdrop click from firing inside the card */}
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

        {/* Impact preview card shown inside the share modal */}
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

          {/* Show earned badge chips if any are unlocked */}
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

        {/* Share action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Native share — only rendered when browser supports Web Share API */}
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

// ---------------------------------------------------------------------------
// ChallengesTab
// Renders the weekly challenges panel including:
//   - Streak tracker with day-of-week visual dots
//   - 6 challenge cards with progress bars
//   - This-week summary stats grid
//
// Uses prevCompletedRef to detect newly-completed challenges since last render
// and triggers the ChallengeCompleteOverlay animation once per completion event.
// ---------------------------------------------------------------------------
function ChallengesTab({ tripHistory }) {
  const streak = calculateStreak(tripHistory);
  const wp = getWeeklyProgress(tripHistory);
  const resetDays = daysUntilReset();

  // Ref stores the Set of completed challenge IDs from the previous render.
  // On first render it's null — we initialise it without showing any animation.
  const prevCompletedRef = useRef(null);
  const [newlyCompleted, setNewlyCompleted] = useState(null);

  // Enrich each challenge definition with live progress values
  const challenges = WEEKLY_CHALLENGES.map((c) => {
    const value = c.getValue(wp, streak);
    const completed = value >= c.target;
    const pct = Math.min(100, Math.round((value / c.target) * 100));
    return { ...c, value, completed, pct };
  });

  const completedCount = challenges.filter((c) => c.completed).length;

  // Detect newly completed challenges and trigger animation overlay
  // Re-runs whenever tripHistory changes (which changes wp/streak → challenges)
  useEffect(() => {
    const completedIds = new Set(
      challenges.filter((c) => c.completed).map((c) => c.id),
    );

    // First run — just initialise the ref, no animation
    if (prevCompletedRef.current === null) {
      prevCompletedRef.current = completedIds;
      return;
    }

    // Compare against previous — find the first newly completed one
    for (const id of completedIds) {
      if (!prevCompletedRef.current.has(id)) {
        const ch = challenges.find((c) => c.id === id);
        if (ch) setNewlyCompleted(ch);
        break; // show one overlay at a time
      }
    }
    prevCompletedRef.current = completedIds;
  }, [tripHistory]);

  // Color of the streak flame — escalates with streak length
  const streakColor =
    streak >= 7
      ? "#FF5722"
      : streak >= 3
        ? "#FF9800"
        : streak >= 1
          ? "#ffc107"
          : "#444";

  return (
    <div>
      {/* Challenge completion overlay — shown for 2.4s on new completion */}
      {newlyCompleted && (
        <ChallengeCompleteOverlay
          challenge={newlyCompleted}
          onDone={() => setNewlyCompleted(null)}
        />
      )}

      {/* ── Streak card ───────────────────────────────────────────────── */}
      <div
        className="eco-card"
        style={{ borderLeft: `4px solid ${streakColor}`, marginBottom: "16px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ textAlign: "center" }}>
              {/* Flame greyed out when streak = 0 */}
              <div
                style={{
                  fontSize: "52px",
                  lineHeight: 1,
                  filter: streak > 0 ? "none" : "grayscale(1) opacity(0.3)",
                }}
              >
                🔥
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "40px",
                  fontWeight: "800",
                  color: streakColor,
                  lineHeight: 1,
                }}
              >
                {streak}
              </div>
              <div
                style={{ fontSize: "13px", color: "#888", marginTop: "2px" }}
              >
                day streak
              </div>
            </div>
          </div>

          {/* Day-of-week dot row — S M T W T F S */}
          <div style={{ display: "flex", gap: "8px" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              // Compute the actual calendar date for this slot in the current week
              const now = new Date();
              const weekStart = new Date(now);
              weekStart.setDate(now.getDate() - now.getDay());
              weekStart.setHours(0, 0, 0, 0);
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + (day - 1));

              const hasTrip = tripHistory.some((t) => {
                if (!t.timestamp) return false;
                const td = new Date(t.timestamp);
                return td.toDateString() === d.toDateString();
              });
              const isToday = d.toDateString() === now.toDateString();
              const isPast = d < now;

              return (
                <div
                  key={day}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: "700",
                    // Filled with streak color if a trip was recorded that day
                    background: hasTrip
                      ? streakColor
                      : isToday
                        ? "#2a2a2a"
                        : isPast
                          ? "#111"
                          : "#1a1a1a",
                    border: isToday
                      ? `2px solid ${streakColor}`
                      : "2px solid transparent",
                    color: hasTrip ? "#fff" : "#444",
                  }}
                >
                  {hasTrip ? "✓" : ["S", "M", "T", "W", "T", "F", "S"][day - 1]}
                </div>
              );
            })}
          </div>
        </div>

        {streak === 0 && (
          <p style={{ margin: "12px 0 0", color: "#555", fontSize: "12px" }}>
            Complete a trip today to start your streak!
          </p>
        )}
        {/* Special banner for 7+ day champions */}
        {streak >= 7 && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              background: "rgba(255,87,34,0.1)",
              border: "1px solid rgba(255,87,34,0.3)",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#FF5722",
              fontWeight: "600",
            }}
          >
            🏆 7-Day Champion! Incredible consistency!
          </div>
        )}
      </div>

      {/* ── Weekly reset info + completion counter ─────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#fff", fontSize: "16px" }}>
            🎯 Weekly Challenges
          </h2>
          <p style={{ margin: "2px 0 0", color: "#555", fontSize: "11px" }}>
            Resets in {resetDays} day{resetDays !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Pill turns green when all challenges are done */}
        <div
          style={{
            padding: "6px 14px",
            borderRadius: "20px",
            background:
              completedCount === challenges.length
                ? "rgba(76,175,80,0.15)"
                : "#1a1a1a",
            border: `1px solid ${completedCount === challenges.length ? "#4CAF50" : "#333"}`,
            fontSize: "13px",
            fontWeight: "700",
            color: completedCount === challenges.length ? "#4CAF50" : "#666",
          }}
        >
          {completedCount}/{challenges.length} done
        </div>
      </div>

      {/* ── Challenge cards ───────────────────────────────────────────── */}
      {tripHistory.length === 0 ? (
        <div className="eco-card">
          <p className="no-data">Complete trips to unlock weekly challenges.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {challenges.map((ch) => (
            <div
              key={ch.id}
              className="eco-card"
              style={{
                padding: "16px 20px",
                marginBottom: 0,
                // Left border turns colored when completed, grey when pending
                borderLeft: `4px solid ${ch.completed ? ch.color : "#333"}`,
                opacity: ch.completed ? 1 : 0.9,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Subtle gradient shimmer behind completed cards */}
              {ch.completed && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(135deg, ${ch.color}08, transparent)`,
                    pointerEvents: "none",
                  }}
                />
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  position: "relative",
                }}
              >
                {/* Challenge icon — replaced with ✅ on completion */}
                <div
                  style={{
                    fontSize: "28px",
                    lineHeight: 1,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {ch.completed ? "✅" : ch.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "700",
                        fontSize: "14px",
                        color: ch.completed ? ch.color : "#fff",
                      }}
                    >
                      {ch.title}
                    </span>
                    {/* Progress label: "X unit / Y unit" or "Done!" / "Not yet" for booleans */}
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: ch.completed ? ch.color : "#888",
                        whiteSpace: "nowrap",
                        marginLeft: "12px",
                      }}
                    >
                      {ch.isBool
                        ? ch.completed
                          ? "Done!"
                          : "Not yet"
                        : `${ch.value}${ch.unit ? ` ${ch.unit}` : ""} / ${ch.target}${ch.unit ? ` ${ch.unit}` : ""}`}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    {ch.desc}
                  </p>

                  {/* Numeric progress bar — hidden for boolean challenges */}
                  {!ch.isBool && (
                    <div
                      style={{
                        background: "#111",
                        borderRadius: "4px",
                        height: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${ch.pct}%`,
                          // Full color when done; dimmed when in-progress
                          background: ch.completed
                            ? `linear-gradient(90deg, ${ch.color}, ${ch.color}cc)`
                            : `linear-gradient(90deg, ${ch.color}88, ${ch.color}44)`,
                          borderRadius: "4px",
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  )}

                  {/* Boolean challenge — empty bar when incomplete */}
                  {ch.isBool && !ch.completed && (
                    <div
                      style={{
                        background: "#111",
                        borderRadius: "4px",
                        height: "6px",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: "0%",
                          background: ch.color,
                          borderRadius: "4px",
                        }}
                      />
                    </div>
                  )}

                  {/* Boolean challenge — full bar when complete */}
                  {ch.isBool && ch.completed && (
                    <div
                      style={{
                        background: `${ch.color}22`,
                        borderRadius: "4px",
                        height: "6px",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: "100%",
                          background: ch.color,
                          borderRadius: "4px",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── This week summary stat tiles ─────────────────────────────── */}
      {tripHistory.length > 0 && (
        <div className="eco-card" style={{ marginTop: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", color: "#fff" }}>
            📊 This Week So Far
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))",
              gap: "10px",
            }}
          >
            {[
              { label: "Trips", val: wp.tripCount, icon: "🚴" },
              {
                label: "Distance",
                val: `${wp.totalDistance.toFixed(1)} km`,
                icon: "📏",
              },
              { label: "Avg Score", val: `${wp.avgScore}/100`, icon: "🌿" },
              { label: "Days Ridden", val: wp.daysRidden, icon: "📅" },
            ].map(({ label, val, icon }) => (
              <div
                key={label}
                style={{
                  background: "#111",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "18px", marginBottom: "4px" }}>
                  {icon}
                </div>
                <div
                  style={{ fontSize: "20px", fontWeight: "700", color: "#fff" }}
                >
                  {val}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#555",
                    textTransform: "uppercase",
                    marginTop: "2px",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnvironmentalImpactHub — main component
//
// Aggregates trip history into cumulative stats, drives badge detection,
// and renders all four tab views: Overview, Trip Details, Leaderboard, Challenges.
//
// Props:
//   tripHistory  — Zustand persisted array; each entry is a completed trip object
//   currentTrip  — live object during an active trip; null otherwise
//   allRiders    — unused currently; reserved for family-wide aggregation
// ---------------------------------------------------------------------------
const EnvironmentalImpactHub = ({
  tripHistory = [],
  currentTrip = null,
  allRiders = [],
}) => {
  // Tab state: "overview" | "detailed" | "leaderboard" | "challenges"
  const [viewMode, setViewMode] = useState("overview");
  const [showBadges, setShowBadges] = useState(false);
  const [showCoachingTips, setShowCoachingTips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null); // expanded trip in detailed view
  const [tripLimit, setTripLimit] = useState(5); // how many trips to show in detailed tab
  const [showShareModal, setShowShareModal] = useState(false);

  // Tracks the badge that just unlocked so BadgeUnlockOverlay can be shown
  const [newlyUnlocked, setNewlyUnlocked] = useState(null);
  // Ref holds the Set of already-unlocked badge IDs from the previous render
  const prevUnlockedIdsRef = useRef(null);

  // ── Aggregate stats — computed from full tripHistory ─────────────────────
  // Dual field name support: store saves distanceKm; older/simulated trips may use distance
  const totalDistance = tripHistory.reduce(
    (sum, t) => sum + (t.distanceKm || t.distance || 0),
    0,
  );
  const totalTrips = tripHistory.length;

  // Dual field name: store saves score; some legacy entries use ecoScore
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

  // Dual field: store saves durationSeconds; older trips may use duration
  const totalDuration = tripHistory.reduce(
    (sum, t) => sum + (t.duration || t.durationSeconds || 0),
    0,
  );
  const totalDurationHrs = (totalDuration / 3600).toFixed(1);

  // Environmental impact numbers derived from total distance
  const { savedCO2, petrolEquivalent } = calculateCO2Savings(totalDistance);
  const treeEquiv = calculateTreeEquivalents(savedCO2);

  // Badge tier evaluation — returns array of badge objects with unlocked + progress
  const badges = getEcoBadges(savedCO2);
  const nextBadge = getNextBadgeTarget(savedCO2);

  // ── Badge unlock detection ────────────────────────────────────────────────
  // Runs whenever savedCO2 changes (i.e. after a new trip is added).
  // Compares current unlocked set against previous; triggers overlay for new ones.
  useEffect(() => {
    const currentUnlockedIds = new Set(
      badges.filter((b) => b.unlocked).map((b) => b.id),
    );

    // First render — just capture baseline state without showing any animation
    if (prevUnlockedIdsRef.current === null) {
      prevUnlockedIdsRef.current = currentUnlockedIds;
      return;
    }

    // Find the first badge that wasn't unlocked before but is now
    for (const id of currentUnlockedIds) {
      if (!prevUnlockedIdsRef.current.has(id)) {
        const badge = badges.find((b) => b.id === id);
        if (badge) setNewlyUnlocked(badge);
        break; // show one overlay at a time
      }
    }
    prevUnlockedIdsRef.current = currentUnlockedIds;
  }, [savedCO2]);

  // ── Coaching tips source priority ─────────────────────────────────────────
  // 1. Use live currentTrip data if a trip is active
  // 2. Fall back to the most recent completed trip
  // 3. Return generic starter tips if no trips exist at all
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
    currentTips = getCoachingTips(); // returns generic starter tips
  }

  const unlockedBadges = badges.filter((b) => b.unlocked);

  // ── Leaderboard data — aggregates trips by riderName ─────────────────────
  // Groups all trips in tripHistory by riderName, summing CO2, trips, scores.
  // Then sorts by CO2 saved descending and assigns rank numbers.
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

  const handleExportTrip = (trip) => {
    downloadTripPDF({
      // Pass all original fields through (riderName, distance, duration, etc.)
      ...trip,
      // Map distanceKm → distance (PDF generator reads `distance`)
      distance: trip.distanceKm || trip.distance || 0,
      // Map durationSeconds → duration (PDF generator reads `duration`)
      duration: trip.durationSeconds || trip.duration || 0,
      // Map score → ecoScore (PDF generator reads `ecoScore`)
      ecoScore: trip.score || trip.ecoScore || 0,
      // Map avgSpeedKmh → avgSpeed (PDF generator reads `avgSpeed`)
      avgSpeed: trip.avgSpeedKmh || trip.avgSpeed || 0,
      // KEY FIX: map batteryUsedPercent → batteryUsed (PDF generator reads `batteryUsed`)
      // Without this, batteryUsed is undefined and the PDF defaults to 15%
      batteryUsed: trip.batteryUsedPercent ?? trip.batteryUsed ?? 0,
      // batteryRemaining is already the correct field name — pass through as-is
      batteryRemaining: trip.batteryRemaining ?? null, // null triggers fallback, not 0
      battery: trip.battery ?? 100,
    });
  };

  // Traffic-light color for eco score values — used throughout the component
  const scoreColor = (s) =>
    s >= 80 ? "#4CAF50" : s >= 60 ? "#ffc107" : "#dc3545";

  // Stats object passed to ShareModal — pre-formatted strings
  const shareStats = {
    savedCO2: savedCO2.toFixed(2),
    treeEquiv: treeEquiv.toFixed(2),
    totalDistance: totalDistance.toFixed(1),
    totalTrips,
    avgEcoScore,
    bestEcoScore,
    unlockedBadges,
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
      {/* Badge unlock overlay — shown for 2.8s when a new CO2 tier is reached */}
      {newlyUnlocked && (
        <BadgeUnlockOverlay
          badge={newlyUnlocked}
          onDone={() => setNewlyUnlocked(null)}
        />
      )}

      {/* Share modal — conditionally rendered; receives pre-computed shareStats */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        stats={shareStats}
      />

      {/* Global CSS animations injected via <style> — avoids needing a separate CSS file */}
      <style>{`
        @keyframes badgeOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes badgeBounceIn { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        @keyframes badgeSpin { from { transform: rotate(-20deg) scale(0.8); } to { transform: rotate(0deg) scale(1); } }
        @keyframes badgeGlow { from { box-shadow: 0 8px 40px rgba(255,193,7,0.4); } to { box-shadow: 0 8px 60px rgba(255,193,7,0.8); } }
        @keyframes badgeCardPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,193,7,0); } 50% { box-shadow: 0 0 0 8px rgba(255,193,7,0.25); } }
        .badge-new { animation: badgeCardPulse 1.5s ease 3; }
        .eco-card { background: #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid #404040; }
        .eco-card h2 { color: #fff; margin: 0 0 16px; font-size: 18px; }
        .impact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
        .impact-box { color: white; padding: 18px; border-radius: 10px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .impact-box h3 { margin: 0 0 8px; font-size: 13px; opacity: 0.9; font-weight: 500; }
        .impact-box .big-num { font-size: 28px; font-weight: bold; }
        .impact-box .sub { font-size: 11px; opacity: 0.8; margin-top: 4px; }
        .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-tile { background: #333; border: 1px solid #444; border-radius: 8px; padding: 14px; text-align: center; }
        .stat-tile .val { font-size: 24px; font-weight: 700; color: #fff; }
        .stat-tile .lbl { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
        .badge-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-top: 14px; }
        .badge-unlocked { background: linear-gradient(135deg, #ffc107, #ffb300); color: #1a1a1a; font-weight: bold; box-shadow: 0 4px 12px rgba(255,193,7,0.3); border-radius: 8px; padding: 12px; text-align: center; cursor: pointer; transition: transform 0.2s; }
        .badge-unlocked:hover { transform: scale(1.05); }
        .tabs { display: flex; gap: 6px; margin-bottom: 20px; border-bottom: 1px solid #404040; flex-wrap: wrap; }
        .tab { padding: 10px 16px; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 500; color: #888; border-bottom: 3px solid transparent; transition: all 0.2s; white-space: nowrap; }
        .tab.active { color: #4CAF50; border-bottom-color: #4CAF50; }
        .tab:hover { color: #aaa; }
        .leaderboard-table { width: 100%; border-collapse: collapse; }
        .leaderboard-table th { background: #1a1a1a; padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #4CAF50; border-bottom: 2px solid #404040; }
        .leaderboard-table td { padding: 12px; border-bottom: 1px solid #404040; color: #e0e0e0; }
        .leaderboard-table tr:hover { background: #333; }
        .rank-badge { display: inline-flex; width: 28px; height: 28px; background: linear-gradient(135deg, #ffc107, #ffb300); border-radius: 50%; align-items: center; justify-content: center; font-weight: bold; color: #1a1a1a; font-size: 12px; }
        .coaching-tip-row { padding: 12px; background: #333; border-radius: 8px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; }
        .btn-primary { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; }
        .btn-secondary { background: #404040; color: #e0e0e0; border: 1px solid #555; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; }
        .btn-share { background: linear-gradient(135deg, #1a7e32, #28a745); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .btn-share:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(40,167,69,0.4); }
        .btn-small { background: #404040; color: #e0e0e0; border: 1px solid #555; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s; }
        .btn-small:hover { background: #555; }
        .trip-card { padding: 14px; background: #333; border-radius: 8px; margin-bottom: 10px; }
        .trip-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px,1fr)); gap: 10px; margin-bottom: 8px; }
        .trip-card-field { font-size: 12px; }
        .trip-card-field .f-label { color: #888; margin-bottom: 2px; }
        .trip-card-field .f-val { font-weight: 600; color: #e0e0e0; }
        .no-data { color: #666; text-align: center; padding: 30px 0; font-size: 14px; }
      `}</style>

      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* ── Header card ────────────────────────────────────────────── */}
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
            {/* Share button disabled until at least one trip exists */}
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

        {/* ── Top metrics — 4 impact boxes ─────────────────────────── */}
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

        {/* ── Carbon Offset Badges ──────────────────────────────────── */}
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
            {/* Toggle to expand locked badge progress list */}
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
                    // badge-new applies a pulsing glow animation for freshly unlocked badges
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

          {/* Locked badges with progress bars — shown when "View All" is expanded */}
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
                      // Clamp progress between 0–99 so the bar never appears full for locked badges
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          {/* All badges unlocked — celebration banner */}
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

        {/* ── Coaching Tips card ────────────────────────────────────── */}
        {/* Only rendered when there are tips to show; tips are hidden by default */}
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
            {/* Show at most 3 tips; border color driven by priority level */}
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

        {/* ── Tab navigation ────────────────────────────────────────── */}
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
              setTripLimit(5); // reset pagination when switching to this tab
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
          <button
            className={`tab ${viewMode === "challenges" ? "active" : ""}`}
            onClick={() => setViewMode("challenges")}
          >
            🎯 Challenges
          </button>
        </div>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
        {viewMode === "overview" && (
          <div className="eco-card">
            <h2>Riding Summary</h2>
            {totalTrips === 0 ? (
              <p className="no-data">
                No trips recorded yet. Start a trip or simulate one.
              </p>
            ) : (
              <>
                {/* 8-tile stat grid: trips, distance, time, scores, CO2, trees, badges */}
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

                {/* Score distribution — horizontal progress bars for eco/good/poor buckets */}
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
                  // Percentage helper — avoids division by zero
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

                {/* Last 3 trips mini-list — most recent first */}
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

        {/* ── TRIP DETAILS TAB ──────────────────────────────────────── */}
        {viewMode === "detailed" && (
          <div className="eco-card">
            <h2>Trip History</h2>
            {totalTrips === 0 ? (
              <p className="no-data">No trips recorded yet.</p>
            ) : (
              // Scrollable container — capped at 500px to avoid infinite page growth
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {tripHistory
                  .slice()
                  .reverse() // newest first
                  .slice(0, tripLimit) // pagination: show only tripLimit entries
                  .map((trip, idx) => {
                    const s = trip.score || trip.ecoScore || 0;
                    const dist = trip.distanceKm || trip.distance || 0;
                    const dur = trip.duration || trip.durationSeconds || 0;
                    const speed = trip.avgSpeed || trip.avgSpeedKmh || 0;
                    // batteryUsed display — supports both field name variants
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
                            {/* SIM badge for simulated trips */}
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

                        {/* Trip metric grid */}
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
                          {/* Export PDF — calls the fixed handleExportTrip with normalised fields */}
                          <button
                            className="btn-small"
                            onClick={() => handleExportTrip(trip)}
                          >
                            📄 Export PDF
                          </button>
                          {/* Toggle expanded detail row */}
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

                        {/* Expanded detail row — ride style, consumption, battery remaining, tree equiv */}
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

            {/* Pagination controls — only shown when there are more than 5 trips */}
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

        {/* ── LEADERBOARD TAB ───────────────────────────────────────── */}
        {/* Groups trips by riderName and ranks by CO2 saved descending */}
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
                        {/* Medal emoji for top 3; number for the rest */}
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

        {/* ── CHALLENGES TAB ────────────────────────────────────────── */}
        {/* Delegates to ChallengesTab which manages its own streak/challenge state */}
        {viewMode === "challenges" && (
          <ChallengesTab tripHistory={tripHistory} />
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
