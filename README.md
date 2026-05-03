# FamilyTrack EV 🚴‍♂️⚡

A comprehensive family safety and eco-tracking application for electric vehicle (EV) riders. Monitor real-time location, battery levels, and driving efficiency while ensuring safety through geofencing and emergency response features. Built with React 19, Firebase, and OpenStreetMap for seamless real-time family connectivity.

---

## 📋 Table of Contents

- [Overview](#overview)
- [🌟 Key Features](#-key-features)
  - [For Riders 👤](#for-riders-)
  - [For Watchers 👁️](#for-watchers-)
  - [Unique Features ⭐](#unique-features-)
- [🛠️ Tech Stack](#-tech-stack)
- [🚀 Installation & Setup](#-installation--setup)
- [📂 Project Structure](#-project-structure)
- [🔧 Configuration](#-configuration)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)
- [📞 Support](#-support)

---

## Overview

**FamilyTrack EV** is an all-in-one family safety and eco-awareness platform designed specifically for electric vehicle riders. It combines real-time GPS tracking, battery monitoring, eco-score analytics, and family-based safety features into a unified application. Perfect for families wanting to ensure rider safety while promoting environmentally conscious driving habits.

**Use Cases:**
- Parents monitoring teenage EV riders
- Family coordination and safety alerts
- Eco-driving coaching and performance tracking
- Trip history and environmental impact analysis
- Emergency response via hold-to-activate SOS

---

## 🌟 Key Features

### For Riders 👤

#### **Real-Time Location Sharing**
- Live GPS synchronization to Firebase Realtime Database
- Continuous online/offline status tracking
- Accurate location updates every 5-10 seconds during active trips
- Seamless fallback to last known location when offline
- Location history persistence in local storage

#### **Eco-Score Tracking System**
- **Real-time dynamic scoring** based on three weighted metrics:
  - Throttle control (35%): Smooth acceleration rewards
  - Speed management (35%): Optimal speed range (40-50 km/h preferred)
  - Acceleration smoothness (30%): Gradual vs. aggressive changes
- **Color-coded feedback**: Visual indicators for eco-score ranges
  - 🟢 Excellent: 90-100
  - 🟢 Good: 75-89
  - 🟡 Fair: 50-74
  - 🟠 Poor: 25-49
  - 🔴 Critical: 0-24
- **Personalized coaching tips** generated based on riding patterns
- **Leaderboard ranking** by average eco-score, distance, and trips completed

#### **Advanced Battery Management**
- **Real-time battery percentage display** with remaining capacity
- **Three consumption profiles** optimized for different riding styles:
  - **Eco Mode**: 33 Wh/km (max range, gentle riding)
  - **Normal Mode**: 37 Wh/km (balanced riding)
  - **Aggressive Mode**: 46 Wh/km (high-performance riding)
- **Battery drain rate alerts**: Detects abnormal power consumption (20% above baseline)
- **Multi-level battery warnings**:
  - 🟢 Full: 25-100%
  - 🟡 Low: 10-24% (warning toast)
  - 🔴 Critical: <10% (modal alert, trip disabled)
- **Remaining range projections** for current & eco-mode driving
- **Time-to-empty calculations** based on current speed and battery
- **Pre-trip battery check**: Prevents trips if battery is critically low

#### **Comprehensive Trip Recording**
- **Automatic trip tracking** when motion is detected
- **Captured metrics per trip**:
  - Distance traveled (km)
  - Trip duration (hours/minutes/seconds)
  - Average speed (km/h)
  - Battery consumed (% & Wh)
  - Eco-score average
  - Start/end times and timestamps
  - Complete GPS route with waypoints
- **Trip history storage**: Up to 100 trips in local Zustand store + cloud persistence
- **Firebase sync**: Automatic trip persistence for watchers to access
- **Trip filtering & sorting**: By date, duration, eco-score, distance
- **Detailed trip summary cards** with analytics

#### **Emergency SOS Feature**
- **Hold-to-activate system**: 5-second hold button press triggers SOS
- **Automatic emergency data transmission**:
  - Current GPS location (lat/lon/accuracy)
  - Battery level
  - Rider name
  - Timestamp of emergency
- **Emergency logging**: All SOS events stored in Firebase for family review
- **Pre-filled emergency contacts** (customizable in code):
  - Mom, Dad, Emergency (112)
  - Direct phone call integration (iOS/Android)
- **Visual countdown timer** during SOS activation
- **Immediate watcher alert** on SOS trigger

#### **Environmental Badges & Achievements**
- **5-tier badge system** based on CO2 saved:
  - 🌱 **Seedling**: 5 kg CO2 saved
  - 🌿 **Sapling**: 25 kg CO2 saved
  - 🌳 **Oak**: 100 kg CO2 saved
  - 🌲 **Forest Guardian**: 500 kg CO2 saved
  - 🏆 **Carbon Champion**: 1000+ kg CO2 saved
- **CO2 calculation**: 0.142 kg CO2/km (EV vs. petrol baseline)
- **Tree equivalents**: 1 tree = 21 kg CO2/year
- **Badge progress visualization** with next milestone tracking
- **Achievement notifications** on badge tier unlocks

#### **Intelligent Coaching System**
- **Auto-generated contextual coaching tips** based on:
  - Real-time eco-score during riding
  - Battery level and drain rate
  - Current speed profile
  - Historical riding patterns
- **Tip categories**:
  - ⚡ Throttle control (smooth acceleration)
  - 🛑 Braking technique (regenerative recovery)
  - ⏱️ Speed optimization (40-50 km/h sweet spot)
  - 🗺️ Route planning (efficient paths)
  - 🔋 Battery management (charging strategy)
  - 🎯 Encouragement (positive feedback)
  - 🏆 Achievement (milestone celebrations)
- **Priority system**: Critical alerts shown first, then medium/low
- **Dismissible alerts**: Riders can close tips that don't apply
- **Sent tips inbox**: Track all coaching tips from watchers with read/unread status
- **Watcher-sent tips**: Custom tips from family members with priority levels

#### **Charging Station Locator**
- **Overpass API integration**: Real-time charging station database
- **Smart radius expansion algorithm**:
  - Starts at 3km radius
  - Auto-expands to 6km if no results
  - Expands to 15km if still no results
  - Caches results to reduce API calls (5-minute TTL)
- **Station details extracted**:
  - Name, brand, and operator information
  - Number of charging sockets/capacity
  - Network type (if available)
  - Access restrictions (public/private)
  - Distance from current location
- **Google Maps integration**: One-click navigation links
- **Charging station map markers** on interactive map
- **Sorted by proximity**: Nearest stations listed first

#### **Trip PDF Export**
- **Custom PDF generation** (no external libraries, pure JavaScript)
- **Exported trip summary includes**:
  - Rider name, date, and time
  - Distance, duration, average speed
  - Battery metrics (used %, remaining %)
  - Eco-score analysis and efficiency rating
  - Environmental impact (CO2 saved, trees equivalent)
  - Personalized eco-driving recommendations
  - Trip quality assessment
- **Download functionality**: Save PDFs to device for record-keeping

#### **Interactive Map & Route Visualization**
- **Leaflet + OpenStreetMap integration**: Real-time map display
- **Route mapping**: Complete GPS path visualization during and after trips
- **Live marker updates**: Current position indicator
- **Geofence visualization**: Colored circles showing safe zones
- **Zoom & pan controls**: Full map interactivity
- **Charging station overlay**: View nearby charging infrastructure

---

### For Watchers 👁️

#### **Live Interactive Multi-Rider Map**
- **Real-time rider tracking**: All family members visible on single map
- **Leaflet + OpenStreetMap base**: Professional mapping backend
- **Multi-rider markers** with:
  - Rider name and current status (online/offline)
  - Battery level indicator
  - Color-coded markers per rider
  - Last update timestamp
- **Route visualization**: Complete GPS paths for all active riders
- **Live route refresh**: Updates as riders move (10-second intervals)
- **Zoom to rider**: Quick navigation to specific family member's location
- **Route legend**: Shows number of tracked points per active rider

#### **Advanced Geofence Management**
- **Create custom safe zones** directly on the interactive map
- **Zone properties**:
  - Custom name and color (7 color options)
  - Center point (click on map to place)
  - Configurable radius (0.1 - 5 km)
  - Creation timestamp tracking
- **Edit existing zones**: Modify name, location, and radius
- **Delete zones**: Remove zones no longer needed
- **Entry/exit alerts**: Real-time notifications when riders enter/leave zones
- **Firebase persistence**: All geofences synced across devices
- **Visual zone feedback**: Color-coded circles on map

#### **Comprehensive Alerts Dashboard**
- **Multi-category alert system**:
  - 🔋 Battery alerts (low battery warnings)
  - 📊 Drain rate alerts (abnormal power consumption)
  - 📍 Geofence alerts (entry/exit events)
  - 🌧️ Weather alerts (rain detection)
  - ⚡ Speed alerts (excessive speed warnings)
- **Alert metadata**: Timestamp, rider name, severity level
- **Dismissible alerts**: Clear individual alerts after review
- **Alert history**: Last 50 alerts stored and viewable
- **Alert prioritization**: Critical/high alerts shown first

#### **Emergency SOS Response System**
- **Immediate SOS modal popup** when rider triggers emergency
- **Rapid access to critical information**:
  - 🚨 Rider name and status
  - 📍 GPS coordinates (tap for Google Maps direction)
  - 🔋 Current battery level
  - 🕐 Emergency timestamp
  - Direct one-click navigation to emergency location
- **SOS event history**: All past emergencies logged
- **Multi-rider SOS handling**: Multiple riders can call SOS simultaneously

#### **Trip Monitoring & Analysis**
- **Browse all family trips** from dashboard
- **Advanced trip filtering**:
  - By date range (today, last 7 days, custom)
  - By rider name
  - By trip quality (eco-score ranges)
  - Sort by distance, duration, eco-score
- **Trip statistics view**:
  - Total trips, total distance, average eco-score
  - Best/worst eco-score records
  - Rider-specific analytics
- **Individual trip details**:
  - Duration, distance, speed metrics
  - Battery consumption analysis
  - Eco-score breakdown
  - Environmental impact (CO2, tree equivalents)
- **Trip PDF export**: Download complete trip reports
- **Route review**: Inspect GPS paths for each trip

#### **Intelligent Coaching System**
- **Auto-generate coaching tips** based on rider's eco-score:
  - Threshold-based suggestion (if eco-score <40, <60, etc.)
  - Personalized to riding style and patterns
- **Send custom coaching tips** to rider inbox:
  - Custom message composition
  - Priority level selection (high/medium/low/info)
  - Icon and category assignment
  - Timestamp tracking
- **Tip delivery & tracking**:
  - Tips appear in rider's inbox immediately
  - Read/unread status tracking
  - Riders can view sender and timestamp
  - Watchers can see sent tips in their coaching panel
- **Multi-watcher support**: Multiple family members can send tips

#### **Environmental Reports & Analytics**
- **Family-level environmental dashboard**:
  - Total CO2 saved by family
  - Tree equivalents planted (theoretical)
  - Family eco-score trends
  - Carbon offset in kg
- **Individual rider rankings**:
  - Ranked by average eco-score
  - Ranked by distance traveled
  - Ranked by trips completed
  - Ranked by environmental impact
- **Badge achievement tracking**:
  - Which riders have reached each tier
  - Progress toward next milestone
  - Family badge statistics
- **Eco-impact visualization**: Charts and graphs

#### **Weather-Based Safety Alerts**
- **OpenWeatherMap integration**: Real-time weather data
- **Rain detection** using WMO weather codes
- **Weather condition tracking**:
  - Current conditions per rider location
  - Precipitation probability
  - Wind speed and visibility
- **Auto-triggered safety tips**: System sends rain safety coaching when:
  - Rain detected in rider's current location
  - Speed suggestions (reduce by 20%)
  - Braking distance reminders
  - Safety tip auto-prompts to watcher
- **Optional feature**: Disable weather monitoring if desired
- **Manual weather-based tips**: Watcher can send weather-specific safety tips

#### **Family Member Management**
- **Family panel with member list**:
  - Display name and role (Rider/Watcher)
  - Member profiles and contact info
  - Online/offline status
  - Last seen timestamp
- **Role assignment**: Designate family members as Riders or Watchers
- **Invite system**: Generate shareable invite codes for family members
- **Firebase-backed membership**: Real-time family sync
- **Google Sign-In integration**: Secure authentication

---

### Unique Features ⭐

#### **Advanced Eco-Score Algorithm**
- **Three-component weighting system**: Throttle, Speed, Acceleration
- **Real-time calculation**: Updated 10+ times per second during riding
- **Historical tracking**: All eco-scores stored per trip for analysis
- **Comparative leaderboard**: Family members compete eco-score rankings

#### **No External PDF Library**
- **Custom PDF generation** built from scratch
- **All trip data embedded** in generated PDFs
- **Environmental report included** in exports
- **Lightweight implementation** reduces bundle size

#### **Dual Role Architecture**
- **Rider mode**: Real-time sharing, trip recording, eco-scoring
- **Watcher mode**: Multi-rider tracking, geofence management, coaching
- **Role switching**: Users can toggle between roles within app
- **Mixed family setup**: Both roles supported in same family group

#### **Progressive Geofence Search**
- **Smart API querying**: Expands search radius progressively
- **Result caching**: 5-minute TTL on charging station queries
- **Bandwidth optimized**: Reduces redundant API calls
- **Seamless UX**: Automatic fallback without user intervention

#### **Comprehensive Zustand State Management**
- **Persistent localStorage**: Trip history survives app refresh
- **Firebase sync**: Cloud persistence for multi-device access
- **Conflict resolution**: Merges local & cloud trips intelligently
- **100-trip limit**: Prevents excessive storage while maintaining history

#### **Real-Time Firebase Integration**
- **Live location updates**: GPS synced to database instantly
- **SOS event streaming**: Emergency alerts in real-time
- **Multi-device sync**: Changes propagate across all family devices
- **Online/offline detection**: Automatic status management
- **Geofence change detection**: Instant updates for zone modifications

#### **Customizable Admin Panel**
- **Runtime configuration editor**:
  - Adjust battery thresholds
  - Modify eco-score weights
  - Tune drain rate detection
  - Password-protected access
- **Firebase backend storage**: Changes persist across app instances
- **Real-time validation**: Weight sum verification (must equal 100)
- **Reset & revert options**: Undo unwanted changes

#### **Battery Profile System**
- **Pre-configured for Ather Rizta Z**: 3.7 kWh capacity
- **Three consumption modes**: Eco (33), Normal (37), Aggressive (46) Wh/km
- **Dynamic profile switching**: Automatic based on riding style
- **Range projections**: Accurate estimations per consumption mode
- **Drain rate anomaly detection**: 20% above baseline triggers alert

#### **Demo & Testing Features**
- **7 demo rider profiles** with sample trips
- **100-trip history support** for testing large datasets
- **Simulated GPS tracking** for testing without vehicle
- **Guest mode**: Test app without Google Sign-In
- **Local Zustand fallback**: Work offline with local data

#### **Comprehensive Geofence Visualization**
- **Color-coded zones** (7 color palette)
- **Radius overlay** on interactive map
- **Entry/exit indicators** on route visualization
- **Zone history**: Timestamps for all boundary crossings
- **Customizable zone names**: Descriptive labels (Home, Office, School, etc.)

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend Framework** | React 19 |
| **Build Tool** | Vite 8 |
| **State Management** | Zustand 5 |
| **Maps & Geolocation** | Leaflet 1.9 + React-Leaflet 5 + OpenStreetMap |
| **Backend & Database** | Firebase Realtime Database |
| **Authentication** | Firebase Auth + Google Sign-In |
| **Maps API** | Google Maps Directions API |
| **POI Database** | Overpass API (OpenStreetMap) |
| **Weather Data** | OpenWeatherMap API |
| **Styling** | Pure CSS with responsive design |
| **Storage** | LocalStorage (Zustand persistence) + Firebase |
| **PDF Generation** | Custom JavaScript implementation |
| **Geolocation** | Browser Geolocation API |
| **Distance Calculations** | Haversine formula |

**Version Requirements:**
- Node.js 18+
- npm or yarn

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Firebase project with Realtime Database enabled
- API keys for:
  - Firebase (Auth + Realtime DB)
  - OpenWeatherMap (optional for weather features)
  - Google Maps (for directions links)

### Step-by-Step Installation

#### 1. **Clone Repository**
```bash
git clone https://github.com/Avadhoot-007/familytrack-ev.git
cd familytrack-ev
```

#### 2. **Install Dependencies**
```bash
npm install
```

#### 3. **Configure Environment Variables**

Create a `.env.local` file in the root directory (copy from `.env.example`):

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Optional APIs
VITE_OPENWEATHER_API_KEY=your_openweather_api_key

# Admin Panel Protection
VITE_ADMIN_PASSWORD=your_secure_admin_password
```

#### 4. **Configure Firebase Realtime Database**

Set up Firebase Realtime Database security rules:

```json
{
  "rules": {
    "riders": {
      "$riderId": {
        ".read": true,
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('familyId').val() === root.child('riders').child($riderId).child('familyId').val()",
        "trips": {
          ".read": true
        },
        "coachingTips": {
          ".read": "$uid === auth.uid",
          ".write": true
        }
      }
    },
    "families": {
      "$familyId": {
        ".read": "root.child('users').child(auth.uid).child('familyId').val() === $familyId",
        ".write": "root.child('users').child(auth.uid).child('familyId').val() === $familyId"
      }
    },
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('familyId').val() === root.child('users').child($uid).child('familyId').val()",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

#### 5. **Run Development Server**
```bash
npm run dev
```

The app will start on `http://localhost:5173` (or another available port).

#### 6. **Build for Production**
```bash
npm run build
```

Generated files will be in the `dist/` directory.

#### 7. **Deploy (Firebase Hosting)**
```bash
firebase init hosting
firebase deploy
```

---

## 📂 Project Structure

```
src/
├── pages/
│   ├── RiderDashboard.jsx          # Main rider interface (tracking, eco-score, SOS)
│   └── WatcherDashboardPage.jsx    # Main watcher interface (map, trips, alerts)
│
├── components/
│   ├── AdminPanel.jsx              # Runtime configuration editor
│   ├── CoachingTipCard.jsx         # Watcher-side tip generation & sending
│   ├── CoachingTipsSystem.jsx      # Toast-style tip display for riders
│   ├── FamilyPanel.jsx             # Family member management & invites
│   ├── GeofenceEditor.jsx          # Interactive geofence creation/editing
│   ├── RiderLeaderboard.jsx        # Eco-score rankings and statistics
│   ├── RiderTipsInbox.jsx          # Rider-side tip inbox (read/unread)
│   ├── SOSModal.jsx                # Emergency SOS interface
│   ├── TripSummaryCard.jsx         # Trip details and PDF export
│   └── WatcherDashboard.jsx        # Map, alerts, trips, coaching hub
│
├── services/
│   ├── locationService.js          # Geofence detection (Haversine formula)
│   └── chargingStations.js         # Overpass API integration, caching
│
├── utils/
│   ├── Coachingtips.js             # Tip generation algorithm & icons
│   ├── ecoImpactCalculations.js    # CO2 savings & badge tier logic
│   ├── ecoScoring.js               # Real-time eco-score algorithm
│   ├── tripFirebaseSync.js         # Firebase read/write operations
│   └── tripPDFExport.js            # Custom PDF generation
│
├── store/
│   └── index.js                    # Zustand state management (localStorage + Firebase sync)
│
├── data/
│   └── geofences.js                # Pre-configured safe zones
│
├── config/
│   └── firebase.js                 # Firebase initialization
│
├── styles/
│   └── *.css                       # Component styles
│
├── App.jsx                         # Main app router & auth flow
├── main.jsx                        # React entry point
└── index.html                      # HTML template
```

---

## 🔧 Configuration

### Battery & Eco-Score Settings

Edit `src/pages/RiderDashboard.jsx`:

```javascript
// Ather Rizta Z Specifications
const BATTERY_SPECS = {
  capacity: 3700,     // 3.7 kWh total capacity
  consumption: {
    eco: 33,         // Wh/km in eco mode
    normal: 37,      // Wh/km in normal mode
    aggressive: 46   // Wh/km in aggressive mode
  }
};

// Battery Alert Thresholds
const BATTERY_CRITICAL = 10;  // % - blocks trip start
const BATTERY_LOW = 25;       // % - shows warning
const BATTERY_BLOCK = 0;      // % - minimum to ride

// Drain Rate Detection
const DRAIN_BASELINE_WH_KM = 37;  // Expected consumption (normal mode)
const DRAIN_ALERT_RATIO = 1.2;    // 20% above baseline triggers alert
```

### Eco-Score Algorithm

Edit `src/utils/ecoScoring.js`:

```javascript
// Eco-Score Weights (must sum to 100)
const WEIGHTS = {
  throttle: 35,      // Smooth acceleration importance
  speed: 35,         // Speed maintenance importance
  acceleration: 30   // Acceleration smoothness importance
};

// Score Ranges
// 90-100: Excellent (🟢)
// 75-89:  Good (🟢)
// 50-74:  Fair (🟡)
// 25-49:  Poor (🟠)
// 0-24:   Critical (🔴)
```

### Environmental Badge Tiers

Edit `src/utils/ecoImpactCalculations.js`:

```javascript
// CO2 Thresholds (kg CO2 saved)
const BADGE_TIERS = {
  seedling: 5,              // 🌱 Seedling
  sapling: 25,              // 🌿 Sapling
  oak: 100,                 // 🌳 Oak
  forestGuardian: 500,      // 🌲 Forest Guardian
  carbonChampion: 1000      // 🏆 Carbon Champion
};

// CO2 Calculation
const CO2_PER_KM = 0.142;   // kg CO2/km (EV vs. petrol)
const CO2_PER_TREE_YEAR = 21; // kg CO2/year (1 tree)
```

### Default Geofences

Edit `src/data/geofences.js`:

```javascript
export const geofences = [
  { 
    id: 1, 
    name: 'Home', 
    lat: 18.6702, 
    lng: 73.7902, 
    radiusKm: 0.5 
  },
  { 
    id: 2, 
    name: 'Office', 
    lat: 18.5204, 
    lng: 73.8567, 
    radiusKm: 0.3 
  },
  { 
    id: 3, 
    name: 'College', 
    lat: 18.6213, 
    lng: 73.9121, 
    radiusKm: 0.4 
  },
];
```

### Admin Panel Configuration

Access the Admin Panel in the app (requires `VITE_ADMIN_PASSWORD`):

```
URL: /admin-panel
Password: [Your configured admin password]

Editable Settings:
- Throttle weight (0-100)
- Speed weight (0-100)
- Acceleration weight (0-100)
- Battery critical threshold (%)
- Battery low threshold (%)
- Drain rate baseline (Wh/km)
- Drain alert ratio (multiplier)
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### For Bug Reports
1. Check existing issues first
2. Provide clear description and reproduction steps
3. Include browser/device info and console errors

### For Feature Requests
1. Describe the feature and use case
2. Explain how it improves the app
3. Include mockups/wireframes if applicable

### For Code Contributions
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Follow existing code style and patterns
4. Test thoroughly before submitting
5. Commit with clear messages: `git commit -m 'Add detailed feature description'`
6. Push to branch: `git push origin feature/your-feature-name`
7. Open a Pull Request with detailed description

### Development Guidelines
- Use React hooks for all new components
- Follow existing Zustand patterns for state
- Add comments for complex logic
- Test Firebase rules before pushing
- Ensure responsive design for mobile/tablet
- Avoid breaking changes when possible

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this project for personal or commercial purposes.

---

## 🙏 Acknowledgments

Special thanks to:

- **React 19** & **Vite** - Modern frontend development
- **Firebase** - Real-time backend infrastructure
- **Leaflet.js** & **OpenStreetMap** - Mapping and geolocation
- **Zustand** - Lightweight state management
- **Overpass API** - POI and charging station data
- **OpenWeatherMap** - Real-time weather information
- **Google Maps** - Navigation and directions

---

## 📞 Support

### Getting Help

- **GitHub Issues**: [Open an issue](https://github.com/Avadhoot-007/familytrack-ev/issues) for bugs or feature requests
- **Configuration Issues**: Check `.env.example` and Firebase setup guide above
- **Firebase Errors**: Review Firebase security rules and authentication setup
- **Map Issues**: Verify Leaflet library and OpenStreetMap connection
- **Weather Features**: Confirm OpenWeatherMap API key is valid

### Common Issues

#### 🔴 "Firebase not initialized"
- Check all Firebase credentials in `.env.local`
- Verify database URL format
- Ensure Firebase project has Realtime Database enabled

#### 🔴 "Map not loading"
- Clear browser cache
- Check browser console for Leaflet errors
- Verify OpenStreetMap is accessible in your region

#### 🔴 "Location not updating"
- Allow location permissions in browser
- Check browser geolocation settings
- Verify Firebase database rules allow reads/writes

#### 🔴 "Trips not syncing"
- Confirm Firebase rules are correctly set
- Check network connection
- Review browser developer tools for Firebase errors

### Performance Tips

- **Reduce trip history size** if app feels slow (clear old trips)
- **Disable weather alerts** if not needed
- **Limit map zoom level** for better performance
- **Use charging station cache** to reduce API calls
- **Enable browser caching** for faster loads

### Deployment Checklist

- [ ] All Firebase credentials configured
- [ ] Security rules reviewed and tested
- [ ] Admin password set securely
- [ ] Optional APIs configured (weather, maps)
- [ ] Privacy policy in place
- [ ] Terms of service prepared
- [ ] Data retention policies defined
- [ ] CORS settings verified

---

## 🎯 Roadmap & Future Features

Potential enhancements:

- 📱 Native mobile app (React Native)
- 🗺️ Enhanced route planning & waypoints
- 🏆 Global leaderboards (opt-in)
- 📊 Advanced trip analytics & trends
- 🔔 Push notifications (PWA)
- 💬 In-app messaging between family
- 🚗 Multi-vehicle support per rider
- ⚙️ Custom consumption profiles
- 📈 Eco-score improvement challenges
- 🌐 Internationalization (i18n)

---

**Stay safe, ride green! 🌱⚡**

*FamilyTrack EV - Making family EV riding safer and more eco-conscious.*
