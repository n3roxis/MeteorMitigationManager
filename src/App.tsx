import { AsteroidInfo } from './components/UI/Hud/AsteroidInfo';
import ImpactSimulationPanel from './components/UI/ImpactSimulation/ImpactSimulationPanel';
import { PANEL_BG, APP_BG } from './components/UI/theme';
import WorldMapPanel from './components/UI/MapView/WorldMapPanel';
import SolarSystemPanel from './components/UI/OrbitView/SolarSystemPanel';
import EconomyPanel from './components/UI/OrbitView/EconomyPanel';
import { economyState } from './solar_system/economy/state';
import { finalizePreparedLaunch, deorbitItem, activateItem } from './solar_system/economy/actions';
import { addMitigationEvent } from './solar_system/impact/mitigationHistory';
import { IMPACTOR_NOMINAL_FLIGHT_TIME_SEC, IMPACTOR_FLIGHT_TIME_VARIANTS } from './solar_system/economy/balance';
import { InterceptPath } from './solar_system/entities/Interceptor/InterceptPath';
import { ENTITIES } from './solar_system/state/entities';
import { METEOR_UNO } from './solar_system/data/meteors';
import React from 'react';

// Simple countdown component using assumed total meteor flight (365 days) minus elapsed sim time (from economyState.timeSec)
const TOTAL_METEOR_FLIGHT_DAYS = 365; // matches meteors.ts flightDays
let telescopeActivationSimTimeSec: number | null = null; // captured first time telescope becomes active
const CountdownToImpact: React.FC = () => {
  const telescopeActive = economyState.inventory.some(i => i.blueprint === 'space-telescope' && i.state === 'ACTIVE_LOCATION');
  if (!telescopeActive) {
    const elapsedDays = economyState.timeSec / 86400;
    return (
      <div style={{ flex:'0 0 auto', padding:'4px 6px 0', textAlign:'center', display:'flex', flexDirection:'column', gap:6, opacity:0.55 }}>
        <div style={{ fontSize:11, letterSpacing:0.5, fontWeight:600, color:'#486b7d', textTransform:'uppercase' }}>Impact ETA</div>
        <div style={{ fontSize:12, fontWeight:600, fontFamily:'monospace', letterSpacing:1, color:'#2d4451' }}>--d --:--:--</div>
        <div style={{ fontSize:9, color:'#39515e', letterSpacing:0.4 }}>Elapsed {elapsedDays.toFixed(1)}d</div>
        <div style={{ fontSize:8, color:'#314650', letterSpacing:0.4, marginTop:2 }}>Activate telescope for ETA</div>
      </div>
    );
  }
  // Capture activation sim time (once)
  if (telescopeActivationSimTimeSec === null) {
    telescopeActivationSimTimeSec = economyState.timeSec;
  }
  const elapsedSinceActivationSec = Math.max(0, economyState.timeSec - telescopeActivationSimTimeSec);
  const elapsedDays = elapsedSinceActivationSec / 86400;
  const remainingDays = Math.max(0, TOTAL_METEOR_FLIGHT_DAYS - elapsedDays);
  const remainingSec = remainingDays * 86400;
  const d = Math.floor(remainingSec / 86400);
  const h = Math.floor((remainingSec % 86400) / 3600);
  const m = Math.floor((remainingSec % 3600) / 60);
  const s = Math.floor(remainingSec % 60);
  // Defensive mitigation score:
  //  - +10 per tsunami dam (once constructed -> BUILT or later states)
  //  - +5 per orbital habitat ONLY after it has launched (i.e. in space: AT_LOCATION or ACTIVE_LOCATION)
  let defensiveScore = economyState.inventory.reduce((acc:number, it:any) => {
    if (it.blueprint === 'tsunami-dam-module' && (it.state === 'BUILT' || it.state === 'PREPPED_LAUNCH' || it.state === 'AT_LOCATION' || it.state === 'ACTIVE_LOCATION')) {
      acc += 10;
    }
    if (it.blueprint === 'impact-bunker' && (it.state === 'BUILT' || it.state === 'PREPPED_LAUNCH' || it.state === 'AT_LOCATION' || it.state === 'ACTIVE_LOCATION')) {
      acc += 5;
    }
    if (it.blueprint === 'orbital-habitat' && (it.state === 'AT_LOCATION' || it.state === 'ACTIVE_LOCATION')) {
      acc += 5;
    }
    return acc;
  }, 0);
  // +10 if Evacuation Routes Planning research completed
  if (economyState.researchUnlocked.has('evacuation-routes' as any)) {
    defensiveScore += 10;
  }
  return (
    <div style={{ flex:'0 0 auto', padding:'4px 6px 0', textAlign:'center', display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:11, letterSpacing:0.5, fontWeight:600, color:'#8ab8d1', textTransform:'uppercase' }}>Impact ETA</div>
      <div style={{ fontSize:18, fontWeight:600, fontFamily:'monospace', letterSpacing:1, color:'#f6f8fa', textShadow:'0 0 6px #000' }}>
        {d}d {h.toString().padStart(2,'0')}:{m.toString().padStart(2,'0')}:{s.toString().padStart(2,'0')}
      </div>
      <div style={{ fontSize:10, color:'#6d8899', letterSpacing:0.4 }}>Elapsed {elapsedDays.toFixed(1)}d</div>
      <div style={{ marginTop:6, fontSize:10, fontWeight:600, letterSpacing:0.5, color:'#6fb7ff', textTransform:'uppercase' }}>Defensive Mitigation</div>
      <div style={{ fontSize:15, fontWeight:600, fontFamily:'monospace', letterSpacing:0.8, color:'#bfe5ff', textShadow:'0 0 4px #000' }}>{defensiveScore}</div>
    </div>
  );
};

const App = () => {
  // Local tick to trigger re-render so big launch button reflects PREPPED_LAUNCH changes
  const [, setTick] = React.useState(0);
  React.useEffect(()=>{
    let raf:number; const loop=()=>{ setTick(t=>t+1); raf=requestAnimationFrame(loop); }; loop(); return ()=>cancelAnimationFrame(raf);
  },[]);
  // Lambert solver polling (now every animation frame instead of throttled interval)
  const lastSolveRef = React.useRef<number>(0);
  React.useEffect(()=>{
    let cancelled = false;
    const frameLoop = () => {
      if (cancelled) return;
      const now = Date.now();
  const preppedActivation = economyState.inventory.find((i:any)=>i.state==='PREPPED_ACTIVATION');
      if (preppedActivation && preppedActivation.blueprint.includes('impactor')) {
        // Run every frame; optionally skip if same ms timestamp (micro-optimization)
        if (now !== lastSolveRef.current) {
          lastSolveRef.current = now;
          try {
            const locMap: Record<string,string> = {
              'LEO': 'earth',
              'SE_L1':'sun-earth-L1','SE_L2':'sun-earth-L2','SE_L3':'sun-earth-L3','SE_L4':'sun-earth-L4','SE_L5':'sun-earth-L5'
            };
            if (preppedActivation.location) {
              const originEntId = locMap[preppedActivation.location] || 'earth';
              const originEnt: any = ENTITIES.find(e=> (e as any).id === originEntId);
              const meteorEnt: any = ENTITIES.find(e=> (e as any).id === METEOR_UNO.id);
              if (originEnt && meteorEnt) {
                const interceptor = new InterceptPath(`ui-solver-${preppedActivation.id}`, originEnt, meteorEnt, false);
                const tries = IMPACTOR_FLIGHT_TIME_VARIANTS.map((m:number)=>IMPACTOR_NOMINAL_FLIGHT_TIME_SEC*m);
                const massGuess = (preppedActivation.massTons||1)*1000;
                const found = interceptor.findTrajectories(tries, massGuess);
                if (found>0) {
                  interceptor.chooseTrajectory(0);
                  const path = interceptor.chosenPath;
                  if (path) {
                    preppedActivation.activationTrajectory = {
                      viable: true,
                      checkedAt: now,
                      flightTimeSec: path.flightTime,
                      depVel: [path.departureVelocity.x, path.departureVelocity.y, path.departureVelocity.z],
                      meteorDelta: path.meteorVelocityChange ? [path.meteorVelocityChange.x, path.meteorVelocityChange.y, path.meteorVelocityChange.z] : [path.arrivalDeltaVelocity.x, path.arrivalDeltaVelocity.y, path.arrivalDeltaVelocity.z]
                    };
                  }
                } else {
                  preppedActivation.activationTrajectory = { viable:false, checkedAt: now };
                }
              }
            }
          } catch(err) {
            preppedActivation.activationTrajectory = { viable:false, checkedAt: now };
          }
        }
      }
      requestAnimationFrame(frameLoop);
    };
    requestAnimationFrame(frameLoop);
    return ()=>{ cancelled = true; };
  },[]);
  return (
  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', gridTemplateRows: '50% 50%', width: '100vw', height: '100vh', margin: 0, background: APP_BG, color: '#eee', fontFamily: 'system-ui, Arial, sans-serif', overflow: 'hidden', position:'relative' }}>
      {/* Funds overlay top center */}
      <div style={{ position:'absolute', top:6, left:'50%', transform:'translateX(-50%)', background:'rgba(24,34,44,0.9)', padding:'4px 10px 5px', border:'1px solid #2e4352', borderRadius:6, fontSize:12, fontWeight:600, letterSpacing:0.6, boxShadow:'0 2px 6px -2px #000, 0 0 0 1px #253643 inset', zIndex:1000 }}>
        Funds: {economyState.fundsBillion.toFixed(2)}B
      </div>
      {/* Top Left: Solar System */}
      <div style={{ position: 'relative', borderRight: '1px solid #1d2530', borderBottom: '1px solid #1d2530', background:PANEL_BG }}>
        <SolarSystemPanel />
      </div>
      {/* Top Right: World Map */}
      <div style={{ position: 'relative', borderBottom: '1px solid #1d2530', overflow:'hidden', background:PANEL_BG }}>
        <WorldMapPanel />
      </div>
      {/* Center the AsteroidInfo radar circle dead-center on screen (no frame) */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', width:200, height:200, zIndex:1200, pointerEvents:'none' }}>
        <AsteroidInfo diameter={200} />
      </div>

      {/* Bottom full row container (spans both columns) */}
      <div style={{ gridColumn:'1 / span 2', gridRow:'2 / 3', position:'relative', display:'flex', flexDirection:'row', width:'100%', height:'100%', borderTop:'1px solid #1d2530' }}>
        {/* Bottom Left: Economy Panel */}
        <div style={{ position:'relative', flex:'1 1 auto', borderRight:'1px solid #1d2530', background:PANEL_BG, overflow:'hidden', margin:'8px 8px 8px 8px', boxSizing:'border-box' }}>
          <EconomyPanel />
        </div>
  {/* Middle fixed (slim) control panel with big red button */}
  <div style={{ width:150, minWidth:150, maxWidth:150, flex:'0 0 150px', borderRight:'1px solid #1d2530', background:PANEL_BG, position:'relative', display:'flex', flexDirection:'column', padding:'0 10px 14px 10px', boxSizing:'border-box' }}>
          {/* Reserved top space (100px) so it doesn't visually collide with centered AsteroidInfo */}
          <div style={{ height:100, flex:'0 0 auto' }} />
          {/* Countdown */}
          <CountdownToImpact />
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            {(() => {
              const preppedLaunch = economyState.inventory.find((i:any)=>i.state==='PREPPED_LAUNCH');
              const preppedLanding = economyState.inventory.find((i:any)=>i.state==='PREPPED_LANDING');
              const preppedActivation = economyState.inventory.find((i:any)=>i.state==='PREPPED_ACTIVATION');
              // Determine activation viability & fuel sufficiency for impactors
              let activationSearching = false;
              let activationNeedsFuel = false; // disabled (bypassed) for impactor fuel debug
              if (preppedActivation) {
                const bp = preppedActivation.blueprint;
                if (bp.includes('impactor')) {
                  const cache = preppedActivation.activationTrajectory;
                  activationSearching = !(cache && cache.viable);
                  // Lookup activation fuel requirement from blueprint index indirectly (mass/fuel stored on item already)
                  // We infer requirement from capacity heuristic: capacity was set to activationFuelTons*2 OR 1.
                  // More reliable: attach requirement to item? Not stored, so approximate via min of (fuelCapacity/2) unless capacity==1 and fuelTons<0.5.
                  // Simpler: encode hardcoded map for now.
                  // Fuel requirement temporarily bypassed – do not gate button on fuel
                }
              }
              const disabled = (!preppedLaunch && !preppedLanding && !preppedActivation) || activationSearching || activationNeedsFuel;
              const activeItem = preppedLaunch || preppedLanding || preppedActivation;
              const bpName = activeItem ? (()=>{ const bp = activeItem.blueprint; return bp ? bp.replace(/-/g,' ') : ''; })() : '';
              return (
              <button
                disabled={disabled}
                aria-label={preppedLanding? 'Land' : 'Launch'}
                style={{
                  width:120,
                  height:120,
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
                onClick={()=>{ if(!disabled){
                  if(preppedLaunch){
                    const bp = preppedLaunch.blueprint;
                    finalizePreparedLaunch(economyState, preppedLaunch.id);
                    if (bp === 'orbital-tanker') {
                      // Consistent tanker launch label
                      addMitigationEvent({ kind:'LAUNCH', label:'Launched orbital tanker', simTimeSec: economyState.timeSec });
                    } else {
                      const isHabitat = bp === 'orbital-habitat';
                      addMitigationEvent({ kind:'LAUNCH', label:`Launched ${bp.replace(/-/g,' ')}`, simTimeSec:economyState.timeSec, highlight: isHabitat });
                    }
                  } else if(preppedLanding){
                    const bp = preppedLanding.blueprint;
                    deorbitItem(economyState, preppedLanding.id);
                    if (bp === 'orbital-tanker') {
                      // Consistent tanker landing label
                      addMitigationEvent({ kind:'DEORBIT', label:'Landed orbital tanker', simTimeSec: economyState.timeSec });
                    }
                  } else if (preppedActivation){
                    const bp = preppedActivation.blueprint;
                    const isImpactor = bp.includes('impactor');
                    activateItem(economyState, preppedActivation.id);
                    if (isImpactor) {
                      addMitigationEvent({ kind:'IMPACTOR_ACTIVATED', label:`Impactor activated (${bp.replace(/-/g,' ')})`, simTimeSec:economyState.timeSec, highlight:true });
                    }
                  }
                } }}
              >
                {!disabled && (
                  <>
                    <span style={{ fontSize:22, letterSpacing:1.5 }}>
                      {activationSearching ? 'SEARCHING' : (preppedLanding? 'DEORBIT' : (preppedLaunch ? 'LAUNCH' : 'ACTIVATE'))}
                    </span>
                    <span style={{ fontSize:10, marginTop:6, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', opacity:0.9, whiteSpace:'nowrap', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }}>
                      {activationSearching ? 'Searching flightpath…' : bpName}
                    </span>
                  </>
                )}
              </button>
              ); })()}
          </div>
        </div>
        <ImpactSimulationPanel />
      </div>
    </div>
  );
};

export default App;
