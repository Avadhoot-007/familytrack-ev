// ---------------------------------------------------------------------------
// tripPDFExport.js
// Generates and triggers a browser download of a trip summary PDF.
// Used by: WatcherDashboard (View button), TripSummaryCard (Export PDF button)
// ---------------------------------------------------------------------------

import { generateImpactReport } from "./ecoImpactCalculations";

// ---------------------------------------------------------------------------
// generateTripSummary
// Builds a structured summary object from raw trip data.
// Called internally by downloadTripPDF and can also be used by other modules
// that need a normalised view of trip metrics without generating a PDF.
//
// Params: tripData — raw trip object (from Firebase or Zustand store)
// Returns: { metrics: {...}, efficiency: {...} }
// ---------------------------------------------------------------------------
export const generateTripSummary = (tripData) => {
  const {
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 15,
    batteryRemaining = null, // explicit post-trip battery %; preferred source of truth
  } = tripData;

  const remaining =
    batteryRemaining != null
      ? Math.max(0, Math.min(100, Math.round(Number(batteryRemaining))))
      : Math.max(0, Math.min(100, Math.round(100 - Number(batteryUsed))));

  // Efficiency rating bucket based on eco score thresholds
  const rating =
    ecoScore >= 80 ? "Excellent" : ecoScore >= 60 ? "Good" : "Poor";

  // Rough range estimate: assumes battery % maps linearly to range over duration
  const rangeEstimate =
    batteryUsed > 0
      ? (((100 / batteryUsed) * duration) / 3600).toFixed(1)
      : "N/A";

  // Contextual tip based on score bucket
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
      batteryUsed: Math.round(Number(batteryUsed)),
      batteryRemaining: remaining,
    },
    efficiency: { rating, range: rangeEstimate, tip },
  };
};

// ---------------------------------------------------------------------------
// esc
// PDF string literal escaper — required by the PDF spec.
// Any ( ) or \ inside a PDF string must be backslash-escaped, otherwise the
// PDF renderer will misparse the stream and either crash or show garbled text.
// ---------------------------------------------------------------------------
const esc = (s) =>
  String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

// ---------------------------------------------------------------------------
// downloadTripPDF
// Main export. Builds a valid PDF-1.4 document from trip metrics and triggers
// a browser file-download. No external libraries — pure JavaScript string
// construction so the bundle stays lean.
//
// PDF structure (object graph):
//   1 0 obj  — Catalog (root)
//   2 0 obj  — Pages node
//   3 0 obj  — Single Page
//   4 0 obj  — Content stream (text commands)
//   5 0 obj  — Helvetica font (regular)
//   6 0 obj  — Helvetica-Bold font (title)
//
// Cross-reference table is built dynamically from byte offsets so Adobe
// and browser PDF viewers can seek directly to any object.
//
// Params: tripData — trip object containing at minimum:
//   riderName, distance, duration, ecoScore, avgSpeed,
//   batteryUsed, batteryRemaining, timestamp, worstAxis
// ---------------------------------------------------------------------------
export const downloadTripPDF = (tripData) => {
  const {
    riderName = "Rider",
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 15,
    batteryRemaining = null, // actual post-trip battery %; see FIX note above
    timestamp = new Date().toISOString(),
    worstAxis = "speed",
  } = tripData;

  const remaining =
    batteryRemaining != null
      ? Math.max(0, Math.min(100, Math.round(Number(batteryRemaining))))
      : Math.max(0, Math.min(100, Math.round(100 - Number(batteryUsed))));

  // ── Generate environmental impact numbers ────────────────────────────────
  // Delegates to ecoImpactCalculations: CO2 saved vs petrol, tree equivalents.
  const impactReport = generateImpactReport(tripData);

  // ── Build the summary object for the efficiency/tip section ─────────────
  const summary = generateTripSummary({
    ...tripData,
    batteryRemaining: remaining,
  });

  // ── Format timestamps and duration for display ───────────────────────────
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMins = Math.floor(duration / 60);
  const durationSecs = duration % 60;

  // ── Choose the score comment shown in the Recommendations section ────────
  const scoreComment =
    ecoScore >= 80
      ? "Excellent! Maintain smooth acceleration patterns."
      : ecoScore >= 60
        ? "Good ride. Focus on steady speed for better efficiency."
        : "Aggressive riding detected. Ease off for better range.";

  // ── Build the plain-text line array rendered into the PDF stream ─────────
  // All lines must be ASCII only — Helvetica Type1 does not support Unicode.
  // Non-ASCII characters (e.g. emoji, degree symbols) will render as garbage.
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
    // batteryUsed: how much was drained during this trip
    `Battery Used:      ${Math.round(Number(batteryUsed))}%`,
    // batteryRemaining: actual level LEFT after the trip ends
    `Battery Remaining: ${remaining}%`,
    ``,
    `ECO-SCORE ANALYSIS`,
    LIGHT,
    `Score:             ${ecoScore}/100`,
    `Rating:            ${summary.efficiency.rating}`,
    `Improvement:       ${100 - ecoScore}%`,
    // worstAxis: the sensor dimension (throttle / speed / accel) with highest penalty
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

  // ── Build the PDF content stream ─────────────────────────────────────────
  // BT / ET = Begin Text / End Text operators.
  // /F2 for the bold title on the first line, /F1 (regular) for everything else.
  // 14 TL = text leading (line spacing in points).
  // T* = move to next line using current leading.
  let stream = "BT\n/F1 10 Tf\n50 740 Td\n14 TL\n";
  stream += `/F2 14 Tf (${esc(lines[0])}) Tj T*\n/F1 10 Tf\n`; // bold title
  for (let i = 1; i < lines.length; i++) {
    stream += `(${esc(lines[i])}) Tj T*\n`;
  }
  stream += "ET\n";

  // ── Assemble PDF objects ──────────────────────────────────────────────────
  // Each string in `objects` maps to one indirect PDF object (N 0 obj … endobj).
  // Object indices are 1-based and must be consistent with the xref table below.
  const objects = [];

  // Obj 1: Document catalog — entry point for any PDF reader
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Obj 2: Pages dictionary — declares single-page document
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // Obj 3: Page — A4-ish letter size (612×792 pts), references content + fonts
  objects.push(
    "3 0 obj\n" +
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\n" +
      "endobj\n",
  );

  // Obj 4: Content stream — the actual text drawing commands.
  // /Length must match the exact byte count of `stream` or readers will error.
  objects.push(
    "4 0 obj\n" +
      `<< /Length ${stream.length} >>\n` +
      "stream\n" +
      stream +
      "\nendstream\nendobj\n",
  );

  // Obj 5: Regular font — Helvetica is a standard PDF Type1 font (no embedding needed)
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );

  // Obj 6: Bold font — Helvetica-Bold, used for the title line only
  objects.push(
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  );

  // ── Build the PDF byte string with cross-reference table ─────────────────
  // PDF readers use the xref table to seek directly to any object by byte offset.
  // We track the byte position of each object as we append it to pdfContent.
  let pdfContent = "%PDF-1.4\n";
  const xrefPositions = [];

  for (const obj of objects) {
    xrefPositions.push(pdfContent.length); // record this object's start offset
    pdfContent += obj;
  }

  // startxref: byte offset of the xref table itself (reader jumps here first)
  const xrefOffset = pdfContent.length;
  const totalObjs = objects.length + 1; // +1 for the mandatory free object 0

  // xref section: one 20-byte entry per object (10-digit offset, 5-digit gen, n/f flag)
  pdfContent += `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const pos of xrefPositions) {
    pdfContent += `${String(pos).padStart(10, "0")} 00000 n \n`;
  }

  // trailer dictionary + startxref marker — required by PDF spec
  pdfContent += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\n`;
  pdfContent += `startxref\n${xrefOffset}\n%%EOF`;

  // ── Trigger browser file download ─────────────────────────────────────────
  // Create a temporary object URL from a Blob, click a hidden link, then revoke.
  // This approach works in all modern browsers without a server round-trip.
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trip-${riderName}-${dateStr}-summary.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // release memory — important for long-running sessions
};
