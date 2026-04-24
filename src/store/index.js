import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

      // Trip History — persisted via zustand persist middleware only.
      // FIX: removed manual localStorage.setItem calls — single source of truth.
      tripHistory: [],
      addCompletedTrip: (trip) => set((state) => {
        const newTrip = {
          ...trip,
          id: trip.id || `trip-${Date.now()}`,
          timestamp: trip.timestamp || new Date().toISOString(),
        };
        // Deduplicate by timestamp to prevent double-adds on re-renders
        const exists = state.tripHistory.some(t => t.timestamp === newTrip.timestamp);
        if (exists) return {};
        const updated = [...state.tripHistory, newTrip].slice(-100);
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
 * Hydrate trip history from zustand persist (localStorage via 'familytrack-ev-store').
 * The persist middleware already rehydrates automatically on store creation,
 * so this function just waits for that to settle and signals readiness.
 */
export const hydrateTripsFromStorage = async () => {
  return new Promise((resolve) => {
    // Zustand persist rehydrates synchronously from localStorage on store init.
    // Give it one tick to ensure the store state is populated before components read it.
    setTimeout(() => {
      const { tripHistory } = useStore.getState();
      console.log(`✓ Store hydrated — ${tripHistory.length} trips available`);
      resolve();
    }, 0);
  });
};

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.useStore = useStore;
}