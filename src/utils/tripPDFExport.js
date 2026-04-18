import { generateImpactReport } from './ecoImpactCalculations';

export const generateTripSummary = (tripData) => {
  const {
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    battery = 85,
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

export const downloadTripPDF = (tripData) => {
  const {
    riderName = 'Rider',
    distance = 0,
    duration = 0,
    ecoScore = 0,
    avgSpeed = 0,
    battery = 85,
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

  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
4 0 obj
<< /Length 2200 >>
stream
BT
/F2 18 Tf
50 750 Td
(FamilyTrack EV - Trip Summary) Tj
0 -30 Td
/F1 11 Tf
(Rider: ${riderName}) Tj
0 -16 Td
(Date: ${dateStr} at ${timeStr}) Tj
0 -30 Td
/F2 13 Tf
(Trip Details) Tj
0 -22 Td
/F1 10 Tf
(Distance: ${distance.toFixed(2)} km) Tj
0 -16 Td
(Duration: ${durationMins}m ${durationSecs}s) Tj
0 -16 Td
(Average Speed: ${avgSpeed.toFixed(1)} km/h) Tj
0 -16 Td
(Battery Used: ${batteryUsed}%) Tj
0 -16 Td
(Battery Remaining: ${100 - batteryUsed}%) Tj
0 -28 Td
/F2 13 Tf
(Eco-Score Analysis) Tj
0 -22 Td
/F1 10 Tf
(Score: ${ecoScore}/100) Tj
0 -16 Td
(Rating: ${summary.efficiency.rating}) Tj
0 -16 Td
(Improvement Potential: ${100 - ecoScore}%) Tj
0 -28 Td
/F2 13 Tf
(Environmental Impact) Tj
0 -22 Td
/F1 10 Tf
(CO2 Saved: ${impactReport.co2.saved.toFixed(2)} kg) Tj
0 -16 Td
(vs Petrol: ${impactReport.co2.petrolEquivalent.toFixed(2)} kg) Tj
0 -16 Td
(Tree Equivalents: ${impactReport.impact.treeEquivalents.toFixed(2)} trees) Tj
0 -28 Td
/F2 13 Tf
(Recommendations) Tj
0 -22 Td
/F1 10 Tf
${ecoScore >= 80 
  ? '(Excellent! Maintain smooth acceleration patterns.)' 
  : ecoScore >= 60 
  ? '(Good ride. Focus on steady speed for better efficiency.)' 
  : '(Aggressive riding detected. Ease off for better range.)'}
Tj
0 -16 Td
(${summary.efficiency.tip}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000270 00000 n 
0000002530 00000 n 
0000002610 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
2693
%%EOF`;

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