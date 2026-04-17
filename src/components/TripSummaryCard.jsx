import { useState } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../config/firebase';
import './TripSummaryCard.css';

export default function TripSummaryCard({ trip, riderId }) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Guard clause for missing trip data
  if (!trip) {
    return <div className="trip-summary-card">No trip data available</div>;
  }
  const distance = trip.distance || 8.2; // km
  const duration = trip.duration || 12; // minutes
  const ecoScore = trip.ecoScore || 82; // 0-100
  const batteryUsed = trip.batteryUsed || 18; // percentage
  const batteryRemaining = trip.batteryRemaining || 67;
  const timestamp = trip.timestamp || new Date().toISOString();

  const avgSpeed = distance > 0 ? ((distance / duration) * 60).toFixed(1) : 0; // km/h
  const ecoRating = ecoScore >= 80 ? 'Excellent' : ecoScore >= 60 ? 'Good' : 'Poor';
  const ecoColor = ecoScore >= 80 ? '#4CAF50' : ecoScore >= 60 ? '#FFC107' : '#f44336';

  // Safe battery projections
  const batteryProjection = batteryUsed > 0 ? (100 / batteryUsed * duration).toFixed(0) : 'N/A';
  const ecoProjection = batteryUsed > 0 ? (100 / batteryUsed * duration * 1.3).toFixed(0) : 'N/A';

  // Safe date formatting
  const tripDate = new Date(timestamp);
  const formattedDate = isNaN(tripDate.getTime()) ? 'Invalid Date' : tripDate.toLocaleDateString();

  // Generate PDF (client-side, text-based)
  const generatePDF = () => {
    setIsGenerating(true);

    // Simple PDF generation (text content)
    const pdfContent = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 1200 >>
stream
BT
/F1 24 Tf
50 750 Td
(FamilyTrack EV - Trip Summary) Tj
0 -50 Td
/F1 12 Tf
(Trip Date: ${formattedDate}) Tj
0 -25 Td
(Duration: ${duration} minutes) Tj
0 -20 Td
(Distance: ${distance} km) Tj
0 -20 Td
(Average Speed: ${avgSpeed} km/h) Tj
0 -20 Td
(Eco-Score: ${ecoScore}/100 (${ecoRating})) Tj
0 -20 Td
(Battery Used: ${batteryUsed}%) Tj
0 -20 Td
(Battery Remaining: ${batteryRemaining}%) Tj
0 -40 Td
/F1 10 Tf
(Riding Style Analysis) Tj
0 -20 Td
${ecoScore >= 80 ? '(Amazing eco-driving! Keep smooth acceleration.)' : '(Tip: Cruise at 40 km/h for better efficiency.)'} Tj
0 -20 Td
(Battery Projection: At this rate, 100% lasts ~${batteryProjection} minutes) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000250 00000 n 
0000001500 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
1590
%%EOF
`;

    // Create blob and download
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsGenerating(false);
  };

  // Save trip to Firebase
  const saveTrip = async () => {
    if (!riderId) {
      alert('Rider ID is required to save the trip.');
      return;
    }
    try {
      const tripRef = ref(db, `riders/${riderId}/trips/${Date.now()}`);
      await set(tripRef, {
        distance,
        duration,
        ecoScore,
        batteryUsed,
        batteryRemaining,
        timestamp,
        createdAt: new Date().toISOString(),
      });
      alert('Trip saved to Firebase ✓');
    } catch (error) {
      alert(`Error saving trip: ${error.message}`);
    }
  };

  return (
    <div className="trip-summary-card">
      <h2>Trip Summary</h2>

      <div className="trip-stats-grid">
        <div className="stat-box">
          <p className="stat-label">Distance</p>
          <p className="stat-value">{distance} km</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Duration</p>
          <p className="stat-value">{duration} min</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Avg Speed</p>
          <p className="stat-value">{avgSpeed} km/h</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Battery Used</p>
          <p className="stat-value">{batteryUsed}%</p>
        </div>
      </div>

      {/* Eco-Score Gauge */}
      <div className="eco-score-section">
        <h3>Eco-Score</h3>
        <div className="eco-gauge-container">
          <div className="eco-gauge" style={{ backgroundColor: ecoColor }}>
            <span className="eco-value">{ecoScore}</span>
            <span className="eco-label">/100</span>
          </div>
          <div className="eco-text">
            <p className="eco-rating">{ecoRating}</p>
            <p className="eco-description">
              {ecoScore >= 80
                ? '🏆 Amazing eco-driving! Keep smooth acceleration.'
                : ecoScore >= 60
                ? '⚡ Good ride. Cruise at 40 km/h for +20% battery.'
                : '⚠️ Aggressive riding. Smooth acceleration saves ₹500/year.'}
            </p>
          </div>
        </div>
      </div>

      {/* Battery Projection */}
      <div className="battery-projection">
        <h3>Battery Projection</h3>
        <p>
          At current riding style: <strong>{batteryProjection} minutes</strong> on full charge (100%)
        </p>
        <p className="projection-tip">
          💡 Eco-style riding could extend this to{' '}
          <strong>{ecoProjection} minutes</strong>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button onClick={saveTrip} className="btn btn-primary">
          💾 Save Trip
        </button>
        <button
          onClick={generatePDF}
          disabled={isGenerating}
          className="btn btn-secondary"
        >
          {isGenerating ? '⏳ Generating...' : '📄 Download PDF'}
        </button>
      </div>
    </div>
  );
}