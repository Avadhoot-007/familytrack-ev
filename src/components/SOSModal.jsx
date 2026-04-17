import { useState, useEffect, useRef } from 'react';
import { ref, set, update } from 'firebase/database';
import { db } from '../config/firebase';
import './SOSModal.css';

export default function SOSModal({ isOpen, onClose, riderName, riderId, location, battery }) {
  const [isActivating, setIsActivating] = useState(false);
  const [sosActivated, setSOSActivated] = useState(false);
  const [countdownTimer, setCountdownTimer] = useState(5);
  const isHoldingRef = useRef(false);
  const [emergencyContacts] = useState([
    { id: 1, name: 'Mom', phone: '+91-98765-43210', icon: '👩' },
    { id: 2, name: 'Dad', phone: '+91-87654-32109', icon: '👨' },
    { id: 3, name: 'Emergency', phone: '112', icon: '🚨' },
  ]);

  useEffect(() => {
    if (!isActivating || countdownTimer <= 0) return;
    const timer = setTimeout(() => {
      setCountdownTimer(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [isActivating, countdownTimer]);

  useEffect(() => {
    if (!isActivating) return;
    
    const handlePointerUp = () => {
      if (isHoldingRef.current) {
        isHoldingRef.current = false;
        setIsActivating(false);
        setCountdownTimer(5);
      }
    };

    document.addEventListener('pointerup', handlePointerUp);
    return () => document.removeEventListener('pointerup', handlePointerUp);
  }, [isActivating]);

  useEffect(() => {
    if (isActivating && countdownTimer === 0) {
      handleSOSActivation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownTimer, isActivating]);

  const handleSOSActivation = async () => {
    try {
      // Write sosTriggered flag on the rider node — the watcher's onValue listener
      // already watches `riders/` and will pick this up immediately.
      await update(ref(db, `riders/${riderId}`), {
        sosTriggered: true,
        sosTimestamp: new Date().toISOString(),
        sosLocation: location
          ? {
              lat: location.latitude,
              lon: location.longitude,
              accuracy: location.accuracy ?? null,
            }
          : null,
        sosBattery: battery,
        sosRiderName: riderName,
      });

      setSOSActivated(true);
      setIsActivating(false);
    } catch (error) {
      console.error('SOS activation error:', error);
      alert(`Error: ${error.message}`);
      setIsActivating(false);
    }
  };

  const handleClose = () => {
    setIsActivating(false);
    setSOSActivated(false);
    setCountdownTimer(5);
    onClose();
  };

  const handleCallContact = (phone) => {
    if (/Android|iPhone/i.test(navigator.userAgent)) {
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
          <>
            <div className="sos-header">
              <h2>🆘 Emergency Alert</h2>
              <button className="sos-close" onClick={handleClose}>✕</button>
            </div>

            <div className="sos-warning">
              <p>Hold button below for 5 seconds to activate SOS</p>
              <p className="sos-info">Alerts parent/watcher + logs location</p>
            </div>

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

            <button
              className="sos-activate-btn"
              onPointerDown={() => {
                isHoldingRef.current = true;
                setIsActivating(true);
              }}
            >
              🆘 Hold to Activate SOS
            </button>

            <button className="sos-cancel-btn" onClick={handleClose}>
              Cancel
            </button>
          </>
        ) : isActivating && !sosActivated ? (
          <>
            <div className="sos-countdown-container">
              <div className="countdown-circle">
                <span className="countdown-number">{countdownTimer}</span>
              </div>
              <p className="countdown-text">Release to cancel</p>
            </div>
          </>
        ) : (
          <>
            <div className="sos-activated">
              <div className="success-icon">✓</div>
              <h2>SOS Activated!</h2>

              <div className="sos-details">
                <p><strong>Rider:</strong> {riderName || riderId || 'Unknown'}</p>
                {location && location.latitude != null && location.longitude != null && (
                  <>
                    <p><strong>Lat:</strong> {location.latitude.toFixed(4)}</p>
                    <p><strong>Lon:</strong> {location.longitude.toFixed(4)}</p>
                  </>
                )}
                <p><strong>Battery:</strong> {battery != null ? `${battery}%` : 'N/A'}</p>
              </div>

              <div className="sos-alert-box">
                <p>Parent/Watcher has been notified immediately.</p>
                <p>📍 Your location is being tracked in real-time.</p>
              </div>

              <button className="sos-close-btn" onClick={handleClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}