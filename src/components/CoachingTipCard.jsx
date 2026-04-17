import { useState, useEffect } from 'react';
import { ref, push, set, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { generateCoachingTips, getTipIcon } from '../utils/coachingTips';
import './CoachingTipCard.css';

export default function CoachingTipCard({ ecoScore, tripData, riderId, watcherId }) {
  const [tips, setTips] = useState([]);
  const [sentTips, setSentTips] = useState([]);
  const [selectedTip, setSelectedTip] = useState(null);
  const [isSending, setIsSending] = useState(false);

  // Generate tips on eco-score change
  useEffect(() => {
    const generatedTips = generateCoachingTips(ecoScore, tripData);
    setTips(generatedTips);
  }, [ecoScore, tripData]);

  // Listen for tips sent from Firebase
  useEffect(() => {
    if (!riderId) return;

    const tipsRef = ref(db, `riders/${riderId}/coachingTips`);
    onValue(tipsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tipsList = Object.entries(data).map(([key, tip]) => ({
          ...tip,
          id: key,
        }));
        setSentTips(tipsList.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
      } else {
        setSentTips([]);
      }
    });
  }, [riderId]);

  // Send tip to rider
  const sendTipToRider = async (tip) => {
    if (!riderId) {
      alert('Rider ID not set');
      return;
    }

    setIsSending(true);

    try {
      const tipsRef = ref(db, `riders/${riderId}/coachingTips`);
      await push(tipsRef, {
        ...tip,
        sentBy: watcherId || 'parent',
        sentAt: new Date().toISOString(),
        read: false,
      });

      alert(`✓ Tip sent: "${tip.title}"`);
      setSelectedTip(null);
    } catch (error) {
      alert(`Error sending tip: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Clear a sent tip
  const clearSentTip = async (tipId) => {
    try {
      const tipRef = ref(db, `riders/${riderId}/coachingTips/${tipId}`);
      await set(tipRef, null);
    } catch (error) {
      alert(`Error clearing tip: ${error.message}`);
    }
  };

  const priorityColor = {
    high: '#f44336',
    medium: '#FFC107',
    low: '#4CAF50',
  };

  return (
    <div className="coaching-tip-card">
      <h2>Coaching Tips</h2>
      <p className="eco-context">Based on Eco-Score: {ecoScore}/100</p>

      {/* Available Tips */}
      <div className="tips-section">
        <h3>Recommended Tips</h3>
        {tips.length === 0 ? (
          <p className="no-tips">No tips available. Riding perfectly! 🎉</p>
        ) : (
          <div className="tips-list">
            {tips.map((tip) => (
              <div
                key={tip.id}
                className="tip-card"
                style={{
                  borderLeft: `4px solid ${priorityColor[tip.priority]}`,
                }}
              >
                <div className="tip-header">
                  <h4>{getTipIcon(tip.category)} {tip.title}</h4>
                  <span className="priority-badge" style={{ background: priorityColor[tip.priority] }}>
                    {tip.priority.toUpperCase()}
                  </span>
                </div>

                <p className="tip-message">{tip.message}</p>

                <button
                  onClick={() => setSelectedTip(tip)}
                  className="btn btn-send-tip"
                >
                  📤 Send to Rider
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sent Tips History */}
      <div className="sent-tips-section">
        <h3>Tips Sent ({sentTips.length})</h3>
        {sentTips.length === 0 ? (
          <p className="no-tips">No tips sent yet.</p>
        ) : (
          <div className="sent-tips-list">
            {sentTips.map((sentTip) => (
              <div key={sentTip.id} className="sent-tip-card">
                <div className="sent-tip-header">
                  <h5>{getTipIcon(sentTip.category)} {sentTip.title}</h5>
                  <span className={`read-badge ${sentTip.read ? 'read' : 'unread'}`}>
                    {sentTip.read ? '✓ Read' : '○ Unread'}
                  </span>
                </div>

                <p className="sent-tip-message">{sentTip.message}</p>

                <div className="sent-tip-meta">
                  <small>
                    Sent {new Date(sentTip.sentAt).toLocaleDateString()} at{' '}
                    {new Date(sentTip.sentAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                  <button
                    onClick={() => clearSentTip(sentTip.id)}
                    style={{
                      marginLeft: '10px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    🗑️ Clear
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Confirm Send */}
      {selectedTip && (
        <div className="modal-overlay" onClick={() => setSelectedTip(null)}>
          <div className="modal-content">
            <h3>Send Coaching Tip?</h3>
            <p className="modal-tip-title">{selectedTip.title}</p>
            <p className="modal-tip-message">{selectedTip.message}</p>

            <div className="modal-actions">
              <button
                onClick={() => setSelectedTip(null)}
                className="btn btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => sendTipToRider(selectedTip)}
                disabled={isSending}
                className="btn btn-confirm"
              >
                {isSending ? '⏳ Sending...' : '✓ Send Tip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}