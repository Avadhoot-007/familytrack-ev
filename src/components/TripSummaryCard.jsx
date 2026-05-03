// TripSummaryCard: Post-trip summary with eco metrics, battery consumption, PDF export
// Displays: eco score, CO2 saved, range projections, speed metrics
import { useState } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../config/firebase';
import { downloadTripPDF } from '../utils/ecoImpactCalculations';
import './TripSummaryCard.css';

// Ather Rizta Z Battery Specs (3.7 kWh)
const BATTERY_SPECS = {
  capacity: 3700, // Wh (3.7 kWh)
  consumption: {
    eco: 33,        // Wh/km (eco/smooth riding)
    normal: 37,     // Wh/km (average)
    aggressive: 46, // Wh/km (aggressive/city)
  },
};

export default function TripSummaryCard({ trip, riderId }) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Guard clause for missing trip data
  if (!trip) {
    return <div className="trip-summary-card">No trip data available</div>;
  }

  // Use trip data as-is (passed from RiderDashboard with real GPS & consumption values)
  const distance = trip.distance || 0;
  const duration = trip.duration || 0; // in seconds
  const ecoScore = trip.ecoScore || 0;
  const batteryUsed = trip.batteryUsed || 0; // calculated from consumption × distance
  const batteryRemaining = trip.batteryRemaining || 0; // post-trip battery %
  const timestamp = trip.timestamp || new Date().toISOString();
  const avgSpeed = trip.avgSpeed || 0;
  const riderName = trip.riderName || 'Rider';

  // Determine ride style from eco score
  const getRideStyle = () => {
    if (ecoScore >= 80) return 'eco';
    if (ecoScore >= 60) return 'normal';
    return 'aggressive';
  };

  const rideStyle = getRideStyle();
  const consumptionRate = BATTERY_SPECS.consumption[rideStyle];

  // Calculate battery state in Wh for projections
  const batteryCapacityWh = BATTERY_SPECS.capacity;
  const batteryRemainingWh = (batteryRemaining / 100) * batteryCapacityWh;

  // Calculate realistic range and time projections for remaining battery
  const calculateProjection = (consumption) => {
    if (batteryRemaining <= 0) return { range: '0', minutes: '0', hours: 0, mins: 0 };
    
    // Range = remaining battery (Wh) / consumption rate (Wh/km)
    const rangeKm = batteryRemainingWh / consumption;
    
    // Time to empty = range / avg speed (convert to minutes)
    const avgSpeedKmh = parseFloat(avgSpeed) || 25; // fallback to 25 km/h
    const minutes = avgSpeedKmh > 0 ? (rangeKm / avgSpeedKmh) * 60 : 0;
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    return { 
      range: rangeKm.toFixed(1), 
      minutes: minutes.toFixed(0), 
      hours, 
      mins 
    };
  };

  const projection = calculateProjection(consumptionRate);
  const ecoProjection = calculateProjection(BATTERY_SPECS.consumption.eco);

  const ecoRating = ecoScore >= 80 ? 'Excellent' : ecoScore >= 60 ? 'Good' : 'Poor';
  const ecoColor = ecoScore >= 80 ? '#4CAF50' : ecoScore >= 60 ? '#FFC107' : '#f44336';

  // Safe date formatting
  const tripDate = new Date(timestamp);
  const formattedDate = isNaN(tripDate.getTime()) ? 'Invalid Date' : tripDate.toLocaleDateString();

  // Format duration in seconds to readable time
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Export PDF
  const handleExportPDF = async () => {
    setIsGenerating(true);
    try {
      downloadTripPDF({
        riderName: riderName,
        distance: distance,
        duration: duration,
        ecoScore: ecoScore,
        avgSpeed: parseFloat(avgSpeed),
        battery: batteryRemaining,
        batteryUsed: batteryUsed,
        timestamp: timestamp,
        worstAxis: trip.worstAxis || 'speed',
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save trip to Firebase (usually already saved from RiderDashboard)
  const saveTrip = async () => {
    if (!riderId) {
      alert('Rider ID required.');
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
        rideStyle,
        consumptionWh: consumptionRate,
      });
      alert('Trip saved ✓');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const formatTime = (hours, mins) => {
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="trip-summary-card">
      <h2>Trip Summary</h2>

      <div className="trip-stats-grid">
        <div className="stat-box">
          <p className="stat-label">Distance</p>
          <p className="stat-value">{distance.toFixed(2)} km</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Duration</p>
          <p className="stat-value">{formatDuration(duration)}</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Avg Speed</p>
          <p className="stat-value">{parseFloat(avgSpeed).toFixed(1)} km/h</p>
        </div>

        <div className="stat-box">
          <p className="stat-label">Battery Used</p>
          <p className="stat-value">{batteryUsed.toFixed(1)}%</p>
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
                : '⚠️ Aggressive riding. Smooth acceleration saves battery.'}
            </p>
          </div>
        </div>
      </div>

      {/* Battery Projection */}
      <div className="battery-projection">
        <h3>Battery Projection</h3>
        <p>
          Current style <strong>({rideStyle}, {consumptionRate} Wh/km)</strong>: 
          <strong>{formatTime(projection.hours, projection.mins)}</strong> remaining ({projection.range} km)
        </p>
        <p className="projection-tip">
          💚 Eco-style riding <strong>(33 Wh/km)</strong>: 
          <strong>{formatTime(ecoProjection.hours, ecoProjection.mins)}</strong> ({ecoProjection.range} km)
        </p>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button onClick={saveTrip} className="btn btn-primary">
          💾 Save Trip
        </button>
        <button
          onClick={handleExportPDF}
          disabled={isGenerating}
          className="btn btn-secondary"
        >
          {isGenerating ? '⏳ Generating...' : '📄 Export PDF'}
        </button>
      </div>
    </div>
  );
}