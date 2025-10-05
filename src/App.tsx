
import React from 'react';
import { AsteroidInfo } from './components/UI/Hud/AsteroidInfo';
import WorldMapPanel from './components/UI/MapView/WorldMapPanel';
import EconomyPanel from './components/UI/OrbitView/EconomyPanel';
import SolarSystemPanel from './components/UI/OrbitView/SolarSystemPanel';
import { METEOR_UNO } from './solar_system/data/meteors';
import { activateItem, deorbitItem, finalizePreparedLaunch } from './solar_system/economy/actions';
import { ACTIVATION_SOLVER_POLL_INTERVAL_MS, IMPACTOR_FLIGHT_TIME_VARIANTS, IMPACTOR_NOMINAL_FLIGHT_TIME_SEC } from './solar_system/economy/balance';
import { economyState } from './solar_system/economy/state';
import { InterceptPath } from './solar_system/entities/Interceptor/InterceptPath';
import { ENTITIES } from './solar_system/state/entities';

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
      const preppedActivation = economyState.inventory.find(i=>i.state==='PREPPED_ACTIVATION');
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
                const tries = IMPACTOR_FLIGHT_TIME_VARIANTS.map(m=>IMPACTOR_NOMINAL_FLIGHT_TIME_SEC*m);
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
    <div>
      <div style={{ display:'flex',width:'100vw',height:'100vh',position:'absolute', overflow:'hidden',justifyContent:'center',flexDirection:'column',alignItems:'center',pointerEvents:'none'}}>
          <AsteroidInfo/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', gridTemplateRows: '50% 50%', width: '100vw', height: '100vh', margin: 0, background: '#121212', color: '#eee', fontFamily: 'system-ui, Arial, sans-serif', overflow: 'hidden', position:'relative' }}>
        {/* Funds overlay top center */}
        <div style={{ position:'absolute', top:6, left:'50%', transform:'translateX(-50%)', background:'rgba(24,34,44,0.9)', padding:'4px 10px 5px', border:'1px solid #2e4352', borderRadius:6, fontSize:12, fontWeight:600, letterSpacing:0.6, boxShadow:'0 2px 6px -2px #000, 0 0 0 1px #253643 inset', zIndex:1000 }}>
          Funds: {economyState.fundsBillion.toFixed(2)}B
        </div>
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
          {/* Middle fixed 200px panel with debug stacked above big button, both bottom-aligned */}
          <div style={{ width:200, minWidth:200, maxWidth:200, flex:'0 0 200px', borderRight:'1px solid #1d2530', background:'#141b22', position:'relative', display:'flex', flexDirection:'column', fontSize:11, lineHeight:1.25 }}>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'stretch', justifyContent:'flex-end', padding:'0 0 12px' }}>
              <div style={{ flex:'0 0 auto', padding:'6px 6px 4px', borderBottom:'1px solid #1d2530', fontWeight:600, letterSpacing:0.5, color:'#88b0c8' }}>Activation Solver</div>
              <div style={{ flex:'0 0 auto', padding:'4px 6px 6px', borderBottom:'1px solid #1d2530', minHeight:90 }}>
              {(() => {
                const preppedActivation = economyState.inventory.find(i=>i.state==='PREPPED_ACTIVATION');
                if (!preppedActivation) return <div style={{ opacity:0.5 }}>No impactor in activation prep.</div>;
                if (!preppedActivation.blueprint.includes('impactor')) return <div style={{ opacity:0.5 }}>Activation prep (non-impactor)</div>;
                const cache = preppedActivation.activationTrajectory;
                const now = Date.now();
                if (!cache) return <div style={{ color:'#bbb' }}>Status: <span style={{ color:'#d97717' }}>initializing…</span></div>;
                const age = (now - cache.checkedAt)/1000;
                const fmt = (v:number)=> {
                  if (!isFinite(v)) return 'NaN';
                  const av = Math.abs(v);
                  if (av>1000) return v.toFixed(1);
                  if (av>=0.01) return v.toFixed(3);
                  if (av===0) return '0';
                  return v.toExponential(2);
                };
                let depMag = 0; let metMag = 0;
                let ux = 0, uy = 0, uz = 0, azDeg = 0, elDeg = 0;
                if (cache.depVel) {
                  const [vx, vy, vz] = cache.depVel;
                  depMag = Math.sqrt(vx*vx + vy*vy + vz*vz);
                  if (depMag > 0) {
                    ux = vx/depMag; uy = vy/depMag; uz = vz/depMag;
                    azDeg = (Math.atan2(vy, vx) * 180/Math.PI + 360) % 360; // 0° = +X axis
                    const horiz = Math.sqrt(vx*vx + vy*vy);
                    elDeg = Math.atan2(vz, horiz) * 180/Math.PI; // elevation above XY plane
                  }
                }
                if (cache.meteorDelta) metMag = Math.sqrt(cache.meteorDelta[0]**2 + cache.meteorDelta[1]**2 + cache.meteorDelta[2]**2);
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    <div>Status: {cache.viable ? <span style={{ color:'#3ecf5e' }}>VIABLE</span> : <span style={{ color:'#d97717' }}>SEARCHING</span>}</div>
                    <div>Last Check: {fmt(age)}s ago</div>
                    {cache.flightTimeSec && <div>Flight Time: {(cache.flightTimeSec/86400).toFixed(1)} d</div>}
                    {cache.depVel && <div>Dep |v|: {fmt(depMag)}</div>}
                    {cache.depVel && <div style={{ whiteSpace:'nowrap' }}>V: {cache.depVel.map(v=>fmt(v)).join(' ')}</div>}
                    {cache.depVel && <div style={{ whiteSpace:'nowrap' }}>Û: {fmt(ux)} {fmt(uy)} {fmt(uz)}</div>}
                    {cache.depVel && <div>Az/Elev: {fmt(azDeg)}° / {fmt(elDeg)}°</div>}
                    {cache.meteorDelta && <div>Δv meteor: {fmt(metMag)}</div>}
                    <div style={{ opacity:0.6 }}>Poll {ACTIVATION_SOLVER_POLL_INTERVAL_MS/1000}s</div>
                  </div>
                );
              })()}
              </div>
              {/* Projectile debug list */}
              <div style={{ flex:'0 0 auto', padding:'4px 6px 6px', borderBottom:'1px solid #1d2530', maxHeight:130, overflowY:'auto' }}>
              {(() => {
                // Collect interceptor projectiles
                const projs: any[] = ENTITIES.filter(e=> (e as any).constructor && (e as any).constructor.name === 'InterceptorProjectile') as any[];
                if (projs.length===0) return <div style={{ opacity:0.5 }}>No projectiles in flight.</div>;
                const rows = projs.map(p=>{
                  const pos = (p as any).position; const vel = (p as any).velocity; const ft = (p as any).flightTime; const el = (p as any).elapsed || 0;
                  const speed = Math.sqrt(vel.x*vel.x+vel.y*vel.y+vel.z*vel.z);
                  const pct = ft>0 ? Math.min(100, (el/ft)*100) : 0;
                  const numFmt = (v:number)=>{
                    const av=Math.abs(v); if(av>=0.01) return v.toFixed(3); if(av===0) return '0'; return v.toExponential(2);
                  };
                  const rmag = Math.sqrt(pos.x*pos.x+pos.y*pos.y+pos.z*pos.z);
                  return <div key={p.id} style={{ marginBottom:3 }}>
                    <div style={{ color:'#89c5ff' }}>{p.id}</div>
                    <div style={{ whiteSpace:'nowrap' }}>r: {numFmt(pos.x)} {numFmt(pos.y)} {numFmt(pos.z)}</div>
                    <div style={{ whiteSpace:'nowrap' }}>|r|: {numFmt(rmag)}</div>
                    <div style={{ whiteSpace:'nowrap' }}>v: {numFmt(vel.x)} {numFmt(vel.y)} {numFmt(vel.z)}</div>
                    <div style={{ whiteSpace:'nowrap' }}>|v|: {numFmt(speed)}  t: {el.toFixed(1)}/{ft.toFixed(1)}s ({pct.toFixed(1)}%)</div>
                  </div>;
                });
                return <div>{rows}</div>;
              })()}
              </div>
              {/* Big red activation / launch button bottom-aligned */}
              <div style={{ flex:'0 0 auto', display:'flex', alignItems:'flex-end', justifyContent:'center', paddingTop:10 }}>
              {(() => {
                const preppedLaunch = economyState.inventory.find(i=>i.state==='PREPPED_LAUNCH');
                const preppedLanding = economyState.inventory.find(i=>i.state==='PREPPED_LANDING');
                const preppedActivation = economyState.inventory.find(i=>i.state==='PREPPED_ACTIVATION');
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
                  onClick={()=>{ if(!disabled){ if(preppedLaunch){ finalizePreparedLaunch(economyState, preppedLaunch.id); } else if(preppedLanding){ deorbitItem(economyState, preppedLanding.id); } else if (preppedActivation){ activateItem(economyState, preppedActivation.id); } } }}
                >
                  {!disabled && (
                    <>
                      <span style={{ fontSize:22, letterSpacing:1.5 }}>
                        {activationSearching ? 'SEARCHING' : (preppedLanding? 'DEORBIT' : (preppedLaunch ? 'LAUNCH' : 'ACTIVATE'))}
                      </span>
                      <span style={{ fontSize:10, marginTop:6, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', opacity:0.9, whiteSpace:'nowrap', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }}>
                        {activationSearching ? 'Searching flightpath…' : (preppedLanding? 'Deorbit ' : (preppedLaunch? 'Launch ' : 'Activate ')) + bpName}
                      </span>
                    </>
                  )}
                </button>
                ); })()}
              </div>
            </div>
          </div>
          {/* Bottom Right: Future panel placeholder */}
          <div style={{ position:'relative', flex:'1 1 auto' }}>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, opacity:0.5 }}>Reserved</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
