import { create } from 'zustand';

export const useStore = create((set, get) => ({
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

  // Trip History (NEW - for Environmental Impact Hub)
  tripHistory: [],
  addCompletedTrip: (trip) => set((state) => ({
    tripHistory: [...state.tripHistory, {
      ...trip,
      id: `trip-${Date.now()}`,
      timestamp: trip.timestamp || new Date().toISOString(),
    }].slice(-100), // Keep last 100 trips
  })),

  // Coaching Tips Cache
  currentCoachingTips: [],
  setCoachingTips: (tips) => set({ currentCoachingTips: tips }),

  // Impact Summary (cached)
  impactSummary: null,
  setImpactSummary: (summary) => set({ impactSummary: summary }),
}));