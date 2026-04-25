# FamilyTrack EV 🚴‍♂️🔋

A comprehensive family safety and eco-tracking application for electric vehicle riders. Monitor real-time location, battery levels, and driving efficiency while ensuring safety through geofencing and emergency alerts.

## 🌟 Features
### For Riders 👤
- **Real-time Location Sharing**: Share live GPS location while riding; updates sync to Firebase in real-time.
- **Eco-Score Tracking**: Live eco-scoring computed from throttle, speed and acceleration with color-coded feedback.
- **Battery Monitoring & Projections**: Track battery %, projected range (Wh/km), drain-rate alerts and critical warnings.
- **Trip Logging & Simulation**: Automatic trip recording plus realistic demo profiles (simulated trips are flagged).
- **Hold-to-Activate SOS**: 5s hold-to-activate SOS (countdown) that logs location, battery and notifies watchers.
- **Coaching Tips (Rider Inbox)**: Receive tips sent by watchers or auto-generated tips based on trip analysis (poor eco-score, high drain, speeding patterns); unread badge and dismissible tips.
- **Badge & Achievement System**: Unlock environmental badges (Seedling → Sapling → Oak → Forest Guardian → Carbon Champion) based on CO2 saved; animated notifications celebrate milestones.
- **Nearby Charging Stations**: Lookup chargers using OpenStreetMap/Overpass with client-side caching and Google Maps links.
- **Trip Summary & PDF Export**: Export trip summaries and environmental impact reports as downloadable PDFs.

### For Watchers 👁️
- **Live Map with Leaflet**: Interactive map showing online/offline riders, custom markers, geofences and nearby chargers.
- **SOS Alerts & Actions**: Immediate SOS modal with location and direct Google Maps link; mark SOS as resolved from watcher UI.
- **Geofence Notifications**: Enter/exit alerts for configurable safe zones (see `src/data/geofences.js`).
- **Alerts Panel & Actions**: Battery/drain/weather alerts with one-click actions to send coaching reminders to riders.
- **Trip History, Exports & Leaderboard**: Browse trips, filter by time window, export PDFs and view eco leaderboards across riders.
- **Weather Monitoring (Optional)**: Real-time OpenWeatherMap integration polling every 30–60s per rider; detects rain (WMO codes 200–231, 300–321, 500–531) and triggers auto-prompts to send safety tips (gracefully disables if key missing).

### Core & Notable Implementations 🔧
- **Realtime Sync & Auth**: Anonymous Firebase Auth (optional) and Realtime Database for live location, trip and SOS state.
- **State Persistence & Hydration**: Zustand store with local persistence and Firebase hydration fallback (`hydrateTripsFromStorage`).
- **Charging Stations (Overpass API)**: Charger lookup via OpenStreetMap Overpass API with 5-minute client cache to reduce requests.
- **Drain-rate & Range Estimation**: Calculates Wh/km drain rate, issues alerts when drain exceeds a configurable baseline.
- **Trip PDF Generation**: Two PDF utilities for watcher/rider exports — ASCII-safe PDF generation with dynamic stream length handling.
- **Coaching Tips Flow**: Tips can be auto-generated from trip analysis or pushed by watchers; saved under `riders/{riderId}/coachingTips` in Firebase.
- **Geofencing**: Configurable geofence list in `src/data/geofences.js`, used by watcher to generate enter/leave alerts.
- **SOS Workflow**: SOS sets `sosTriggered`, `sosTimestamp`, `sosLocation`, `sosBattery`, and `sosRiderName` in the rider node — watchers subscribe and surface an emergency modal.
- **Trip Simulation Profiles**: Built-in demo ride profiles to test UI, scoring, PDF export and badge unlocking. Simulated trips include `isSimulated: true`.
- **Weather & Safety Prompts**: Optional rain detection triggers watcher prompts and suggests sending safety tips.

If you want a short changelog of recent additions, let me know and I can append it here.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Styling**: CSS with responsive design
- **Maps**: Leaflet for interactive mapping with OpenStreetMap
- **Backend**: Firebase Realtime Database
- **State Management**: Zustand
- **Authentication**: Firebase Auth (optional)
- **PDF Generation**: jsPDF for trip exports
- **Deployment**: Ready for Vercel/Netlify/Firebase Hosting

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project with Realtime Database enabled

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/familytrack-ev.git
   cd familytrack-ev
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase & Environment Variables**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Realtime Database
   - Copy `.env.example` to `.env` and fill in your values:
   ```env
   # Firebase (required)
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
   
   # Weather (optional — weather features gracefully disable if missing)
   VITE_OPENWEATHER_API_KEY=your_openweather_api_key
   ```
   See `.env.example` for all available options.

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm run preview
   ```

6. **Deploy to Firebase Hosting** (optional)
   ```bash
   npm run build
   firebase deploy
   ```
   Ensure `firebase.json` is configured with SPA rewrites to `/index.html` (pre-configured in repo).

## 📱 Usage

### Rider Mode
1. Enter your name on the welcome screen
2. Adjust battery level slider
3. Click "Start Sharing" to begin location tracking
4. Monitor your eco-score and trip stats in real-time
5. Use SOS button in emergencies
6. View coaching tips and environmental impact in dedicated tabs
7. Check leaderboard and trip history

### Watcher Mode
1. Switch to "Watcher" tab in the header
2. View live map with all riders' locations
3. Monitor alerts and geofencing notifications
4. Review trip history and send coaching tips
5. Respond to SOS alerts immediately with Google Maps integration
6. Export trip data as PDFs

## 📂 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── CoachingTipCard.jsx          # Display individual coaching tip cards
│   ├── CoachingTipsSystem.jsx        # Manage and filter coaching tips
│   ├── EnvironmentalImpactHub.jsx    # Display eco-score, badges, and CO2 savings
│   ├── RiderLeaderboard.jsx          # Show leaderboard by trips & eco-score
│   ├── RiderTipsInbox.jsx            # Tips inbox with unread badges
│   ├── SOSModal.jsx                  # Emergency SOS modal with location & battery
│   ├── TripSummaryCard.jsx           # Display trip stats and export options
│   └── WatcherDashboard.jsx          # Interactive map, alerts, and rider management
├── pages/               # Page-level components
│   ├── RiderDashboard.jsx            # Main rider interface with trip tracking
│   └── WatcherDashboardPage.jsx      # Watcher mode with map & alerts
├── services/            # Business logic and API services
│   ├── locationService.js            # Geofence calculations & distance math
│   └── chargingStations.js           # Overpass API integration for chargers
├── store/               # State management (Zustand)
│   └── index.js                      # Global state: riders, trips, alerts, UI state
├── utils/               # Helper functions and calculations
│   ├── Coachingtips.js               # Auto-generate coaching tips from trip analysis
│   ├── ecoImpactCalculations.js      # Badge logic, CO2 savings, tree equivalents
│   ├── ecoScoring.js                 # Eco-score formula, sensor simulation
│   ├── tripFirebaseSync.js           # Persist/load trips from Firebase Realtime DB
│   └── tripPDFExport.js              # Generate downloadable PDF trip reports
├── data/                # Static data
│   └── geofences.js                  # Configurable safe zone boundaries
├── config/              # Configuration
│   └── firebase.js                   # Firebase initialization and setup
├── App.jsx              # Main app component with routing
└── main.jsx             # Vite entry point
```

## 🛠️ Services & Utilities

### Core Services

#### `locationService.js`
- `calculateDistance(lat1, lng1, lat2, lng2)` — Haversine distance calculation
- `isInsideGeofence(lat, lng, geofence)` — Check if location is within geofence radius
- Used by watcher to generate enter/exit alerts

#### `chargingStations.js`
- Fetches nearby EV charging stations via OpenStreetMap Overpass API
- Client-side 5-minute cache to reduce API load
- Returns up to 10 closest chargers with directions link to Google Maps
- Integrated with rider dashboard for nearby charger lookup

### Core Utilities

#### `ecoScoring.js`
Calculates eco-score and trip efficiency:
- `calculateEcoScore(throttle, speed, acceleration)` — Returns 0–100 score with color
- `generateSensorReading()` — Realistic sensor simulation with physics drift for testing
- `calculateTripStats(readings)` — Aggregates trip stats: avg speed, distance, duration, eco score
- `getEcoScoreColor(score)` — Maps score to CSS color for UI feedback

#### `ecoImpactCalculations.js`
Environmental impact and badge management:
- `calculateCO2Savings(energyUsedWh, distanceKm)` — Compares EV vs. gasoline emissions
- `calculateTreeEquivalents(co2Kg)` — Converts CO2 to trees planted equivalent
- `getEcoBadges(totalCO2Saved)` — Returns current badge tier (Seedling → Carbon Champion)
- `getNextBadgeTarget(currentTier)` — Shows CO2 needed for next badge unlock
- `generateImpactReport(trips)` — Creates detailed environmental report for PDF export

#### `Coachingtips.js`
Auto-generates and manages coaching tips:
- Analyzes trip eco-score, drain rate, and speed patterns
- Auto-generates tips: "Try smoother acceleration" (if eco-score < 50), "Watch your drain!" (if drain > 1.2×baseline), etc.
- Separate from watcher-pushed tips; all stored under `riders/{riderId}/coachingTips` in Firebase
- Tips have `isAutoGenerated` flag to distinguish source

#### `tripFirebaseSync.js`
Manages trip data persistence:
- `persistTripToFirebase(trip)` — Saves completed trip to Firebase Realtime DB
- `loadTripsFromFirebase(riderId)` — Retrieves rider's trip history
- Handles state hydration: loads trips from Firebase on app boot if local cache empty
- Trip data includes: route, eco-score, battery used, duration, CO2 saved, badge unlocks

#### `tripPDFExport.js`
Generates downloadable trip reports:
- `downloadTripPDF(trip, riderName)` — Exports rider's trip summary as PDF
- Includes trip stats, eco-score breakdown, CO2 saved, distance, and charts
- ASCII-safe PDF generation with dynamic stream length handling
- Used by both riders (personal export) and watchers (trip review export)

## 🔧 Configuration

### Geofences
Edit [src/data/geofences.js](src/data/geofences.js) to define safe zones:
```javascript
export const geofences = [
  { id: 1, name: 'Home', lat: 18.6702, lng: 73.7902, radiusKm: 0.5 },
  { id: 2, name: 'Office', lat: 18.5204, lng: 73.8567, radiusKm: 0.3 },
  // Add more zones...
];
```
Watchers receive enter/exit alerts for these geofences in real-time.

### Environment Variables
All configuration is managed via `.env` file. See `.env.example` for complete reference with optional features.

## 🎯 Advanced Configuration

### Battery Specifications (Ather Rizta Z)
Configure in [src/pages/RiderDashboard.jsx](src/pages/RiderDashboard.jsx):
```javascript
const BATTERY_SPECS = {
  capacity: 3700,        // Wh (3.7 kWh)
  consumption: {
    eco: 33,             // Wh/km
    normal: 37,          // Wh/km (baseline)
    aggressive: 46,      // Wh/km
  },
};

// Alert thresholds
const BATTERY_ALERTS = {
  critical: 10,          // % — trip blocked
  low: 25,               // % — warning badge
  drainBaseline: 37,     // Wh/km — baseline for drain warnings
  drainAlertRatio: 1.20, // Alert when actual/baseline exceeds this
};
```

### Eco-Scoring Formula
Defined in [src/utils/ecoScoring.js](src/utils/ecoScoring.js):
- **Throttle Impact**: 35% weight (targets smooth acceleration)
- **Speed Impact**: 35% weight (targets speed efficiency <35 km/h)
- **Acceleration Impact**: 30% weight (targets smooth ramping <0.3 m/s²)

**Score Interpretation**:
- **90–100**: ♻️ Excellent (green)
- **75–89**: 🌱 Good (light green)
- **50–74**: 🟡 Fair (yellow)
- **25–49**: 🟠 Poor (orange)
- **0–24**: ⚠️ Critical (red)

### Badge Thresholds
Configured in [src/utils/ecoImpactCalculations.js](src/utils/ecoImpactCalculations.js):
```javascript
const badges = [
  { tier: 0, name: 'Seedling', minCO2: 0 },       // 0 kg CO2
  { tier: 1, name: 'Sapling', minCO2: 5 },        // 5 kg CO2
  { tier: 2, name: 'Oak', minCO2: 15 },           // 15 kg CO2
  { tier: 3, name: 'Forest Guardian', minCO2: 30 },
  { tier: 4, name: 'Carbon Champion', minCO2: 50 },
];
```

### CO2 & Environmental Impact
Calculated in [src/utils/ecoImpactCalculations.js](src/utils/ecoImpactCalculations.js):
- **CO2 Avoided**: Comparison between actual EV trip and equivalent gasoline vehicle
- **Tree Equivalents**: 1 tree ≈ 20 kg CO2/year
- **Forest Impact**: Cumulative environmental badge system encourages eco-friendly riding

### Drain-Rate Monitoring
Drain rate is calculated as `Wh/km` and monitored against baseline:
- If actual drain > 1.2 × baseline (37 Wh/km), alert is triggered
- Displayed in trip summary and watcher alerts panel
- Used to auto-generate coaching tips for efficiency improvement

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

### Development Guidelines
- Use ESLint for code quality
- Follow React best practices
- Test on multiple devices/browsers
- Keep Firebase rules secure
- Use Zustand for state management
- Maintain responsive design principles

## � Firebase Security Rules

Realtime Database rules are configured in [firebase.rules](firebase.rules) with the following structure:
- **Riders** can read/write their own location and trip data
- **Watchers** have read-only access to riders they are monitoring
- **SOS data** is readable by all authenticated users in real-time for emergency response
- **Coaching Tips** are readable by riders and writable by watchers and auto-generation system

Deploy rules with: `firebase deploy --only database`

## �📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with React and Vite
- Maps powered by OpenStreetMap and Leaflet
- Real-time data via Firebase
- State management with Zustand
- PDF generation with jsPDF
- Icons from Emoji sources

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Check the troubleshooting section
- Contact the maintainers

---

**Stay safe, ride green! 🌱**
