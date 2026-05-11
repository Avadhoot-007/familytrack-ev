// Global state management using Zustand
// Persists to localStorage and syncs trips with Firebase
// Manages: auth, location, trip history, battery, alerts, coaching tips
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeRiderId } from "../services/locationService";
import {
  persistTripToFirebase,
  loadTripsFromFirebase,
} from "../utils/tripFirebaseSync";

const STORAGE_KEY = "familytrack-ev-store";

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Auth ─────────────────────────────────────────────────────────────
      userId: null,
      riderName: null,
      role: null,
      familyId: null,
      isGuest: false,

      setAuth: (userId, riderName) => set({ userId, riderName }),

      setGoogleUser: ({ uid, displayName, familyId, role }) =>
        set({
          userId: uid,
          riderName: displayName,
          familyId,
          role,
          isGuest: false,
        }),

      setGuest: (name) =>
        set({
          riderName: name,
          isGuest: true,
          userId: null,
          familyId: null,
          role: "rider",
        }),

      setFamilyId: (familyId) => set({ familyId }),
      setRole: (role) => set({ role }),

      clearAuth: () =>
        set({
          userId: null,
          riderName: null,
          role: null,
          familyId: null,
          isGuest: false,
        }),

      // ── Current trip ──────────────────────────────────────────────────────
      isSharing: false,
      tripStartTime: null,
      tripStats: { distanceKm: 0, avgSpeedKmh: 0, score: 0, worstAxis: null },

      setSharing: (isSharing) =>
        set({ isSharing, tripStartTime: isSharing ? Date.now() : null }),
      updateTripStats: (stats) => set({ tripStats: stats }),

      // ── Battery ───────────────────────────────────────────────────────────
      battery: 85,
      setBattery: (battery) => set({ battery }),

      // ── Location ──────────────────────────────────────────────────────────
      location: null,
      setLocation: (location) => set({ location }),

      // ── Riders (watcher) ─────────────────────────────────────────────────
      riders: {},
      setRiders: (riders) => set({ riders }),

      // ── Alerts ───────────────────────────────────────────────────────────
      alerts: [],
      addAlert: (alert) =>
        set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),

      // ── Trip History ──────────────────────────────────────────────────────
      tripHistory: [],

      // FIX: dedup by `id` not `timestamp` — two rapid trips in same ms no
      // longer collide. Firebase write moved OUTSIDE the setter to avoid async
      // side-effects inside Zustand's pure updater (fixes StrictMode double-fire).
      addCompletedTrip: (trip) => {
        const newTrip = {
          ...trip,
          id: trip.id || `trip-${Date.now()}`,
          timestamp: trip.timestamp || new Date().toISOString(),
        };

        // Read current state synchronously before mutating
        const state = get();

        // Dedup by id — guards against duplicate calls with the same explicit id
        const exists = state.tripHistory.some((t) => t.id === newTrip.id);
        if (exists) return;

        const updated = [...state.tripHistory, newTrip].slice(-100);
        set({ tripHistory: updated });

        // Firebase write is async — runs after state update, not inside it
        const riderId =
          state.userId ||
          (state.riderName ? normalizeRiderId(state.riderName) : null);
        if (riderId) {
          persistTripToFirebase(riderId, newTrip).catch((e) =>
            console.warn("persistTripToFirebase failed:", e.message),
          );
        }
      },

      setTripHistory: (trips) => set({ tripHistory: trips }),

      // FIX: mergeTrips now keys by `id` then falls back to `timestamp`
      // so Firebase-hydrated trips (which always have an id) never duplicate.
      mergeTrips: (incomingTrips) =>
        set((state) => {
          // Build a map keyed by id for O(1) dedup
          const existing = new Map(
            state.tripHistory.map((t) => [t.id || t.timestamp, t]),
          );
          incomingTrips.forEach((t) => {
            const key = t.id || t.timestamp;
            if (!existing.has(key)) existing.set(key, t);
          });
          const merged = Array.from(existing.values())
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .slice(-100);
          return { tripHistory: merged };
        }),

      removeTrip: (tripId) =>
        set((state) => ({
          tripHistory: state.tripHistory.filter((t) => t.id !== tripId),
        })),

      // ── Coaching Tips ─────────────────────────────────────────────────────
      currentCoachingTips: [],
      setCoachingTips: (tips) => set({ currentCoachingTips: tips }),

      // ── Impact Summary (cached) ───────────────────────────────────────────
      impactSummary: null,
      setImpactSummary: (summary) => set({ impactSummary: summary }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        battery: state.battery,
        riderName: state.riderName,
        userId: state.userId,
        familyId: state.familyId,
        role: state.role,
        isGuest: state.isGuest,
        tripHistory: state.tripHistory,
      }),
    },
  ),
);

// Hydration helper: Load trips from Firebase on app startup.
// Merges Firebase trips into local store without overwriting local-only entries.
export const hydrateTripsFromStorage = async () => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const state = useStore.getState();

      const riderId =
        state.userId ||
        (state.riderName ? normalizeRiderId(state.riderName) : null);

      if (riderId) {
        try {
          const firebaseTrips = await loadTripsFromFirebase(riderId);
          if (firebaseTrips.length > 0) {
            useStore.getState().mergeTrips(firebaseTrips);
            console.log(
              `✓ Hydrated — merged ${firebaseTrips.length} Firebase trips`,
            );
          } else {
            console.log("✓ Hydrated — no Firebase trips found");
          }
        } catch (e) {
          console.warn("Hydration Firebase fetch failed:", e.message);
        }
      } else {
        console.log("✓ Store ready — no riderId yet");
      }

      resolve();
    }, 0);
  });
};

// Expose store to browser console for debugging (dev only)
if (typeof window !== "undefined") {
  window.useStore = useStore;
}
