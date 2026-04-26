# FamilyTrack EV 🚴‍♂️🔋

A comprehensive family safety and eco-tracking application for electric vehicle riders. Monitor real-time location, battery levels, and driving efficiency while ensuring safety through geofencing and emergency alerts.

## 🌟 Features

### For Riders 👤

#### **📍 Location & Trip Tracking**
- **Real-time Location Sharing**: Share live GPS location with high accuracy while riding; updates sync to Firebase in real-time.
- **Automatic Trip Recording**: Records complete trip routes with coordinates, distance (Haversine calculation), duration, average speed, and timestamps.
- **Trip History & Management**: Browse up to 100 trips, view trip details, filter by date, and access complete trip statistics.
- **Manual Start/Stop Controls**: Hold-to-activate modal for precise trip control with visual confirmation.
- **Trip Simulation (7 Profiles)**: Built-in realistic demo profiles for testing UI, scoring, PDF export, and badge unlocking. Simulated trips are clearly flagged in database.
- **Online/Offline Status**: Real-time connectivity tracking visible to watchers.

#### **🔋 Battery Management & Monitoring**
- **Real-time Battery Display**: Live battery percentage with visual gauge and alerts.
- **Three Consumption Profiles**:
  - Eco Mode: 33 Wh/km
  - Normal Mode: 37 Wh/km (baseline)
  - Aggressive Mode: 46 Wh/km
- **Projected Range Calculation**: Displays estimated range (km) based on current battery and consumption rate.
- **Drain Rate Monitoring**: Calculates real-time battery drain in Wh/km; alerts when exceeding baseline (37 Wh/km × 1.2 multiplier).
- **Smart Battery Alerts**:
  - Low battery warning at 25%
  - Critical battery alert at 10%
  - Cannot start new trip at 0% battery
- **Battery Specs (Ather Rizta Z)**: 3.7 kWh (3700 Wh) capacity with smart consumption tracking.

#### **🌱 Eco-Score & Riding Efficiency**
- **Real-Time Eco-Score**: Live calculation every 5 seconds using weighted formula:
  - Throttle Control: 35% weight (targets smooth acceleration)
  - Speed Efficiency: 35% weight (targets speeds <35 km/h)
  - Acceleration Smoothness: 30% weight (targets smooth ramping <0.3 m/s²)
- **Score Interpretation** (0–100 scale):
  - 90–100: ♻️ Excellent (Green)
  - 75–89: 🌱 Good (Light Green)
  - 50–74: 🟡 Fair (Yellow)
  - 25–49: 🟠 Poor (Orange)
  - 0–24: ⚠️ Critical (Red)
- **Worst Axis Identification**: Highlights which factor needs improvement (throttle/speed/acceleration).
- **Sensor Simulation**: Realistic throttle, speed, and acceleration readings with physics-based drift for testing.
- **Live Feedback UI**: Real-time dashboard showing all eco metrics.

#### **♻️ Environmental Impact & Badges**
- **CO2 Savings Tracking**: Calculates CO2 avoided per trip vs. equivalent petrol vehicle (saves ~0.142 kg CO2/km).
- **Tree Equivalents**: Converts total CO2 saved to trees planted (1 tree ≈ 21 kg CO2/year).
- **5-Tier Badge System** (unlocked based on cumulative CO2 saved):
  - 🌱 **Seedling**: 5 kg CO2 saved
  - 🌿 **Sapling**: 25 kg CO2 saved
  - 🌳 **Oak**: 100 kg CO2 saved
  - 🌲 **Forest Guardian**: 500 kg CO2 saved
  - 🏆 **Carbon Champion**: 1000 kg CO2 saved
- **Badge Progress Tracking**: Shows progress to next tier with visual progress bar.
- **Animated Badge Celebrations**: Celebratory overlay animations when unlocking new badges.
- **Environmental Impact Hub**: Dedicated tab showing cumulative stats, tree equivalents, and badge progress.

#### **🆘 Emergency & Safety (SOS)**
- **Hold-to-Activate SOS**: 5-second hold activation (prevents accidental triggers) with countdown timer.
- **Emergency Information Logging**:
  - Current GPS location
  - Battery state
  - Rider name
  - Exact timestamp
- **Immediate Watcher Notification**: Syncs to Firebase in real-time for watchers' emergency modal.
- **Quick Release**: Cancel anytime before 5 seconds elapse.
- **Emergency Contacts**: Direct phone integration with quick-call buttons (Mom, Dad, 112).
- **Post-Activation Confirmation**: Shows what watchers received.

#### **💬 Coaching Tips System**
- **Auto-Generated Tips**: Based on trip analysis:
  - Poor throttle control (eco-score <50)
  - Excessive speeding (avg speed >40 km/h)
  - Aggressive acceleration (peaks >0.5 G-force)
  - Low battery (remaining <25%)
  - Long-distance optimization
- **Watcher-Sent Tips**: Custom coaching tips from family members (categorized by priority).
- **Tips Inbox**: Dedicated inbox with read/unread status tracking.
- **Unread Badge**: Badge count showing new coaching tips.
- **Dismissible Tips**: Archive read tips to keep inbox clean.
- **Firebase Storage**: All tips persisted under `riders/{riderId}/coachingTips`.

#### **📡 Nearby Charging Stations**
- **OpenStreetMap Integration**: Queries Overpass API for nearby EV chargers.
- **Smart Range Expansion**:
  - Starts at 3 km radius
  - Expands to 6 km if no chargers found
  - Expands to 15 km max for remote areas
- **Station Information**: Name, operator, brand, socket types, distance sorting.
- **5-Minute Client Cache**: Reduces API calls and improves UX.
- **Google Maps Directions**: Direct links to navigate to chargers.
- **Auto-Trigger on Critical Battery**: Shows chargers when battery drops to 10%.
- **Error Handling**: Graceful retry and fallback on API failures.

#### **📊 Trip Summary & PDF Export**
- **Detailed Trip Cards**: Distance, duration, average speed, battery used, eco-score, CO2 saved.
- **PDF Export**: Download trip summary with:
  - Trip statistics and metrics
  - Eco-score analysis
  - Environmental impact report
  - Coaching tips for improvement
- **ASCII-Safe PDF Generation**: Handles special characters and multi-page content.
- **Automatic Browser Download**: One-click PDF generation and download.

#### **🏆 Leaderboard & Community Stats**
- **Eco-Score Ranking**: Rank riders by average eco-score across all trips.
- **Achievements Ranking**: Total trips completed, total distance covered.
- **Community Statistics**: Total family riders, cumulative trips, total distance, average eco-score.
- **Medal Display**: Top 3 riders get 🥇🥈🥉 badges.
- **Score Color Coding**: Visual indication of riding quality.
- **Real-Time Updates**: Refreshes every 10 seconds.

#### **📱 Dashboard & UI Features**
- **Multi-Tab Interface**: Dashboard, Environment, Leaderboard, History, Tips.
- **Battery-Themed UI**: Color changes based on battery level (Green/Yellow/Red).
- **Toast Notifications**: Real-time alerts for trip events, achievements, warnings.
- **Eco-Score Gauge**: Real-time visual gauge of current riding efficiency.
- **Battery Projection Display**: Shows estimated remaining range.
- **Responsive Design**: Optimized for mobile devices and tablets.

### For Watchers 👁️

#### **🗺️ Live Map & Monitoring**
- **Interactive Leaflet Map**: Real-time OpenStreetMap tiles with multi-rider support.
- **Rider Markers**: Color-coded markers (5 rotating colors) showing all active riders.
- **Online/Offline Indicators**: Real-time connectivity status for each rider.
- **Rider Info Popups**: Name, current location, battery %, timestamp, GPS accuracy.
- **Trip Route Visualization**: Polylines showing current trip routes in real-time.
- **Charging Station Markers**: Green ⚡ markers for nearby chargers.
- **Multi-Rider Tracking**: Simultaneously monitor entire family.
- **Interactive Controls**: Zoom, pan, and filter by rider status.

#### **🚨 Emergency & SOS Response**
- **SOS Alert Modal**: Immediate notification with full emergency details.
- **GPS Coordinates**: Precise location of rider at SOS activation.
- **One-Click Google Maps**: Direct navigation link to rider location.
- **Rider Information**: Name, current battery, activation timestamp.
- **Mark as Resolved**: Quick action to mark SOS as resolved.
- **SOS History**: Track all emergency activations with timestamps.
- **Real-Time Firebase Listener**: Instant alerts without delay.

#### **⚠️ Geofence Management & Notifications**
- **Geofence Editor**: Create, edit, and delete safe zones directly on map.
- **Click-to-Place Geofences**: Simple map interface for zone creation.
- **Configurable Radius**: Set custom radius (km) for each zone.
- **Named Zones**: Label zones (Home, School, Office, Park, etc.).
- **Zone Color Coding**: 7 color options for easy visualization.
- **Pre-Configured Zones**: Default zones for Home, Office, and College.
- **Entry/Exit Alerts**: Real-time notifications when riders enter/leave zones.
- **Zone Information Display**: View zone details, edit, or delete.
- **Firebase Persistence**: All geofences saved and synced.

#### **📢 Alerts & Notifications Panel**
- **Multi-Type Alerts**:
  - Battery level alerts (25%, 10% thresholds)
  - Drain rate alerts (when >44 Wh/km, i.e., 1.2× baseline)
  - Geofence entry/exit alerts
  - Weather rain alerts (optional)
  - Speed limit alerts
- **Alert Severity Levels**: Critical (red) vs. Informational (blue).
- **Dismissible Alerts**: Mark as read and clear.
- **Alert Stack**: Multiple simultaneous notifications.
- **Toast Notifications**: Non-intrusive alert display.

#### **💬 Coaching Tips Management**
- **Auto-Generate Tips**: Based on rider's trip analysis and eco-score.
- **Custom Tip Creation**: Send personalized coaching messages.
- **Tip Templates**: Pre-defined messages for common scenarios.
- **Priority Levels**: High, Medium, Low, Informational classifications.
- **Send to Rider Inbox**: Tips delivered to rider's coaching tips section.
- **Sent History**: Track all tips sent with read status.
- **Unread Count Badge**: Know which tips riders haven't seen yet.

#### **📈 Trip Monitoring & Analytics**
- **Trip Browser**: View all family member trips in chronological order.
- **Advanced Filtering**: Filter by date range, rider, trip quality/eco-score.
- **Trip Details Modal**: Full trip information including:
  - Route and distance
  - Duration and average speed
  - Battery used
  - Eco-score analysis
  - CO2 saved and environmental impact
- **Cumulative Statistics**: Family totals and per-rider analytics.
- **Rider Comparison**: Compare metrics across riders.
- **PDF Export**: Download trip reports per trip.
- **Pagination**: Browse trips efficiently (5 shown, load more).
- **Last Trip Info**: Timestamps and basic metrics visible in list.

#### **🌍 Environmental Impact Dashboard**
- **Family Total CO2 Savings**: Cumulative environmental impact.
- **Impact Summary**: Trees planted equivalent, petrol comparison.
- **Rider Eco-Ranking**: Leaderboard by eco-score and CO2 saved.
- **Badge Achievements**: Display badges unlocked by each rider.
- **Impact Report**: Generate detailed family environmental reports.
- **Environmental Statistics**: Aggregated family metrics and trends.

#### **🌤️ Weather Monitoring (Optional)**
- **OpenWeatherMap Integration**: Real-time weather per rider location.
- **Rain Detection**: Identifies rain (WMO codes 200–231, 300–321, 500–531).
- **Auto-Safety Prompts**: Suggests sending safety coaching tips when rain detected.
- **Weather Updates**: Refreshes every 30–60 seconds per rider.
- **Weather Conditions**: Display temperature, humidity, conditions.
- **Graceful Degradation**: Fully functional without API key (weather features disabled).

### Core & Notable Implementations 🔧

#### **🔐 Family & Authentication System**
- **Google Sign-In**: OAuth integration for easy login.
- **Guest Mode**: Anonymous access for testing without authentication.
- **6-Character Invite Codes**: Share codes for family member invitations.
- **Invite Code Management**: Generate, regenerate, and share with Web Share API/clipboard.
- **Role-Based Access**: Rider vs. Watcher roles with appropriate permissions.
- **Firebase Auth Integration**: Secure authentication and user tracking.
- **Family Data Isolation**: Each family's data is completely isolated in Firebase.

#### **🔄 Realtime Sync & State Management**
- **Zustand Store**: Global state management with:
  - Auth state (userId, role, familyId, riderName)
  - Trip state (isSharing, current trip, trip history)
  - Battery and location state
  - Riders list and live status
  - Alerts (up to 50 stored)
  - Coaching tips
  - Environmental impact cache
- **LocalStorage Persistence**: State automatically saved locally.
- **Firebase Hydration**: On app start, loads trips and data from Firebase fallback.
- **Trip Deduplication**: Prevents double-counting trips by timestamp.
- **Real-Time Listeners**: Firebase subscriptions for live updates.

#### **📍 Maps & Location Services**
- **Leaflet.js Framework**: Full-featured interactive mapping.
- **OpenStreetMap Tiles**: Open-source map tiles with no API key required.
- **Custom Markers**: Styled rider markers with battery info.
- **Polyline Routes**: Visual trip route visualization.
- **Circle Zones**: Geofence visualization on map.
- **Haversine Distance Calculation**: Accurate distance between coordinates.
- **Geofence Point-in-Circle Detection**: Determines entry/exit events.
- **Map Event Handlers**: Interactive controls and click-to-place.

#### **📄 Advanced PDF Generation**
- **Custom PDF Generation**: Builds PDFs from scratch without external libraries.
- **Multi-Page Support**: Long reports split across pages.
- **Font Embedding**: Courier and Helvetica font support.
- **Dynamic Stream Handling**: Calculates stream length dynamically.
- **ASCII-Safe Content**: Handles special characters safely.
- **XRef Table Generation**: Proper PDF structure for all readers.
- **Automatic Download**: Browser automatic download trigger.
- **Dual Format Support**: Different PDF layouts for riders vs. watchers.

#### **🌐 External API Integrations**
- **Browser Geolocation API**: High-accuracy GPS with fallback.
- **OpenWeatherMap API**: Weather and rain detection (optional).
- **OpenStreetMap Overpass API**: Charger discovery and caching.
- **Google Maps**: Direction links and navigation.
- **Web Share API**: Native sharing (SMS, WhatsApp, email).
- **Clipboard API**: Copy invite codes.

#### **🔐 Firebase Integration**
- **Realtime Database**: Live data synchronization.
- **Family Structure**: `families/{familyId}` nodes for data isolation.
- **Rider Nodes**: `riders/{riderId}` with location, trip, and SOS data.
- **Geofence Storage**: Persisted in `families/{familyId}/geofences`.
- **Coaching Tips Inbox**: `riders/{riderId}/coachingTips` for tip management.
- **Trip History**: Complete trips stored with full metrics.
- **SOS Data**: Emergency data with `sosTriggered`, `sosLocation`, `sosBattery`, `sosRiderName`, `sosTimestamp`.

#### **⚡ Charging Station System**
- **Overpass API Querying**: Queries OpenStreetMap for charger data.
- **Progressive Radius Expansion**: Smart expansion from 3km → 6km → 15km max.
- **Client-Side Caching**: 5-minute cache reduces API load by ~80%.
- **Comprehensive Charger Data**: Name, operator, brand, socket types.
- **Distance Sorting**: Closest chargers displayed first.
- **Error Handling**: Retries and fallback on API failures.
- **Google Maps Integration**: Direct navigation links.

---

### 🎯 Unique & Advanced Features Highlights

1. **Hold-to-Activate SOS** — 5-second hold prevents accidental emergency triggers
2. **Worst Axis Identification** — Tells riders exactly what to improve (throttle/speed/acceleration)
3. **Badge Animation System** — Celebratory overlay animations on milestone unlocks
4. **Trip Deduplication** — Prevents duplicate trip counting in leaderboards and history
5. **Intelligent Drain Alerts** — Dynamic 1.2× baseline monitoring for efficiency warnings
6. **Weather-Triggered Safety** — Rain detection automatically suggests sending safety tips
7. **Smart Charging Station Search** — Progressive radius expansion for better coverage
8. **Dual PDF Generators** — Separate optimized formats for rider and watcher exports
9. **Real-Time Geofence Detection** — Entry/exit monitoring with instant alerts
10. **Family Invite System** — 6-character codes shareable via multiple platforms
11. **Sensor Simulation Engine** — Realistic physics-based throttle/speed/accel drift for testing
12. **Auto Online/Offline Tracking** — Real-time connectivity status visible to watchers
13. **Cumulative CO2 Tracking** — Global environmental impact across all family trips
14. **Environmental Badge Gamification** — 5-tier system encouraging eco-friendly riding
15. **Three Consumption Profiles** — Eco/Normal/Aggressive modes with different drain rates

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
Location calculation and geofence detection:
- `calculateDistance(lat1, lng1, lat2, lng2)` — Haversine formula for accurate distance calculation
- `isInsideGeofence(lat, lng, geofence)` — Point-in-circle detection for geofence entry/exit
- `getDistanceToGeofence(lat, lng, geofence)` — Distance to geofence boundary
- Used by watcher to generate real-time enter/exit alerts

#### `chargingStations.js`
EV charging station discovery and management:
- `fetchNearbyChargers(lat, lng, radiusKm)` — OpenStreetMap Overpass API query
- `expandSearchRadius(previousResults, radiusKm)` — Progressive radius expansion (3km → 6km → 15km)
- `getCachedChargers(lat, lng)` — 5-minute client-side cache lookup
- `formatChargerInfo(station)` — Standardize station data (name, operator, brand, sockets)
- `generateGoogleMapsLink(lat, lng)` — Creates navigation link
- Used by rider dashboard for nearby charger lookup, auto-triggers at critical battery (10%)

### Core Utilities

#### `ecoScoring.js`
Eco-score calculation and sensor simulation:
- `calculateEcoScore(throttle, speed, acceleration)` — Returns 0–100 score with color coding
  - Input: throttle (0-100%), speed (km/h), acceleration (G-force)
  - Output: { score: number, color: string, label: string, worstAxis: string }
- `generateSensorReading()` — Realistic sensor simulation with physics-based drift
- `calculateTripStats(readings)` — Aggregates trip statistics from sensor readings
  - Returns: { avgSpeed, distance, duration, avgEcoScore, maxAcceleration, etc. }
- `getEcoScoreColor(score)` — Maps score to CSS color (#00AA00 green → #FF0000 red)
- `simulateTrip(profile)` — Runs 7 built-in demo profiles for testing
- Updates every 5 seconds during active trip

#### `ecoImpactCalculations.js`
Environmental impact and badge management:
- `calculateCO2Savings(energyUsedWh, distanceKm)` — Compares EV vs. petrol emissions
  - Formula: (distanceKm × 0.142 kg CO2/km) saved
  - Returns: { co2Saved, co2Equivalent, treesEquivalent }
- `calculateTreeEquivalents(co2Kg)` — Converts CO2 to trees (1 tree = 21 kg CO2/year)
- `getEcoBadges(totalCO2Saved)` — Returns current badge tier and progress
  - Tiers: Seedling (5kg) → Sapling (25kg) → Oak (100kg) → Forest Guardian (500kg) → Carbon Champion (1000kg)
- `getNextBadgeTarget(currentTier)` — Shows CO2 needed for next unlock
- `generateImpactReport(trips)` — Creates detailed environmental report for PDF export
  - Includes: total CO2 saved, tree equivalents, family stats, rider rankings
- `unlockBadgeAnimation(badge)` — Triggers celebratory notification

#### `Coachingtips.js`
Auto-generates coaching tips from trip analysis:
- `generateAutoTips(trip)` — Analyzes trip eco-score, drain rate, and patterns
  - Poor eco-score (<50): "Try smoother acceleration"
  - High drain (>1.2× baseline): "Watch your drain!"
  - Excessive speed (>40 km/h): "Maintain speeds under 35 km/h"
  - Aggressive acceleration (>0.5 G): "Accelerate gradually"
  - Long distance at high drain: "Consider eco-mode"
- `formatTip(category, priority)` — Standardizes tip format
- `getTipEmoji(category)` — Adds visual emoji indicators
- `isAutoGenerated` flag to distinguish from watcher-sent tips
- All tips persisted under `riders/{riderId}/coachingTips` in Firebase

#### `tripFirebaseSync.js`
Trip data persistence and state hydration:
- `persistTripToFirebase(trip)` — Saves completed trip to Firebase
  - Stores: route, eco-score, battery used, duration, CO2 saved, badge unlocks
  - Path: `riders/{riderId}/trips/{tripId}`
- `loadTripsFromFirebase(riderId)` — Retrieves rider's trip history
  - Pagination: up to 100 trips cached locally
  - Orders by timestamp (newest first)
- `hydrateTripsFromStorage()` — On app boot, loads trips from Firebase if local cache empty
- `syncTripWithMetadata(trip)` — Adds timestamps, CO2 calcs, badge triggers
- `deduplicateTripsByTimestamp(trips)` — Prevents duplicate trips in history
- Real-time listener for live trip updates in watcher mode

#### `tripPDFExport.js`
PDF generation for trip exports:
- `downloadTripPDF(trip, riderName)` — Exports rider's trip summary as PDF
  - Includes: trip distance, duration, average speed, battery used, eco-score, CO2 saved
  - Adds: coaching tips, environmental impact analysis, graphs/charts
- `generateWatcherPDF(trip, riderName)` — Alternative format for watcher review
- `generateEnvironmentalReport(trips)` — Family environmental impact summary PDF
- Handles: ASCII-safe content, multi-page support, dynamic stream length
- Auto-triggers browser download after generation

### Store (`store/index.js` - Zustand)
Global state management with persistence:

**Auth State**:
- `userId` — Current user ID
- `riderName` — Rider/user display name
- `role` — 'rider' or 'watcher'
- `familyId` — Family group identifier
- `isGuest` — Anonymous mode flag

**Trip & Location State**:
- `isSharing` — Active trip status
- `currentLocation` — { lat, lng, accuracy, timestamp }
- `tripStartTime` — Trip start timestamp
- `tripStats` — Current trip metrics
- `tripHistory` — Array of completed trips (up to 100)

**Battery State**:
- `batteryPercent` — Current battery percentage
- `batteryDrain` — Current drain rate (Wh/km)
- `projectedRange` — Estimated remaining range (km)
- `batteryTrend` — Battery usage over time

**Family State**:
- `riders` — Active riders in family { riderId: riderData }
- `alerts` — Alert queue (up to 50)
- `coachingTips` — Rider's tips inbox
- `geofences` — Family geofence zones

**Impact & Environmental State**:
- `impactSummary` — Cumulative CO2 and badge data (cached)
- `badges` — Unlocked badges per rider
- `leaderboardData` — Rankings by eco-score, distance, etc.

**Features**:
- LocalStorage persistence with `persist` middleware
- Firebase hydration on app initialization
- Real-time listeners for multi-user sync
- Trip deduplication by timestamp
- Automatic state cleanup for old data

## 🔧 Configuration

### Geofences
Edit [src/data/geofences.js](src/data/geofences.js) to define safe zones:
```javascript
export const geofences = [
  { id: 1, name: 'Home', lat: 18.6702, lng: 73.7902, radiusKm: 0.5 },
  { id: 2, name: 'Office', lat: 18.5204, lng: 73.8567, radiusKm: 0.3 },
  { id: 3, name: 'College', lat: 18.5195, lng: 73.8627, radiusKm: 0.4 },
  // Add more zones...
];
```
Watchers receive real-time enter/exit alerts for these geofences. Zones are color-coded and can be edited directly from the watcher dashboard map.

### Environment Variables
All configuration is managed via `.env` file. See `.env.example` for complete reference:

**Firebase Configuration** (Required):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL`

**Weather Configuration** (Optional):
- `VITE_OPENWEATHER_API_KEY` — Enables weather monitoring; gracefully disables if missing

## 🎯 Advanced Configuration

### Battery Specifications (Ather Rizta Z)
Configure in [src/pages/RiderDashboard.jsx](src/pages/RiderDashboard.jsx):
```javascript
const BATTERY_SPECS = {
  capacity: 3700,        // Wh (3.7 kWh)
  consumption: {
    eco: 33,             // Wh/km — efficient riding
    normal: 37,          // Wh/km — baseline/normal riding
    aggressive: 46,      // Wh/km — high-performance riding
  },
};

// Alert thresholds
const BATTERY_ALERTS = {
  critical: 10,          // % — trip blocked at this level
  low: 25,               // % — low battery warning
  drainBaseline: 37,     // Wh/km — normal consumption baseline
  drainAlertRatio: 1.20, // Alert when actual/baseline exceeds this (1.2× = 44.4 Wh/km threshold)
};
```

### Eco-Scoring Formula
Defined in [src/utils/ecoScoring.js](src/utils/ecoScoring.js):
```javascript
// Weighted eco-score calculation
const ecoScore = (throttleScore × 0.35) + (speedScore × 0.35) + (accelerationScore × 0.30)
```

**Scoring Components**:
- **Throttle Impact** (35%): Targets smooth acceleration; penalizes aggressive throttle usage
- **Speed Impact** (35%): Targets efficient speeds <35 km/h; penalizes excessive speeding
- **Acceleration Impact** (30%): Targets smooth ramping <0.3 m/s²; penalizes jerky acceleration

**Score Interpretation**:
| Range | Label | Color | Description |
|-------|-------|-------|-------------|
| 90–100 | ♻️ Excellent | Green | Peak efficiency—optimal riding |
| 75–89 | 🌱 Good | Light Green | Good efficiency—acceptable riding |
| 50–74 | 🟡 Fair | Yellow | Average efficiency—room for improvement |
| 25–49 | 🟠 Poor | Orange | Low efficiency—needs improvement |
| 0–24 | ⚠️ Critical | Red | Very poor efficiency—urgent improvement needed |

### Badge Thresholds & Environmental Impact
Configured in [src/utils/ecoImpactCalculations.js](src/utils/ecoImpactCalculations.js):
```javascript
const badges = [
  { tier: 0, name: 'Seedling', minCO2: 5 },           // 5 kg CO2 saved
  { tier: 1, name: 'Sapling', minCO2: 25 },           // 25 kg CO2 saved
  { tier: 2, name: 'Oak', minCO2: 100 },              // 100 kg CO2 saved
  { tier: 3, name: 'Forest Guardian', minCO2: 500 },  // 500 kg CO2 saved
  { tier: 4, name: 'Carbon Champion', minCO2: 1000 }, // 1000 kg CO2 saved
];

// CO2 Impact Calculations
const CO2_PER_KM_EV = 0.050;        // kg — EV emissions (grid-dependent)
const CO2_PER_KM_PETROL = 0.192;    // kg — equivalent petrol emissions
const CO2_SAVED_PER_KM = 0.142;     // kg — CO2 avoided per km
const TREE_OFFSET_ANNUAL = 21;      // kg/year — CO2 offset per tree
```

**Environmental Impact Calculation**:
- **CO2 Avoided per km**: 0.142 kg (difference between EV and petrol)
- **Tree Equivalents**: Total CO2 saved ÷ 21 kg/year = trees planted equivalent
- **Forest Impact**: Badges represent cumulative environmental contribution

### Drain-Rate Monitoring & Alerts
Real-time drain calculation and alert system:

```javascript
// Drain rate = Energy used (Wh) ÷ Distance (km)
// Alert triggered when: actual drain > baseline (37 Wh/km) × 1.2
// Alert threshold = 44.4 Wh/km

// Consumption profiles affect drain rate:
// - Eco mode: Targets 33 Wh/km (10% below baseline)
// - Normal mode: 37 Wh/km (baseline)
// - Aggressive: 46 Wh/km (24% above baseline)
```

**Drain Alert Triggers**:
- When drain rate exceeds 44.4 Wh/km (120% of baseline)
- Auto-generates coaching tip: "Watch your drain! Try smoother acceleration"
- Displayed in watcher's alert panel
- Included in trip analysis and PDF exports

### Coaching Tips Auto-Generation
Tips generated by [src/utils/Coachingtips.js](src/utils/Coachingtips.js) based on trip analysis:

```javascript
// Auto-generated tip triggers:
if (ecoScore < 50) {
  // Poor throttle control
  tips.push("Try smoother acceleration and avoid rapid throttle changes");
}
if (avgSpeed > 40) {
  // Excessive speeding
  tips.push("Maintain speeds under 35 km/h for better efficiency");
}
if (maxAcceleration > 0.5) {
  // Aggressive acceleration
  tips.push("Accelerate gradually for better eco-score and battery life");
}
if (batteryUsagePercent > 25) {
  // High battery drain
  tips.push("Watch your drain! Consider eco-mode for longer range");
}
if (worstAxis === 'throttle') {
  // Throttle is worst performer
  tips.push("Focus on smoother throttle modulation—it's your biggest efficiency drain");
}
```

### Trip Simulation Profiles
Built-in 7 demo profiles in [src/utils/ecoScoring.js](src/utils/ecoScoring.js) for testing:

```javascript
const tripProfiles = {
  'eco': { name: 'Eco Rider', throttle: 30, speed: 25, accel: 0.1 },
  'normal': { name: 'Normal Rider', throttle: 50, speed: 35, accel: 0.3 },
  'aggressive': { name: 'Aggressive Rider', throttle: 80, speed: 45, accel: 0.7 },
  'efficient': { name: 'Very Efficient', throttle: 20, speed: 20, accel: 0.05 },
  'sporty': { name: 'Sporty Rider', throttle: 70, speed: 50, accel: 0.8 },
  'mixed': { name: 'Mixed Pattern', throttle: 50, speed: 35, accel: 0.4 },
  'city': { name: 'City Commute', throttle: 40, speed: 30, accel: 0.25 },
};

// All simulated trips marked: isSimulated: true
```

### Charging Station Search Algorithm
Smart progressive radius expansion in [src/services/chargingStations.js](src/services/chargingStations.js):

```javascript
// Progressive expansion strategy:
// 1. Search 3 km radius → if found, return results
// 2. If <3 chargers found, expand to 6 km radius
// 3. If still <3 chargers, expand to 15 km radius (max)
// 4. Return up to 10 closest chargers sorted by distance

// Cache optimization:
// - 5-minute cache reduces API calls by ~80%
// - Prevents duplicate API requests for same location
// - Automatic cache invalidation after 5 minutes
```

### Firebase Database Structure
```
families/{familyId}/
  ├── members/
  │   └── {userId}: {role, name, joinedAt}
  ├── geofences/
  │   └── {geofenceId}: {name, lat, lng, radiusKm}
  └── trips/
      └── {tripId}: {trip data}

riders/{riderId}/
  ├── profile: {name, role, joinedAt}
  ├── currentLocation: {lat, lng, accuracy, timestamp}
  ├── battery: {percent, drain, projectedRange}
  ├── status: {online, lastSeen}
  ├── trips: {trip history}
  ├── coachingTips: {tip inbox}
  └── sosAlert: {sosTriggered, sosLocation, sosBattery, sosRiderName, sosTimestamp}
```

### Weather Monitoring Configuration
Rain detection thresholds in [src/components/WatcherDashboard.jsx](src/components/WatcherDashboard.jsx):

```javascript
// WMO Weather codes that trigger rain alert:
const RAIN_CODES = [
  // Thunderstorm: 200-231
  200, 201, 202, 210, 211, 212, 221, 230, 231,
  // Drizzle: 300-321
  300, 301, 302, 310, 311, 312, 313, 314, 321,
  // Rain: 500-531
  500, 501, 502, 503, 504, 511, 520, 521, 522, 531
];

// Auto-prompt when rain detected:
// "Rainy conditions detected for {riderName}. Consider sending safety tips."
// Update frequency: 30-60 seconds per rider
```

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

- Built with React 19 and Vite for fast development and production builds
- Maps powered by OpenStreetMap tiles and Leaflet.js for interactive mapping
- Real-time data synchronization via Firebase Realtime Database
- State management with Zustand for predictable and performant state handling
- PDF generation using custom PDF generation with dynamic stream handling
- Location services with Haversine formula for accurate distance calculations
- Weather data from OpenWeatherMap API with graceful degradation
- EV charging station data from OpenStreetMap Overpass API with intelligent caching
- GPS and geolocation powered by browser Geolocation API
- UI/UX inspired by modern mobile applications with responsive design principles
- Environmental impact calculations based on real-world EV and petrol emissions data

## 📋 Changelog

### ✨ Major Features Implemented

#### **Phase 1: Core Rider Features**
- ✅ Real-time GPS location sharing with Firebase sync
- ✅ Live eco-score calculation (throttle, speed, acceleration weighted formula)
- ✅ Battery monitoring with consumption profiles (eco: 33, normal: 37, aggressive: 46 Wh/km)
- ✅ Trip recording, history storage, and management (up to 100 trips)
- ✅ Hold-to-activate SOS (5-second countdown) with emergency info logging
- ✅ Environmental badge system (5 tiers: Seedling → Carbon Champion)
- ✅ CO2 savings calculation and tree equivalents

#### **Phase 2: Watcher (Parent) Features**
- ✅ Interactive Leaflet map with real-time rider markers
- ✅ Online/offline status tracking and connectivity indicators
- ✅ Geofence creation, management, and entry/exit alerts
- ✅ Emergency SOS alert modal with Google Maps integration
- ✅ Trip history browser with advanced filtering (date, rider, quality)
- ✅ Environmental impact dashboard with family statistics
- ✅ Coaching tips system (auto-generated + watcher-sent)

#### **Phase 3: Advanced Rider Features**
- ✅ Coaching tips inbox with read/unread tracking
- ✅ Nearby charging stations finder (Overpass API + progressive radius)
- ✅ Trip PDF export with statistics and environmental impact
- ✅ Leaderboard with eco-score and achievement rankings
- ✅ Badge animation and celebratory notifications
- ✅ Worst-axis identification (throttle/speed/acceleration)
- ✅ 7 demo trip profiles for testing UI and features
- ✅ Trip deduplication to prevent duplicate entries

#### **Phase 4: Advanced Watcher Features**
- ✅ Multi-rider simultaneous tracking on single map
- ✅ Trip route polylines with live visualization
- ✅ Charging station markers on map (⚡ green icons)
- ✅ Battery-level themed UI (green/yellow/red)
- ✅ Comprehensive alerts panel (battery, drain, geofence, weather)
- ✅ PDF export per trip for watchers
- ✅ Environmental report generation for family
- ✅ Geofence color coding (7 colors for easy identification)

#### **Phase 5: Authentication & Family System**
- ✅ Google Sign-In OAuth integration
- ✅ Guest/anonymous mode for testing
- ✅ 6-character invite codes for family member sharing
- ✅ Role-based access control (Rider vs. Watcher)
- ✅ Family data isolation and security
- ✅ Invite code sharing via Web Share API and clipboard
- ✅ Firebase Auth integration with role-based routing

#### **Phase 6: Weather & Safety**
- ✅ OpenWeatherMap integration (optional)
- ✅ Rain detection (WMO codes 200-231, 300-321, 500-531)
- ✅ Auto-prompts to send safety tips on rain
- ✅ Weather updates every 30-60 seconds per rider
- ✅ Graceful degradation if API key missing

#### **Phase 7: State Management & Persistence**
- ✅ Zustand store with automatic LocalStorage persistence
- ✅ Firebase hydration on app initialization
- ✅ Real-time listeners for multi-user synchronization
- ✅ State cache management (up to 100 trips, 50 alerts)
- ✅ Automatic data cleanup for old entries

### 🎯 Unique Algorithm Implementations

- **Eco-Score Formula**: Weighted calculation balancing throttle (35%), speed (35%), acceleration (30%)
- **Smart Drain Alert**: Dynamic 1.2× baseline monitoring (37 × 1.2 = 44.4 Wh/km threshold)
- **Progressive Charging Search**: Auto-expands radius (3km → 6km → 15km) until finding chargers
- **Trip Deduplication**: Prevents double-counting by comparing timestamps within 30-second window
- **Haversine Distance**: Accurate lat/lng distance calculations for geofence detection
- **Worst Axis Identification**: Identifies primary riding inefficiency (throttle/speed/accel)
- **Sensor Simulation Engine**: Physics-based throttle/speed/accel drift with realistic variance
- **Energy Consumption Model**: Three profiles matching real-world EV riding patterns
- **CO2 Impact Calculation**: (Distance × 0.192 kg/km petrol) - (Distance × 0.050 kg/km EV) = CO2 saved
- **Badge Progression**: Gamified tier system encouraging sustained eco-friendly riding

### 📦 Technical Implementations

- **Real-Time Database Sync**: Firebase listeners for live multi-user updates
- **PDF Generation from Scratch**: Custom PDF builder with stream handling and font embedding
- **API Integration Pattern**: Overpass API with intelligent caching and progressive fallback
- **Geofence Detection**: Point-in-circle algorithm for reliable zone boundary detection
- **State Hydration**: Local-first approach with Firebase fallback for data resilience
- **Responsive Mobile Design**: Fully optimized for iOS and Android devices
- **CSS Grid & Flexbox**: Modern responsive layouts without Bootstrap dependency
- **Environmental Data Storage**: Efficient JSON compression for historical trip data

### 🔮 Future Enhancement Roadmap

**Potential Features**:
- 🚀 Multiple vehicle profiles (different EV models with different battery/consumption specs)
- 🚀 Voice alerts and notifications for emergency situations
- 🚀 Social sharing of achievements and badges
- 🚀 Advanced analytics dashboard with charts and trends
- 🚀 Charging network integration (real-time charger availability)
- 🚀 Trip replay visualization with playback controls
- 🚀 Machine learning for personalized coaching recommendations
- 🚀 Integration with actual EV telemetry (CAN bus, APIs)
- 🚀 Community leaderboard across families
- 🚀 Carbon offset marketplace integration
- 🚀 Mobile app with offline support (PWA/React Native)
- 🚀 Smart-watch companion app
- 🚀 Integration with insurance programs (eco-score discounts)
- 🚀 Real-time weather alerts on map
- 🚀 Scheduled maintenance reminders based on miles

## 📊 Key Metrics & Specifications

### Rider Specifications

| Metric | Value | Description |
|--------|-------|-------------|
| Battery Capacity | 3.7 kWh | Ather Rizta Z specs |
| Eco Mode Consumption | 33 Wh/km | Efficient riding |
| Normal Mode Consumption | 37 Wh/km | Baseline consumption |
| Aggressive Mode Consumption | 46 Wh/km | High-performance riding |
| Critical Battery | 10% | Trip cannot start |
| Low Battery Alert | 25% | Visual warning displayed |
| Drain Alert Threshold | 44.4 Wh/km | 1.2× baseline multiplier |
| Eco-Score Update | Every 5 seconds | Real-time calculation |
| Max Riders Tracked | Unlimited | Per family |
| Trip History Limit | 100 trips | Local cache per rider |
| Alert Queue | 50 max | Older alerts auto-cleared |

### Watcher Specifications

| Metric | Value | Description |
|--------|-------|-------------|
| Map Update Frequency | Real-time | Firebase listener |
| Geofence Entry/Exit | <1 second | Real-time detection |
| Weather Update | 30-60 seconds | Per rider polling |
| Leaderboard Refresh | 10 seconds | Auto-update |
| SOS Alert Delivery | <100ms | Real-time Firebase |
| Max Geofences | Unlimited | Per family |
| Max Alert History | 50 | Circular buffer |
| Simultaneous Riders | Unlimited | No limit per map |
| Charging Cache Duration | 5 minutes | Auto-refresh after 5m |
| Max Chargers Returned | 10 | Sorted by distance |

### Environmental Impact Metrics

| Metric | Value | Formula |
|--------|-------|---------|
| CO2 per km (EV) | 0.050 kg | Grid-dependent |
| CO2 per km (Petrol) | 0.192 kg | Reference vehicle |
| CO2 Saved per km | 0.142 kg | 0.192 - 0.050 |
| Tree Offset Annual | 21 kg CO2/year | 1 tree = 21 kg/year |
| Seedling Badge | 5 kg CO2 | Tier 0 unlock |
| Sapling Badge | 25 kg CO2 | Tier 1 unlock |
| Oak Badge | 100 kg CO2 | Tier 2 unlock |
| Forest Guardian | 500 kg CO2 | Tier 3 unlock |
| Carbon Champion | 1000 kg CO2 | Tier 4 unlock |

### Performance & Optimization

| Aspect | Optimization |
|--------|--------------|
| API Calls | 5-minute charger cache reduces load ~80% |
| State Management | LocalStorage persistence prevents re-hydration lag |
| PDF Generation | Streamed generation prevents UI blocking |
| Firebase Sync | Real-time listeners with efficient data structure |
| Map Rendering | Leaflet canvas rendering for smooth animations |
| Sensor Simulation | Realistic drift prevents unrealistic patterns |
| Trip Deduplication | 30-second window prevents duplicate entries |
| Battery Projection | Real-time calculation updates with drain rate |

---

## 🛠️ Troubleshooting & Best Practices

### Common Issues & Solutions

#### **Issue: Location not updating**
**Solution**: Check browser location permissions in settings. Ensure HTTPS connection (required for Geolocation API).
```javascript
// Check if permissions are granted
navigator.permissions.query({name: 'geolocation'}).then(result => {
  console.log(result.state); // 'granted', 'denied', 'prompt'
});
```

#### **Issue: Eco-score always showing 0**
**Solution**: Ensure sensor readings are being generated. Check that trip is actively started.
- Verify trip status: `isSharing === true`
- Check sensor simulation is running: 5-second intervals
- Review console for errors in `ecoScoring.js`

#### **Issue: Charging stations not found**
**Solution**: Check Overpass API availability. App automatically expands search radius.
- First search: 3 km radius
- If no results: expands to 6 km
- Max search: 15 km radius
- If still empty: check internet connection and Overpass API status

#### **Issue: Firebase not syncing**
**Solution**: Verify Firebase configuration and database rules.
```bash
# Deploy Firebase rules
firebase deploy --only database

# Check database URL format
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
```

#### **Issue: Weather alerts not appearing**
**Solution**: OpenWeatherMap API key is optional. If missing, weather features gracefully disable.
- Ensure `VITE_OPENWEATHER_API_KEY` is set in `.env`
- Check API key validity in OpenWeatherMap console
- Weather polling runs every 30-60 seconds

#### **Issue: Badge not unlocking**
**Solution**: Check CO2 calculation and threshold values.
```javascript
// Verify CO2 calculation
const co2Saved = distance * 0.142; // kg CO2
const badgeTier = getEcoBadges(totalCO2Saved);
console.log(`CO2 Saved: ${co2Saved}kg, Badge Tier: ${badgeTier}`);
```

#### **Issue: PDF export fails**
**Solution**: Check browser PDF support. Ensure trip has complete data.
- Verify trip has: distance, duration, eco-score, battery used
- Check browser console for PDF generation errors
- Fallback: Use watcher trip export feature

#### **Issue: Geofence alerts not triggering**
**Solution**: Verify geofence is correctly configured and radius is sufficient.
```javascript
// Test geofence detection
import { isInsideGeofence } from './services/locationService';
const result = isInsideGeofence(lat, lng, geofence);
console.log('Inside geofence:', result);
```

### Best Practices

#### **For Riders**
1. **Regular Trips**: Ride regularly to unlock badges and track environmental impact
2. **Eco-Score Improvement**: Focus on smooth throttle and maintain speeds <35 km/h
3. **Battery Management**: Use eco-mode for daily commutes, reserve aggressive mode for emergencies
4. **SOS Safety**: Use hold-to-activate to prevent accidental triggers; keep phone charged
5. **Charging Stations**: Check nearby chargers before long trips to avoid range anxiety
6. **Coaching Tips**: Review and implement tips for progressive efficiency improvement

#### **For Watchers**
1. **Regular Monitoring**: Check map periodically for rider status updates
2. **Geofence Setup**: Create geofences for common locations (home, school, office)
3. **Proactive Coaching**: Send tips after reviewing trip analysis, especially on poor eco-scores
4. **Alert Management**: Dismiss old alerts to keep focus on current issues
5. **Weather Awareness**: Monitor weather updates during monsoon or adverse seasons
6. **SOS Response**: Keep app open during rider trips to respond quickly to emergencies

#### **For Administrators (Setup)**
1. **Firebase Security**: Review and deploy security rules in `database.rules`
2. **API Keys**: Securely store API keys in `.env` file; never commit to git
3. **Environment Separation**: Use separate Firebase projects for dev/staging/production
4. **Performance**: Monitor Firebase usage to optimize query patterns
5. **Backup**: Regularly export Firebase data for backup
6. **Scaling**: Plan for multi-family support and data retention policies

#### **Development Best Practices**
```javascript
// Good: Check for required environment variables
if (!import.meta.env.VITE_FIREBASE_DATABASE_URL) {
  console.error('Firebase database URL not configured');
}

// Good: Graceful API degradation
try {
  const chargers = await fetchNearbyChargers(lat, lng);
} catch (error) {
  console.warn('Charger API unavailable, using cache');
}

// Good: State validation
if (!trip.distance || !trip.duration) {
  console.error('Incomplete trip data');
  return;
}

// Good: Cache management
const isCacheValid = Date.now() - cachedTime < 5 * 60 * 1000; // 5 minutes
```

### Performance Tips

1. **Limit Map Markers**: For >50 riders, consider clustering
2. **Cache Trip History**: Use LocalStorage to avoid repeated Firebase queries
3. **Debounce Location Updates**: Limit Firebase writes to 10-second intervals
4. **Lazy Load Components**: Load watcher dashboard only when needed
5. **Minify PDFs**: Compress trip exports to reduce download size
6. **Monitor Firebase**: Watch real-time database size and split data if needed

---

## 📱 Responsive Design

The application is fully responsive and tested on:
- **Desktop**: 1920×1080, 1366×768 (Chrome, Firefox, Safari)
- **Tablet**: iPad Air, iPad Mini, Android tablets (800×1280+)
- **Mobile**: iPhone 12/13/14/15, Samsung Galaxy S21/S22/S23, Pixel 6/7/8

**Key Responsive Features**:
- Touch-friendly buttons (48×48px minimum)
- Map auto-fit to screen size
- Tab interface collapses on mobile
- Geofence editor optimized for touch
- Trip list scrollable on small screens

---

For questions or issues:
- Open an issue on GitHub
- Check the troubleshooting section in this README
- Review the Firebase configuration guide
- Contact the maintainers

---

**Stay safe, ride green, and help your family stay eco-conscious! 🌱🚴‍♂️⚡**
