// ---------------------------------------------------------------------------
// ecoImpactCalculations.js
// Core environmental impact calculations for FamilyTrack EV.
//
// Responsibilities:
//   - CO2 savings vs petrol baseline
//   - Tree absorption equivalents
//   - Badge tier unlocking (gamification)
//   - Coaching tip generation (per axis: throttle / speed / accel)
//   - Leaderboard score formula
//   - Trip impact report generation
//
// Constants are overridable at runtime via setImpactConstants(), which is
// called by App.jsx after fetching /config/ecoConstants from Firebase.
// This allows tuning without a redeploy.
// ---------------------------------------------------------------------------

// ── Runtime-overridable constants ────────────────────────────────────────────
// Defaults match real-world averages for India (petrol) and grid-charged EVs.
// CO2_PER_KM_PETROL: avg Indian petrol scooter emission (kg CO2 / km)
// TREE_ABSORBS_PER_YEAR: how much CO2 one mature tree absorbs annually (kg)
// EV_EMISSIONS_FACTOR: upstream grid emissions per km for an EV (kg CO2 / km)
let CO2_PER_KM_PETROL = 0.192;
let TREE_ABSORBS_PER_YEAR = 21;
let EV_EMISSIONS_FACTOR = 0.05;

// ---------------------------------------------------------------------------
// setImpactConstants
// Called once on app load (App.jsx) after fetching Firebase remote config.
// Only updates keys that are actually present — safe to call with partial objects.
// ---------------------------------------------------------------------------
export const setImpactConstants = (c = {}) => {
  if (c.co2PerKmPetrol != null) CO2_PER_KM_PETROL = c.co2PerKmPetrol;
  if (c.treeAbsorbsPerYear != null)
    TREE_ABSORBS_PER_YEAR = c.treeAbsorbsPerYear;
  if (c.evEmissionsFactor != null) EV_EMISSIONS_FACTOR = c.evEmissionsFactor;
};

// ---------------------------------------------------------------------------
// calculateCO2Savings
// Core impact calculation: how much CO2 was avoided by riding EV vs petrol.
// Formula: savedCO2 = (petrol rate - EV rate) * distance
// Returns all three values so callers can display any combination.
// ---------------------------------------------------------------------------
export const calculateCO2Savings = (distanceKm) => {
  const petrolEmissions = distanceKm * CO2_PER_KM_PETROL;
  const evEmissions = distanceKm * EV_EMISSIONS_FACTOR;
  const savedCO2 = petrolEmissions - evEmissions;
  return {
    savedCO2: Math.round(savedCO2 * 100) / 100,
    petrolEquivalent: Math.round(petrolEmissions * 100) / 100,
    evEquivalent: Math.round(evEmissions * 100) / 100,
  };
};

// ---------------------------------------------------------------------------
// calculateTreeEquivalents
// Converts a CO2 mass (kg) into a "tree equivalent" count.
// One tree absorbs TREE_ABSORBS_PER_YEAR kg of CO2 per year.
// Used in badges, share cards, and PDF reports.
// ---------------------------------------------------------------------------
export const calculateTreeEquivalents = (co2Saved) => {
  const treesEquivalent = co2Saved / TREE_ABSORBS_PER_YEAR;
  return Math.round(treesEquivalent * 100) / 100;
};

// ---------------------------------------------------------------------------
// Badge tier thresholds
// Keyed by id; sorted at runtime by co2 value ascending.
// Each tier requires cumulative CO2 saved across ALL trips (not per-trip).
// ---------------------------------------------------------------------------
const BADGE_THRESHOLDS = {
  seedling: { co2: 5, label: "Seedling", desc: "Saved 5kg CO2" },
  sapling: { co2: 25, label: "Sapling", desc: "Saved 25kg CO2" },
  oak: { co2: 100, label: "Oak", desc: "Saved 100kg CO2" },
  forest: { co2: 500, label: "Forest Guardian", desc: "Saved 500kg CO2" },
  champion: { co2: 1000, label: "Carbon Champion", desc: "Saved 1000kg CO2" },
};

// ---------------------------------------------------------------------------
// getEcoBadges
// Returns the badge array for a given cumulative CO2 saved value.
//
// Logic:
//   - Walk thresholds low → high.
//   - Mark each as unlocked if totalCO2Saved >= threshold.
//   - On first locked tier: compute fractional progress (0–99%) and break.
//     Progress is capped at 99 so a locked badge never looks 100% in the UI.
//   - Callers show all unlocked + the next locked badge with its progress bar.
// ---------------------------------------------------------------------------
export const getEcoBadges = (totalCO2Saved) => {
  const badges = [];
  const sortedThresholds = Object.entries(BADGE_THRESHOLDS).sort(
    (a, b) => a[1].co2 - b[1].co2,
  );

  for (let i = 0; i < sortedThresholds.length; i++) {
    const [key, badge] = sortedThresholds[i];

    if (totalCO2Saved >= badge.co2) {
      // Fully unlocked — 100% progress
      badges.push({
        id: key,
        label: badge.label,
        desc: badge.desc,
        unlocked: true,
        co2: badge.co2,
        progress: 100,
      });
    } else {
      // First locked tier — compute partial progress from previous threshold
      const prevThreshold = i > 0 ? sortedThresholds[i - 1][1].co2 : 0;
      const progress = Math.round(
        ((totalCO2Saved - prevThreshold) / (badge.co2 - prevThreshold)) * 100,
      );
      badges.push({
        id: key,
        label: badge.label,
        desc: badge.desc,
        unlocked: false,
        co2: badge.co2,
        progress: Math.min(progress, 99), // never show 100% for a locked badge
      });
      break; // stop — don't show tiers beyond the next target
    }
  }

  return badges;
};

// ---------------------------------------------------------------------------
// getNextBadgeTarget
// Returns the next CO2 milestone the rider is working toward.
// If all badges are unlocked, returns maxReached: true so UI can show
// a "Carbon Champion — all badges unlocked!" celebration state.
// ---------------------------------------------------------------------------
export const getNextBadgeTarget = (totalCO2Saved) => {
  const thresholds = Object.values(BADGE_THRESHOLDS).sort(
    (a, b) => a.co2 - b.co2,
  );
  const next = thresholds.find((t) => t.co2 > totalCO2Saved);
  if (next) return { target: next.co2, remaining: next.co2 - totalCO2Saved };
  const maxThreshold = thresholds[thresholds.length - 1];
  return { target: maxThreshold.co2, remaining: 0, maxReached: true };
};

// ---------------------------------------------------------------------------
// getCoachingTips
// Generates a prioritised tip list based on:
//   ecoScore  — overall trip quality (0–100)
//   worstAxis — which sensor dimension caused the most penalty
//               one of: "throttle" | "speed" | "accel"
//   avgSpeed  — used in the speed tip metric string
//   distance  — triggers a long-trip efficiency tip if > 10 km
//
// Tip priority levels: "critical" > "high" > "low" > "info"
// CoachingTipsSystem.jsx displays critical/high first; others below.
// Returns at least one tip (a generic "start tracking" tip if no data).
// ---------------------------------------------------------------------------
export const getCoachingTips = (
  ecoScore = 0,
  worstAxis = "speed",
  avgSpeed = 0,
  throttleData = [],
  distance = 0,
) => {
  const tips = [];

  // ── Axis-specific primary tip ─────────────────────────────────────────────
  // One tip per worst axis — directly addresses the rider's biggest inefficiency.
  if (worstAxis === "throttle") {
    tips.push({
      priority: "high",
      icon: "🎛️",
      title: "Throttle Control",
      tip: "Ease off throttle gradually. Smooth inputs save 15-20% range.",
      metric: "Throttle avg exceeded safe range",
    });
  } else if (worstAxis === "speed") {
    tips.push({
      priority: "high",
      icon: "⚡",
      title: "Speed Optimization",
      tip: "Keep under 35 km/h for max efficiency. Every 10 km/h adds 25% energy cost.",
      metric: `Your avg: ${avgSpeed.toFixed(1)} km/h`,
    });
  } else if (worstAxis === "accel") {
    tips.push({
      priority: "high",
      icon: "🚀",
      title: "Acceleration Smoothness",
      tip: "Avoid rapid acceleration bursts. Smooth ramping saves the most energy.",
      metric: "Sudden acceleration detected",
    });
  }

  // ── Score-based secondary tips ────────────────────────────────────────────
  // These layer on top of the axis tip to provide positive/negative reinforcement.
  if (ecoScore >= 90) {
    tips.push({
      priority: "info",
      icon: "🏆",
      title: "Eco Champion Status!",
      tip: "Excellent riding. Maintain this pattern for consistent range.",
      metric: `Score: ${ecoScore}/100`,
    });
    tips.push({
      priority: "info",
      icon: "💚",
      title: "Share Your Success",
      tip: "Help others learn by sharing your eco-riding techniques.",
      metric: "Community impact growing",
    });
  } else if (ecoScore >= 75) {
    tips.push({
      priority: "low",
      icon: "👍",
      title: "Good Form",
      tip: "Minor tweaks could unlock +10-15 points. Focus on steady speed.",
      metric: `Score: ${ecoScore}/100`,
    });
  } else if (ecoScore < 50) {
    tips.push({
      priority: "critical",
      icon: "⚠️",
      title: "Aggressive Riding",
      tip: "Current pattern wastes 30%+ range. Ease off for 40% more miles.",
      metric: `Score: ${ecoScore}/100`,
    });
  }

  // ── Distance-based tip ────────────────────────────────────────────────────
  // Long trips benefit from a constant-speed strategy that short trips don't.
  if (distance > 10) {
    tips.push({
      priority: "info",
      icon: "📏",
      title: "Long Trip Energy",
      tip: "Cruise at steady 30 km/h for long rides. Variance drains battery faster.",
      metric: `Distance: ${distance.toFixed(1)} km`,
    });
  }

  // ── Fallback tip ──────────────────────────────────────────────────────────
  // Shown when rider has no trip data yet (no axis, no score, no distance).
  return tips.length > 0
    ? tips
    : [
        {
          priority: "info",
          icon: "📊",
          title: "Start Tracking",
          tip: "Complete a trip to receive personalized coaching tips.",
          metric: "No trips recorded yet",
        },
      ];
};

// ---------------------------------------------------------------------------
// calculateLeaderboardScore
// Composite score for family leaderboard ranking.
// Combines eco score quality with total CO2 impact.
// High eco score (≥85) gets a 1.5× multiplier to reward consistency.
// ---------------------------------------------------------------------------
export const calculateLeaderboardScore = (tripStats) => {
  const { ecoScore = 0, totalCO2Saved = 0 } = tripStats;
  const treeEquiv = calculateTreeEquivalents(totalCO2Saved);
  const ecoMultiplier = ecoScore >= 85 ? 1.5 : ecoScore >= 70 ? 1.2 : 1;
  return Math.round((ecoScore * 0.5 + treeEquiv * 10) * ecoMultiplier);
};

// ---------------------------------------------------------------------------
// generateImpactReport
// Builds a structured impact summary object for a single trip.
// Used by tripPDFExport.js and the watcher's trip detail modal.
// Does NOT include battery data — callers handle that separately.
// ---------------------------------------------------------------------------
export const generateImpactReport = (tripData) => {
  const { distance = 0, duration = 0, ecoScore = 0, avgSpeed = 0 } = tripData;
  const { savedCO2, petrolEquivalent } = calculateCO2Savings(distance);
  const treeEquiv = calculateTreeEquivalents(savedCO2);
  const badges = getEcoBadges(savedCO2);
  const nextBadge = getNextBadgeTarget(savedCO2);
  return {
    distance,
    duration,
    ecoScore,
    avgSpeed,
    co2: { saved: savedCO2, petrolEquivalent },
    impact: { treeEquivalents: treeEquiv, badges, nextBadge },
  };
};
