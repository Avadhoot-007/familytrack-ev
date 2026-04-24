// ---------------------------------------------------------------------------
// src/utils/tripFirebaseSync.js
// Persists tripHistory to Firebase and hydrates Zustand from it on load.
// Node: riders/{riderId}/tripHistory/{tripId}
// ---------------------------------------------------------------------------

import { ref, set, get } from 'firebase/database';
import { db } from '../config/firebase';

/**
 * Write a single completed trip to Firebase.
 * Called after addCompletedTrip() in store.
 */
export const persistTripToFirebase = async (riderId, trip) => {
  if (!riderId || !trip?.id) return;
  try {
    await set(ref(db, `riders/${riderId}/tripHistory/${trip.id}`), trip);
  } catch (e) {
    console.warn('tripFirebaseSync: write failed', e.message);
  }
};

/**
 * Load all trips from Firebase for a rider.
 * Returns [] if none found or on error.
 */
export const loadTripsFromFirebase = async (riderId) => {
  if (!riderId) return [];
  try {
    const snap = await get(ref(db, `riders/${riderId}/tripHistory`));
    if (!snap.exists()) return [];
    const data = snap.val();
    return Object.values(data).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  } catch (e) {
    console.warn('tripFirebaseSync: read failed', e.message);
    return [];
  }
};