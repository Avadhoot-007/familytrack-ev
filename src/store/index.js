import { create } from 'zustand';

export const useStore = create((set) => ({
  // Auth
  userId: null,
  riderName: null,
  setAuth: (userId, riderName) => set({ userId, riderName }),

  // Current trip
  isSharing: false,
  tripStartTime: null,
  tripStats: { distanceKm: 0, avgSpeedKmh: 0, ecoScore: 0 },
  
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
}));