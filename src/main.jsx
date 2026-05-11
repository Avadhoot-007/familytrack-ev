// ─────────────────────────────────────────────────────────────────────────────
// main.jsx — React application entry point
//
// Responsibilities:
//   1. Detect admin route BEFORE any React tree mounts
//   2. Render AdminPanel in isolation at /admin (no auth, no store)
//   3. Render the full App (auth + store + routing) for all other paths
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Global CSS — applied to all routes including admin
import "./index.css";

// Leaflet CSS must be imported at the entry point so map tiles and
// controls render correctly across all components that use MapContainer.
// Importing it inside a component causes style race conditions.
import "leaflet/dist/leaflet.css";

import App from "./App.jsx";
import AdminPanel from "./components/AdminPanel.jsx";

// ── Admin route detection ─────────────────────────────────────────────────────
// Checked once at module load time — before any component renders.
// AdminPanel is completely isolated: no Firebase auth, no Zustand store,
// no family/rider context. It only reads and writes config/ecoConstants.
// The password gate inside AdminPanel provides its own access control.
const isAdmin = window.location.pathname === "/admin";

// ── Mount ─────────────────────────────────────────────────────────────────────
// StrictMode wraps both routes so all lifecycle and hook violations surface
// in development. StrictMode is a no-op in production builds.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isAdmin ? (
      // Admin path: render isolated config panel, skip all auth flows
      <AdminPanel />
    ) : (
      // All other paths: render full application with auth, store, and routing
      <App />
    )}
  </StrictMode>,
);
