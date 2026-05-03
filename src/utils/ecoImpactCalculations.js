// Environmental Impact Hub calculations — CO2 savings, tree equivalents, badges
// Constants: CO2_PER_KM_PETROL, TREE_ABSORBS_PER_YEAR, EV_EMISSIONS_FACTOR
// Can be overridden via setImpactConstants() from Firebase config

let CO2_PER_KM_PETROL = 0.192;
let TREE_ABSORBS_PER_YEAR = 21;
let EV_EMISSIONS_FACTOR = 0.05;

// Update impact constants from Firebase config (called by App.jsx on load)
export const setImpactConstants = (c = {}) => {
  if (c.co2PerKmPetrol != null) CO2_PER_KM_PETROL = c.co2PerKmPetrol;
  if (c.treeAbsorbsPerYear != null)
    TREE_ABSORBS_PER_YEAR = c.treeAbsorbsPerYear;
  if (c.evEmissionsFactor != null) EV_EMISSIONS_FACTOR = c.evEmissionsFactor;
};

// Calculate CO2 emissions saved by using EV instead of petrol
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

// Convert CO2 savings to number of trees that would absorb same amount annually
export const calculateTreeEquivalents = (co2Saved) => {
  const treesEquivalent = co2Saved / TREE_ABSORBS_PER_YEAR;
  return Math.round(treesEquivalent * 100) / 100;
};

const BADGE_THRESHOLDS = {
  seedling: { co2: 5, label: "Seedling", desc: "Saved 5kg CO2" },
  sapling: { co2: 25, label: "Sapling", desc: "Saved 25kg CO2" },
  oak: { co2: 100, label: "Oak", desc: "Saved 100kg CO2" },
  forest: { co2: 500, label: "Forest Guardian", desc: "Saved 500kg CO2" },
  champion: { co2: 1000, label: "Carbon Champion", desc: "Saved 1000kg CO2" },
};

// Unlock eco badges based on cumulative CO2 savings (gamification)
export const getEcoBadges = (totalCO2Saved) => {
  const badges = [];
  const sortedThresholds = Object.entries(BADGE_THRESHOLDS).sort(
    (a, b) => a[1].co2 - b[1].co2,
  );

  for (let i = 0; i < sortedThresholds.length; i++) {
    const [key, badge] = sortedThresholds[i];
    if (totalCO2Saved >= badge.co2) {
      badges.push({
        id: key,
        label: badge.label,
        desc: badge.desc,
        unlocked: true,
        co2: badge.co2,
        progress: 100,
      });
    } else {
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
        progress: Math.min(progress, 99),
      });
      break;
    }
  }

  return badges;
};

export const getNextBadgeTarget = (totalCO2Saved) => {
  const thresholds = Object.values(BADGE_THRESHOLDS).sort(
    (a, b) => a.co2 - b.co2,
  );
  const next = thresholds.find((t) => t.co2 > totalCO2Saved);
  if (next) return { target: next.co2, remaining: next.co2 - totalCO2Saved };
  const maxThreshold = thresholds[thresholds.length - 1];
  return { target: maxThreshold.co2, remaining: 0, maxReached: true };
};

// Generate personalized coaching tips based on eco score and worst axis (throttle/speed/accel)
export const getCoachingTips = (
  ecoScore = 0,
  worstAxis = "speed",
  avgSpeed = 0,
  throttleData = [],
  distance = 0,
) => {
  const tips = [];

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

  if (distance > 10) {
    tips.push({
      priority: "info",
      icon: "📏",
      title: "Long Trip Energy",
      tip: "Cruise at steady 30 km/h for long rides. Variance drains battery faster.",
      metric: `Distance: ${distance.toFixed(1)} km`,
    });
  }

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

// Score for leaderboard ranking (combines eco score + CO2 saved + multiplier for high eco scores)
export const calculateLeaderboardScore = (tripStats) => {
  const { ecoScore = 0, totalCO2Saved = 0 } = tripStats;
  const treeEquiv = calculateTreeEquivalents(totalCO2Saved);
  const ecoMultiplier = ecoScore >= 85 ? 1.5 : ecoScore >= 70 ? 1.2 : 1;
  return Math.round((ecoScore * 0.5 + treeEquiv * 10) * ecoMultiplier);
};

// Comprehensive trip impact report (used for PDF export and displays)
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

// Generate PDF trip summary with eco metrics, environmental impact, and coaching tips
export const generateTripPDF = (tripData) => {
  const {
    riderName = "Rider",
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 15,
    worstAxis = "speed",
    timestamp = new Date().toISOString(),
  } = tripData;

  const impactReport = generateImpactReport(tripData);
  const badges = getEcoBadges(impactReport.co2.saved);

  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMins = Math.floor(duration / 60);
  const durationSecs = duration % 60;

  const HEAVY = "=".repeat(70);
  const LIGHT = "-".repeat(70);

  const lines = [];
  lines.push("FAMILYTRACK EV - TRIP SUMMARY & ENVIRONMENTAL IMPACT");
  lines.push("");
  lines.push(HEAVY);
  lines.push("");
  lines.push(`Rider: ${riderName}`);
  lines.push(`Date: ${dateStr} at ${timeStr}`);
  lines.push("");
  lines.push("TRIP DETAILS");
  lines.push(LIGHT);
  lines.push(`Distance:                    ${distance.toFixed(2)} km`);
  lines.push(`Duration:                    ${durationMins}m ${durationSecs}s`);
  lines.push(`Average Speed:               ${avgSpeed.toFixed(1)} km/h`);
  lines.push(`Battery Used:                ${batteryUsed}%`);
  lines.push(`Battery Remaining:           ${100 - batteryUsed}%`);
  lines.push("");
  lines.push("ECO-SCORE ANALYSIS");
  lines.push(LIGHT);
  lines.push(`Score:                       ${ecoScore}/100`);
  lines.push(
    `Rating:                      ${ecoScore >= 80 ? "Excellent" : ecoScore >= 60 ? "Good" : "Poor"}`,
  );
  lines.push(`Improvement Potential:       ${100 - ecoScore}%`);
  lines.push(
    `Primary Focus Area:          ${worstAxis.charAt(0).toUpperCase() + worstAxis.slice(1)}`,
  );
  lines.push("");
  lines.push("ENVIRONMENTAL IMPACT");
  lines.push(LIGHT);
  lines.push(
    `CO2 Saved vs. Petrol:        ${impactReport.co2.saved.toFixed(2)} kg`,
  );
  lines.push(
    `  (Petrol would emit:        ${impactReport.co2.petrolEquivalent.toFixed(2)} kg)`,
  );
  lines.push(
    `Tree Equivalents:            ${impactReport.impact.treeEquivalents.toFixed(2)} trees/year absorption`,
  );
  lines.push("");

  const unlockedBadges = badges.filter((b) => b.unlocked);
  if (unlockedBadges.length > 0) {
    lines.push("ACHIEVEMENTS UNLOCKED");
    lines.push(LIGHT);
    unlockedBadges.forEach((b) => {
      lines.push(`[X] ${b.label}: ${b.desc}`);
    });
    lines.push("");
  }

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

  const linesPerPage = 50;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  const objects = [];
  const pageCount = pages.length;
  const pageRefs = pages.map((_, i) => `${3 + i} 0 R`).join(" ");
  const streamStartObj = 3 + pageCount;
  const fontObj = streamStartObj + pageCount;

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>\nendobj\n`,
  );

  for (let i = 0; i < pageCount; i++) {
    objects.push(
      `${3 + i} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Contents ${streamStartObj + i} 0 R ` +
        `/Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\n` +
        `endobj\n`,
    );
  }

  for (let i = 0; i < pageCount; i++) {
    let stream = "BT\n/F1 10 Tf\n50 750 Td\n12 TL\n";
    for (const line of pages[i]) {
      const escaped = line
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
      stream += `(${escaped}) Tj T*\n`;
    }
    stream += "ET\n";
    objects.push(
      `${streamStartObj + i} 0 obj\n` +
        `<< /Length ${stream.length} >>\n` +
        `stream\n${stream}\nendstream\nendobj\n`,
    );
  }

  objects.push(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`,
  );

  let pdfContent = "%PDF-1.4\n";
  const xrefPositions = [];
  for (const obj of objects) {
    xrefPositions.push(pdfContent.length);
    pdfContent += obj;
  }

  const xrefOffset = pdfContent.length;
  const totalObjs = objects.length + 1;
  pdfContent += `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const pos of xrefPositions) {
    pdfContent += `${String(pos).padStart(10, "0")} 00000 n \n`;
  }
  pdfContent += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\n`;
  pdfContent += `startxref\n${xrefOffset}\n%%EOF`;

  return pdfContent;
};

// Trigger browser download of trip PDF
export const downloadTripPDF = (tripData) => {
  const pdfContent = generateTripPDF(tripData);
  const riderName = tripData.riderName || "Rider";
  const dateStr = new Date(
    tripData.timestamp || new Date(),
  ).toLocaleDateString();
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
