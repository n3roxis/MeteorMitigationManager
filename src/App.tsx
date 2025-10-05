import { AsteroidInfo } from './components/UI/Hud/AsteroidInfo';
import WorldMapPanel from './components/UI/MapView/WorldMapPanel';
import SolarSystemPanel from './components/UI/OrbitView/SolarSystemPanel';

const App = () => {
  
  return (
    <div>
      <div style={{ display:'flex',width:'100vw',height:'100vh',position:'absolute', overflow:'hidden',justifyContent:'center',flexDirection:'column',alignItems:'center',pointerEvents:'none'}}>
          <AsteroidInfo/>
      </div>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', margin: 0, background: '#121212', color: '#eee', fontFamily: 'system-ui, Arial, sans-serif', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <SolarSystemPanel/>
        </div>
        <div style={{flex: 1, maxWidth:2,display: 'flex', background: '#aaaaaa'}}></div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <WorldMapPanel />
        </div>
      </div>
    </div>
  );
};

export default App;
