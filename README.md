# FamilyTrack EV 🚴‍♂️🔋

A comprehensive family safety and eco-tracking application for electric vehicle riders. Monitor real-time location, battery levels, and driving efficiency while ensuring safety through geofencing and emergency alerts.

## 🌟 Features
### For Riders 👤
- **Real-time Location Sharing**: Share live GPS location while riding; updates sync to Firebase in real-time.
- **Eco-Score Tracking**: Live eco-scoring computed from throttle, speed and acceleration with color-coded feedback.
- **Battery Monitoring & Projections**: Track battery %, projected range (Wh/km), drain-rate alerts and critical warnings.
- **Trip Logging & Simulation**: Automatic trip recording plus realistic demo profiles (simulated trips are flagged).
- **Hold-to-Activate SOS**: 5s hold-to-activate SOS (countdown) that logs location, battery and notifies watchers.
- **Coaching Tips (Rider Inbox)**: Receive tips sent by watchers or auto-generated tips based on trip analysis; unread badge and dismissible tips.
- **Nearby Charging Stations**: Lookup chargers using OpenStreetMap/Overpass with client-side caching and Google Maps links.
- **Trip Summary & PDF Export**: Export trip summaries and environmental impact reports as downloadable PDFs.

### For Watchers 👁️
- **Live Map with Leaflet**: Interactive map showing online/offline riders, custom markers, geofences and nearby chargers.
- **SOS Alerts & Actions**: Immediate SOS modal with location and direct Google Maps link; mark SOS as resolved from watcher UI.
- **Geofence Notifications**: Enter/exit alerts for configurable safe zones (see `src/data/geofences.js`).
- **Alerts Panel & Actions**: Battery/drain/weather alerts with one-click actions to send coaching reminders to riders.
- **Trip History, Exports & Leaderboard**: Browse trips, filter by time window, export PDFs and view eco leaderboards across riders.
- **Weather Overlay (Optional)**: Integrates OpenWeatherMap for rain warnings and automated watch-side prompts (requires `VITE_OPENWEATHER_API_KEY`).

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

3. **Configure Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Realtime Database
   - Copy your config to `.env`:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm run preview
   ```

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
│   ├── CoachingTipCard.jsx
│   ├── CoachingTipsSystem.jsx
│   ├── EnvironmentalImpactHub.jsx
│   ├── RiderLeaderboard.jsx
│   ├── SOSModal.jsx
│   ├── TripSummaryCard.jsx
│   └── WatcherDashboard.jsx
├── pages/               # Page components
│   ├── RiderDashboard.jsx
│   └── WatcherDashboardPage.jsx
├── services/            # Utility services
│   └── locationService.js
├── store/               # State management (Zustand)
│   └── index.js
├── utils/               # Helper functions
│   ├── Coachingtips.js
│   ├── ecoImpactCalculations.js
│   ├── ecoScoring.js
│   └── tripPDFExport.js
├── data/                # Static data
│   └── geofences.js
├── config/              # Configuration
│   └── firebase.js
├── App.jsx              # Main app component
└── main.jsx             # Entry point
```

## 🔧 Configuration

### Geofences
Edit `src/data/geofences.js` to define safe zones:
```javascript
export const geofences = [
  { id: 1, name: 'Home', lat: 18.6702, lng: 73.7902, radiusKm: 0.5 },
  // Add more zones...
];
```

### Eco-Scoring
Customize scoring in `src/utils/ecoScoring.js`:
- Adjust `WEIGHTS` for different penalty factors
- Modify `THRESHOLDS` for scoring sensitivity

### Battery Specifications
Configure battery specs in `src/pages/RiderDashboard.jsx`:
```javascript
const BATTERY_SPECS = {
  capacity: 3700, // Wh (3.7 kWh)
  consumption: {
    eco: 33,        // Wh/km
    normal: 37,     // Wh/km
    aggressive: 46, // Wh/km
  },
};
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

## 📄 License

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
