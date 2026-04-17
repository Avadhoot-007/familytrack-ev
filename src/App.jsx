import { useState } from 'react';
import RiderDashboard from './pages/RiderDashboard';
import WatcherDashboard from './pages/WatcherDashboardPage';

export default function App() {
  const [view, setView] = useState('rider');
  const [riderName, setRiderName] = useState('');
  const [nameSet, setNameSet] = useState(false);

  const handleSetName = () => {
    if (riderName.trim()) {
      setNameSet(true);
    }
  };

  if (!nameSet) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        maxWidth: '400px', margin: '100px auto',
        fontFamily: 'Arial, sans-serif',
      }}>
        {/* Title row: emoji + text side-by-side to prevent overlap */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '12px', marginBottom: '12px',
        }}>
          <span style={{ fontSize: '36px', lineHeight: 1 }}>🚴</span>
          <span style={{
            fontSize: '28px', fontWeight: '600', letterSpacing: '0',
            color: 'inherit', lineHeight: 1,
          }}>
            FamilyTrack EV
          </span>
        </div>

        <p style={{
          fontSize: '18px', fontWeight: '500', margin: '0 0 20px',
          color: 'inherit', letterSpacing: '0',
        }}>
          Enter Your Name
        </p>

        <input
          id="rider-name"
          name="rider-name"
          type="text"
          placeholder="Your name..."
          value={riderName}
          onChange={(e) => setRiderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
          style={{
            padding: '10px', fontSize: '16px', width: '100%',
            marginBottom: '10px', borderRadius: '4px',
            border: '1px solid #ddd', boxSizing: 'border-box',
            fontFamily: 'Arial, sans-serif',
          }}
        />

        <button
          onClick={handleSetName}
          style={{
            padding: '10px 20px', background: '#4CAF50', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
            fontSize: '16px', width: '100%', fontFamily: 'Arial, sans-serif',
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial' }}>
      <div style={{
        padding: '12px 20px', background: '#f5f5f5',
        borderBottom: '1px solid #ddd', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h2 style={{ margin: 0 }}>🚴 FamilyTrack EV</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setView('rider')}
            style={{
              padding: '8px 16px', fontSize: '14px',
              background: view === 'rider' ? '#4CAF50' : '#ddd',
              color: view === 'rider' ? 'white' : '#333',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              fontWeight: view === 'rider' ? 'bold' : 'normal',
            }}
          >
            👤 Rider
          </button>
          <button
            onClick={() => setView('watcher')}
            style={{
              padding: '8px 16px', fontSize: '14px',
              background: view === 'watcher' ? '#2196F3' : '#ddd',
              color: view === 'watcher' ? 'white' : '#333',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              fontWeight: view === 'watcher' ? 'bold' : 'normal',
            }}
          >
            👁️ Watcher
          </button>
        </div>
      </div>

      <div style={{ display: view === 'rider' ? 'block' : 'none' }}>
        <RiderDashboard riderName={riderName} />
      </div>
      <div style={{ display: view === 'watcher' ? 'block' : 'none' }}>
        <WatcherDashboard />
      </div>
    </div>
  );
}