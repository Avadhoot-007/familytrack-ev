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

  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMins = Math.floor(duration / 60);
  const durationSecs = duration % 60;
  const ecoRating = ecoScore >= 80 ? 'Excellent' : ecoScore >= 60 ? 'Good' : 'Poor';
  const improvement = 100 - ecoScore;

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
<< /Length 1800 >>
stream
BT
/F2 20 Tf
50 740 Td
(FamilyTrack EV - Trip Summary) Tj
0 -40 Td
/F1 12 Tf
(Rider: ${riderName}) Tj
0 -20 Td
(Date: ${dateStr} at ${timeStr}) Tj
0 -40 Td
/F2 14 Tf
(Trip Details) Tj
0 -25 Td
/F1 11 Tf
(Distance: ${distance.toFixed(2)} km) Tj
0 -18 Td
(Duration: ${durationMins}m ${durationSecs}s) Tj
0 -18 Td
(Average Speed: ${avgSpeed.toFixed(1)} km/h) Tj
0 -18 Td
(Battery Used: ${batteryUsed}%) Tj
0 -18 Td
(Battery Remaining: ${100 - batteryUsed}%) Tj
0 -30 Td
/F2 14 Tf
(Eco-Score Analysis) Tj
0 -25 Td
/F1 11 Tf
(Score: ${ecoScore}/100) Tj
0 -18 Td
(Rating: ${ecoRating}) Tj
0 -18 Td
(Improvement Potential: ${improvement}%) Tj
0 -30 Td
/F2 14 Tf
(Recommendations) Tj
0 -25 Td
/F1 10 Tf
${ecoScore >= 80 
  ? '(Excellent! Keep smooth acceleration patterns.)' 
  : ecoScore >= 60 
  ? '(Good ride. Cruise at 40 km/h for better range.)' 
  : '(Aggressive riding detected. Smooth acceleration saves fuel.)'}
Tj
0 -18 Td
(Projected Range: ${(100 / batteryUsed * durationMins / 60).toFixed(1)} hours at full battery) Tj
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
0000000260 00000 n 
0000002110 00000 n 
0000002190 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
2273
%%EOF`;

  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trip-${riderName}-${dateStr}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

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
      range: (100 / batteryUsed * duration / 60).toFixed(0),
      tip: ecoScore >= 80 
        ? 'Keep smooth acceleration'
        : ecoScore >= 60
        ? 'Cruise at 40 km/h for +20% range'
        : 'Smooth acceleration saves ₹500/year',
    },
  };
};