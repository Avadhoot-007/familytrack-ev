import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistTripToFirebase, loadTripsFromFirebase } from '../utils/tripFirebaseSync';

const STORAGE_KEY = 'familytrack-ev-store';

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Auth ─────────────────────────────────────────────────────────────
      userId:   null,
      riderName: null,
      role:     null,
      familyId: null,
      isGuest:  false,

      setAuth: (userId, riderName) => set({ userId, riderName }),

      setGoogleUser: ({ uid, displayName, familyId, role }) =>
        set({ userId: uid, riderName: displayName, familyId, role, isGuest: false }),

      // Guests default to 'rider' — safest, nothing in app breaks
      setGuest: (name) =>
        set({ riderName: name, isGuest: true, userId: null, familyId: null, role: 'rider' }),

      setFamilyId: (familyId) => set({ familyId }),
      setRole: (role)         => set({ role }),

      clearAuth: () =>
        set({ userId: null, riderName: null, role: null, familyId: null, isGuest: false }),

      // ── Current trip ──────────────────────────────────────────────────────
      isSharing:    false,
      tripStartTime: null,
      tripStats:    { distanceKm: 0, avgSpeedKmh: 0, score: 0, worstAxis: null },

      setSharing: (isSharing) =>
        set({ isSharing, tripStartTime: isSharing ? Date.now() : null }),
      updateTripStats: (stats) => set({ tripStats: stats }),

      // ── Battery ───────────────────────────────────────────────────────────
      battery:    85,
      setBattery: (battery) => set({ battery }),

      // ── Location ──────────────────────────────────────────────────────────
      location:    null,
      setLocation: (location) => set({ location }),

      // ── Riders (watcher) ─────────────────────────────────────────────────
      riders:    {},
      setRiders: (riders) => set({ riders }),

      // ── Alerts ───────────────────────────────────────────────────────────
      alerts:   [],
      addAlert: (alert) =>
        set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),

      // ── Trip History ──────────────────────────────────────────────────────
      tripHistory: [],

      addCompletedTrip: (trip) =>
        set((state) => {
          const newTrip = {
            ...trip,
            id:        trip.id        || `trip-${Date.now()}`,
            timestamp: trip.timestamp || new Date().toISOString(),
          };
          // Deduplicate by timestamp
          const exists = state.tripHistory.some((t) => t.timestamp === newTrip.timestamp);
          if (exists) return {};

          const updated = [...state.tripHistory, newTrip].slice(-100);

          const riderId =
            state.userId ||
            state.riderName?.toLowerCase().replace(/\s+/g, '-') ||
            null;
          if (riderId) persistTripToFirebase(riderId, newTrip);

          return { tripHistory: updated };
        }),

      setTripHistory: (trips) => set({ tripHistory: trips }),

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
        battery:     state.battery,
        riderName:   state.riderName,
        userId:      state.userId,
        familyId:    state.familyId,
        role:        state.role,
        isGuest:     state.isGuest,
        tripHistory: state.tripHistory,
      }),
    }
  )
);

// ── Hydration ─────────────────────────────────────────────────────────────────
export const hydrateTripsFromStorage = async () => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const state = useStore.getState();
      const localCount = state.tripHistory.length;

      if (localCount > 0) {
        console.log(`✓ Store hydrated from localStorage — ${localCount} trips`);
        resolve();
        return;
      }

      const riderId =
        state.userId ||
        state.riderName?.toLowerCase().replace(/\s+/g, '-') ||
        null;

      if (riderId) {
        const firebaseTrips = await loadTripsFromFirebase(riderId);
        if (firebaseTrips.length > 0) {
          useStore.getState().setTripHistory(firebaseTrips);
          console.log(`✓ Store hydrated from Firebase — ${firebaseTrips.length} trips`);
        } else {
          console.log('✓ Store hydrated — no trips found');
        }
      } else {
        console.log('✓ Store ready — no riderId yet');
      }

      resolve();
    }, 0);
  });
};

if (typeof window !== 'undefined') {
  window.useStore = useStore;
}