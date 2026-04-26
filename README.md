# FamilyTrack EV 🚴‍♂️🔋

A comprehensive family safety and eco-tracking application for electric vehicle riders. Monitor real-time location, battery levels, and driving efficiency while ensuring safety through geofencing and emergency alerts.

## 🌟 Key Features

### For Riders 👤
- **Real-time Location Sharing** - Live GPS sync to Firebase with online/offline status
- **Eco-Score Tracking** - Live calculation (throttle 35%, speed 35%, acceleration 30%) with color feedback
- **Battery Management** - Real-time % display, 3 consumption profiles (eco: 33, normal: 37, aggressive: 46 Wh/km), drain rate alerts
- **Trip Recording** - Automatic recording with distance, duration, avg speed; up to 100 trips stored + 7 demo profiles
- **Hold-to-Activate SOS** - 5-second hold emergency alert with location, battery, and rider name logging
- **Environmental Badges** - 5-tier system (Seedling → Carbon Champion) based on CO2 saved; 0.142 kg CO2/km savings
- **Coaching Tips** - Auto-generated tips based on eco-score, speed, acceleration + watcher-sent coaching
- **Charging Stations** - Overpass API integration with smart radius expansion (3km → 6km → 15km), Google Maps links
- **Trip PDF Export** - Download trip summaries with stats, eco-analysis, and environmental impact
- **Leaderboard** - Rank riders by eco-score, distance, trips completed

### For Watchers 👁️
- **Live Interactive Map** - Leaflet + OpenStreetMap with real-time multi-rider markers, routes, charging stations
- **Geofence Management** - Create/edit zones directly on map with entry/exit alerts (7 colors, configurable radius)
- **SOS Response** - Immediate emergency modal with GPS, battery, direct Google Maps navigation link
- **Trip Monitoring** - Browse all family trips with filtering (date, rider, quality) and PDF export
- **Alerts Dashboard** - Battery, drain rate, geofence, weather, and speed alerts with dismissal
- **Coaching System** - Auto-generate or send custom tips to rider inboxes with read/unread tracking
- **Environmental Reports** - Family CO2 totals, tree equivalents, rider rankings, badge achievements
- **Weather Alerts** - Optional rain detection (WMO codes) with auto-prompts to send safety tips

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Styling**: CSS with responsive design
- **Maps**: Leaflet + OpenStreetMap
- **State Management**: Zustand (with LocalStorage persistence)
- **Backend**: Firebase Realtime Database
- **Authentication**: Firebase Auth + Google Sign-In
- **APIs**: OpenWeatherMap, OpenStreetMap Overpass, Google Maps, Geolocation
- **PDF Generation**: Custom implementation (no external libs)

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+, npm/yarn
- Firebase project with Realtime Database enabled

### Quick Start
```bash
# Clone and install
git clone https://github.com/yourusername/familytrack-ev.git
cd familytrack-ev
npm install

# Configure Firebase
# Copy .env.example to .env and add:
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
VITE_OPENWEATHER_API_KEY=optional_key

# Run development server
npm run dev

# Build for production
npm run build
firebase deploy
```

## 📂 Project Structure

```
src/
├── components/          # Rider/Watcher UI components
│   ├── CoachingTipCard.jsx, RiderLeaderboard.jsx, SOSModal.jsx
│   ├── TripSummaryCard.jsx, WatcherDashboard.jsx
├── pages/               # Main pages
│   ├── RiderDashboard.jsx, WatcherDashboardPage.jsx
├── services/            # Business logic
│   ├── locationService.js (geofence detection, Haversine)
│   ├── chargingStations.js (Overpass API, caching)
├── store/               # State management (Zustand)
│   └── index.js
├── utils/               # Calculations & helpers
│   ├── ecoScoring.js, ecoImpactCalculations.js
│   ├── Coachingtips.js, tripFirebaseSync.js, tripPDFExport.js
├── data/
│   └── geofences.js (configurable safe zones)
├── config/
│   └── firebase.js (Firebase setup)
└── App.jsx, main.jsx
```

## 🔧 Configuration

### Battery & Eco-Score
Edit `src/pages/RiderDashboard.jsx`:
```javascript
// Ather Rizta Z specs
const BATTERY_SPECS = {
  capacity: 3700,     // 3.7 kWh
  consumption: { eco: 33, normal: 37, aggressive: 46 } // Wh/km
};
const BATTERY_ALERTS = { critical: 10, low: 25, drainBaseline: 37, drainAlertRatio: 1.20 };

// Eco-score: (throttle×0.35) + (speed×0.35) + (accel×0.30)
// Ranges: 90-100 Excellent, 75-89 Good, 50-74 Fair, 25-49 Poor, 0-24 Critical
```

### Geofences
Edit `src/data/geofences.js`:
```javascript
export const geofences = [
  { id: 1, name: 'Home', lat: 18.6702, lng: 73.7902, radiusKm: 0.5 },
  { id: 2, name: 'Office', lat: 18.5204, lng: 73.8567, radiusKm: 0.3 },
];
```

### Badge Tiers
CO2 thresholds in `src/utils/ecoImpactCalculations.js`:
```javascript
// 🌱 Seedling: 5 kg CO2 → 🌿 Sapling: 25 kg → 🌳 Oak: 100 kg 
// → 🌲 Forest Guardian: 500 kg → 🏆 Carbon Champion: 1000 kg
// CO2 saved: 0.142 kg/km (EV vs petrol); 1 tree = 21 kg CO2/year
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

- React 19 & Vite for frontend
- Firebase Realtime Database
- Leaflet.js & OpenStreetMap
- Zustand state management
- OpenWeatherMap API
- Overpass API for charging stations

## 📞 Support

- Open an issue on GitHub
- Check Firebase configuration
- Review `.env.example` for setup

**Stay safe, ride green! 🌱⚡**
