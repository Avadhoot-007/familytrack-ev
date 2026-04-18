import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'familytrack-ev-store';
const TRIP_HISTORY_KEY = 'familytrack-trip-history';

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
      tripStats: { distanceKm: 0, avgSpeedKmh: 0, ecoScore: 0, worstAxis: null },
      
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

      // Trip History (PERSISTED - survives page reload)
      tripHistory: [],
      addCompletedTrip: (trip) => set((state) => {
        const newTrip = {
          ...trip,
          id: `trip-${Date.now()}`,
          timestamp: trip.timestamp || new Date().toISOString(),
        };
        const updated = [...state.tripHistory, newTrip].slice(-100);
        // Also sync to localStorage directly for instant backup
        localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(updated));
        return { tripHistory: updated };
      }),

      // Bulk load trips (used during Firebase hydration)
      setTripHistory: (trips) => set({ tripHistory: trips }),

      // Clear specific trip
      removeTrip: (tripId) => set((state) => {
        const updated = state.tripHistory.filter(t => t.id !== tripId);
        localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(updated));
        return { tripHistory: updated };
      }),

      // Coaching Tips Cache
      currentCoachingTips: [],
      setCoachingTips: (tips) => set({ currentCoachingTips: tips }),

      // Impact Summary (cached)
      impactSummary: null,
      setImpactSummary: (summary) => set({ impactSummary: summary }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        // Only persist these (not transient UI state)
        battery: state.battery,
        riderName: state.riderName,
        userId: state.userId,
        tripHistory: state.tripHistory, // Persist trips via zustand too
      }),
    }
  )
);

/**
 * Hydrate trip history from localStorage on app init
 * @returns {Promise<void>}
 */
export const hydrateTripsFromStorage = async () => {
  try {
    const stored = localStorage.getItem(TRIP_HISTORY_KEY);
    if (stored) {
      const trips = JSON.parse(stored);
      useStore.setState({ tripHistory: trips });
      console.log(`✓ Loaded ${trips.length} trips from localStorage`);
      return;
    }
  } catch (err) {
    console.error('localStorage read error:', err);
  }

  // Fallback: Try Firebase only if localStorage empty (optional)
  console.log('ℹ localStorage empty. Trips will be loaded from Firebase on next sync.');
  // Firebase trips auto-sync when RiderDashboard queries them during the trip save flow
};

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.useStore = useStore;
}