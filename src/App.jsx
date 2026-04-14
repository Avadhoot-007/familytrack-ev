import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from './config/firebase';

const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.setIcon(DefaultIcon);

export default function App() {
  const position = [18.5204, 73.8567];

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', background: '#f0f0f0', textAlign: 'center' }}>
        <h1>FamilyTrack EV</h1>
        <p>✓ Firebase Connected</p>
      </div>
      <MapContainer
        center={position}
        zoom={13}
        style={{ width: '100%', flex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <Marker position={position}>
          <Popup>Pune, India - Rider Location</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}