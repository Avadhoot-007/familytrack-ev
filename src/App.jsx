import { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, set, push, update } from "firebase/database";
import { auth, db, googleProvider } from "./config/firebase";
import RiderDashboard from "./pages/RiderDashboard";
import WatcherDashboard from "./pages/WatcherDashboardPage";
import FamilyPanel from "./components/FamilyPanel";
import AdminPanel from "./components/AdminPanel";
import { hydrateTripsFromStorage, useStore } from "./store";
import { setEcoConstants } from "./utils/ecoScoring";
import { setImpactConstants } from "./utils/ecoImpactCalculations";

const makeInviteCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

// ── Family setup screen ───────────────────────────────────────────────────────

function FamilySetup({ user, onDone }) {
  const [step, setStep] = useState("choose");
  const [role, setRole] = useState(null);
  const [code, setCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [createdFamily, setCreatedFamily] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!role) {
      setError("Pick a role first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const newCode = makeInviteCode();
      const familyRef = push(ref(db, "families"));
      const familyId = familyRef.key;

      await set(familyRef, {
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        inviteCode: newCode,
        members: { [user.uid]: role },
      });

      await set(ref(db, `invites/${newCode}`), {
        familyId,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });

      await set(ref(db, `users/${user.uid}`), {
        displayName: user.displayName,
        email: user.email,
        familyId,
        role,
        joinedAt: new Date().toISOString(),
      });

      setCreatedFamily({ familyId, role });
      setGeneratedCode(newCode);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!role) {
      setError("Pick a role first.");
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Enter the 6-character invite code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const inviteSnap = await get(ref(db, `invites/${trimmed}`));
      if (!inviteSnap.exists()) {
        setError("Invalid code — double-check and try again.");
        setLoading(false);
        return;
      }

      const { familyId } = inviteSnap.val();

      await set(ref(db, `users/${user.uid}`), {
        displayName: user.displayName,
        email: user.email,
        familyId,
        role,
        joinedAt: new Date().toISOString(),
      });

      await update(ref(db, `families/${familyId}/members`), {
        [user.uid]: role,
      });

      onDone({ familyId, role });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const s = {
    wrap: {
      minHeight: "100vh",
      background: "#0f1117",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, sans-serif",
      padding: "20px",
    },
    card: {
      background: "#1a1d27",
      border: "1px solid #2a2d3a",
      borderRadius: "16px",
      padding: "36px 32px",
      maxWidth: "420px",
      width: "100%",
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    },
    title: {
      color: "#fff",
      fontSize: "22px",
      fontWeight: "700",
      margin: "0 0 6px",
    },
    sub: { color: "#888", fontSize: "13px", margin: "0 0 28px" },
    label: {
      color: "#ccc",
      fontSize: "13px",
      fontWeight: "600",
      marginBottom: "10px",
      display: "block",
    },
    roleRow: { display: "flex", gap: "10px", marginBottom: "20px" },
    roleBtn: (active) => ({
      flex: 1,
      padding: "14px",
      border: `2px solid ${active ? "#4CAF50" : "#333"}`,
      borderRadius: "10px",
      background: active ? "rgba(76,175,80,0.12)" : "#222",
      color: active ? "#4CAF50" : "#888",
      fontWeight: "600",
      fontSize: "14px",
      cursor: "pointer",
      transition: "all 0.2s",
    }),
    input: {
      width: "100%",
      padding: "12px 14px",
      background: "#222",
      border: "1px solid #333",
      borderRadius: "8px",
      color: "#fff",
      fontSize: "16px",
      letterSpacing: "3px",
      fontFamily: "monospace",
      marginBottom: "16px",
      boxSizing: "border-box",
    },
    btn: (color = "#4CAF50") => ({
      width: "100%",
      padding: "13px",
      background: color,
      border: "none",
      borderRadius: "8px",
      color: "#fff",
      fontWeight: "700",
      fontSize: "14px",
      cursor: "pointer",
      marginBottom: "10px",
      transition: "opacity 0.2s",
    }),
    ghost: {
      width: "100%",
      padding: "11px",
      background: "transparent",
      border: "1px solid #333",
      borderRadius: "8px",
      color: "#888",
      fontWeight: "600",
      fontSize: "13px",
      cursor: "pointer",
    },
    error: {
      color: "#ff5252",
      fontSize: "13px",
      marginBottom: "12px",
      background: "rgba(244,67,54,0.1)",
      borderRadius: "6px",
      padding: "8px 12px",
      border: "1px solid rgba(244,67,54,0.3)",
    },
    codebox: {
      textAlign: "center",
      padding: "20px",
      background: "#111",
      borderRadius: "10px",
      marginBottom: "16px",
      border: "1px solid #2a5a2a",
    },
    codeText: {
      fontSize: "36px",
      fontWeight: "800",
      letterSpacing: "6px",
      color: "#4CAF50",
      fontFamily: "monospace",
    },
  };

  const RoleSelector = () => (
    <>
      <span style={s.label}>Your role in this family:</span>
      <div style={s.roleRow}>
        <button
          style={s.roleBtn(role === "rider")}
          onClick={() => setRole("rider")}
        >
          🚴 Rider
        </button>
        <button
          style={s.roleBtn(role === "watcher")}
          onClick={() => setRole("watcher")}
        >
          👁️ Watcher
        </button>
      </div>
    </>
  );

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h2 style={s.title}>🚴 FamilyTrack EV</h2>
        <p style={s.sub}>Welcome, {user.displayName?.split(" ")[0]}!</p>

        {step === "choose" && (
          <>
            <p style={{ ...s.label, marginBottom: "16px" }}>
              Set up your family group:
            </p>
            <button style={s.btn()} onClick={() => setStep("create")}>
              ➕ Create a new family
            </button>
            <button style={s.btn("#2196F3")} onClick={() => setStep("join")}>
              🔗 Join with invite code
            </button>
          </>
        )}

        {step === "create" && (
          <>
            <RoleSelector />
            {error && <div style={s.error}>{error}</div>}
            {generatedCode ? (
              <>
                <p style={{ ...s.label, color: "#4CAF50" }}>
                  Family created! Share this code:
                </p>
                <div style={s.codebox}>
                  <div style={s.codeText}>{generatedCode}</div>
                  <p
                    style={{
                      color: "#666",
                      fontSize: "12px",
                      margin: "8px 0 0",
                    }}
                  >
                    Others join by entering this 6-character code
                  </p>
                </div>
                <button style={s.btn()} onClick={() => onDone(createdFamily)}>
                  Continue to Dashboard →
                </button>
              </>
            ) : (
              <>
                <button
                  style={{ ...s.btn(), opacity: loading ? 0.6 : 1 }}
                  disabled={loading}
                  onClick={handleCreate}
                >
                  {loading ? "⏳ Creating…" : "✓ Create Family"}
                </button>
                <button
                  style={s.ghost}
                  onClick={() => {
                    setStep("choose");
                    setError("");
                    setRole(null);
                  }}
                >
                  ← Back
                </button>
              </>
            )}
          </>
        )}

        {step === "join" && (
          <>
            <RoleSelector />
            <span style={s.label}>Enter the 6-character invite code:</span>
            <input
              style={s.input}
              maxLength={6}
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            {error && <div style={s.error}>{error}</div>}
            <button
              style={{ ...s.btn("#2196F3"), opacity: loading ? 0.6 : 1 }}
              disabled={loading}
              onClick={handleJoin}
            >
              {loading ? "⏳ Joining…" : "🔗 Join Family"}
            </button>
            <button
              style={s.ghost}
              onClick={() => {
                setStep("choose");
                setError("");
                setCode("");
                setRole(null);
              }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Auth / landing screen ─────────────────────────────────────────────────────

function AuthScreen({ onGuest, onGoogle, loading, error }) {
  const [name, setName] = useState("");

  const s = {
    wrap: {
      minHeight: "100vh",
      background: "#0f1117",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, sans-serif",
      padding: "20px",
    },
    card: {
      background: "#1a1d27",
      border: "1px solid #2a2d3a",
      borderRadius: "16px",
      padding: "40px 32px",
      maxWidth: "380px",
      width: "100%",
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      textAlign: "center",
    },
    icon: { fontSize: "48px", marginBottom: "12px" },
    title: {
      color: "#fff",
      fontSize: "26px",
      fontWeight: "700",
      margin: "0 0 6px",
    },
    sub: { color: "#666", fontSize: "13px", margin: "0 0 32px" },
    divider: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      margin: "20px 0",
      color: "#444",
      fontSize: "12px",
    },
    line: { flex: 1, height: "1px", background: "#2a2d3a" },
    googleBtn: {
      width: "100%",
      padding: "13px",
      marginBottom: "12px",
      background: "#fff",
      border: "none",
      borderRadius: "8px",
      color: "#1a1a1a",
      fontWeight: "700",
      fontSize: "14px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      transition: "opacity 0.2s",
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      background: "#222",
      border: "1px solid #333",
      borderRadius: "8px",
      color: "#fff",
      fontSize: "15px",
      marginBottom: "10px",
      boxSizing: "border-box",
      fontFamily: "Arial",
    },
    guestBtn: {
      width: "100%",
      padding: "12px",
      background: "transparent",
      border: "1px solid #333",
      borderRadius: "8px",
      color: "#aaa",
      fontWeight: "600",
      fontSize: "14px",
      cursor: "pointer",
    },
    error: {
      color: "#ff5252",
      fontSize: "13px",
      marginBottom: "12px",
      background: "rgba(244,67,54,0.1)",
      borderRadius: "6px",
      padding: "8px 12px",
      border: "1px solid rgba(244,67,54,0.3)",
    },
    feature: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      color: "#888",
      marginBottom: "6px",
    },
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.icon}>🚴</div>
        <h1 style={s.title}>FamilyTrack EV</h1>
        <p style={s.sub}>Family safety for EV riders</p>

        <div style={{ textAlign: "left", marginBottom: "24px" }}>
          {[
            "🔒 Secure family groups",
            "📨 Invite family members",
            "📱 Sync across devices",
          ].map((f) => (
            <div key={f} style={s.feature}>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button
          style={{ ...s.googleBtn, opacity: loading ? 0.6 : 1 }}
          disabled={loading}
          onClick={onGoogle}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>

        <div style={s.divider}>
          <div style={s.line} />
          <span>or use as guest</span>
          <div style={s.line} />
        </div>

        <input
          style={s.input}
          type="text"
          placeholder="Enter your name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onGuest(name)}
        />
        <button
          style={{ ...s.guestBtn, opacity: name.trim() ? 1 : 0.5 }}
          disabled={!name.trim()}
          onClick={() => onGuest(name)}
        >
          Continue as Guest (no sync)
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  // ── Admin route — completely isolated, no auth/store involvement ──────────
  if (window.location.pathname === "/admin") {
    return <AdminPanel />;
  }

  const [view, setView] = useState("rider");
  const [authState, setAuthState] = useState("loading");
  const [googleUser, setGoogleUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  const setGoogleUserStore = useStore((s) => s.setGoogleUser);
  const setGuest = useStore((s) => s.setGuest);
  const clearAuth = useStore((s) => s.clearAuth);
  const storeRiderName = useStore((s) => s.riderName);
  const storeIsGuest = useStore((s) => s.isGuest);
  const storeFamilyId = useStore((s) => s.familyId);
  const storeRole = useStore((s) => s.role);
  const storeUserId = useStore((s) => s.userId);

  // ── Hydration ────────────────────────────────────────────────────────────
  useEffect(() => {
    hydrateTripsFromStorage().then(() => setIsHydrated(true));
  }, []);

  // ── Fetch eco constants from Firebase on mount ───────────────────────────
  useEffect(() => {
    get(ref(db, "config/ecoConstants"))
      .then((snap) => {
        if (snap.exists()) {
          const c = snap.val();
          setEcoConstants(c);
          setImpactConstants(c);
        }
      })
      .catch((e) => console.warn("ecoConstants fetch failed:", e));
  }, []);

  // ── Auth state listener ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const { isGuest, riderName } = useStore.getState();
        if (isGuest && riderName) {
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
        }
        return;
      }

      if (user.isAnonymous) {
        setAuthState("unauthenticated");
        return;
      }

      setGoogleUser(user);
      try {
        const userSnap = await get(ref(db, `users/${user.uid}`));
        if (userSnap.exists()) {
          const userData = userSnap.val();
          setGoogleUserStore({
            uid: user.uid,
            displayName: user.displayName,
            familyId: userData.familyId || null,
            role: userData.role || null,
          });
          setAuthState("authenticated");
        } else {
          setAuthState("needs-family");
        }
      } catch (e) {
        console.error("User profile fetch error:", e);
        setAuthState("needs-family");
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        setAuthError(e.message);
      }
      setAuthLoading(false);
    }
  };

  const handleGuest = (name) => {
    setGuest(name.trim());
    setAuthState("authenticated");
  };

  const handleFamilyDone = (data) => {
    if (!data) {
      setAuthState("authenticated");
      return;
    }
    const { familyId, role } = data;
    if (familyId && role && googleUser) {
      setGoogleUserStore({
        uid: googleUser.uid,
        displayName: googleUser.displayName,
        familyId,
        role,
      });
    }
    setAuthState("authenticated");
  };

  const handleSignOut = async () => {
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await signOut(auth);
      }
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      clearAuth();
      setGoogleUser(null);
      setAuthState("unauthenticated");
    }
  };

  // ── Loading screen ───────────────────────────────────────────────────────
  if (authState === "loading" || !isHydrated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial",
          color: "#fff",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "48px" }}>🚴</div>
        <p style={{ color: "#666", fontSize: "14px" }}>
          Loading FamilyTrack EV…
        </p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <AuthScreen
        onGuest={handleGuest}
        onGoogle={handleGoogle}
        loading={authLoading}
        error={authError}
      />
    );
  }

  if (authState === "needs-family" && googleUser) {
    return <FamilySetup user={googleUser} onDone={handleFamilyDone} />;
  }

  const riderName = storeRiderName || googleUser?.displayName || "Rider";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "Arial" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 20px",
          background: "#1a1d27",
          borderBottom: "1px solid #2a2d3a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🚴</span>
          <h2
            style={{
              margin: 0,
              color: "#fff",
              fontSize: "16px",
              fontWeight: "700",
            }}
          >
            FamilyTrack EV
          </h2>
          {storeFamilyId && (
            <span
              style={{
                fontSize: "11px",
                color: "#4CAF50",
                background: "rgba(76,175,80,0.12)",
                border: "1px solid rgba(76,175,80,0.3)",
                borderRadius: "12px",
                padding: "2px 8px",
                fontWeight: "600",
              }}
            >
              🔒 Family
            </span>
          )}
          {storeIsGuest && (
            <span
              style={{
                fontSize: "11px",
                color: "#ff9800",
                background: "rgba(255,152,0,0.1)",
                border: "1px solid rgba(255,152,0,0.3)",
                borderRadius: "12px",
                padding: "2px 8px",
              }}
            >
              Guest
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setView("rider")}
            style={tabStyle(view === "rider", "#4CAF50")}
          >
            👤 Rider
          </button>
          <button
            onClick={() => setView("watcher")}
            style={tabStyle(view === "watcher", "#2196F3")}
          >
            👁️ Watcher
          </button>
          <button
            onClick={() => setView("family")}
            style={tabStyle(view === "family", "#ff9800")}
          >
            👨‍👩‍👧 Family
          </button>
          <button
            onClick={handleSignOut}
            style={{
              padding: "7px 12px",
              fontSize: "12px",
              background: "transparent",
              border: "1px solid #333",
              color: "#666",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            title="Sign out"
          >
            ↩ Out
          </button>
        </div>
      </div>

      {/* ── RiderDashboard — always mounted to preserve GPS/trip state ── */}
      <div style={{ display: view === "rider" ? "block" : "none" }}>
        <RiderDashboard riderName={riderName} isActive={view === "rider"} />
      </div>

      {/* ── Watcher — unmount when hidden (map resets are fine) ─────── */}
      {view === "watcher" && <WatcherDashboard key="watcher-map" />}

      {/* ── Family panel ─────────────────────────────────────────────── */}
      {view === "family" && (
        <FamilyPanel
          familyId={storeFamilyId}
          userId={storeUserId}
          userRole={storeRole}
          displayName={riderName}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function tabStyle(active, activeColor) {
  return {
    padding: "7px 14px",
    fontSize: "13px",
    background: active ? activeColor : "#2a2d3a",
    color: active ? "white" : "#888",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: active ? "bold" : "normal",
    transition: "all 0.2s",
  };
}
