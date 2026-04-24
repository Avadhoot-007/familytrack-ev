import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistTripToFirebase, loadTripsFromFirebase } from '../utils/tripFirebaseSync';

const STORAGE_KEY = 'familytrack-ev-store';

export const useStore = create(
  persist(
    (set, get) => ({
      // Auth
      userId: null,
      riderName: null,
      setAuth: (userId, riderName) => set({ userId, riderName }),

      // Current trip
      isSharing: false,
      tripStartTime: null,
      tripStats: { distanceKm: 0, avgSpeedKmh: 0, score: 0, worstAxis: null },

      setSharing: (isSharing) => set({ isSharing, tripStartTime: isSharing ? Date.now() : null }),
      updateTripStats: (stats) => set({ tripStats: stats }),

      // Battery
      battery: 85,
      setBattery: (battery) => set({ battery }),

      // Location
      location: null,
      setLocation: (location) => set({ location }),

      // Riders (for watcher)
      riders: {},
      setRiders: (riders) => set({ riders }),

      // Alerts
      alerts: [],
      addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),

      // Trip History
      tripHistory: [],

      addCompletedTrip: (trip) => set((state) => {
        const newTrip = {
          ...trip,
          id: trip.id || `trip-${Date.now()}`,
          timestamp: trip.timestamp || new Date().toISOString(),
        };
        // Deduplicate by timestamp
        const exists = state.tripHistory.some(t => t.timestamp === newTrip.timestamp);
        if (exists) return {};
        const updated = [...state.tripHistory, newTrip].slice(-100);

        // Fire-and-forget Firebase write
        const riderId = state.riderName
          ?.toLowerCase().replace(/\s+/g, '-') || null;
        if (riderId) {
          persistTripToFirebase(riderId, newTrip);
        }

        return { tripHistory: updated };
      }),

      setTripHistory: (trips) => set({ tripHistory: trips }),

      removeTrip: (tripId) => set((state) => ({
        tripHistory: state.tripHistory.filter(t => t.id !== tripId),
      })),

      // Coaching Tips
      currentCoachingTips: [],
      setCoachingTips: (tips) => set({ currentCoachingTips: tips }),

      // Impact Summary (cached)
      impactSummary: null,
      setImpactSummary: (summary) => set({ impactSummary: summary }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        battery: state.battery,
        riderName: state.riderName,
        userId: state.userId,
        tripHistory: state.tripHistory,
      }),
    }
  )
);

/**
 * Hydrate trip history.
 * 1. Wait for Zustand persist rehydration (localStorage).
 * 2. If localStorage has trips — done, Firebase is backup only.
 * 3. If localStorage is empty — attempt Firebase load for this rider.
 */
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

      // localStorage empty — try Firebase
      const riderId = state.riderName
        ?.toLowerCase().replace(/\s+/g, '-') || null;

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

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.useStore = useStore;
}