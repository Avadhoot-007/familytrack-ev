# FamilyTrack EV 🚴‍♂️🔋

A comprehensive family safety and eco-tracking application for electric vehicle riders. Monitor real-time location, battery levels, and driving efficiency while ensuring safety through geofencing and emergency alerts.

## 🌟 Features

### For Riders 👤
- **Real-time Location Sharing**: Share your location with family members during rides
- **Eco-Score Tracking**: Monitor driving efficiency with live scoring based on throttle, speed, and acceleration
- **Battery Monitoring**: Track battery usage and receive low-battery warnings with adjustable battery levels
- **Trip Logging**: Automatic trip recording with distance, duration, and performance metrics
- **Emergency SOS**: Hold-to-activate emergency alerts with location and battery info
- **Coaching Tips**: Real-time personalized driving tips based on eco-scores during rides
- **Trip Simulation**: Generate realistic demo trips for testing and demonstration
- **Trip Analytics**: Detailed trip summaries with PDF export capabilities
- **Environmental Impact**: Track CO₂ savings, tree equivalents, and earn carbon offset badges
- **Rider Leaderboard**: Compare performance with other family members

### For Watchers 👁️
- **Live Map View**: See all family members' locations on an interactive map with Leaflet
- **Geofencing Alerts**: Get notified when riders enter/leave predefined safe zones
- **Trip Analytics**: View detailed trip history, leaderboards, and performance stats
- **Coaching Tips**: Send personalized driving tips based on eco-scores
- **Emergency Response**: Receive immediate SOS alerts with location data and Google Maps integration
- **Real-time Monitoring**: Track rider status, battery levels, and online/offline status
- **Trip History**: Comprehensive trip data with filtering (7 days, 30 days, all time)
- **PDF Exports**: Download detailed trip summaries and reports

### Core Features 🔧
- **Real-time Firebase Sync**: Live data synchronization across devices with Firebase Realtime Database
- **State Management**: Efficient state handling with Zustand
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Offline Support**: Basic functionality without internet (limited)
- **PDF Trip Exports**: Download detailed trip summaries with jsPDF
- **Battery Projections**: Estimate range based on current driving style and consumption rates
- **Environmental Impact Hub**: Track carbon footprint, earn badges, and view eco-leaderboards
- **Coaching Tips System**: AI-powered driving improvement suggestions
- **Trip Simulation**: Realistic demo data generation for testing
- **Geofencing**: Configurable safe zones with automatic alerts
- **Emergency SOS System**: Immediate alert system with location sharing

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
