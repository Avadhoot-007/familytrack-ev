// AdminPanel: Edit eco-scoring constants and environmental impact factors from Firebase
// Allows tuning: throttle/speed/accel weights, thresholds, CO2 factors
// Requires admin password; changes sync to all devices via Firebase config/ecoConstants
import React, { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { ref, get, set } from "firebase/database";

// Default constants (mirrors ecoScoring.js + ecoImpactCalculations.js)
const DEFAULTS = {
  // Eco Scoring weights (must sum to 100)
  throttleWeight: 35,
  speedWeight: 35,
  accelWeight: 30,
  // Thresholds — penalty kicks in above these
  throttleThreshold: 40,
  speedThreshold: 35,
  accelThreshold: 0.3,
  // Ranges — full penalty reached at threshold + range
  throttleRange: 60,
  speedRange: 25,
  accelRange: 0.7,
  // CO2 Impact
  co2PerKmPetrol: 0.192,
  evEmissionsFactor: 0.05,
  treeAbsorbsPerYear: 21,
};

const FIREBASE_PATH = "config/ecoConstants";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "admin123";

// ---------------------------------------------------------------------------
// Field metadata for rendering
// ---------------------------------------------------------------------------
const FIELD_GROUPS = [
  {
    title: "⚖️ Eco Score Weights",
    subtitle: "Must sum to 100",
    color: "#4CAF50",
    fields: [
      {
        key: "throttleWeight",
        label: "Throttle Weight",
        min: 0,
        max: 100,
        step: 1,
        unit: "pts",
      },
      {
        key: "speedWeight",
        label: "Speed Weight",
        min: 0,
        max: 100,
        step: 1,
        unit: "pts",
      },
      {
        key: "accelWeight",
        label: "Accel Weight",
        min: 0,
        max: 100,
        step: 1,
        unit: "pts",
      },
    ],
  },
  {
    title: "🎯 Penalty Thresholds",
    subtitle: "Penalty starts above these values",
    color: "#FF9800",
    fields: [
      {
        key: "throttleThreshold",
        label: "Throttle Threshold",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
      {
        key: "speedThreshold",
        label: "Speed Threshold",
        min: 0,
        max: 120,
        step: 1,
        unit: "km/h",
      },
      {
        key: "accelThreshold",
        label: "Accel Threshold",
        min: 0,
        max: 2,
        step: 0.05,
        unit: "m/s²",
      },
    ],
  },
  {
    title: "📐 Penalty Ranges",
    subtitle: "Full penalty reached at threshold + range",
    color: "#2196F3",
    fields: [
      {
        key: "throttleRange",
        label: "Throttle Range",
        min: 1,
        max: 100,
        step: 1,
        unit: "%",
      },
      {
        key: "speedRange",
        label: "Speed Range",
        min: 1,
        max: 100,
        step: 1,
        unit: "km/h",
      },
      {
        key: "accelRange",
        label: "Accel Range",
        min: 0.1,
        max: 3,
        step: 0.05,
        unit: "m/s²",
      },
    ],
  },
  {
    title: "🌱 CO₂ & Impact Constants",
    subtitle: "Used for savings and badge calculations",
    color: "#8BC34A",
    fields: [
      {
        key: "co2PerKmPetrol",
        label: "Petrol CO₂/km",
        min: 0.05,
        max: 0.5,
        step: 0.001,
        unit: "kg/km",
      },
      {
        key: "evEmissionsFactor",
        label: "EV Emissions Factor",
        min: 0,
        max: 0.2,
        step: 0.005,
        unit: "kg/km",
      },
      {
        key: "treeAbsorbsPerYear",
        label: "Tree Absorption/Year",
        min: 1,
        max: 100,
        step: 1,
        unit: "kg CO₂",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Password Gate
// ---------------------------------------------------------------------------
function PasswordGate({ onAuth }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const attempt = () => {
    if (pw === ADMIN_PASSWORD) {
      onAuth();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setError(false), 2000);
      setPw("");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-8px); }
          40%,80%  { transform: translateX(8px); }
        }
        .gate-box { animation: none; }
        .gate-box.shaking { animation: shake 0.5s ease; }
      `}</style>
      <div
        className={`gate-box${shake ? " shaking" : ""}`}
        style={{
          background: "#1a1a1a",
          border: `1px solid ${error ? "#dc3545" : "#333"}`,
          borderRadius: "12px",
          padding: "48px 40px",
          width: "320px",
          textAlign: "center",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          transition: "border-color 0.2s",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔐</div>
        <h2
          style={{
            color: "#fff",
            margin: "0 0 6px",
            fontSize: "18px",
            letterSpacing: "1px",
          }}
        >
          ADMIN ACCESS
        </h2>
        <p
          style={{
            color: "#555",
            fontSize: "12px",
            margin: "0 0 28px",
            textTransform: "uppercase",
            letterSpacing: "2px",
          }}
        >
          FamilyTrack EV
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          placeholder="Enter password"
          autoFocus
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "#0d0d0d",
            border: `1px solid ${error ? "#dc3545" : "#333"}`,
            borderRadius: "6px",
            color: "#e0e0e0",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "14px",
            fontFamily: "inherit",
            letterSpacing: "2px",
            transition: "border-color 0.2s",
          }}
        />
        {error && (
          <p style={{ color: "#dc3545", fontSize: "12px", margin: "0 0 10px" }}>
            Incorrect password
          </p>
        )}
        <button
          onClick={attempt}
          style={{
            width: "100%",
            padding: "12px",
            background: "#4CAF50",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            letterSpacing: "1px",
            fontFamily: "inherit",
          }}
        >
          ENTER
        </button>
        <p style={{ color: "#333", fontSize: "11px", marginTop: "24px" }}>
          Set VITE_ADMIN_PASSWORD in .env
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Panel
// ---------------------------------------------------------------------------
export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [constants, setConstants] = useState(DEFAULTS);
  const [saved, setSaved] = useState({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [dirty, setDirty] = useState(false);

  // ── Fetch from Firebase on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    const fetch = async () => {
      try {
        const snap = await get(ref(db, FIREBASE_PATH));
        if (snap.exists()) {
          const data = { ...DEFAULTS, ...snap.val() };
          setConstants(data);
          setSaved(data);
        }
      } catch (e) {
        console.error("AdminPanel fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [authed]);

  // ── Track dirty state ─────────────────────────────────────────────────────
  useEffect(() => {
    setDirty(JSON.stringify(constants) !== JSON.stringify(saved));
  }, [constants, saved]);

  const handleChange = (key, val) => {
    const parsed = parseFloat(val);
    if (isNaN(parsed)) return;
    setConstants((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await set(ref(db, FIREBASE_PATH), constants);
      setSaved({ ...constants });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (e) {
      console.error("AdminPanel save error:", e);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleReset = () => {
    setConstants({ ...DEFAULTS });
  };

  const handleRevert = () => {
    setConstants({ ...saved });
  };

  // Weight sum validation
  const weightSum =
    constants.throttleWeight + constants.speedWeight + constants.accelWeight;
  const weightOk = Math.round(weightSum) === 100;

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#111",
        minHeight: "100vh",
        padding: "20px",
        color: "#e0e0e0",
      }}
    >
      <style>{`
        .admin-card {
          background: #1a1a1a; border-radius: 12px; padding: 24px;
          margin-bottom: 20px; border: 1px solid #2a2a2a;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .field-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 0; border-bottom: 1px solid #222;
        }
        .field-row:last-child { border-bottom: none; }
        .field-label { flex: 1; font-size: 13px; color: #bbb; }
        .field-unit  { font-size: 11px; color: #555; width: 54px; text-align: right; }
        .field-input {
          width: 90px; padding: 7px 10px; background: #0d0d0d;
          border: 1px solid #333; border-radius: 6px;
          color: #fff; font-size: 13px; text-align: right;
          outline: none; transition: border-color 0.2s;
        }
        .field-input:focus { border-color: #4CAF50; }
        .field-input.warn  { border-color: #FF9800; }
        .range-input {
          width: 90px; accent-color: #4CAF50;
        }
        .section-title {
          font-size: 15px; font-weight: 700; color: #fff;
          margin: 0 0 4px;
        }
        .section-sub { font-size: 11px; color: #555; margin: 0 0 16px; }
        .pill {
          display: inline-block; padding: 2px 8px; border-radius: 10px;
          font-size: 11px; font-weight: 600;
        }
      `}</style>

      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        {/* Header */}
        <div
          className="admin-card"
          style={{ borderColor: "#333", marginBottom: "24px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h1
                style={{ margin: "0 0 4px", fontSize: "22px", color: "#fff" }}
              >
                ⚙️ Admin Panel
              </h1>
              <p style={{ margin: 0, color: "#555", fontSize: "12px" }}>
                FamilyTrack EV · Eco Constants Configuration
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={handleRevert}
                disabled={!dirty}
                style={{
                  padding: "9px 16px",
                  background: "none",
                  border: "1px solid #444",
                  borderRadius: "6px",
                  color: dirty ? "#bbb" : "#444",
                  fontSize: "12px",
                  cursor: dirty ? "pointer" : "not-allowed",
                }}
              >
                ↩ Revert
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: "9px 16px",
                  background: "none",
                  border: "1px solid #555",
                  borderRadius: "6px",
                  color: "#888",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Reset Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={saveStatus === "saving" || !dirty || !weightOk}
                style={{
                  padding: "9px 20px",
                  background:
                    !dirty || !weightOk
                      ? "#222"
                      : saveStatus === "saved"
                        ? "#1a7e32"
                        : saveStatus === "error"
                          ? "#7e1a1a"
                          : "#4CAF50",
                  border: "none",
                  borderRadius: "6px",
                  color: "#fff",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: !dirty || !weightOk ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  minWidth: "110px",
                }}
              >
                {saveStatus === "saving"
                  ? "⏳ Saving…"
                  : saveStatus === "saved"
                    ? "✓ Saved"
                    : saveStatus === "error"
                      ? "✗ Error"
                      : "💾 Save to Firebase"}
              </button>
            </div>
          </div>

          {/* Status bar */}
          {loading && (
            <p style={{ color: "#555", fontSize: "12px", marginTop: "12px" }}>
              Loading constants from Firebase…
            </p>
          )}
          {dirty && !loading && (
            <div
              style={{
                marginTop: "14px",
                padding: "10px 14px",
                background: "#1a1a00",
                border: "1px solid #555",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#ffc107",
              }}
            >
              ⚠ Unsaved changes — riders will use current Firebase values until
              you save.
            </div>
          )}
        </div>

        {/* Weight sum warning */}
        {!weightOk && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 16px",
              background: "#2a1a00",
              border: "1px solid #FF9800",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#FF9800",
            }}
          >
            ⚠ Eco Score Weights sum to <strong>{Math.round(weightSum)}</strong>{" "}
            — must equal 100. Save is blocked until corrected.
          </div>
        )}

        {/* Constant groups */}
        {FIELD_GROUPS.map((group) => (
          <div
            key={group.title}
            className="admin-card"
            style={{ borderLeft: `3px solid ${group.color}` }}
          >
            <h2 className="section-title">{group.title}</h2>
            <p className="section-sub">{group.subtitle}</p>

            {group.fields.map((f) => {
              const isWeightField = f.key.endsWith("Weight");
              const isWarn = isWeightField && !weightOk;
              const current = constants[f.key] ?? DEFAULTS[f.key];
              const defaultVal = DEFAULTS[f.key];
              const changed = current !== defaultVal;

              return (
                <div key={f.key} className="field-row">
                  <div className="field-label">
                    {f.label}
                    {changed && (
                      <span
                        className="pill"
                        style={{
                          marginLeft: "8px",
                          background: "#1a2a1a",
                          color: "#4CAF50",
                          border: "1px solid #2a4a2a",
                        }}
                      >
                        modified
                      </span>
                    )}
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    className="range-input"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={current}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                  />

                  {/* Number input */}
                  <input
                    type="number"
                    className={`field-input${isWarn ? " warn" : ""}`}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={current}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                  />

                  <div className="field-unit">{f.unit}</div>

                  {/* Default badge */}
                  <button
                    onClick={() => handleChange(f.key, defaultVal)}
                    title={`Reset to default (${defaultVal})`}
                    style={{
                      background: "none",
                      border: "1px solid #2a2a2a",
                      borderRadius: "4px",
                      color: "#444",
                      fontSize: "10px",
                      cursor: "pointer",
                      padding: "3px 6px",
                      whiteSpace: "nowrap",
                      minWidth: "52px",
                    }}
                  >
                    ↺ {defaultVal}
                  </button>
                </div>
              );
            })}
          </div>
        ))}

        {/* Live preview */}
        <div className="admin-card">
          <h2 className="section-title" style={{ marginBottom: "14px" }}>
            🔍 Live Preview
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {[
              {
                label: "CO₂ saved (10 km ride)",
                val: `${((constants.co2PerKmPetrol - constants.evEmissionsFactor) * 10).toFixed(3)} kg`,
                icon: "♻️",
              },
              {
                label: "Tree equiv. (10 km)",
                val: `${(((constants.co2PerKmPetrol - constants.evEmissionsFactor) * 10) / constants.treeAbsorbsPerYear).toFixed(4)}`,
                icon: "🌳",
              },
              {
                label: "Max score penalty sum",
                val: `${constants.throttleWeight + constants.speedWeight + constants.accelWeight} pts`,
                icon: "📊",
                warn: !weightOk,
              },
              {
                label: "Speed penalty starts at",
                val: `${constants.speedThreshold} km/h`,
                icon: "⚡",
              },
            ].map(({ label, val, icon, warn }) => (
              <div
                key={label}
                style={{
                  background: warn ? "#2a1a00" : "#0d0d0d",
                  border: `1px solid ${warn ? "#FF9800" : "#222"}`,
                  borderRadius: "8px",
                  padding: "14px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "22px", marginBottom: "6px" }}>
                  {icon}
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "700",
                    color: warn ? "#FF9800" : "#fff",
                  }}
                >
                  {val}
                </div>
                <div
                  style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            color: "#2a2a2a",
            fontSize: "11px",
            marginTop: "8px",
          }}
        >
          Changes saved to Firebase /config/ecoConstants · Riders pick up new
          values on next app load
        </p>
      </div>
    </div>
  );
}
