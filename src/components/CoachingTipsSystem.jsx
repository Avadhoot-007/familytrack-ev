import React, { useState } from 'react';

const CoachingTipsSystem = ({ tips = [], ecoScore = 0, onDismiss = () => {} }) => {
  const [dismissedTipIds, setDismissedTipIds] = useState(new Set());

  const visibleTips = tips.filter(tip => !dismissedTipIds.has(tip.title));
  const highPriority = visibleTips.filter(t => t.priority === 'critical' || t.priority === 'high');
  const otherTips = visibleTips.filter(t => t.priority !== 'critical' && t.priority !== 'high');

  const handleDismiss = (tipTitle) => {
    setDismissedTipIds(new Set([...dismissedTipIds, tipTitle]));
  };

  if (!visibleTips.length) return null;

  const displayTips = [...highPriority, ...otherTips].slice(0, 3);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
        animation: 'slideUp 0.4s ease-out',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(26, 126, 50, 0.3); }
          50% { box-shadow: 0 4px 30px rgba(26, 126, 50, 0.6); }
        }
      `}</style>

      {displayTips.map((tip, idx) => {
        const bgColor =
          tip.priority === 'critical' ? '#dc3545' :
          tip.priority === 'high' ? '#ff9800' :
          tip.priority === 'info' ? '#2196F3' :
          '#28a745';

        const isCritical = tip.priority === 'critical' || tip.priority === 'high';

        return (
          <div
            key={tip.title}
            style={{
              background: bgColor,
              color: 'white',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: idx < displayTips.length - 1 ? '12px' : 0,
              maxWidth: '320px',
              boxShadow: isCritical
                ? '0 4px 20px rgba(220, 53, 69, 0.4)'
                : '0 4px 12px rgba(0, 0, 0, 0.2)',
              animation: isCritical ? 'pulse 2s infinite' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{tip.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                  {tip.title}
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4', marginBottom: '8px' }}>
                  {tip.tip}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '8px' }}>
                  {tip.metric}
                </div>
                <button
                  onClick={() => handleDismiss(tip.title)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Standalone Modal Version (for dashboard card)
export const CoachingTipsModal = ({ isOpen, tips = [], onClose }) => {
  if (!isOpen) return null;

  const criticalTips = tips.filter(t => t.priority === 'critical' || t.priority === 'high');
  const otherTips = tips.filter(t => t.priority !== 'critical' && t.priority !== 'high');
  const allTips = [...criticalTips, ...otherTips];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>💡 Coaching Tips</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
            }}
          >
            ✕
          </button>
        </div>

        {allTips.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allTips.map((tip) => {
              const borderColor =
                tip.priority === 'critical' ? '#dc3545' :
                tip.priority === 'high' ? '#ff9800' :
                tip.priority === 'info' ? '#2196F3' :
                '#28a745';

              return (
                <div
                  key={tip.title}
                  style={{
                    border: `2px solid ${borderColor}`,
                    borderRadius: '8px',
                    padding: '12px',
                    background: '#f9f9f9',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{tip.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>
                        {tip.title}
                      </div>
                      <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#555', marginBottom: '6px' }}>
                        {tip.tip}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999' }}>
                        {tip.metric}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#666', textAlign: 'center', margin: '20px 0' }}>
            No coaching tips available.
          </p>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '10px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Got It
        </button>
      </div>
    </div>
  );
};

export default CoachingTipsSystem;