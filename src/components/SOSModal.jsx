import { useState, useEffect } from 'react';
import { ref, set, push } from 'firebase/database';
import { db } from '../config/firebase';
import './SOSModal.css';

export default function SOSModal({ isOpen, onClose, riderName, riderId, location, battery }) {
  const [isActivating, setIsActivating] = useState(false);
  const [sosActivated, setSOSActivated] = useState(false);
  const [countdownTimer, setCountdownTimer] = useState(5);
  const [emergencyContacts, setEmergencyContacts] = useState([
    { id: 1, name: 'Mom', phone: '+91-98765-43210', icon: '👩' },
    { id: 2, name: 'Dad', phone: '+91-87654-32109', icon: '👨' },
    { id: 3, name: 'Emergency', phone: '112', icon: '🚨' },
  ]);

  // Countdown timer before SOS activation
  useEffect(() => {
    if (!isActivating || countdownTimer <= 0) return;

    const timer = setTimeout(() => {
      setCountdownTimer(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isActivating, countdownTimer]);

  // Trigger SOS when countdown reaches 0
  useEffect(() => {
    if (isActivating && countdownTimer === 0) {
      handleSOSActivation();
    }
  }, [countdownTimer, isActivating]);

  const handleSOSActivation = async () => {
    try {
      const sosId = `sos-${Date.now()}`;
      const sosRef = ref(db, `riders/${riderId}/emergencies/${sosId}`);

      await set(sosRef, {
        status: 'ACTIVE',
        timestamp: new Date().toISOString(),
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        } : null,
        battery: battery,
        riderName: riderName,
      });

      // Notify parent/watcher
      const alertRef = ref(db, `alerts/${sosId}`);
      await push(alertRef, {
        type: 'SOS_EMERGENCY',
        riderId: riderId,
        riderName: riderName,
        timestamp: new Date().toISOString(),
        location: location,
        battery: battery,
        status: 'PENDING',
      });

      setSOSActivated(true);
      setIsActivating(false);
    } catch (error) {
      console.error('SOS activation error:', error);
      alert(`Error: ${error.message}`);
      setIsActivating(false);
    }
  };

  const handleCancel = () => {
    setIsActivating(false);
    setCountdownTimer(5);
    setSOSActivated(false);
  };

  const handleCallContact = (phone) => {
    if (navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone')) {
      window.location.href = `tel:${phone.replace(/\D/g, '')}`;
    } else {
      alert(`Call: ${phone}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sos-modal-overlay">
      <div className="sos-modal-content">
        {!isActivating && !sosActivated ? (
          // SOS Activation Screen
          <>
            <div className="sos-header">
              <h2>🆘 Emergency Alert</h2>
              <button className="sos-close" onClick={onClose}>✕</button>
            </div>

            <div className="sos-warning">
              <p>Hold button below for 5 seconds to activate SOS</p>
              <p className="sos-info">Alerts parent/watcher + logs location</p>
            </div>

            {/* Emergency Contacts */}
            <div className="emergency-contacts">
              <h3>Quick Call</h3>
              <div className="contacts-grid">
                {emergencyContacts.map(contact => (
                  <button
                    key={contact.id}
                    className="contact-btn"
                    onClick={() => handleCallContact(contact.phone)}
                  >
                    <span className="contact-icon">{contact.icon}</span>
                    <span className="contact-name">{contact.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SOS Activation Button */}
            <button
              className="sos-activate-btn"
              onMouseDown={() => setIsActivating(true)}
              onMouseUp={handleCancel}
              onTouchStart={() => setIsActivating(true)}
              onTouchEnd={handleCancel}
              onTouchCancel={handleCancel}
            >
              🆘 Hold to Activate SOS
            </button>

            <button className="sos-cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </>
        ) : isActivating && !sosActivated ? (
          // Countdown Screen
          <>
            <div className="sos-countdown-container">
              <div className="countdown-circle">
                <span className="countdown-number">{countdownTimer}</span>
              </div>
              <p className="countdown-text">Release to cancel</p>
            </div>
          </>
        ) : (
          // SOS Activated Confirmation
          <>
            <div className="sos-activated">
              <div className="success-icon">✓</div>
              <h2>SOS Activated!</h2>

              <div className="sos-details">
                <p><strong>Rider:</strong> {riderName}</p>
                {location && (
                  <>
                    <p><strong>Lat:</strong> {location.latitude.toFixed(4)}</p>
                    <p><strong>Lon:</strong> {location.longitude.toFixed(4)}</p>
                  </>
                )}
                <p><strong>Battery:</strong> {battery}%</p>
              </div>

              <div className="sos-alert-box">
                <p>Parent/Watcher has been notified immediately.</p>
                <p>📍 Your location is being tracked in real-time.</p>
              </div>

              <button className="sos-close-btn" onClick={() => {
                handleCancel();
                onClose();
              }}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}