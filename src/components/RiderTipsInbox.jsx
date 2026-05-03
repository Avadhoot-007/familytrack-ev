// RiderTipsInbox: Notification hub for coaching tips sent by watchers
// Displays: priority-based tips (high/medium/low/info), marks read/unread
import { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../config/firebase';

const PRIORITY_META = {
  high:   { color: '#f44336', bg: 'rgba(244,67,54,0.12)',   border: 'rgba(244,67,54,0.35)',   label: 'HIGH' },
  medium: { color: '#ff9800', bg: 'rgba(255,152,0,0.12)',   border: 'rgba(255,152,0,0.35)',   label: 'MED'  },
  low:    { color: '#4CAF50', bg: 'rgba(76,175,80,0.12)',   border: 'rgba(76,175,80,0.35)',   label: 'LOW'  },
  info:   { color: '#2196F3', bg: 'rgba(33,150,243,0.12)',  border: 'rgba(33,150,243,0.35)',  label: 'INFO' },
};

const CATEGORY_ICONS = {
  battery:     '🔋',
  throttle:    '⚡',
  speed:       '⏱️',
  braking:     '🛑',
  route:       '🗺️',
  encouragement: '🎯',
  achievement: '🏆',
  weather:     '🌧️',
};

export default function RiderTipsInbox({ riderId }) {
  const [tips, setTips]         = useState([]);
  const [open, setOpen]         = useState(false);
  const [unread, setUnread]     = useState(0);

  // ── Firebase listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!riderId) return;
    const tipsRef = ref(db, `riders/${riderId}/coachingTips`);
    const unsub = onValue(tipsRef, (snap) => {
      const data = snap.val();
      if (!data) { setTips([]); setUnread(0); return; }
      const list = Object.entries(data)
        .map(([key, tip]) => ({ ...tip, key }))
        .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
      setTips(list);
      setUnread(list.filter((t) => !t.read).length);
    });
    return () => unsub();
  }, [riderId]);

  // ── Mark a tip read ────────────────────────────────────────────────────────
  const markRead = async (tipKey) => {
    try {
      await update(ref(db, `riders/${riderId}/coachingTips/${tipKey}`), { read: true });
    } catch (e) {
      console.error('markRead error:', e);
    }
  };

  // ── Mark all read when drawer opens ───────────────────────────────────────
  const handleOpen = () => {
    setOpen(true);
    tips.filter((t) => !t.read).forEach((t) => markRead(t.key));
  };

  if (!riderId) return null;

  const meta = (priority) => PRIORITY_META[priority] ?? PRIORITY_META.info;

  return (
    <>
      {/* ── Floating badge button ─────────────────────────────────────────── */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        style={{
          position: 'fixed',
          bottom: '88px',       /* sits above SOS toast stack area */
          left: '20px',
          zIndex: 1500,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: 'none',
          background: unread > 0
            ? 'linear-gradient(135deg, #ff9800, #f44336)'
            : 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
          boxShadow: unread > 0
            ? '0 4px 18px rgba(255,152,0,0.5)'
            : '0 4px 12px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          transition: 'all 0.2s',
          animation: unread > 0 ? 'tipBadgePulse 2s infinite' : 'none',
          outline: 'none',
          border: unread > 0 ? '2px solid rgba(255,152,0,0.6)' : '2px solid #333',
        }}
        title={unread > 0 ? `${unread} unread tip${unread > 1 ? 's' : ''}` : 'Coaching tips'}
      >
        💡
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#f44336',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '11px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #121212',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1600,
            animation: 'drawerFadeIn 0.2s ease',
          }}
        />
      )}

      {/* ── Slide-up drawer ───────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1700,
        background: '#1a1a1a',
        borderRadius: '18px 18px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        border: '1px solid #2a2a2a',
        borderBottom: 'none',
        maxHeight: '72vh',
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        pointerEvents: open ? 'all' : 'none',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px 12px',
          borderBottom: '1px solid #2a2a2a',
          flexShrink: 0,
        }}>
          {/* Drag handle */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '36px',
            height: '4px',
            background: '#444',
            borderRadius: '2px',
          }} />

          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: '700' }}>
              💡 Coaching Tips
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#666' }}>
              {tips.length === 0 ? 'No tips yet' : `${tips.length} tip${tips.length > 1 ? 's' : ''} from your watcher`}
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            style={{
              background: '#2a2a2a', border: '1px solid #444',
              color: '#aaa', borderRadius: '8px', cursor: 'pointer',
              padding: '6px 10px', fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tip list */}
        <div style={{ overflowY: 'auto', padding: '12px 16px 24px', flex: 1 }}>
          {tips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏁</div>
              <p style={{ margin: 0, fontSize: '14px' }}>No tips sent yet.</p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#444' }}>
                Your watcher will send tips based on your ride.
              </p>
            </div>
          ) : (
            tips.map((tip) => {
              const m = meta(tip.priority);
              const icon = CATEGORY_ICONS[tip.category] ?? '💡';
              const timeAgo = formatTimeAgo(tip.sentAt);
              return (
                <div
                  key={tip.key}
                  style={{
                    background: tip.read ? '#1e1e1e' : m.bg,
                    border: `1px solid ${tip.read ? '#2a2a2a' : m.border}`,
                    borderLeft: `4px solid ${tip.read ? '#333' : m.color}`,
                    borderRadius: '10px',
                    padding: '14px',
                    marginBottom: '10px',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px', lineHeight: 1 }}>{icon}</span>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: tip.read ? '#aaa' : '#fff' }}>
                        {tip.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {!tip.read && (
                        <span style={{
                          background: m.color, color: '#fff',
                          borderRadius: '4px', fontSize: '10px',
                          fontWeight: '700', padding: '2px 5px',
                        }}>
                          {m.label}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#555' }}>{timeAgo}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: tip.read ? '#666' : '#ccc', lineHeight: '1.5' }}>
                    {tip.message}
                  </p>
                  {tip.sentBy && (
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#555' }}>
                      Sent by {tip.sentBy}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Keyframes injected once ───────────────────────────────────────── */}
      <style>{`
        @keyframes tipBadgePulse {
          0%, 100% { box-shadow: 0 4px 18px rgba(255,152,0,0.5); }
          50%       { box-shadow: 0 4px 28px rgba(255,152,0,0.85); }
        }
        @keyframes drawerFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}

function formatTimeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}