import { useState, useEffect, useCallback } from 'react';
import { ref, get, set, push, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';

const makeCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const ROLE_META = {
  rider:   { icon: '🚴', label: 'Rider',   color: '#4CAF50' },
  watcher: { icon: '👁️', label: 'Watcher', color: '#2196F3' },
};

export default function FamilyPanel({ familyId, userId, userRole, displayName }) {
  const [inviteCode, setInviteCode]         = useState('');
  const [members, setMembers]               = useState({});
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading]               = useState(true);
  const [regen, setRegen]                   = useState(false);
  const [copied, setCopied]                 = useState(false);
  const [error, setError]                   = useState('');
  const [authReady, setAuthReady]           = useState(false);
  const [resolvedUid, setResolvedUid]       = useState(auth.currentUser?.uid || userId || null);

  // ── Wait for Firebase Auth to restore session ─────────────────────────────
  useEffect(() => {
    // If already signed in, mark ready immediately
    if (auth.currentUser) {
      setResolvedUid(auth.currentUser.uid);
      setAuthReady(true);
      return;
    }
    // Otherwise wait for auth state to resolve (handles page refresh case)
    const unsub = onAuthStateChanged(auth, (user) => {
      setResolvedUid(user?.uid || userId || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, [userId]);

  // ── Fetch family data ─────────────────────────────────────────────────────
  const loadFamily = useCallback(async () => {
    if (!familyId) return;
    if (!authReady) return;
    // Guest users have no Firebase auth — skip the restricted read
    // and show a simplified view instead
    if (!resolvedUid) {
      setError('Sign in with Google to view family details.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const snap = await get(ref(db, `families/${familyId}`));
      if (!snap.exists()) { setError('Family not found.'); return; }
      const data = snap.val();
      setInviteCode(data.inviteCode || '');
      setMembers(data.members || {});

      // Fetch display names — rules now allow any auth'd user to read users/$uid
      const uids = Object.keys(data.members || {});
      const profiles = {};
      await Promise.all(uids.map(async (uid) => {
        try {
          const uSnap = await get(ref(db, `users/${uid}`));
          if (uSnap.exists()) profiles[uid] = uSnap.val();
        } catch { /* ignore per-member errors */ }
      }));
      setMemberProfiles(profiles);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [familyId, authReady, resolvedUid]);
  useEffect(() => {
    if (authReady) loadFamily();
  }, [loadFamily, authReady]);

  // ── Regenerate invite code ────────────────────────────────────────────────
  const handleRegen = async () => {
    if (!familyId || !resolvedUid) return;
    setRegen(true);
    setError('');
    try {
      const newCode = makeCode();

      // Write new invite entry
      await set(ref(db, `invites/${newCode}`), {
        familyId,
        createdBy: resolvedUid,
        createdAt: new Date().toISOString(),
      });

      // Store code on family node so it's retrievable
      await update(ref(db, `families/${familyId}`), { inviteCode: newCode });

      setInviteCode(newCode);
    } catch (e) {
      setError(e.message);
    } finally {
      setRegen(false);
    }
  };

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / non-HTTPS
      const el = document.createElement('textarea');
      el.value = inviteCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Web Share API ─────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!inviteCode) return;
    const text = `Join my FamilyTrack EV family! Use code: ${inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FamilyTrack EV Invite', text });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  // ── Auth still resolving ──────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={styles.wrap}>
        <div style={{ ...styles.card, textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#555', fontSize: '14px' }}>⏳ Checking authentication…</p>
        </div>
      </div>
    );
  }

  // ── No family (guest without familyId) ───────────────────────────────────
  if (!familyId) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.emptyIcon}>🔓</div>
          <h2 style={styles.emptyTitle}>No Family Group</h2>
          <p style={styles.emptySub}>
            You're using FamilyTrack EV as a guest.<br />
            Sign in with Google to create or join a family group.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🔒 Family Group</h2>
          <p style={styles.subtitle}>
            ID: <code style={styles.code}>{familyId.slice(0, 12)}…</code>
          </p>
        </div>
        <span style={{ ...styles.roleBadge, borderColor: ROLE_META[userRole]?.color || '#666', color: ROLE_META[userRole]?.color || '#999' }}>
          {ROLE_META[userRole]?.icon || '👤'} {ROLE_META[userRole]?.label || userRole || 'Unknown'}
        </span>
      </div>

      {error && <div style={styles.errorBox}>⚠️ {error}</div>}

      {/* ── Invite Code Card ───────────────────────────────────────────── */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>INVITE CODE</p>
        <p style={styles.sectionHint}>Share this with family members to join your group.</p>

        {loading ? (
          <div style={styles.codeLoading}>Loading code…</div>
        ) : inviteCode ? (
          <>
            <div style={styles.codeBox}>
              <span style={styles.codeText}>{inviteCode}</span>
            </div>
            <div style={styles.codeActions}>
              <button style={copied ? { ...styles.actionBtn, ...styles.actionBtnSuccess } : styles.actionBtn} onClick={handleCopy}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button style={{ ...styles.actionBtn, ...styles.actionBtnBlue }} onClick={handleShare}>
                📤 Share
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.actionBtnGhost, opacity: regen ? 0.6 : 1 }}
                disabled={regen}
                onClick={handleRegen}
              >
                {regen ? '⏳ …' : '🔄 New Code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={styles.noCode}>No code generated yet.</p>
            <button
              style={{ ...styles.actionBtn, ...styles.actionBtnBlue, opacity: regen ? 0.6 : 1 }}
              disabled={regen}
              onClick={handleRegen}
            >
              {regen ? '⏳ Generating…' : '✨ Generate Code'}
            </button>
          </>
        )}
      </div>

      {/* ── Members List ───────────────────────────────────────────────── */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>MEMBERS ({Object.keys(members).length})</p>

        {loading ? (
          <p style={styles.noCode}>Loading members…</p>
        ) : Object.keys(members).length === 0 ? (
          <p style={styles.noCode}>No members found.</p>
        ) : (
          <div style={styles.memberList}>
            {Object.entries(members).map(([uid, role]) => {
              const profile = memberProfiles[uid];
              const name    = profile?.displayName || uid.slice(0, 8) + '…';
              const meta    = ROLE_META[role] || { icon: '👤', label: role, color: '#666' };
              const isYou   = uid === resolvedUid;
              return (
                <div key={uid} style={styles.memberRow}>
                  <div style={styles.memberAvatar} title={name}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.memberInfo}>
                    <span style={styles.memberName}>
                      {name}{isYou && <span style={styles.youBadge}>you</span>}
                    </span>
                    {profile?.email && <span style={styles.memberEmail}>{profile.email}</span>}
                  </div>
                  <span style={{ ...styles.memberRole, color: meta.color, borderColor: meta.color + '55' }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── How to join instructions ───────────────────────────────────── */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>HOW TO INVITE SOMEONE</p>
        <ol style={styles.instructionList}>
          <li>Share the invite code above via WhatsApp, SMS, or email.</li>
          <li>They sign in with Google on FamilyTrack EV.</li>
          <li>Choose a role (Rider or Watcher).</li>
          <li>Select "Join with invite code" and enter the code.</li>
        </ol>
      </div>

      <button style={styles.refreshBtn} onClick={loadFamily} disabled={loading}>
        {loading ? '⏳ Refreshing…' : '↻ Refresh'}
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '16px',
    padding: '48px 32px',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: '48px', marginBottom: '16px' },
  emptyTitle: { color: '#fff', fontSize: '20px', margin: '0 0 8px' },
  emptySub: { color: '#666', fontSize: '14px', lineHeight: 1.6, margin: 0 },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  title: { color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' },
  subtitle: { color: '#666', fontSize: '12px', margin: 0 },
  code: {
    fontFamily: 'monospace',
    background: '#2a2d3a',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#aaa',
    fontSize: '11px',
  },
  roleBadge: {
    padding: '5px 12px',
    border: '1px solid',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
    background: 'transparent',
    flexShrink: 0,
  },

  errorBox: {
    background: 'rgba(244,67,54,0.1)',
    border: '1px solid rgba(244,67,54,0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#ff5252',
    fontSize: '13px',
    marginBottom: '16px',
  },

  section: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  },
  sectionLabel: {
    margin: '0 0 4px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#555',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  sectionHint: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: '#666',
  },

  codeLoading: { color: '#555', fontSize: '14px', padding: '8px 0' },
  noCode: { color: '#555', fontSize: '13px', margin: '0 0 12px' },

  codeBox: {
    background: '#111318',
    border: '1px solid #2a2d3a',
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'center',
    marginBottom: '14px',
  },
  codeText: {
    fontSize: '40px',
    fontWeight: '800',
    letterSpacing: '8px',
    color: '#4CAF50',
    fontFamily: 'monospace',
  },

  codeActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '9px 16px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    background: '#4CAF50',
    color: '#fff',
    transition: 'opacity 0.2s',
    flexShrink: 0,
  },
  actionBtnSuccess: { background: '#2e7d32' },
  actionBtnBlue:    { background: '#2196F3' },
  actionBtnGhost: {
    background: 'transparent',
    border: '1px solid #333',
    color: '#888',
  },

  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: '#111318',
    borderRadius: '8px',
    border: '1px solid #1e2130',
  },
  memberAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#2a2d3a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#aaa',
    fontSize: '15px',
    fontWeight: '700',
    flexShrink: 0,
  },
  memberInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  memberEmail: {
    fontSize: '11px',
    color: '#555',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  youBadge: {
    fontSize: '10px',
    background: 'rgba(76,175,80,0.15)',
    color: '#4CAF50',
    border: '1px solid rgba(76,175,80,0.3)',
    borderRadius: '10px',
    padding: '1px 6px',
    fontWeight: '600',
  },
  memberRole: {
    fontSize: '12px',
    fontWeight: '600',
    border: '1px solid',
    borderRadius: '12px',
    padding: '3px 8px',
    flexShrink: 0,
  },

  instructionList: {
    margin: '8px 0 0',
    paddingLeft: '20px',
    color: '#888',
    fontSize: '13px',
    lineHeight: '1.8',
  },

  refreshBtn: {
    background: 'transparent',
    border: '1px solid #2a2d3a',
    color: '#555',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    width: '100%',
    transition: 'all 0.2s',
  },
};