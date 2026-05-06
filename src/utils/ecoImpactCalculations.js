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
//   - PDF generation + browser download (generateTripPDF / downloadTripPDF)
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

// ---------------------------------------------------------------------------
// esc
// PDF content stream string escaper.
// The PDF spec requires backslashes and parentheses to be escaped inside
// literal strings — unescaped parens break the content stream parser.
// ---------------------------------------------------------------------------
const esc = (s) =>
  String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

// ---------------------------------------------------------------------------
// generateTripPDF
// Builds a valid PDF-1.4 byte string for a completed trip.
//
// Callers must pass batteryRemaining explicitly. EnvironmentalImpactHub's
// handleExportTrip and WatcherDashboard's handleExportPDF both do this.
// ---------------------------------------------------------------------------
export const generateTripPDF = (tripData) => {
  const {
    riderName = "Rider",
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 15,
    batteryRemaining = null,
    worstAxis = "speed",
    timestamp = new Date().toISOString(),
  } = tripData;

  // ── Resolve battery remaining ─────────────────────────────────────────────
  // Use the actual value when present and valid.
  // The fallback to (100 - batteryUsed) only fires for legacy trip objects
  // that pre-date the batteryRemaining field being stored in the Zustand store.
  const remaining =
    batteryRemaining != null && batteryRemaining !== ""
      ? Math.max(
          0,
          Math.min(100, Math.round(Number(batteryRemaining) * 10) / 10),
        )
      : Math.max(
          0,
          Math.min(100, Math.round((100 - Number(batteryUsed)) * 10) / 10),
        );

  // ── Impact calculations ───────────────────────────────────────────────────
  const impactReport = generateImpactReport(tripData);
  const badges = getEcoBadges(impactReport.co2.saved);
  const unlockedBadges = badges.filter((b) => b.unlocked);

  // ── Format timestamps and duration ───────────────────────────────────────
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMins = Math.floor(duration / 60);
  const durationSecs = duration % 60;

  const HEAVY = "=".repeat(70);
  const LIGHT = "-".repeat(70);

  // ── Build text content lines ──────────────────────────────────────────────
  // ASCII only — Courier Type1 font does not support Unicode or emoji.
  // Each string maps to one Tj T* instruction in the PDF content stream.
  const lines = [];
  lines.push("FAMILYTRACK EV - TRIP SUMMARY & ENVIRONMENTAL IMPACT");
  lines.push("");
  lines.push(HEAVY);
  lines.push("");
  lines.push(`Rider: ${riderName}`);
  lines.push(`Date:  ${dateStr} at ${timeStr}`);
  lines.push("");
  lines.push("TRIP DETAILS");
  lines.push(LIGHT);
  lines.push(`Distance:          ${Number(distance).toFixed(2)} km`);
  lines.push(`Duration:          ${durationMins}m ${durationSecs}s`);
  lines.push(`Average Speed:     ${Number(avgSpeed).toFixed(1)} km/h`);
  // batteryUsed = % drained during THIS trip only
  lines.push(
    `Battery Used:      ${Math.round(Number(batteryUsed) * 10) / 10}%`,
  );
  // batteryRemaining = actual level left AFTER this trip ends (not 100 - used)
  lines.push(`Battery Remaining: ${remaining}%`);
  lines.push("");
  lines.push("ECO-SCORE ANALYSIS");
  lines.push(LIGHT);
  lines.push(`Score:             ${ecoScore}/100`);
  lines.push(
    `Rating:            ${ecoScore >= 80 ? "Excellent" : ecoScore >= 60 ? "Good" : "Poor"}`,
  );
  lines.push(`Improvement:       ${100 - ecoScore}%`);
  lines.push(
    `Focus Area:        ${String(worstAxis).charAt(0).toUpperCase() + String(worstAxis).slice(1)}`,
  );
  lines.push("");
  lines.push("ENVIRONMENTAL IMPACT");
  lines.push(LIGHT);
  lines.push(`CO2 Saved vs Petrol:   ${impactReport.co2.saved.toFixed(2)} kg`);
  lines.push(
    `  (Petrol would emit:  ${impactReport.co2.petrolEquivalent.toFixed(2)} kg)`,
  );
  lines.push(
    `Tree Equivalents:      ${impactReport.impact.treeEquivalents.toFixed(2)} trees/year`,
  );
  lines.push("");

  // ── Achievements section ──────────────────────────────────────────────────
  // Only rendered if at least one badge has been unlocked for this trip's CO2 level.
  if (unlockedBadges.length > 0) {
    lines.push("ACHIEVEMENTS UNLOCKED");
    lines.push(LIGHT);
    unlockedBadges.forEach((b) => {
      lines.push(`[X] ${b.label}: ${b.desc}`);
    });
    lines.push("");
  }

  // ── Coaching tips section ─────────────────────────────────────────────────
  // Axis-specific actionable advice matching what the rider saw in-app.
  lines.push("COACHING TIPS");
  lines.push(LIGHT);
  if (worstAxis === "throttle") {
    lines.push(
      "* Throttle Control: Ease off throttle gradually for smoother rides.",
    );
    lines.push("  Rapid inputs waste 15-20% of battery range.");
  } else if (worstAxis === "speed") {
    lines.push(
      "* Speed Optimization: Keep under 35 km/h for maximum efficiency.",
    );
    lines.push("  Every 10 km/h increase adds 25% energy cost.");
  } else if (worstAxis === "accel") {
    lines.push("* Acceleration Smoothness: Avoid rapid acceleration bursts.");
    lines.push("  Smooth ramping saves the most energy.");
  }
  lines.push("");

  // Score-based closing comment
  if (ecoScore >= 80) {
    lines.push("[OK] Excellent! Maintain this smooth riding pattern.");
  } else if (ecoScore >= 60) {
    lines.push("* Good form. Minor adjustments could add 10-15 points.");
    lines.push("  Focus on consistent speed and smooth inputs.");
  } else {
    lines.push("[!] Aggressive riding detected. Ease off for 40% more range.");
    lines.push("  Practice smooth acceleration and braking.");
  }
  lines.push("");
  lines.push(HEAVY);
  lines.push("Keep riding green! Every km counts toward sustainability.");
  lines.push(`Generated: ${new Date().toLocaleString()}`);

  // ── Paginate lines into 50-line pages ─────────────────────────────────────
  // PDF spec requires each page to be a separate Page object with its own
  // content stream. 50 lines at 12pt leading fits comfortably on a Letter page.
  const linesPerPage = 50;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  // ── Build PDF indirect objects ─────────────────────────────────────────────
  // PDF-1.4 structure:
  //   Obj 1: Catalog → points to Pages
  //   Obj 2: Pages   → lists all Page objects
  //   Obj 3..N: Page (one per page)
  //   Obj N+1..M: Content stream (one per page)
  //   Obj M+1: Font (Courier Type1, no embedding needed)
  const objects = [];
  const pageCount = pages.length;
  const pageRefs = pages.map((_, i) => `${3 + i} 0 R`).join(" ");
  const streamStartObj = 3 + pageCount;
  const fontObj = streamStartObj + pageCount;

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>\nendobj\n`,
  );

  // Page descriptor objects — each references its own content stream
  for (let i = 0; i < pageCount; i++) {
    objects.push(
      `${3 + i} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Contents ${streamStartObj + i} 0 R ` +
        `/Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\n` +
        `endobj\n`,
    );
  }

  // Content stream objects — BT/ET wraps text block; T* advances one line
  for (let i = 0; i < pageCount; i++) {
    let stream = "BT\n/F1 10 Tf\n50 750 Td\n12 TL\n";
    for (const line of pages[i]) {
      stream += `(${esc(line)}) Tj T*\n`;
    }
    stream += "ET\n";
    objects.push(
      `${streamStartObj + i} 0 obj\n` +
        `<< /Length ${stream.length} >>\n` +
        `stream\n${stream}\nendstream\nendobj\n`,
    );
  }

  // Font object — Courier is a standard Type1 font; no embedding required
  objects.push(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`,
  );

  // ── Assemble final PDF byte string with cross-reference table ─────────────
  // xref table lets PDF readers seek directly to any object by byte offset,
  // enabling fast random access without scanning the whole file.
  let pdfContent = "%PDF-1.4\n";
  const xrefPositions = [];
  for (const obj of objects) {
    xrefPositions.push(pdfContent.length);
    pdfContent += obj;
  }

  const xrefOffset = pdfContent.length;
  const totalObjs = objects.length + 1; // +1 for the free head entry (obj 0)
  pdfContent += `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const pos of xrefPositions) {
    pdfContent += `${String(pos).padStart(10, "0")} 00000 n \n`;
  }
  pdfContent += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\n`;
  pdfContent += `startxref\n${xrefOffset}\n%%EOF`;

  return pdfContent;
};

// ---------------------------------------------------------------------------
// downloadTripPDF
// Wraps generateTripPDF: builds the PDF string then triggers a browser
// file-download using a temporary Blob URL.
//
// Field name support:
//   Callers from EnvironmentalImpactHub pass batteryUsedPercent (store name).
//   handleExportTrip there already maps it to batteryUsed before calling here,
//   so this function always receives the correctly named field.
// ---------------------------------------------------------------------------
export const downloadTripPDF = (tripData) => {
  // Pass the full tripData object — do not destructure here so batteryRemaining
  // is not accidentally dropped before reaching generateTripPDF.
  const pdfContent = generateTripPDF(tripData);

  const riderName = tripData.riderName || "Rider";
  const dateStr = new Date(
    tripData.timestamp || new Date(),
  ).toLocaleDateString();

  // Create a temporary Blob URL, click it to trigger download, then revoke
  // immediately to free memory (the download continues asynchronously).
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trip-${riderName}-${dateStr}-impact.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
