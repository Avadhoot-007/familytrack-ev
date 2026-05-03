// tripPDFExport.js — Generate and download trip summary as PDF
// Used by WatcherDashboard and TripSummaryCard
import { generateImpactReport } from './ecoImpactCalculations';

// Summarize trip metrics and efficiency
export const generateTripSummary = (tripData) => {
  const {
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 15,
  } = tripData;

  return {
    metrics: {
      distance: distance.toFixed(2),
      duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
      avgSpeed: avgSpeed.toFixed(1),
      ecoScore,
      batteryUsed,
      batteryRemaining: 100 - batteryUsed,
    },
    efficiency: {
      rating: ecoScore >= 80 ? 'Excellent' : ecoScore >= 60 ? 'Good' : 'Poor',
      range: batteryUsed > 0 ? (100 / batteryUsed * duration / 3600).toFixed(1) : 'N/A',
      tip: ecoScore >= 80
        ? 'Keep smooth acceleration'
        : ecoScore >= 60
        ? 'Cruise at 40 km/h for +20% range'
        : 'Smooth acceleration saves battery',
    },
  };
};

// ---------------------------------------------------------------------------
// downloadTripPDF — used by WatcherDashboard
// FIX 1: removed hardcoded /Length 2200 — replaced with dynamic byte count
// FIX 2: no non-ASCII chars in PDF stream (Helvetica Type1 = no Unicode)
// FIX 3: proper PDF escape for ( ) \ in string literals
// ---------------------------------------------------------------------------

export const downloadTripPDF = (tripData) => {
  const {
    riderName = 'Rider',
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    batteryUsed = 15,
    timestamp = new Date().toISOString(),
  } = tripData;

  const impactReport = generateImpactReport(tripData);
  const summary = generateTripSummary(tripData);

  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMins = Math.floor(duration / 60);
  const durationSecs = duration % 60;

  const rating = summary.efficiency.rating;
  const tip = summary.efficiency.tip;

  const scoreComment =
    ecoScore >= 80
      ? 'Excellent! Maintain smooth acceleration patterns.'
      : ecoScore >= 60
      ? 'Good ride. Focus on steady speed for better efficiency.'
      : 'Aggressive riding detected. Ease off for better range.';

  // Helper: escape PDF string special chars
  const esc = (s) =>
    String(s)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  // Build lines — ASCII only, no Unicode symbols
  const LIGHT = '-'.repeat(60);
  const lines = [
    `FamilyTrack EV - Trip Summary`,
    ``,
    `Rider: ${riderName}`,
    `Date:  ${dateStr} at ${timeStr}`,
    ``,
    `TRIP DETAILS`,
    LIGHT,
    `Distance:          ${distance.toFixed(2)} km`,
    `Duration:          ${durationMins}m ${durationSecs}s`,
    `Average Speed:     ${avgSpeed.toFixed(1)} km/h`,
    `Battery Used:      ${batteryUsed}%`,
    `Battery Remaining: ${100 - batteryUsed}%`,
    ``,
    `ECO-SCORE ANALYSIS`,
    LIGHT,
    `Score:             ${ecoScore}/100`,
    `Rating:            ${rating}`,
    `Improvement:       ${100 - ecoScore}%`,
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
    tip,
    ``,
    `Keep riding green! Every km counts toward sustainability.`,
    `Generated: ${new Date().toLocaleString()}`,
  ];

  // Build content stream
  let stream = 'BT\n/F1 10 Tf\n50 740 Td\n14 TL\n';
  // Title in bold (F2)
  stream += `/F2 14 Tf (${esc(lines[0])}) Tj T*\n/F1 10 Tf\n`;
  for (let i = 1; i < lines.length; i++) {
    stream += `(${esc(lines[i])}) Tj T*\n`;
  }
  stream += 'ET\n';

  // Object offsets for xref
  const objects = [];

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  // Obj 2: Pages (single page)
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  // Obj 3: Page
  objects.push(
    '3 0 obj\n' +
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
    '/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\n' +
    'endobj\n'
  );
  // Obj 4: Content stream — FIX: dynamic /Length
  objects.push(
    '4 0 obj\n' +
    `<< /Length ${stream.length} >>\n` +
    'stream\n' +
    stream +
    '\nendstream\nendobj\n'
  );
  // Obj 5: regular font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  // Obj 6: bold font
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  // Assemble PDF with correct xref
  let pdfContent = '%PDF-1.4\n';
  const xrefPositions = [];
  for (const obj of objects) {
    xrefPositions.push(pdfContent.length);
    pdfContent += obj;
  }

  const xrefOffset = pdfContent.length;
  const totalObjs = objects.length + 1;
  pdfContent += `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const pos of xrefPositions) {
    pdfContent += `${String(pos).padStart(10, '0')} 00000 n \n`;
  }
  pdfContent += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\n`;
  pdfContent += `startxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trip-${riderName}-${dateStr}-summary.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};