// ---------------------------------------------------------------------------
// tripPDFExport.js
// Generates and triggers a browser download of a trip summary PDF.
// Used by: WatcherDashboard (View button), TripSummaryCard (Export PDF),
//          EnvironmentalImpactHub (Export PDF in Trip Details tab)
// ---------------------------------------------------------------------------

import { generateImpactReport } from "./ecoImpactCalculations";

// ---------------------------------------------------------------------------
// generateTripSummary
// Builds a structured summary object from raw trip data.
// Called internally by downloadTripPDF.
// ---------------------------------------------------------------------------
export const generateTripSummary = (tripData) => {
  const {
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 15,
    // batteryRemaining: actual post-trip level, e.g. 80.3 if started at 85%
    // NEVER fall back to (100 - batteryUsed) — that assumes 100% start battery
    batteryRemaining = null,
  } = tripData;

  // Use the actual remaining value if provided.
  // Only fall back to (100 - batteryUsed) as a last resort when batteryRemaining
  // is genuinely absent (e.g. very old trip objects without the field).
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

  const rating =
    ecoScore >= 80 ? "Excellent" : ecoScore >= 60 ? "Good" : "Poor";

  const rangeEstimate =
    batteryUsed > 0
      ? (((100 / batteryUsed) * duration) / 3600).toFixed(1)
      : "N/A";

  const tip =
    ecoScore >= 80
      ? "Keep smooth acceleration"
      : ecoScore >= 60
        ? "Cruise at 40 km/h for +20% range"
        : "Smooth acceleration saves battery";

  return {
    metrics: {
      distance: distance.toFixed(2),
      duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
      avgSpeed: avgSpeed.toFixed(1),
      ecoScore,
      batteryUsed: Math.round(Number(batteryUsed) * 10) / 10,
      batteryRemaining: remaining,
    },
    efficiency: { rating, range: rangeEstimate, tip },
  };
};

// ---------------------------------------------------------------------------
// esc
// PDF string literal escaper — backslash-escapes ( ) and \ characters.
// Required by the PDF spec; unescaped parens break the content stream parser.
// ---------------------------------------------------------------------------
const esc = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

// ---------------------------------------------------------------------------
// downloadTripPDF
// Builds a valid PDF-1.4 document from trip metrics and triggers a browser
// file-download. No external libraries — pure JavaScript string construction.
//
// Expected tripData fields (after normalisation by callers):
//   riderName, distance, duration, ecoScore, avgSpeed,
//   batteryUsed, batteryRemaining, timestamp, worstAxis
//
// IMPORTANT — batteryRemaining must be the ACTUAL post-trip battery level,
// e.g. 80.3 if the rider started at 85% and used 4.7%.
// Callers are responsible for passing the correct value — see handleExportTrip
// in EnvironmentalImpactHub.jsx and handleExportPDF in WatcherDashboard.jsx.
// ---------------------------------------------------------------------------
export const downloadTripPDF = (tripData) => {
  const {
    riderName = "Rider",
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 0,
    // batteryRemaining: actual remaining % after this trip ended.
    // Must NOT be computed as (100 - batteryUsed) — that is wrong if the
    // rider did not start the trip at 100%.
    batteryRemaining = null,
    timestamp = new Date().toISOString(),
    worstAxis = "speed",
  } = tripData;

  // Resolve the remaining value with 1 decimal precision.
  // Use batteryRemaining when available; fall back only as last resort.
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

  // Environmental impact calculations
  const impactReport = generateImpactReport(tripData);

  // Summary object for efficiency tip section
  const summary = generateTripSummary({
    ...tripData,
    batteryRemaining: remaining, // pass resolved value so summary is consistent
  });

  // Format timestamps
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMins = Math.floor(duration / 60);
  const durationSecs = duration % 60;

  const scoreComment =
    ecoScore >= 80
      ? "Excellent! Maintain smooth acceleration patterns."
      : ecoScore >= 60
        ? "Good ride. Focus on steady speed for better efficiency."
        : "Aggressive riding detected. Ease off for better range.";

  // ── PDF text content lines ───────────────────────────────────────────────
  // ASCII only — Helvetica Type1 does not support Unicode/emoji.
  const LIGHT = "-".repeat(60);
  const lines = [
    `FamilyTrack EV - Trip Summary`,
    ``,
    `Rider: ${riderName}`,
    `Date:  ${dateStr} at ${timeStr}`,
    ``,
    `TRIP DETAILS`,
    LIGHT,
    `Distance:          ${Number(distance).toFixed(2)} km`,
    `Duration:          ${durationMins}m ${durationSecs}s`,
    `Average Speed:     ${Number(avgSpeed).toFixed(1)} km/h`,
    // batteryUsed: how much was drained during THIS trip
    `Battery Used:      ${Math.round(Number(batteryUsed) * 10) / 10}%`,
    // batteryRemaining: actual level LEFT after the trip ends
    // e.g. if started at 85% and used 4.7%, this shows 80.3%
    `Battery Remaining: ${remaining}%`,
    ``,
    `ECO-SCORE ANALYSIS`,
    LIGHT,
    `Score:             ${ecoScore}/100`,
    `Rating:            ${summary.efficiency.rating}`,
    `Improvement:       ${100 - ecoScore}%`,
    `Focus Area:        ${String(worstAxis).charAt(0).toUpperCase() + String(worstAxis).slice(1)}`,
    ``,
    `ENVIRONMENTAL IMPACT`,
    LIGHT,
    `CO2 Saved:         ${impactReport.co2.saved.toFixed(2)} kg`,
    `vs Petrol:         ${impactReport.co2.petrolEquivalent.toFixed(2)} kg`,
    `Tree Equivalents:  ${impactReport.impact.treeEquivalents.toFixed(2)} trees/year`,
    ``,
    `RECOMMENDATIONS`,
    LIGHT,
    scoreComment,
    summary.efficiency.tip,
    ``,
    `Keep riding green! Every km counts toward sustainability.`,
    `Generated: ${new Date().toLocaleString()}`,
  ];

  // ── Build PDF content stream ─────────────────────────────────────────────
  // BT/ET = Begin/End Text. /F2 for bold title, /F1 for body text.
  // 14 TL = text leading (line spacing). T* = advance to next line.
  let stream = "BT\n/F1 10 Tf\n50 740 Td\n14 TL\n";
  stream += `/F2 14 Tf (${esc(lines[0])}) Tj T*\n/F1 10 Tf\n`;
  for (let i = 1; i < lines.length; i++) {
    stream += `(${esc(lines[i])}) Tj T*\n`;
  }
  stream += "ET\n";

  // ── Assemble PDF indirect objects ─────────────────────────────────────────
  // Obj 1: Catalog, Obj 2: Pages, Obj 3: Page, Obj 4: Content stream,
  // Obj 5: Helvetica regular, Obj 6: Helvetica-Bold
  const objects = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n" +
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\n" +
      "endobj\n",
  );
  objects.push(
    "4 0 obj\n" +
      `<< /Length ${stream.length} >>\n` +
      "stream\n" +
      stream +
      "\nendstream\nendobj\n",
  );
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );
  objects.push(
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  );

  // ── Build PDF byte string with cross-reference table ─────────────────────
  // xref table allows PDF readers to seek directly to any object by byte offset.
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

  // ── Trigger browser file download ─────────────────────────────────────────
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trip-${riderName}-${dateStr}-summary.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
