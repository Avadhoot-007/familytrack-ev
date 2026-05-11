// RiderDashboard: Primary interface for EV riders
// Tracks: trip metrics (distance, eco score, battery), GPS location, charging stations
// Manages: trip start/end, SOS alerts, coaching tips, environmental impact display
// Integrates with Zustand store for persistence across app

import { useState, useEffect, useRef } from "react";
import { ref, set } from "firebase/database";
import { db } from "../config/firebase";
import {
  generateSensorReading,
  calculateEcoScore,
  calculateTripStats,
  getEcoScoreColor,
} from "../utils/ecoScoring";
import {
  calculateDistance,
  normalizeRiderId,
} from "../services/locationService";
import {
  fetchChargingStations,
  buildMapsUrl,
} from "../services/chargingStations";
import { useStore } from "../store";
import RiderLeaderboard from "../components/RiderLeaderboard";
import SOSModal from "../components/SOSModal";
import EnvironmentalImpactHub from "../components/EnvironmentalImpactHub";
import CoachingTipsSystem from "../components/CoachingTipsSystem";
import TripSummaryCard from "../components/TripSummaryCard";
import { getCoachingTips } from "../utils/ecoImpactCalculations";
import RiderTipsInbox from "../components/RiderTipsInbox";
import "./RiderDashboard.css";

// ── Ather Rizta Z battery specs (3.7 kWh capacity) ───────────────────────────
// consumption rates vary by riding style; used for drain projection and alerts
const BATTERY_SPECS = {
  capacity: 3700, // total Wh
  consumption: { eco: 33, normal: 37, aggressive: 46 }, // Wh/km per style
};

// ── Battery level thresholds ──────────────────────────────────────────────────
// BLOCK: cannot start trip; CRITICAL: emergency modal; LOW: warning toast
const BATTERY_BLOCK = 0;
const BATTERY_CRITICAL = 10;
const BATTERY_LOW = 25;

// ── Drain rate monitoring constants ──────────────────────────────────────────
// Alert fires when real consumption exceeds baseline × DRAIN_ALERT_RATIO
const DRAIN_BASELINE_WH_KM = 37;
const DRAIN_ALERT_RATIO = 1.2;

export default function RiderDashboard({ riderName, isActive = true }) {
  // ── Component state ───────────────────────────────────────────────────────
  const [isSharing, setIsSharing] = useState(false);
  const [battery, setBattery] = useState(85);
  const [location, setLocation] = useState(null);
  const [ecoScore, setEcoScore] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [readings, setReadings] = useState([]);
  const [tripDuration, setTripDuration] = useState(0);
  const [tripStarted, setTripStarted] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sosModalOpen, setSOSModalOpen] = useState(false);
  const [tripData, setTripData] = useState(null);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);

  // ── Toast & modal state ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const [criticalModal, setCriticalModal] = useState(false);
  const [startBlockModal, setStartBlockModal] = useState(false);

  // ── Charging station state ────────────────────────────────────────────────
  const [stations, setStations] = useState([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState(null);
  const [showStations, setShowStations] = useState(false);
  const stationsFetchedRef = useRef(false);

  // ── Drain rate state ──────────────────────────────────────────────────────
  const [drainRate, setDrainRate] = useState(null);
  const [drainAlert, setDrainAlert] = useState(false);
  const startBatteryRef = useRef(null);

  // ── Persistent refs (survive re-renders without triggering effects) ────────
  const batteryRef = useRef(battery); // live battery value for closures
  const watchIdRef = useRef(null); // navigator.geolocation watch ID
  const lastLocationRef = useRef(null); // previous GPS point for delta calc
  const tripStartTimeRef = useRef(null); // trip wall-clock start
  const routePointsRef = useRef([]); // accumulates [lat,lon] pairs

  // ── Battery alert dedup refs ──────────────────────────────────────────────
  const lowToastShownRef = useRef(false);
  const criticalToastShownRef = useRef(false);
  // Tracks whether the critical battery modal has already been shown for the
  // current battery level so the modal doesn't re-open on every render
  const criticalModalShownForBatteryRef = useRef(false);

  // ── Zustand store selectors ───────────────────────────────────────────────
  const tripHistory = useStore((s) => s.tripHistory);
  const addCompletedTrip = useStore((s) => s.addCompletedTrip);
  const setCoachingTips = useStore((s) => s.setCoachingTips);
  const currentCoachingTips = useStore((s) => s.currentCoachingTips);

  // Keep batteryRef in sync with state so geolocation callbacks see latest value
  useEffect(() => {
    batteryRef.current = battery;
  }, [battery]);

  // Derive a Firebase-safe rider ID from the display name
  const riderId = riderName ? normalizeRiderId(riderName) : "rider-1";
  // ── Toast helpers ─────────────────────────────────────────────────────────
  // addToast: push a transient notification; auto-removes after durationMs
  // pass durationMs=0 for a persistent toast (must be manually closed)
  const addToast = (msg, type = "warning", durationMs = 6000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, msg, type }]);
    if (durationMs > 0) {
      setTimeout(() => removeToast(id), durationMs);
    }
    return id;
  };

  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Battery alert effect ──────────────────────────────────────────────────
  // Watches battery + isSharing; fires low/critical toasts and modals once per
  // threshold crossing using dedup refs. Resets when trip starts.
  useEffect(() => {
    if (!isSharing) return;

    if (
      battery <= BATTERY_LOW &&
      battery > BATTERY_CRITICAL &&
      !lowToastShownRef.current
    ) {
      lowToastShownRef.current = true;
      addToast(
        `🔋 Battery at ${battery}% — consider finding a charging station soon.`,
        "warning",
        8000,
      );
      if (location) fetchNearbyStations(location.latitude, location.longitude);
    }

    if (battery <= BATTERY_CRITICAL && !criticalToastShownRef.current) {
      criticalToastShownRef.current = true;
      addToast(
        `🚨 Critical battery (${battery}%)! Stop and charge immediately.`,
        "critical",
        0,
      );
      if (!criticalModalShownForBatteryRef.current) {
        criticalModalShownForBatteryRef.current = true;
        stationsFetchedRef.current = false;
        setCriticalModal(true);
      }
      if (location) fetchNearbyStations(location.latitude, location.longitude);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battery, isSharing]);

  // ── Charging station fetch ────────────────────────────────────────────────
  // _doFetchStations: actual Overpass query; sets stations/loading/error state
  const _doFetchStations = async (lat, lon) => {
    setStationsLoading(true);
    setStationsError(null);
    try {
      const results = await fetchChargingStations(lat, lon, 3);
      setStations(results);
      stationsFetchedRef.current = true;
      if (results.length === 0) {
        setStationsError(
          "No stations found within 12 km. Try a different location.",
        );
      }
    } catch (e) {
      console.error("Station fetch error:", e);
      stationsFetchedRef.current = false;
      setStationsError(`Failed to fetch stations: ${e.message}`);
    } finally {
      setStationsLoading(false);
    }
  };

  // fetchNearbyStations: debounced wrapper; skips if already fetched this session
  const fetchNearbyStations = async (lat, lon) => {
    if (stationsFetchedRef.current) return;
    await _doFetchStations(lat, lon);
  };

  // handleFindStations: manual trigger from UI; always re-fetches
  const handleFindStations = async () => {
    stationsFetchedRef.current = false;
    setShowStations(true);
    const lat = location?.latitude ?? 18.5204;
    const lon = location?.longitude ?? 73.8567;
    await _doFetchStations(lat, lon);
  };

  // ── Drain rate monitoring effect ──────────────────────────────────────────
  // Calculates real-time Wh/km from battery delta and distance traveled.
  // Fires a toast once when drain exceeds DRAIN_BASELINE × DRAIN_ALERT_RATIO.
  useEffect(() => {
    if (!isSharing || tripDistance < 0.3) return;

    const batteryUsedPct = (startBatteryRef.current ?? battery) - battery;
    if (batteryUsedPct <= 0) return;

    const batteryUsedWh = (batteryUsedPct / 100) * BATTERY_SPECS.capacity;
    const rate = batteryUsedWh / tripDistance;
    setDrainRate(parseFloat(rate.toFixed(1)));

    if (rate > DRAIN_BASELINE_WH_KM * DRAIN_ALERT_RATIO && !drainAlert) {
      setDrainAlert(true);
      addToast(
        `⚡ High drain rate (${rate.toFixed(0)} Wh/km vs ${DRAIN_BASELINE_WH_KM} normal) — ease off throttle.`,
        "warning",
        8000,
      );
    } else if (rate <= DRAIN_BASELINE_WH_KM * DRAIN_ALERT_RATIO) {
      setDrainAlert(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripDistance, battery]);

  // ── Derived range / speed helpers ─────────────────────────────────────────
  // getProjectedRange: remaining Wh ÷ current drain rate (or baseline)
  const getProjectedRange = () => {
    const rate = drainRate && drainRate > 0 ? drainRate : DRAIN_BASELINE_WH_KM;
    const remainingWh = (battery / 100) * BATTERY_SPECS.capacity;
    return (remainingWh / rate).toFixed(1);
  };

  // getAvgSpeed: total km ÷ total hours elapsed in trip
  const getAvgSpeed = () => {
    if (tripDuration <= 0 || tripDistance <= 0) return 0;
    return tripDistance / (tripDuration / 3600);
  };

  // getBatteryTheme: CSS class suffix for dynamic accent colour
  const getBatteryTheme = () => {
    if (battery >= 50) return "battery-healthy";
    if (battery >= 20) return "battery-warning";
    return "battery-critical";
  };

  // ── Trip duration ticker ──────────────────────────────────────────────────
  // Increments every second while tripStarted is true
  useEffect(() => {
    if (!tripStarted) return;
    const interval = setInterval(() => setTripDuration((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [tripStarted]);

  // ── Sensor reading interval ───────────────────────────────────────────────
  // Fires every 5 s while sharing; generates simulated throttle/speed/accel,
  // calculates eco score, appends to readings array, and syncs live score to
  // Firebase so the Watcher dashboard can display it in real-time.
  useEffect(() => {
    if (!isSharing) return;
    const interval = setInterval(() => {
      const reading = generateSensorReading();
      setReadings((prev) => [...prev, reading]);
      const score = calculateEcoScore(
        reading.throttle,
        reading.speed,
        reading.accel,
      );
      setEcoScore(score);

      // Write live eco score to Firebase — Watcher reads this from riders/{id}/currentEcoScore
      set(ref(db, `riders/${riderId}/currentEcoScore`), score).catch((e) =>
        console.error("currentEcoScore write error:", e),
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [isSharing, riderId]);

  // ── GPS watch effect ──────────────────────────────────────────────────────
  // Starts navigator.geolocation.watchPosition when sharing + tab is active.
  // On each position update:
  //   - Appends point to routePointsRef and writes to Firebase every 5 points
  //   - Calculates incremental distance from lastLocationRef
  //   - Writes full location object + online status to Firebase
  useEffect(() => {
    if (!isSharing || !isActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ latitude, longitude, accuracy });
        setError(null);

        // Accumulate route points; batch-write to Firebase every 5 updates
        const newPoint = [latitude, longitude];
        routePointsRef.current = [...routePointsRef.current, newPoint];
        setRoutePoints([...routePointsRef.current]);

        const len = routePointsRef.current.length;
        if (len <= 2 || len % 5 === 0) {
          set(
            ref(db, `riders/${riderId}/currentRoute`),
            routePointsRef.current,
          ).catch((e) => console.error("Route write error:", e));
        }

        // Haversine distance delta from last known position
        if (lastLocationRef.current) {
          try {
            const distDelta = calculateDistance(
              lastLocationRef.current.latitude,
              lastLocationRef.current.longitude,
              latitude,
              longitude,
            );
            setTripDistance((prev) => prev + distDelta);
          } catch (err) {
            console.error("Distance calc error:", err);
          }
        }
        lastLocationRef.current = { latitude, longitude };

        // Write rider location + status to Firebase for Watcher map
        set(ref(db, `riders/${riderId}/location`), {
          lat: latitude,
          lon: longitude,
          name: riderName,
          timestamp: new Date().toISOString(),
          battery: batteryRef.current,
          accuracy,
        }).catch((e) => setError(e.message));

        set(ref(db, `riders/${riderId}/status`), "online").catch((e) =>
          setError(e.message),
        );
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );

    watchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, [isSharing, isActive, riderName, riderId]);

  // ── Internal trip start helper ────────────────────────────────────────────
  // Resets all trip state and dedup flags; called by handleStartSharing and
  // the "Ride Anyway" button in the critical battery modal.
  const _doStartSharing = () => {
    setIsSharing(true);
    setTripStarted(true);
    setEcoScore(0);
    setTripDistance(0);
    setReadings([]);
    setTripDuration(0);
    setError(null);
    setDrainRate(null);
    setDrainAlert(false);
    setRoutePoints([]);
    routePointsRef.current = [];
    lowToastShownRef.current = false;
    criticalToastShownRef.current = false;
    // Mark modal as shown so it doesn't re-fire immediately after starting
    criticalModalShownForBatteryRef.current = true;
    stationsFetchedRef.current = false;
    startBatteryRef.current = battery;
    tripStartTimeRef.current = Date.now();
    lastLocationRef.current = null;
    // Clear any stale route from previous trip
    set(ref(db, `riders/${riderId}/currentRoute`), null).catch(() => {});
  };

  // ── handleStartSharing ────────────────────────────────────────────────────
  // Gate-checks battery level before allowing trip start.
  // Shows block modal at 0%, critical modal at ≤BATTERY_CRITICAL%, else starts.
  const handleStartSharing = () => {
    if (battery <= BATTERY_BLOCK) {
      setStartBlockModal(true);
      return;
    }
    if (battery <= BATTERY_CRITICAL) {
      criticalModalShownForBatteryRef.current = false;
      stationsFetchedRef.current = false;
      setStations([]);
      setCriticalModal(true);
      return;
    }
    _doStartSharing();
  };

  // ── handleStopSharing ────────────────────────────────────────────────────
  // Ends the active trip: calculates final stats, builds the trip object,
  // saves profile to Firebase, and delegates ALL trip persistence to
  // addCompletedTrip (which calls persistTripToFirebase internally).
  //
  // FIX: previously also called `set(ref(db, riders/${riderId}/trips/${tripId}))`
  // directly here, creating a SECOND Firebase write with a DIFFERENT auto-generated
  // ID — resulting in duplicate entries in trip history. That direct write is
  // removed; the `id` is now passed into addCompletedTrip so persistTripToFirebase
  // uses the correct consistent key.
  const handleStopSharing = async () => {
    if (!isSharing) return;
    setIsSharing(false);
    setTripStarted(false);

    const finalAvgSpeed =
      tripDuration > 0 && tripDistance > 0
        ? parseFloat((tripDistance / (tripDuration / 3600)).toFixed(1))
        : 0;

    const finalRoute =
      routePointsRef.current.length > 0 ? [...routePointsRef.current] : [];

    try {
      // Generate a single stable trip ID used for both store and Firebase
      const tripId = `trip-${Date.now()}`;

      // Aggregate eco score over all sensor readings collected during the trip
      const tripStats = calculateTripStats(readings);
      const tripEcoScore = tripStats.avg;
      const worstAxis = tripStats.worstAxis;

      // Derive consumption and battery delta from ride style
      const rideStyle =
        tripEcoScore >= 80
          ? "eco"
          : tripEcoScore >= 60
            ? "normal"
            : "aggressive";
      const consumptionRate = BATTERY_SPECS.consumption[rideStyle];
      const batteryUsedWh = tripDistance * consumptionRate;
      const batteryUsedPercent = (batteryUsedWh / BATTERY_SPECS.capacity) * 100;
      const batteryRemaining = batteryRef.current - batteryUsedPercent;

      // ── Write rider profile to Firebase (non-trip metadata) ────────────
      await set(ref(db, `riders/${riderId}/profile`), { name: riderName });

      // ── Clear live trip data from Firebase ────────────────────────────
      // These fields are only relevant during an active trip; clear them now
      // so the Watcher dashboard doesn't show stale data.
      set(ref(db, `riders/${riderId}/currentEcoScore`), null).catch(() => {});
      set(ref(db, `riders/${riderId}/currentRoute`), null).catch(() => {});
      setRoutePoints([]);
      routePointsRef.current = [];

      // ── Persist trip via Zustand store (which calls persistTripToFirebase)
      // IMPORTANT: pass `id: tripId` so addCompletedTrip and persistTripToFirebase
      // use the same key — preventing duplicate Firebase entries.
      addCompletedTrip({
        id: tripId, // ← explicit ID prevents auto-generation of a second one
        riderName,
        distanceKm: parseFloat(tripDistance.toFixed(2)),
        durationSeconds: tripDuration,
        score: tripEcoScore,
        avgSpeedKmh: finalAvgSpeed,
        battery: batteryRef.current,
        batteryUsedPercent: parseFloat(batteryUsedPercent.toFixed(1)),
        batteryRemaining: Math.max(0, parseFloat(batteryRemaining.toFixed(1))),
        worstAxis,
        rideStyle,
        consumptionWh: consumptionRate,
        timestamp: new Date().toISOString(),
        route: finalRoute,
        readingCount: readings.length,
        startLat: location?.latitude ?? null,
        startLon: location?.longitude ?? null,
      });

      // Generate coaching tips based on trip performance for inline display
      const tips = getCoachingTips(
        tripEcoScore,
        worstAxis,
        finalAvgSpeed,
        readings.map((r) => r.throttle),
        tripDistance,
      );
      setCoachingTips(tips);

      // Populate TripSummaryCard with trip details for the post-trip modal
      setTripData({
        riderName,
        distance: parseFloat(tripDistance.toFixed(2)),
        duration: tripDuration,
        ecoScore: tripEcoScore,
        avgSpeed: finalAvgSpeed,
        batteryUsed: parseFloat(batteryUsedPercent.toFixed(1)),
        batteryRemaining: Math.max(0, parseFloat(batteryRemaining.toFixed(1))),
        worstAxis,
        timestamp: new Date().toISOString(),
      });
      setShowTripSummary(true);

      // Mark rider offline in Firebase
      await set(ref(db, `riders/${riderId}/status`), "offline");
      setReadings([]);
    } catch (error) {
      console.error("Error saving trip:", error);
      setError(`Failed to save trip: ${error.message}`);
    }
  };

  // ── handleSimulateTrip ────────────────────────────────────────────────────
  // Generates a randomised demo trip using one of 7 pre-defined profiles.
  // Simulates sensor readings, builds a fake GPS route, calculates eco stats,
  // and persists via addCompletedTrip ONLY (no separate Firebase write).
  //
  // FIX: previously also called `set(ref(db, riders/${riderId}/trips/${simTripId}))`
  // directly, causing the same duplicate-entry bug as handleStopSharing.
  // That direct write is removed; id is passed to addCompletedTrip instead.
  const handleSimulateTrip = async () => {
    if (battery <= BATTERY_BLOCK) {
      setStartBlockModal(true);
      return;
    }

    setIsSimulating(true);
    try {
      // Seven representative riding profiles covering the full eco-score spectrum
      const DEMO_PROFILES = [
        {
          distance: 3.2,
          duration: 600,
          ecoScore: 82,
          style: "eco",
          name: "Eco Ride",
        },
        {
          distance: 5.8,
          duration: 900,
          ecoScore: 65,
          style: "normal",
          name: "Normal Ride",
        },
        {
          distance: 2.1,
          duration: 420,
          ecoScore: 42,
          style: "aggressive",
          name: "Aggressive Ride",
        },
        {
          distance: 4.5,
          duration: 720,
          ecoScore: 55,
          style: "normal",
          name: "Mixed Ride",
        },
        {
          distance: 6.3,
          duration: 1080,
          ecoScore: 88,
          style: "eco",
          name: "Very Eco Ride",
        },
        {
          distance: 3.8,
          duration: 540,
          ecoScore: 35,
          style: "aggressive",
          name: "City Rush",
        },
        {
          distance: 2.5,
          duration: 480,
          ecoScore: 48,
          style: "normal",
          name: "Moderate Ride",
        },
      ];

      const profile =
        DEMO_PROFILES[Math.floor(Math.random() * DEMO_PROFILES.length)];
      const derivedSpeed = parseFloat(
        (profile.distance / (profile.duration / 3600)).toFixed(1),
      );

      // Generate synthetic sensor readings whose aggregate matches the profile style
      const simulatedReadings = [];
      const readingsCount = Math.ceil(profile.duration / 5);
      for (let i = 0; i < readingsCount; i++) {
        let throttle, speed, accel;
        if (profile.style === "eco") {
          throttle = 20 + Math.random() * 30 + Math.sin(i * 0.1) * 10;
          speed = 19 + Math.random() * 6 + Math.cos(i * 0.08) * 3;
          accel = (Math.random() - 0.5) * 0.3;
        } else if (profile.style === "aggressive") {
          throttle = 50 + Math.random() * 45 + Math.sin(i * 0.2) * 15;
          speed = 15 + Math.random() * 25 + Math.sin(i * 0.15) * 8;
          accel = (Math.random() - 0.5) * 0.8;
        } else {
          throttle = 35 + Math.random() * 35 + Math.sin(i * 0.12) * 10;
          speed = 20 + Math.random() * 15 + Math.cos(i * 0.1) * 5;
          accel = (Math.random() - 0.5) * 0.5;
        }
        simulatedReadings.push({
          throttle: Math.max(0, Math.min(100, throttle)),
          speed: Math.max(0, Math.min(60, speed)),
          accel: Math.max(-1, Math.min(1, accel)),
        });
      }

      // Build a plausible GPS route anchored near Pune city centre
      const baseLat = 18.5204 + (Math.random() - 0.5) * 0.05;
      const baseLon = 73.8567 + (Math.random() - 0.5) * 0.05;
      const simulatedRoute = [];
      const routeSteps = Math.min(readingsCount, 30);
      for (let i = 0; i < routeSteps; i++) {
        const t = i / Math.max(routeSteps - 1, 1);
        simulatedRoute.push([
          baseLat +
            (profile.distance / 111) * t * (1 + Math.sin(t * Math.PI) * 0.3),
          baseLon +
            (profile.distance / 111) * t * (0.5 + Math.cos(t * Math.PI) * 0.2),
        ]);
      }

      // Aggregate eco score from synthetic readings (mirrors real trip logic)
      const tripStats = calculateTripStats(simulatedReadings);
      const tripEcoScore = tripStats.avg;
      const worstAxis = tripStats.worstAxis;

      const consumptionRate = BATTERY_SPECS.consumption[profile.style];
      const batteryUsedWh = profile.distance * consumptionRate;
      const batteryUsedPercent = (batteryUsedWh / BATTERY_SPECS.capacity) * 100;
      const newBattery = Math.max(0, battery - batteryUsedPercent);

      // Generate a single stable ID for the simulated trip
      const simTripId = `sim-${Date.now()}`;

      // Write rider profile metadata to Firebase (not the trip itself)
      await set(ref(db, `riders/${riderId}/profile`), { name: riderName });

      // Update displayed battery to reflect simulated drain
      setBattery(newBattery);
      batteryRef.current = newBattery;

      // ── Persist simulated trip via Zustand store ONLY ─────────────────
      // IMPORTANT: pass `id: simTripId` — addCompletedTrip uses this as the
      // Firebase key via persistTripToFirebase, preventing duplicate entries.
      addCompletedTrip({
        id: simTripId, // ← explicit ID; prevents second auto-generated write
        riderName,
        distanceKm: parseFloat(profile.distance.toFixed(2)),
        durationSeconds: profile.duration,
        score: tripEcoScore,
        avgSpeedKmh: derivedSpeed,
        battery: newBattery,
        batteryUsedPercent: parseFloat(batteryUsedPercent.toFixed(1)),
        batteryRemaining: parseFloat(newBattery.toFixed(1)),
        worstAxis,
        rideStyle: profile.style,
        consumptionWh: consumptionRate,
        timestamp: new Date().toISOString(),
        route: simulatedRoute,
        isSimulated: true,
        startLat: baseLat,
        startLon: baseLon,
        readingCount: simulatedReadings.length,
      });

      // Generate coaching tips for the simulated trip
      const tips = getCoachingTips(
        tripEcoScore,
        worstAxis,
        derivedSpeed,
        simulatedReadings.map((r) => r.throttle),
        profile.distance,
      );
      setCoachingTips(tips);

      // Populate TripSummaryCard for the post-simulation modal
      setTripData({
        riderName,
        distance: parseFloat(profile.distance.toFixed(2)),
        duration: profile.duration,
        ecoScore: tripEcoScore,
        avgSpeed: derivedSpeed,
        batteryUsed: parseFloat(batteryUsedPercent.toFixed(1)),
        batteryRemaining: parseFloat(newBattery.toFixed(1)),
        worstAxis,
        timestamp: new Date().toISOString(),
      });
      setShowTripSummary(true);
      setError(null);
    } catch (error) {
      console.error("Simulation error:", error);
      setError(`Simulation failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // ── Formatting helpers ────────────────────────────────────────────────────
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // getDrainLabel: returns severity label + colour for the drain rate strip
  const getDrainLabel = () => {
    if (!drainRate) return null;
    if (drainRate > DRAIN_BASELINE_WH_KM * 1.3)
      return { label: "High Drain", color: "#dc3545", icon: "🔴" };
    if (drainRate > DRAIN_BASELINE_WH_KM * DRAIN_ALERT_RATIO)
      return { label: "Elevated Drain", color: "#ff9800", icon: "🟡" };
    return { label: "Normal Drain", color: "#4CAF50", icon: "🟢" };
  };

  // ── Derived display values ────────────────────────────────────────────────
  const ecoScoreColor = getEcoScoreColor(ecoScore);
  const avgSpeed = getAvgSpeed();
  const projRange = isSharing ? getProjectedRange() : null;
  const drainLabel = getDrainLabel();
  const batteryTheme = getBatteryTheme();

  // Static range/time estimate shown before trip starts (uses baseline drain)
  const estRange = parseFloat(getProjectedRange());
  const estTimeMin = Math.round((estRange / 25) * 60);

  const ecoCardStyle = {
    background: "rgba(0,0,0,0.30)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    padding: "14px 16px",
    marginBottom: "16px",
  };

  // ── StationList sub-component ─────────────────────────────────────────────
  // Renders charging station links inside the critical battery modal.
  // Uses fromLat/fromLon for Google Maps directions origin.
  const StationList = ({ fromLat, fromLon }) => {
    if (stationsLoading) {
      return (
        <p
          style={{
            color: "#ffa726",
            fontSize: "13px",
            margin: "8px 0",
            textAlign: "center",
          }}
        >
          ⏳ Finding nearby stations...
        </p>
      );
    }
    if (stationsError) {
      return (
        <div style={{ marginTop: "8px" }}>
          <p style={{ color: "#ff8a80", fontSize: "12px", margin: "0 0 8px" }}>
            ⚠️ {stationsError}
          </p>
          <button
            className="battery-modal-btn battery-modal-btn-secondary"
            style={{ width: "100%" }}
            onClick={(e) => {
              e.stopPropagation();
              handleFindStations();
            }}
          >
            🔄 Retry
          </button>
        </div>
      );
    }
    if (stations.length === 0) {
      return (
        <button
          className="battery-modal-btn battery-modal-btn-secondary"
          style={{ marginTop: "8px", width: "100%" }}
          onClick={(e) => {
            e.stopPropagation();
            handleFindStations();
          }}
        >
          🔍 Find Nearby Stations
        </button>
      );
    }
    return (
      <div className="battery-modal-stations">
        {stations.slice(0, 3).map((s) => (
          <a
            key={s.id}
            href={
              fromLat && fromLon
                ? buildMapsUrl(fromLat, fromLon, s.lat, s.lon)
                : `https://www.google.com/maps?q=${s.lat},${s.lon}`
            }
            target="_blank"
            rel="noreferrer"
            className="battery-modal-station-link"
          >
            🔌 {s.name} — {s.distanceKm} km →
          </a>
        ))}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`rider-dashboard ${batteryTheme}`}>
      {/* Persistent toast stack — bottom-right corner */}
      <div className="toast-stack">
        {toasts.length > 1 && (
          <button
            onClick={() => setToasts([])}
            style={{
              alignSelf: "flex-end",
              padding: "3px 8px",
              fontSize: "11px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid #555",
              borderRadius: "4px",
              color: "#aaa",
              cursor: "pointer",
              marginBottom: "4px",
            }}
          >
            Clear All
          </button>
        )}
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.msg}</span>
            <button onClick={() => removeToast(t.id)} className="toast-close">
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* ── Battery Dead modal (0% — cannot start) ─────────────────────────── */}
      {startBlockModal && (
        <div
          className="battery-modal-overlay"
          onClick={() => setStartBlockModal(false)}
        >
          <div className="battery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="battery-modal-icon">🪫</div>
            <h2>Battery Dead</h2>
            <p>Battery is at 0%. The scooter cannot start.</p>
            <p className="battery-modal-sub">
              Charge your Ather Rizta Z before riding.
            </p>
            {stations.length > 0 && (
              <p className="battery-modal-sub">
                Nearest: <strong>{stations[0].name}</strong> (
                {stations[0].distanceKm} km)
              </p>
            )}
            <div className="battery-modal-actions">
              <button
                className="battery-modal-btn battery-modal-btn-secondary"
                onClick={() => setStartBlockModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Critical Battery modal (≤10%) ──────────────────────────────────── */}
      {criticalModal && (
        <div
          className="battery-modal-overlay"
          onClick={() => setCriticalModal(false)}
        >
          <div
            className="battery-modal battery-modal-critical"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="battery-modal-icon">🔋</div>
            <h2>Critical Battery — {battery}%</h2>
            <p>
              Estimated range: <strong>~{projRange || estRange} km</strong>
            </p>
            <p className="battery-modal-sub">
              Find a charging station immediately or head home.
            </p>
            <StationList
              fromLat={location?.latitude}
              fromLon={location?.longitude}
            />
            <div
              className="battery-modal-actions"
              style={{ marginTop: "16px" }}
            >
              <button
                className="battery-modal-btn battery-modal-btn-secondary"
                onClick={() => setCriticalModal(false)}
              >
                Dismiss
              </button>
              {battery > BATTERY_BLOCK && (
                <button
                  className="battery-modal-btn"
                  onClick={() => {
                    setCriticalModal(false);
                    _doStartSharing();
                  }}
                >
                  Ride Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Top navigation tabs ─────────────────────────────────────────────── */}
      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          🚴 Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          🏆 Leaderboard
        </button>
        <button
          className={`tab-btn ${activeTab === "impact" ? "active" : ""}`}
          onClick={() => setActiveTab("impact")}
        >
          🌱 Impact Hub
        </button>
      </div>

      {/* ── Dashboard tab ──────────────────────────────────────────────────── */}
      {activeTab === "dashboard" ? (
        <>
          <h1>🚴 Rider Dashboard</h1>
          <p className="rider-name-badge">{riderName}</p>

          {/* Battery section — circular gauge + slider */}
          <div className="battery-section">
            <p>
              <strong>🔋 Battery Status</strong>
            </p>
            <div className="battery-gauge">
              <div className="battery-circle">
                <svg viewBox="0 0 100 100" className="battery-circle-svg">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    className="battery-circle-bg"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    className="battery-circle-fill"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 45}`,
                      strokeDashoffset: `${2 * Math.PI * 45 * (1 - battery / 100)}`,
                    }}
                  />
                </svg>
                <div className="battery-circle-text">
                  <div className="battery-percent">{battery}%</div>
                  <div className="battery-label">Battery</div>
                </div>
              </div>
              <div className="battery-info">
                {battery <= BATTERY_BLOCK ? (
                  <div className="battery-stat warning">
                    🪫 Battery dead — charge before riding
                  </div>
                ) : battery <= BATTERY_CRITICAL ? (
                  <div className="battery-stat warning">
                    🚨 Critical — stop and charge now!
                  </div>
                ) : battery <= BATTERY_LOW ? (
                  <div className="battery-stat warning">
                    ⚠️ Low battery — find a charger soon
                  </div>
                ) : battery >= 50 ? (
                  <div className="battery-stat">
                    ✓ Good condition — continue riding
                  </div>
                ) : (
                  <div className="battery-stat">
                    ⚠️ Medium — plan a charge stop
                  </div>
                )}
                <div className="battery-stat">
                  <strong>Est. Range:</strong> ~{estRange} km
                </div>
                <div className="battery-stat">
                  <strong>Est. Time:</strong> ~{estTimeMin} min
                </div>
              </div>
            </div>
            <div className="battery-bar">
              <div className="battery-fill" style={{ width: `${battery}%` }} />
            </div>
            {/* Dev slider — lets tester simulate battery depletion */}
            <input
              type="range"
              min="0"
              max="100"
              value={battery}
              onChange={(e) => setBattery(Number(e.target.value))}
              className="battery-slider"
            />
          </div>

          {/* Trip duration timer — visible only during active trip */}
          {tripStarted && (
            <div className="trip-timer">
              <p className="timer-label">⏱️ Trip Duration</p>
              <p className="timer-value">{formatDuration(tripDuration)}</p>
            </div>
          )}

          {/* Route point counter */}
          {isSharing && routePoints.length > 0 && (
            <div
              style={{
                fontSize: "12px",
                color: "#666",
                textAlign: "center",
                marginBottom: "8px",
              }}
            >
              📍 {routePoints.length} route points recorded
            </div>
          )}

          {/* Warning shown when Rider tab is hidden — GPS pauses */}
          {isSharing && !isActive && (
            <div
              style={{
                padding: "8px 12px",
                marginBottom: "10px",
                background: "rgba(255,152,0,0.12)",
                border: "1px solid rgba(255,152,0,0.4)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#ffcc80",
                textAlign: "center",
              }}
            >
              ⏸️ GPS paused — switch back to Rider tab to resume
            </div>
          )}

          {/* Primary trip control buttons */}
          <div className="button-group">
            <button
              onClick={handleStartSharing}
              disabled={isSharing}
              className="btn btn-start"
              title={
                battery <= BATTERY_BLOCK ? "Battery dead — cannot start" : ""
              }
            >
              {isSharing
                ? "✓ Sharing..."
                : battery <= BATTERY_BLOCK
                  ? "🪫 No Battery"
                  : "▶️ Start Sharing"}
            </button>
            <button
              onClick={handleStopSharing}
              disabled={!isSharing}
              className="btn btn-stop"
            >
              ⏹️ Stop Sharing
            </button>
            <button
              onClick={handleSimulateTrip}
              disabled={isSharing || isSimulating}
              className="btn btn-simulate"
            >
              {isSimulating ? "⏳ Simulating..." : "🎬 Simulate Trip"}
            </button>
          </div>

          {/* SOS button — always visible for quick access */}
          <button className="btn btn-sos" onClick={() => setSOSModalOpen(true)}>
            🆘 SOS Emergency
          </button>

          {/* GPS coordinates display */}
          {location && (
            <div className="location-display">
              <p>📍 Lat: {location.latitude.toFixed(4)}</p>
              <p>📍 Lon: {location.longitude.toFixed(4)}</p>
              <p>📡 Accuracy: ±{Math.round(location.accuracy)} m</p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="error-box">
              <p>⚠️ {error}</p>
            </div>
          )}

          {/* Live trip stats panel — visible only while sharing */}
          {isSharing && (
            <div className="live-stats">
              <h3>📊 Live Trip Stats</h3>

              {/* Eco score bar */}
              <div style={ecoCardStyle}>
                <div className="eco-score-header">
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#c8e6c9",
                      fontWeight: "600",
                    }}
                  >
                    🌿 Eco-Score
                  </span>
                  <span
                    className="eco-score-value"
                    style={{ color: ecoScoreColor.color }}
                  >
                    {Math.round(ecoScore)}/100
                  </span>
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.22)",
                    height: "10px",
                    borderRadius: "5px",
                    overflow: "hidden",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      background: ecoScoreColor.color,
                      width: `${ecoScore}%`,
                      height: "100%",
                      borderRadius: "5px",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "13px",
                    color: "#e0e0e0",
                  }}
                >
                  {ecoScoreColor.label}
                </p>
              </div>

              <p>
                📏 Distance: <strong>{tripDistance.toFixed(2)} km</strong>
              </p>
              <p>
                ⚡ Avg Speed: <strong>{avgSpeed.toFixed(1)} km/h</strong>
              </p>

              {/* Range ticker — colour-coded by severity */}
              <div
                className={`range-ticker ${parseFloat(projRange) < 5 ? "range-ticker-critical" : parseFloat(projRange) < 15 ? "range-ticker-low" : ""}`}
              >
                <span className="range-ticker-label">
                  📍 Projected Range Remaining
                </span>
                <span className="range-ticker-value">{projRange} km</span>
                {parseFloat(projRange) < 5 && (
                  <span className="range-ticker-warn">
                    ⚠️ Find a charger NOW
                  </span>
                )}
                {parseFloat(projRange) >= 5 && parseFloat(projRange) < 15 && (
                  <span className="range-ticker-warn">
                    🔋 Low range — plan ahead
                  </span>
                )}
              </div>

              {/* Drain rate row */}
              {drainLabel && (
                <div className="drain-rate-row">
                  <span>
                    {drainLabel.icon} Drain Rate:{" "}
                    <strong style={{ color: drainLabel.color }}>
                      {drainLabel.label}
                    </strong>
                  </span>
                  <span style={{ fontSize: "12px", color: "#999" }}>
                    {drainRate} Wh/km (baseline {DRAIN_BASELINE_WH_KM})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Charging stations collapsible card ────────────────────────── */}
          <div className="charging-stations-card">
            <div
              className="charging-stations-header"
              onClick={() => {
                if (!showStations) {
                  setShowStations(true);
                  if (stations.length === 0 && !stationsLoading)
                    handleFindStations();
                } else {
                  setShowStations(false);
                }
              }}
            >
              <span>
                🔌 Nearby Charging Stations{" "}
                {stations.length > 0 ? `(${stations.length} found)` : ""}
              </span>
              <span>{showStations ? "▲" : "▼"}</span>
            </div>

            {showStations && (
              <>
                {stationsLoading && (
                  <p className="charging-loading">
                    ⏳ Fetching nearby stations...
                  </p>
                )}

                {!stationsLoading &&
                  (stations.length === 0 || stationsError) && (
                    <div style={{ padding: "12px 16px" }}>
                      {stationsError ? (
                        <p className="charging-empty">⚠️ {stationsError}</p>
                      ) : (
                        <p className="charging-empty">
                          No stations found. Try refreshing.
                        </p>
                      )}
                      <button
                        onClick={() => {
                          setStationsError(null);
                          handleFindStations();
                        }}
                        style={{
                          marginTop: "8px",
                          padding: "7px 14px",
                          background: "rgba(33,150,243,0.15)",
                          border: "1px solid rgba(33,150,243,0.4)",
                          borderRadius: "6px",
                          color: "#64b5f6",
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                      >
                        🔄 Retry Search
                      </button>
                    </div>
                  )}

                {!stationsLoading && stations.length > 0 && (
                  <div className="charging-stations-list">
                    {stations.map((s) => (
                      <div key={s.id} className="charging-station-row">
                        <div className="charging-station-info">
                          <span className="charging-station-name">
                            {s.name}
                          </span>
                          {s.operator && (
                            <span className="charging-station-sub">
                              {s.operator}
                            </span>
                          )}
                          <span className="charging-station-dist">
                            📍 {s.distanceKm} km away
                          </span>
                        </div>
                        <a
                          href={
                            location
                              ? buildMapsUrl(
                                  location.latitude,
                                  location.longitude,
                                  s.lat,
                                  s.lon,
                                )
                              : `https://www.google.com/maps?q=${s.lat},${s.lon}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="charging-maps-btn"
                        >
                          🗺️ Open Maps
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sharing status indicator */}
          <div className="status-box">
            {isSharing ? (
              <>
                <p className="status-active">✓ Location Sharing Active</p>
                <p className="status-sub">Syncing to Firebase continuously</p>
              </>
            ) : (
              <p className="status-inactive">○ Not Sharing Location</p>
            )}
          </div>

          {/* Post-trip inline summary (shown before modal opens) */}
          {!isSharing && tripDistance > 0 && (
            <div className="trip-ended">
              ✓ Trip ended! Distance: {tripDistance.toFixed(2)} km | Duration:{" "}
              {formatDuration(tripDuration)} | Final Eco-Score:{" "}
              {Math.round(ecoScore)}/100
            </div>
          )}

          {/* Post-trip summary modal */}
          {showTripSummary && tripData && (
            <TripSummaryModal
              tripData={tripData}
              riderId={riderId}
              onClose={() => setShowTripSummary(false)}
            />
          )}
        </>
      ) : activeTab === "leaderboard" ? (
        <RiderLeaderboard />
      ) : (
        <EnvironmentalImpactHub
          tripHistory={tripHistory}
          currentTrip={{
            distance: tripDistance,
            duration: tripDuration,
            ecoScore: Math.round(ecoScore),
            avgSpeed,
            batteryUsed: 100 - battery,
          }}
        />
      )}

      {/* Coaching tips floating panel — shown while sharing if tips exist */}
      {isSharing && currentCoachingTips.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "0 4px 6px",
            }}
          >
            <button
              onClick={() => setCoachingTips([])}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: "600",
                background: "transparent",
                border: "1px solid #444",
                borderRadius: "4px",
                color: "#888",
                cursor: "pointer",
              }}
            >
              🗑️ Clear Tips
            </button>
          </div>
          <CoachingTipsSystem
            tips={currentCoachingTips}
            ecoScore={Math.round(ecoScore)}
          />
        </>
      )}

      {/* Rider coaching tips inbox (floating badge + drawer) */}
      <RiderTipsInbox riderId={riderId} />

      {/* SOS emergency modal */}
      <SOSModal
        isOpen={sosModalOpen}
        onClose={() => setSOSModalOpen(false)}
        riderName={riderName}
        riderId={riderId}
        location={location}
        battery={battery}
      />
    </div>
  );
}

// ── TripSummaryModal ──────────────────────────────────────────────────────────
// Overlay modal shown immediately after a trip ends (real or simulated).
// Renders TripSummaryCard which includes PDF export and battery projection.
function TripSummaryModal({ tripData, riderId, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: "12px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px",
            borderBottom: "1px solid #333",
            position: "sticky",
            top: 0,
            background: "#1a1a1a",
          }}
        >
          <h2 style={{ margin: 0, color: "#fff", fontSize: "20px" }}>
            ✓ Trip Complete!
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#999",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "20px" }}>
          <TripSummaryCard trip={tripData} riderId={riderId} />
        </div>
      </div>
    </div>
  );
}
