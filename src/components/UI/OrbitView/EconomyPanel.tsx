import React from 'react';
import { economyState } from '../../../solar_system/economy/state';
import { RESEARCH_DEFS, BLUEPRINTS, isUnlocked } from '../../../solar_system/economy/data';
import { startResearch, startBuild, launchItem } from '../../../solar_system/economy/actions';
import { GameEconomyState, LocationId } from '../../../solar_system/economy/models';

// Lightweight subscription (animation frame) to keep progress bars and timers live
const listeners = new Set<() => void>();
function notify() { for (const l of listeners) l(); }

function useEconomy(): GameEconomyState {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setTick(t => t + 1);
    listeners.add(cb);
    let raf: number;
    const loop = () => { raf = requestAnimationFrame(loop); setTick(t => t + 1); };
    loop();
    return () => { listeners.delete(cb); cancelAnimationFrame(raf); };
  }, []);
  return economyState;
}

export const EconomyPanel: React.FC = () => {
  const state = useEconomy();
  // Ground construct mode toggle
  const [constructMode, setConstructMode] = React.useState(false);
  // Command mode: which location panel is showing commands and for which item
  const [commandContext, setCommandContext] = React.useState<{ location: LocationId; itemId: string; mode: 'root' | 'transfer' } | null>(null);
  const researchInQueue = new Set(state.actions.filter(a => a.kind==='RESEARCH' && a.status==='PENDING').map(a => a.payload.researchId));
  const canStartResearch = (id: string) => !state.researchUnlocked.has(id as any) && !researchInQueue.has(id);
  const doResearch = (id: string) => { try { startResearch(state, id as any); notify(); } catch(e){ console.warn(e);} };
  const anyLaunchActive = state.actions.some(a => a.kind==='LAUNCH' && a.status==='PENDING');
  const anyPrepped = state.inventory.some(i=>i.state==='PREPPED_LAUNCH');
  // Show all research (completed stay in carousel)
  const allResearch = RESEARCH_DEFS;
  const anyResearchActive = state.actions.some(a => a.kind==='RESEARCH' && a.status==='PENDING');
  // Simple button-based carousel --------------------------------------------------------------
  const CARD_W = 170;                 // visual card width
  const SLOT_W = 70;                  // horizontal step between cards (smaller => more overlap)
  // SLOT_W is the per-index horizontal step; no separate CARD_FULL needed now.
  // Removed unused PAD_X
  const containerRef = React.useRef<HTMLDivElement | null>(null); // wraps buttons + viewport
  const viewportRef = React.useRef<HTMLDivElement | null>(null);  // visible scrolling area only
  const [viewportW, setViewportW] = React.useState(0);
  const [index, setIndex] = React.useState(0);
  React.useEffect(()=>{ setIndex(0); },[allResearch.length]);
  React.useEffect(()=>{
    const measure = () => { if (viewportRef.current) setViewportW(viewportRef.current.clientWidth); };
    measure();
    window.addEventListener('resize', measure);
    return ()=> window.removeEventListener('resize', measure);
  },[]);
  const maxIndex = Math.max(0, allResearch.length-1);
  const go = (dir:number) => setIndex(i=> Math.max(0, Math.min(maxIndex, i+dir)));
  // centerOffset/slotComp no longer needed with direct algebraic centering formula.
  // Deterministic centering with inner offset:
  // Visible card left = index*SLOT_W + (SLOT_W - CARD_W)/2.
  // Card center = index*SLOT_W + (SLOT_W - CARD_W)/2 + CARD_W/2 = index*SLOT_W + SLOT_W/2.
  // So translation X = viewportW/2 - (index*SLOT_W + SLOT_W/2)
  // Correct centering: card center = index*SLOT_W + SLOT_W/2
  const trackX = viewportW>0 ? (viewportW/2 - (index * SLOT_W - SLOT_W/2)) : 0;
  // ------------------------------------------------------------------------------------------

  const locOrder: LocationId[] = ['DEPLOYED','LEO'];
  const renderPanel = (locId: LocationId | 'GROUND') => {
    const isGround = locId === 'GROUND';
    const atLoc = state.inventory.filter(i => !isGround && i.location===locId && (i.state==='AT_LOCATION' || i.state==='ACTIVE_LOCATION' || i.state==='IN_TRANSFER'));
  const groundItems = state.inventory.filter(i=> (i.state==='BUILT' || i.state==='PREPPED_LAUNCH'));
    // If ground and in construct mode, show blueprint list instead of inventory
    if (isGround && constructMode) {
      const anyBuildActive = state.actions.some(a=>a.kind==='BUILD' && a.status==='PENDING');
      return (
  <div key="GROUND_CONSTRUCT" onMouseLeave={()=> setConstructMode(false)} style={{ flex:'1 1 0', minWidth:0, background:'#22303c', border:'1px solid #385166', boxShadow:'0 0 0 1px #2b3d4a inset, 0 0 12px -2px #2f4d61', borderRadius:4, padding:'4px 6px', display:'flex', flexDirection:'column', transition:'background 160ms, box-shadow 220ms' }}>
          <div style={{ fontSize:11, fontWeight:600, marginBottom:2, display:'flex', alignItems:'center', justifyContent:'space-between', letterSpacing:0.2, lineHeight:1 }}>
            <span style={{ lineHeight:1 }}>CONSTRUCT</span>
            <button onClick={()=>setConstructMode(false)} style={{ background:'none', border:'none', color:'#8aa3b8', fontSize:10, cursor:'pointer', padding:'1px 4px', lineHeight:1, opacity:0.85 }}>Back</button>
          </div>
          <div style={{ overflowY:'auto', fontSize:10, lineHeight:1.15, flex:1, marginTop:0 }}>
            {BLUEPRINTS.filter(bp => isUnlocked(state.researchUnlocked as any, bp.type)).map(bp => (
              <div key={bp.type} style={{ padding:'2px 3px 3px', background:'#253744', border:'1px solid #355062', borderRadius:3, marginBottom:3, display:'flex', flexDirection:'column', position:'relative', boxShadow:'0 0 0 1px #2a4352' }}>
                <div style={{ fontSize:10, fontWeight:600, marginBottom:3, textAlign:'center', letterSpacing:0.35 }}>{bp.name}</div>
                {(() => {
                  // Find if this blueprint currently building
                  const buildingItem = state.inventory.find(it => it.blueprint===bp.type && it.state==='BUILDING');
                  const buildAction = buildingItem ? state.actions.find(a=>a.kind==='BUILD' && a.status==='PENDING' && a.payload.itemId===buildingItem.id) : undefined;
                  const pct = buildAction ? Math.min(1,(state.timeSec - buildAction.startTime)/(buildAction.endTime - buildAction.startTime)) : 0;
                  const durDays = (bp.buildDurationSec/86400).toFixed(1)+'d';
                  const thisActive = !!buildAction;
                  const disabled = state.fundsBillion < bp.buildCostFunds || (anyBuildActive && !thisActive) || thisActive; // mutual exclusion
                  const labelMid = thisActive ? '...' : 'Build';
                  return (
                    <div style={{ position:'relative', display:'flex', flexDirection:'column' }}>
                      <button
                        disabled={disabled}
                        className="progress-btn"
                        onClick={()=>{ if(!disabled){ try { startBuild(state, bp.type); notify(); } catch(e){ console.warn(e);} } }}
                        style={{ marginTop:0, width:'100%', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'3px 4px', position:'relative', background:'#283744', border:'1px solid #345061', borderRadius:3, color:'#d4dde4', cursor:disabled?'default':'pointer', opacity:disabled?0.55:1 }}>
                        {thisActive && <div className="progress-fill" style={{ width:(pct*100)+'%', background:'linear-gradient(90deg,#34b4ff,#1485ff)' }} />}
                        <span style={{ minWidth:34, textAlign:'left' }} className="label-layer">{bp.buildCostFunds.toFixed(2)}B</span>
                        <span style={{ flex:1, textAlign:'center', fontWeight:600, letterSpacing:0.25 }} className="label-layer">{labelMid}</span>
                        <span style={{ minWidth:28, textAlign:'right' }} className="label-layer">{durDays}</span>
                      </button>
                      {/* Overlay if other build active */}
                      {anyBuildActive && !thisActive && (
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(14,20,27,0.78)', borderRadius:3, fontSize:8.5, fontWeight:600, letterSpacing:0.45, color:'#b9c6d4' }}>BUSY</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      );
    }
    // If this is a space location panel (LEO/DEPLOYED) and in command mode for an item here, show command panel
    if (!isGround && commandContext && commandContext.location === locId) {
      const item = state.inventory.find(i=>i.id===commandContext.itemId);
      const bp = item ? BLUEPRINTS.find(b=>b.type===item.blueprint) : undefined;
      // Transfer preview targets
      const otherLocation: LocationId = locId === 'LEO' ? 'DEPLOYED' : 'LEO';
      let transferFuelCost = 0; let transferDurationDays = 0; let canTransfer = false;
      if (item && (item.state==='AT_LOCATION' || item.state==='ACTIVE_LOCATION')) {
        // Inline lightweight preview replicating computeFuelCostForTransfer logic: mass * 0.6 if changing region else 0.1
        const mass = item.massTons;
        transferFuelCost = locId === otherLocation ? mass * 0.1 : mass * 0.6; // internal vs cross-region
        transferDurationDays = locId === otherLocation ? 7 : 60; // matches computeTransferDuration
        // Available fuel check
        const available = state.fuel[locId] - state.fuelReserved[locId];
  // item.state already narrowed to AT_LOCATION or ACTIVE_LOCATION here
  canTransfer = transferFuelCost <= available;
      }
  const activationFuel = bp?.activationFuelTons || 0;
  const activationDurationDays = bp?.activationDurationSec ? Math.max(bp.activationDurationSec, 7*24*3600)/86400 : 7; // ensure min week
  const canActivate = item && item.state==='AT_LOCATION' && bp && activationFuel <= (item.location ? (state.fuel[item.location]-state.fuelReserved[item.location]) : 0);
      // Lagrange point list for transfer menu
      const lagrangePoints = ['SE_L1','SE_L2','SE_L4','SE_L5'];
      return (
        <div key={locId} style={{ flex:'1 1 0', minWidth:0, background:'#1a222c', border:'1px solid #2a3644', borderRadius:4, padding:'4px 6px', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:11, fontWeight:600, marginBottom:2, display:'flex', alignItems:'center', justifyContent:'space-between', letterSpacing:0.2, lineHeight:1 }}>
            <span>{locId} {commandContext.mode==='transfer' ? 'TRANSFER' : 'COMMANDS'}</span>
            <div style={{ display:'flex', gap:4 }}>
              {commandContext.mode==='transfer' && <button onClick={()=>setCommandContext(ctx=> ctx ? { ...ctx, mode:'root'} : null)} style={{ background:'none', border:'none', color:'#8aa3b8', fontSize:10, cursor:'pointer', padding:'1px 4px', lineHeight:1 }}>Back</button>}
              <button onClick={()=>setCommandContext(null)} style={{ background:'none', border:'none', color:'#8aa3b8', fontSize:10, cursor:'pointer', padding:'1px 4px', lineHeight:1 }}>Close</button>
            </div>
          </div>
          {!item && <div style={{ fontSize:10, opacity:0.6 }}>Item not found.</div>}
          {item && bp && commandContext.mode==='root' && (
            <div style={{ fontSize:10, lineHeight:1.35, flex:1, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.4, textAlign:'center' }}>{bp.name}</div>
              {/* Activate button cost | label | duration */}
              <button disabled={!canActivate} onClick={()=>{ /* activation wiring later */ }} className="progress-btn" style={{ padding:'4px 6px', borderRadius:4, border:'1px solid #345061', background: canActivate? '#25323e' : '#1f2731', color: canActivate? '#d9e3ea' : '#7d8d99', fontWeight:600, letterSpacing:0.35, cursor:canActivate?'pointer':'default', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ minWidth:38, textAlign:'left' }} className="label-layer">{activationFuel.toFixed(1)}t</span>
                <span style={{ flex:1, textAlign:'center' }} className="label-layer">Activate</span>
                <span style={{ minWidth:28, textAlign:'right' }} className="label-layer">{activationDurationDays.toFixed(0)}d</span>
              </button>
              {/* Transfer button (opens transfer menu) cost | name | duration (generic cross-region preview) */}
              <button disabled={!canTransfer} onClick={()=> setCommandContext(ctx=> ctx ? { ...ctx, mode:'transfer'} : null)} className="progress-btn" style={{ padding:'4px 6px', borderRadius:4, border:'1px solid #345061', background: canTransfer? '#283744' : '#1f2731', color: canTransfer? '#d4dde4' : '#7d8d99', fontWeight:600, letterSpacing:0.35, cursor:canTransfer?'pointer':'default', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ minWidth:38, textAlign:'left' }} className="label-layer">{transferFuelCost.toFixed(1)}t</span>
                <span style={{ flex:1, textAlign:'center' }} className="label-layer">Transfer</span>
                <span style={{ minWidth:28, textAlign:'right' }} className="label-layer">{transferDurationDays}d</span>
              </button>
              <div style={{ marginTop:'auto', fontSize:9, opacity:0.55, textAlign:'center' }}>Select Transfer to choose a Lagrange point</div>
            </div>
          )}
          {item && bp && commandContext.mode==='transfer' && (
            <div style={{ fontSize:10, lineHeight:1.35, flex:1, display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.4, textAlign:'center', marginBottom:2 }}>Choose Destination Lagrange Point</div>
              {lagrangePoints.map(lp => {
                // For now assume same cost/duration as generic cross-region transfer
                const cost = transferFuelCost; const dur = transferDurationDays;
                return (
                  <button key={lp} disabled={!canTransfer} onClick={()=>{ /* schedule transfer later */ }} className="progress-btn" style={{ padding:'4px 6px', borderRadius:4, border:'1px solid #345061', background: canTransfer? '#283744' : '#1f2731', color: canTransfer? '#d4dde4' : '#7d8d99', fontWeight:600, letterSpacing:0.35, cursor:canTransfer?'pointer':'default', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ minWidth:38, textAlign:'left' }} className="label-layer">{cost.toFixed(1)}t</span>
                    <span style={{ flex:1, textAlign:'center' }} className="label-layer">{lp}</span>
                    <span style={{ minWidth:28, textAlign:'right' }} className="label-layer">{dur}d</span>
                  </button>
                );
              })}
              <div style={{ marginTop:'auto', fontSize:9, opacity:0.55, textAlign:'center' }}>More destinations later</div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div key={locId} style={{ flex:'1 1 0', minWidth:0, background:'#1a222c', border:'1px solid #2a3644', borderRadius:4, padding:'4px 6px', display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:11, fontWeight:600, marginBottom:2, display:'flex', alignItems:'center', justifyContent:'space-between', letterSpacing:0.2, lineHeight:1 }}>
          <span>{isGround ? 'GROUND' : locId}</span>
        </div>
  {/* Fuel display temporarily removed */}
        <div style={{ overflowY:'auto', fontSize:10, lineHeight:1.15, flex:1 }}>
          {(isGround ? groundItems : atLoc).map(it => {
            const bp = BLUEPRINTS.find(b=>b.type===it.blueprint)!;
            const tag = it.state === 'ACTIVE_LOCATION' ? ' (A)' : (it.state === 'IN_TRANSFER' ? ' (Xfer)' : '');
            const activeColor = it.state === 'ACTIVE_LOCATION' ? '#2ea84d' : (it.state === 'IN_TRANSFER' ? '#cfa640' : '#d4dde4');
            const launchAction = state.actions.find(a=>a.kind==='LAUNCH' && a.status==='PENDING' && a.payload.itemId===it.id);
            const launchPct = launchAction ? Math.min(1,(state.timeSec - launchAction.startTime)/(launchAction.endTime - launchAction.startTime)) : 0;
            const launchDurationDays = 7; // matches actions.ts launchDur comment (1 week)
            const launchDisabled = !isGround || it.state!=='BUILT' || state.fundsBillion < bp.launchCostFunds || (anyLaunchActive && !launchAction) || (anyPrepped && !launchAction);
            return (
              <div key={it.id} style={{
                marginBottom:3,
                padding:'2px 3px 3px',
                background:'#202b35',
                border:'1px solid #2d3a46',
                borderRadius:3,
                display:'flex',
                flexDirection:'row',
                alignItems:'center',
                gap:4,
                position:'relative',
                cursor: 'default'
              }}>
                <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
                  <div style={{ fontSize:10, fontWeight:600, letterSpacing:0.3, color:activeColor, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{bp.name}{tag}</div>
                  {isGround && (it.state==='BUILT' || it.state==='PREPPED_LAUNCH') && it.blueprint !== 'tsunami-dam-module' && (
                    <button
                      disabled={launchDisabled && it.state!=='PREPPED_LAUNCH'}
                      className="progress-btn"
                      onClick={(e)=>{ 
                        e.stopPropagation(); 
                        if(it.state==='PREPPED_LAUNCH') {
                          // Abort: revert to BUILT
                          it.state = 'BUILT';
                          notify();
                        } else if(!launchDisabled) {
                          try { launchItem(state, it.id); notify(); } catch(err){ console.warn(err);} 
                        }
                      }}
                      style={{ marginTop:2, width:'100%', fontSize:9.5, display:'flex', alignItems:'center', justifyContent: it.state==='PREPPED_LAUNCH' ? 'center' : 'space-between', padding:'3px 4px', position:'relative', background: it.state==='PREPPED_LAUNCH' ? '#3a1d1d' : '#283744', border: it.state==='PREPPED_LAUNCH' ? '1px solid #693232' : '1px solid #345061', borderRadius:3, color: it.state==='PREPPED_LAUNCH' ? '#ff6d6d' : '#d4dde4', cursor:(launchDisabled && it.state!=='PREPPED_LAUNCH')?'default':'pointer', opacity:(launchDisabled && it.state!=='PREPPED_LAUNCH')?0.55:1, fontWeight:600, letterSpacing:0.35, transition:'background 140ms, border-color 140ms, color 140ms' }}>
                      {launchAction && <div className="progress-fill" style={{ width:(launchPct*100)+'%', background:'linear-gradient(90deg,#34b4ff,#1485ff)' }} />}
                      {it.state==='PREPPED_LAUNCH' ? (
                        <span className="label-layer" style={{ position:'relative', zIndex:2, textTransform:'uppercase' }}>Abort Launch</span>
                      ) : (
                        <>
                          <span style={{ minWidth:34, textAlign:'left' }} className="label-layer">{bp.launchCostFunds.toFixed(2)}B</span>
                          <span style={{ flex:1, textAlign:'center', fontWeight:600, letterSpacing:0.25 }} className="label-layer">{launchAction ? '...' : 'Prep Launch'}</span>
                          <span style={{ minWidth:28, textAlign:'right' }} className="label-layer">{launchAction ? (launchPct>=1?'✓': (launchDurationDays.toFixed(0)+'d')) : launchDurationDays+'d'}</span>
                        </>
                      )}
                    </button>
                  )}
                  {!isGround && (
                <button onClick={()=> setCommandContext({ location: locId as LocationId, itemId: it.id, mode:'root' })} style={{ marginTop:2, width:'100%', fontSize:9.5, padding:'4px 6px', background:'#25323d', border:'1px solid #344652', borderRadius:3, color:'#c7d2da', fontWeight:600, letterSpacing:0.4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>Give Command</button>
                  )}
                </div>
                {isGround && it.state==='BUILT' && anyLaunchActive && !launchAction && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(10,15,22,0.65)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:3, fontSize:8.5, fontWeight:600, letterSpacing:0.45, color:'#b9c6d4' }}>BUSY</div>
                )}
              </div>
            );
          })}
          {(isGround ? groundItems : atLoc).length===0 && null}
          {isGround && BLUEPRINTS.some(bp => isUnlocked(state.researchUnlocked as any, bp.type)) && (()=>{
            const activeBuildAction = state.actions.find(a=>a.kind==='BUILD' && a.status==='PENDING');
            let pct = 0;
            if (activeBuildAction) {
              pct = Math.min(1,(state.timeSec - activeBuildAction.startTime)/(activeBuildAction.endTime - activeBuildAction.startTime));
            }
            return (
              <button
                className="progress-btn"
                style={{
                  marginTop:4,
                  width:'100%',
                  background:'#23303c',
                  border: activeBuildAction ? '1px solid #3d5668' : '1px dashed #3a4a56',
                  color:'#b8c7d4',
                  borderRadius:4,
                  padding:'4px 6px',
                  fontSize:11,
                  fontWeight:600,
                  cursor:'pointer',
                  letterSpacing:0.5,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  position:'relative',
                  overflow:'hidden'
                }}
                onClick={()=>setConstructMode(true)}
              >
                {activeBuildAction && <div className="progress-fill" style={{ width:(pct*100)+'%', background:'linear-gradient(90deg,#34b4ff,#1485ff)', opacity:0.8 }} />}
                <span className="label-layer" style={{ position:'relative', zIndex:2 }}>{activeBuildAction ? 'Building…' : '+ Construct'}</span>
              </button>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position:'absolute', inset:0, color:'#eee', font:'12px system-ui', display:'flex', flexDirection:'column', padding:'4px 0 0 0' }}>
      <div style={{ textAlign:'center', fontSize:14, fontWeight:600, letterSpacing:0.5, marginBottom:2 }}>Mission Control</div>
      <style>{`.progress-btn{position:relative;overflow:hidden}.progress-btn .progress-fill{position:absolute;top:0;left:0;bottom:0;background:rgba(61,178,255,0.25)}.progress-btn .label-layer{position:relative;z-index:2}`}</style>
      {/* Research Section Only (heading & funds removed) */}
      <div style={{ flex:'1 1 50%', minHeight:0, display:'flex', flexDirection:'column', marginBottom:0 }}>
  {allResearch.length === 0 && <div style={{ opacity:0.6, padding:'6px 0' }}>No research</div>}
  {allResearch.length > 0 && (
          <div ref={containerRef} style={{ position:'relative', flex:1, overflow:'visible', padding:'26px 0 26px', display:'flex', alignItems:'stretch' }}>
            {allResearch.length>1 && (
              <button onClick={()=>go(-1)} disabled={index===0} style={{ width:38, flex:'0 0 auto', marginRight:6, fontSize:20, background:'#1f2731', border:'1px solid #2d3a46', color:'#d0d7dd', borderRadius:6, cursor:index===0?'default':'pointer', position:'relative', zIndex:500 }}>◀</button>
            )}
            <div ref={viewportRef} style={{ position:'relative', flex:1, overflow:'visible' }}>
              <div style={{ position:'absolute', top:0, left:0, height:'100%', display:'flex', gap:0, transform:`translateX(${trackX}px)`, transition:'transform 320ms cubic-bezier(.22,.75,.3,1)' }}>
                {allResearch.map((r,idx)=>{
                  const inProg = state.actions.find(a => a.kind==='RESEARCH' && a.status==='PENDING' && a.payload.researchId===r.id);
                  const pct = inProg ? Math.min(1,(state.timeSec - inProg.startTime)/(inProg.endTime - inProg.startTime)) : 0;
                  const centerDist = Math.abs(idx - index);
                  // Dramatic scaling with stronger falloff while overlapping
                  const scale = Math.max(0.4, 1 - centerDist * 0.45);
                  // Overlap mode: no extra shift (spacing already reduced)
                  const shift = -16;
                  const glow = idx===index ? '0 0 0 1px #3ba7ff, 0 0 20px #3ba7ff80' : '0 0 0 1px #25303a';
                  const opacity = idx===index ? 1 : 0.55 + Math.max(0, 0.25 - centerDist * 0.1);
                  const z = 100 - centerDist; // keep center on top
                  // Each slot is narrower than the card; we offset the inner card so its center aligns with the slot center.
                  const innerOffset = (SLOT_W - CARD_W) / 2 + shift; // existing manual shift retained
                  // Locked prerequisites
                  const prereqs = (r as any).prereq as string[] | undefined;
                  const locked = prereqs ? !prereqs.every(p => state.researchUnlocked.has(p as any)) : false;
                  const completed = state.researchUnlocked.has(r.id as any);
                  // Disable when completed (nothing to do) or not selected OR queued OR insufficient funds OR another research active (unless this one is in progress)
                  const buttonDisabled = completed || locked || idx!==index || !canStartResearch(r.id) || state.fundsBillion < r.costFunds || (anyResearchActive && !inProg);
                  const showOverlay = (locked || (anyResearchActive && !inProg)) && !inProg && !completed;
                  return (
                    <div key={r.id} style={{ width:SLOT_W, flex:'0 0 auto', display:'flex', justifyContent:'center', position:'relative', zIndex:z }}>
                      <div style={{ width:CARD_W, flex:'0 0 auto', boxSizing:'border-box', transform:`translateX(${innerOffset}px) scale(${scale})`, transformOrigin:'center center', transition:'transform 360ms cubic-bezier(.22,.75,.3,1), opacity 280ms', background: completed? '#15391e' : '#1d2732', borderRadius:10, padding:'12px 10px 12px', display:'flex', flexDirection:'column', boxShadow: completed? '0 0 0 1px #2ea84d,0 0 18px #2ea84d55' : glow, opacity, position:'relative' }}>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textAlign:'center', width:'100%', color: completed? '#47d46a' : '#eee' }}>{r.name}</div>
                        <div style={{ flex:1 }} />
                        <button
                          disabled={buttonDisabled}
                          onClick={()=> doResearch(r.id)}
                          className="progress-btn"
                          style={{ marginTop:8, width:'100%', fontSize:11, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 6px', position:'relative', opacity:buttonDisabled?0.5:1 }}>
                          {inProg && <div className="progress-fill" style={{ width:(pct*100)+'%', background:'linear-gradient(90deg,#34b4ff,#1485ff)' }} />}
                          <span style={{ minWidth:42, textAlign:'left' }} className="label-layer">{r.costFunds.toFixed(2)}B</span>
                          <span style={{ flex:1, textAlign:'center', fontWeight:600, letterSpacing:0.3, color: completed? '#47d46a' : undefined }} className="label-layer">{completed ? 'Done' : (inProg ? '...' : 'Research')}</span>
                          <span style={{ minWidth:34, textAlign:'right', color: completed? '#47d46a' : undefined }} className="label-layer">{completed ? '✓' : (r.durationSec/86400).toFixed(1)+'d'}</span>
                        </button>
                        {showOverlay && (
                          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(10,15,22,0.78)', borderRadius:10, fontSize:10, lineHeight:1.3, textAlign:'center', padding:'6px 8px', color:'#b9c6d4' }}>
                            <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>{locked ? 'LOCKED' : 'BUSY'}</div>
                            {locked && prereqs && (()=>{ const rdef = RESEARCH_DEFS.find(rr=>rr.id===prereqs[0]); return <div style={{ opacity:0.75 }}>Research {rdef? rdef.name : prereqs[0].replace(/-/g,' ')} to unlock this</div>; })()}
                            {!locked && anyResearchActive && <div style={{ opacity:0.75 }}>Another research is in progress</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {allResearch.length>1 && (
              <button onClick={()=>go(1)} disabled={index===maxIndex} style={{ width:38, flex:'0 0 auto', marginLeft:6, fontSize:20, background:'#1f2731', border:'1px solid #2d3a46', color:'#d0d7dd', borderRadius:6, cursor:index===maxIndex?'default':'pointer', position:'relative', zIndex:500 }}>▶</button>
            )}
          </div>
        )}
      </div>
      {/* Bottom Half: Location Panels (divider removed) */}
      <div style={{ flex:'1 1 50%', minHeight:0, paddingTop:4, display:'flex', flexDirection:'row', gap:6, overflowX:'hidden' }}>
        {locOrder.map(l => renderPanel(l))}
        {renderPanel('GROUND')}
      </div>
    </div>
  );
};
export default EconomyPanel;
