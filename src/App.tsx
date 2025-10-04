import SolarSystemPanel from './components/SolarSystemPanel';
import WorldMapPanel from './components/WorldMapPanel';

const App = () => {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', margin: 0, background: '#121212', color: '#eee', fontFamily: 'system-ui, Arial, sans-serif', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <SolarSystemPanel />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <WorldMapPanel />
      </div>
    </div>
  );
};

export default App;
