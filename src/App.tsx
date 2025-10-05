import SolarSystemPanel from './components/UI/OrbitView/SolarSystemPanel';
import WorldMapPanel from './components/UI/MapView/WorldMapPanel';
import EconomyPanel from './components/UI/OrbitView/EconomyPanel';
import { economyState } from './solar_system/economy/state';
import { finalizePreparedLaunch } from './solar_system/economy/actions';
import React from 'react';

const App = () => {
  // Local tick to trigger re-render so big launch button reflects PREPPED_LAUNCH changes
  const [, setTick] = React.useState(0);
  React.useEffect(()=>{
    let raf:number; const loop=()=>{ setTick(t=>t+1); raf=requestAnimationFrame(loop); }; loop(); return ()=>cancelAnimationFrame(raf);
  },[]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', gridTemplateRows: '50% 50%', width: '100vw', height: '100vh', margin: 0, background: '#121212', color: '#eee', fontFamily: 'system-ui, Arial, sans-serif', overflow: 'hidden', position:'relative' }}>
      {/* Top Left: Solar System */}
      <div style={{ position: 'relative', borderRight: '1px solid #1d2530', borderBottom: '1px solid #1d2530' }}>
        <SolarSystemPanel />
      </div>
      {/* Top Right: World Map */}
      <div style={{ position: 'relative', borderBottom: '1px solid #1d2530' }}>
        <WorldMapPanel />
      </div>
      {/* Bottom full row container (custom layout with extra middle panel) */}
      <div style={{ gridColumn:'1 / span 2', position:'relative', display:'flex', flexDirection:'row', width:'100%', height:'100%', borderTop:'1px solid #1d2530' }}>
        {/* Bottom Left: Economy Panel */}
        <div style={{ position:'relative', flex:'1 1 auto', borderRight:'1px solid #1d2530', background:'rgba(10,10,16,0.9)', overflow:'hidden' }}>
          <EconomyPanel />
        </div>
        {/* Middle fixed 200px panel with raised disabled launch button in bottom half */}
        <div style={{ width:200, minWidth:200, maxWidth:200, flex:'0 0 200px', borderRight:'1px solid #1d2530', background:'#141b22', position:'relative', display:'flex', flexDirection:'column' }}>
          <div style={{ flex:'0 0 50%', height:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, letterSpacing:0.5, opacity:0.55 }}>Controls</div>
          <div style={{ flex:'0 0 50%', height:'50%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {(() => {
              const prepped = economyState.inventory.find(i=>i.state==='PREPPED_LAUNCH');
              const disabled = !prepped;
              const bpName = prepped ? (()=>{ const bp = prepped && prepped.blueprint; return bp ? bp.replace(/-/g,' ') : ''; })() : '';
              return (
              <button
                disabled={disabled}
                aria-label="Launch"
                style={{
                  width:140,
                  height:140,
                  borderRadius:'50%',
                  background:'radial-gradient(circle at 32% 32%, #7a2f2f, #3d0000 72%)',
                  border:'2px solid #552a2a',
                  boxShadow: disabled
                    ? '0 8px 18px -6px rgba(0,0,0,0.7), 0 4px 8px -2px rgba(0,0,0,0.55), 0 0 0 2px #261010, 0 0 10px 4px #60181820, inset 0 0 8px #441d1d'
                    : '0 0 0 2px #3b1212, 0 0 12px 4px #ff3d3d88, 0 0 28px 10px #ff1d1d44, inset 0 0 10px 3px #671f1f, 0 8px 18px -6px rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize:20,
                  fontWeight:700,
                  letterSpacing:1.2,
                  cursor: disabled ? 'default' : 'pointer',
                  textShadow:'0 0 6px rgba(255,255,255,0.25)',
                  position:'relative',
                  userSelect:'none',
                  display:'flex',
                  flexDirection:'column',
                  alignItems:'center',
                  justifyContent:'center',
                  opacity: disabled ? 0.55 : 1,
                  transition:'opacity 160ms, box-shadow 260ms'
                }}
                onClick={()=>{ if(!disabled && prepped){ finalizePreparedLaunch(economyState, prepped.id); } }}
              >
                {!disabled && (
                  <>
                    <span style={{ fontSize:22, letterSpacing:1.5 }}>LAUNCH</span>
                    <span style={{ fontSize:10, marginTop:6, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', opacity:0.9, whiteSpace:'nowrap', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }}>{bpName}</span>
                  </>
                )}
              </button>
              ); })()}
          </div>
        </div>
        {/* Bottom Right: Future panel placeholder */}
        <div style={{ position:'relative', flex:'1 1 auto' }}>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, opacity:0.5 }}>Reserved</div>
        </div>
      </div>
    </div>
  );
};

export default App;
