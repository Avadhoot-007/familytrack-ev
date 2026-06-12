// ---------------------------------------------------------------------------
// CoachingTipsSystem.jsx
// Rider-facing coaching tip overlay system.
//
// Two exports:
//   CoachingTipsSystem (default) — fixed bottom-right floating panel shown
//     during an active trip. Displays up to 3 tips sorted by priority
//     (critical/high first). Each tip is dismissible for the session.
//
//   CoachingTipsModal (named) — modal version used in WatcherDashboard and
//     trip detail views. Renders all tips inside a centred overlay card.
//
// Tips are passed in via the `tips` prop (array). This component does NOT
// generate tips — callers (RiderDashboard, EnvironmentalImpactHub) provide
// the array from getCoachingTips() in ecoImpactCalculations.js.
// ---------------------------------------------------------------------------

import React, { useState } from "react";

// ---------------------------------------------------------------------------
// CoachingTipsSystem
// Fixed floating panel anchored to the bottom-right corner of the viewport.
// Only renders when visibleTips.length > 0 (returns null otherwise).
//
// Props:
//   tips      {Array}  — coaching tip objects from getCoachingTips()
//                        Each tip: { title, tip, metric, icon, priority }
//                        priority: "critical" | "high" | "info" | "low"
//   ecoScore  {number} — current trip eco score (passed but not used in this
//                        component directly; available for future logic)
//   onDismiss {func}   — optional callback fired when a tip is dismissed
//                        (currently not called; dismiss is local-only)
// ---------------------------------------------------------------------------

const CoachingTipsSystem = ({
  tips = [],
  ecoScore = 0,
  onDismiss = () => {},
}) => {
  // Tracks titles of tips the rider has dismissed this session.
  // Uses tip.title as the key (not id) because auto-generated tips
  // don't always carry stable ids. Set is recreated on component mount —
  // dismissed tips reappear after a page refresh (intentional).

  const [dismissedTipIds, setDismissedTipIds] = useState(new Set());
  const visibleTips = tips.filter((tip) => !dismissedTipIds.has(tip.title));
  // Split visible tips into two buckets:
  //   highPriority — critical or high; shown first, pulsing red/orange
  //   otherTips    — info or low; shown below, static green
  // Merge order guarantees critical tips always lead the display list.

  const highPriority = visibleTips.filter(
    (t) => t.priority === "critical" || t.priority === "high",
  );
  const otherTips = visibleTips.filter(
    (t) => t.priority !== "critical" && t.priority !== "high",
  );

  // handleDismiss
  // Adds the tip's title to the local dismissed set.
  // Does NOT call onDismiss prop — parent is not notified.
  // Tip stays dismissed until the component unmounts or page refreshes.

  const handleDismiss = (tipTitle) => {
    setDismissedTipIds(new Set([...dismissedTipIds, tipTitle]));
  };

  // Early return — render nothing when all tips are dismissed or tips=[].
  // Avoids an empty fixed-position div occupying the bottom-right corner.

  if (!visibleTips.length) return null;

  // Cap display at 3 tips to avoid stacking too many notifications.
  // Merge ensures critical tips are never cut off by the slice.
  const displayTips = [...highPriority, ...otherTips].slice(0, 3);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 1000,
        animation: "slideUp 0.4s ease-out",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(26, 126, 50, 0.3); }
          50% { box-shadow: 0 4px 30px rgba(26, 126, 50, 0.6); }
        }
      `}</style>

      {displayTips.map((tip, idx) => {
        // Derive card background and box-shadow color from priority level.
        // critical → red (#dc3545), high → orange (#ff9800),
        // info → blue (#2196F3), default/low → green (#28a745)

        const bgColor =
          tip.priority === "critical"
            ? "#dc3545"
            : tip.priority === "high"
              ? "#ff9800"
              : tip.priority === "info"
                ? "#2196F3"
                : "#28a745";

        // isCritical drives the pulsing animation — only critical/high tips pulse.
        // Low/info tips render static to avoid visual noise during normal riding.

        const isCritical =
          tip.priority === "critical" || tip.priority === "high";

        // Render: fixed-position wrapper div (z-index 1000, slideUp animation).
        // Maps displayTips → individual tip cards with dynamic background color,
        // pulse animation for critical/high, and a dismiss button per card.

        return (
          <div
            key={tip.title}
            style={{
              background: bgColor,
              color: "white",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: idx < displayTips.length - 1 ? "12px" : 0,
              maxWidth: "320px",
              boxShadow: isCritical
                ? "0 4px 20px rgba(220, 53, 69, 0.4)"
                : "0 4px 12px rgba(0, 0, 0, 0.2)",
              animation: isCritical ? "pulse 2s infinite" : "none",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
            >
              <span style={{ fontSize: "24px", lineHeight: 1 }}>
                {tip.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: "600",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  {tip.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    lineHeight: "1.4",
                    marginBottom: "8px",
                  }}
                >
                  {tip.tip}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    opacity: 0.8,
                    marginBottom: "8px",
                  }}
                >
                  {tip.metric}
                </div>
                <button
                  onClick={() => handleDismiss(tip.title)}
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.background = "rgba(255, 255, 255, 0.3)")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.background = "rgba(255, 255, 255, 0.2)")
                  }
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Standalone Modal Version (for dashboard card)
// ---------------------------------------------------------------------------
// CoachingTipsModal (named export)
// Full-screen overlay modal version of the coaching tips display.
// Used in WatcherDashboard trip detail modal and EnvironmentalImpactHub.
//
// Unlike CoachingTipsSystem, tips are NOT dismissible — all are shown.
// Clicking the backdrop or the "Got It" button closes the modal.
//
// Props:
//   isOpen  {bool}   — controls visibility; returns null when false
//   tips    {Array}  — same shape as CoachingTipsSystem tips prop
//   onClose {func}   — called when backdrop or "Got It" is clicked
// ---------------------------------------------------------------------------
export const CoachingTipsModal = ({ isOpen, tips = [], onClose }) => {
  // Gate render — skip mounting the modal DOM entirely when closed.
  // Prevents backdrop from intercepting clicks when the modal is hidden.
  if (!isOpen) return null;
  // Same priority-sort logic as CoachingTipsSystem — critical/high tips
  // appear first, lower priority tips follow. No slice cap here; all tips shown.
  const criticalTips = tips.filter(
    (t) => t.priority === "critical" || t.priority === "high",
  );
  const otherTips = tips.filter(
    (t) => t.priority !== "critical" && t.priority !== "high",
  );
  // Merged display order: critical → high → info/low.
  // No deduplication needed — callers pass pre-deduplicated arrays.
  const allTips = [...criticalTips, ...otherTips];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        animation: "fadeIn 0.3s ease-out",
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: "#1a1a1a",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
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
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "600",
              color: "#fff",
            }}
          >
            💡 Coaching Tips
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#999",
            }}
          >
            ✕
          </button>
        </div>

        {allTips.length > 0 ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {allTips.map((tip) => {
              const borderColor =
                tip.priority === "critical"
                  ? "#dc3545"
                  : tip.priority === "high"
                    ? "#ff9800"
                    : tip.priority === "info"
                      ? "#2196F3"
                      : "#28a745";

              return (
                <div
                  key={tip.title}
                  style={{
                    border: `2px solid ${borderColor}`,
                    borderRadius: "8px",
                    padding: "12px",
                    background: "#2a2a2a",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px" }}>
                    <span style={{ fontSize: "20px", lineHeight: 1 }}>
                      {tip.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: "600",
                          fontSize: "13px",
                          marginBottom: "4px",
                        }}
                      >
                        {tip.title}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          lineHeight: "1.5",
                          color: "#ccc",
                          marginBottom: "6px",
                        }}
                      >
                        {tip.tip}
                      </div>
                      <div style={{ fontSize: "11px", color: "#999" }}>
                        {tip.metric}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: "#666", textAlign: "center", margin: "20px 0" }}>
            No coaching tips available.
          </p>
        )}

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: "20px",
            padding: "10px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Got It
        </button>
      </div>
    </div>
  );
};

export default CoachingTipsSystem;
