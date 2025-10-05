import React from 'react';
import { economyState } from '../../../solar_system/economy/state';
import { RESEARCH_DEFS, BLUEPRINTS, isUnlocked } from '../../../solar_system/economy/data';
import { startResearch, startBuild, transferFuelBetweenCraft, prepareLanding, abortPrep, transferObject, launchItem, abortPrep as abortLaunchPrep, prepareActivation, activateItem } from '../../../solar_system/economy/actions';
import * as econActs from '../../../solar_system/economy/actions';
import { LaserWeapon } from '../../../solar_system/entities/LaserWeapon';
import { ENTITIES, registerEntity as registerSimEntity } from '../../../solar_system/state/entities';
import { GameEconomyState, LocationId } from '../../../solar_system/economy/models';
import { computeLaunchCostFunds, computeLaunchPrepDurationSec } from '../../../solar_system/economy/balance';

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

// Helper component logic extracted to reuse in grouping
function InventoryRow(props:{ it:any; isGround:boolean; locId:LocationId; setCommandContext: any }) {
  const { it, isGround, locId, setCommandContext } = props;
  const bp = BLUEPRINTS.find(b=>b.type===it.blueprint)!;
  // Global single-prep lock (launch, landing, activation)
  const globalPrepLock = economyState.actions.some(a=> (a.kind==='LAUNCH' || a.kind==='LAND' || a.kind==='ACTIVATE_PREP' || a.kind==='ABORT_PREP') && a.status==='PENDING')
    || economyState.inventory.some(i=> i.state==='PREPPED_LAUNCH' || i.state==='PREPPED_LANDING' || i.state==='PREPPED_ACTIVATION');
  const tag = '';// removed active suffix per request
  const activeColor = it.state === 'ACTIVE_LOCATION' ? '#2ea84d' : (it.state === 'IN_TRANSFER' ? '#cfa640' : '#d4dde4');
  const clickable = !isGround; // space items enter command panel
  return (
    <div key={it.id}
      onClick={()=>{ if(clickable) setCommandContext({ location: locId as LocationId, itemId: it.id, mode:'root' }); }}
      style={{
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
        cursor: clickable ? 'pointer' : 'default'
      }}>
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', position:'relative' }}>
  <div style={{ fontSize:10, fontWeight:600, letterSpacing:0.3, color:activeColor, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', position:'relative' }}>{bp.name}{tag}
          {it.state==='IN_TRANSFER' && it.transfer && (
            <span style={{ marginLeft:4, fontSize:9, fontWeight:600, color:'#cfa640' }}>→ { (it.transfer as any).destination==='IMPACT' ? 'Impact' : it.transfer.destination }</span>
          )}
        </div>
  {( (bp as any).type!=='tsunami-dam-module') && (bp.type!=='orbital-habitat') && !isGround && it.fuelCapacityTons !== undefined && it.state!=='IN_TRANSFER' && (()=> {
          const fuelNow = (it.fuelTons||0); const cap = (it.fuelCapacityTons||1); const ratio = Math.max(0, Math.min(1, fuelNow/cap));
          const r = Math.round(0x40 + (0xff-0x40)*ratio); const g = Math.round(0x29 + (0x9b-0x29)*ratio); const b = Math.round(0x15 + (0x2f-0x15)*ratio);
          const color = `rgb(${r},${g},${b})`;
          return (
            <div style={{ position:'absolute', top:0, right:0, display:'flex', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:9, fontWeight:600, color:'#c9c0b8', letterSpacing:0.3 }}>{fuelNow.toFixed(1)}t</span>
              <div style={{ position:'relative', width:28, height:10, border:'1px solid #4e3a27', borderRadius:2, background:'#0f151b', boxShadow:'0 0 0 1px #23170f inset' }}>
                <div style={{ position:'absolute', top:1, bottom:1, left:1, width: ratio*(28-2), background: color, borderRadius:1, transition:'width 220ms, background-color 220ms' }} />
              </div>
            </div>
          );
        })()}
        {it.state==='IN_TRANSFER' && it.transfer && (()=> {
          const tr = it.transfer as any;
            const arrivalSim = tr.arrivalTime as number;
            const departureSim = tr.departureTime as number;
            const totalSim = Math.max(1, arrivalSim - departureSim);
            const nowSim = economyState.timeSec;
            const progressSim = totalSim>0 ? (nowSim - departureSim)/totalSim : 0;
            const realDep = tr.realDepartureMs as number | undefined;
            const realArr = tr.realArrivalMs as number | undefined;
            const nowMs = Date.now();
            let progressReal = 0;
            if (realDep && realArr && realArr>realDep) progressReal = (nowMs - realDep)/(realArr - realDep);
            const progress = Math.max(0, Math.min(1, Math.max(progressSim, progressReal)));
            return (
              <div style={{ position:'absolute', inset:0, zIndex:-1, overflow:'hidden', borderRadius:3 }}>
                <div style={{ position:'absolute', top:0, bottom:0, left:0, width:(progress*100)+'%', background:'linear-gradient(90deg,#33404a,#566b79)', opacity:0.42, transition:'width 1.2s linear' }} />
              </div>
            );
        })()}
        {/* Additional inline buttons (abort landing / launch prep) retained from original UI only for ground or landing states */}
  {isGround && (it.state==='BUILT' || it.state==='PREPPED_LAUNCH') && (bp as any).type!=='tsunami-dam-module' && (()=> {
          const launchAction = economyState.actions.find(a=> a.kind==='LAUNCH' && a.status==='PENDING' && a.payload.itemId===it.id);
          const abortAction = economyState.actions.find(a=> a.kind==='ABORT_PREP' && a.status==='PENDING' && a.payload.itemId===it.id && a.payload.target==='LAUNCH');
          const isPrepping = !!launchAction; const isPrepped = it.state==='PREPPED_LAUNCH'; const isAborting = !!abortAction;
          const disabled = (isPrepping && !isPrepped) || isAborting || (!isPrepped && !isPrepping && globalPrepLock && !isAborting);
          const activeAct = (isPrepping && !isPrepped) ? launchAction : (isAborting ? abortAction : null);
          const pct = activeAct ? Math.min(1, Math.max(0, (economyState.timeSec - activeAct.startTime)/(activeAct.endTime - activeAct.startTime))) : 0;
          const label = isPrepped ? (isAborting? '...' : 'ABORT LAUNCH') : (isPrepping? '...' : 'Prep Launch');
          return (
            <div style={{ marginTop:4, display:'flex', gap:4 }}>
              <button
                disabled={disabled}
                onClick={(e)=> { e.stopPropagation(); try { if(isPrepped){ if(!isAborting) { abortLaunchPrep(economyState, it.id, 'LAUNCH'); notify(); } } else if(!isPrepping && !globalPrepLock){ launchItem(economyState, it.id); notify(); } } catch(err){ console.warn(err);} }}
                className='progress-btn'
                style={{ flex:1, padding:'3px 4px', borderRadius:3, border:'1px solid '+(isPrepped? '#7a2d2d':'#345061'), background:isPrepped? '#411b1b':'#25323e', color:isPrepped? '#ff7878':'#d9e3ea', fontWeight:600, letterSpacing:0.35, cursor:disabled? 'default':'pointer', fontSize:9, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', overflow:'hidden', opacity:disabled?0.6:1 }}>
                { ((isPrepping && !isPrepped) || isAborting) && <div className='progress-fill' style={{ width:(pct*100)+'%', background:isPrepped? 'linear-gradient(90deg,#ff9898,#ff5a5a)' : 'linear-gradient(90deg,#4aa9ff,#1485ff)', opacity:0.85 }} /> }
                {(()=>{ const wet = it.massTons + (it.fuelCapacityTons||0); return (
                  <span style={{ minWidth:20, textAlign:'left' }} className='label-layer'>{isPrepped? '' : (isPrepping? '' : (Math.ceil(computeLaunchPrepDurationSec(wet)/86400)+'d'))}</span>
                ); })()}
                <span style={{ flex:1, textAlign:'center' }} className='label-layer'>{label}</span>
                {(()=>{ const wet = it.massTons + (it.fuelCapacityTons||0); return (
                  <span style={{ minWidth:30, textAlign:'right', opacity:isPrepped?0:1 }} className='label-layer'>{isPrepped? '' : (computeLaunchCostFunds(wet).toFixed(2)+'B')}</span>
                ); })()}
              </button>
            </div>
          );
        })()}
        {/* Dam modules have no launch button; no badge shown per request */}
        {/* Inline Turn Off for active space telescope (instant toggle) */}
        {bp.type==='space-telescope' && it.state==='ACTIVE_LOCATION' && (
          <div style={{ marginTop:4, display:'flex' }}>
            <button
              onClick={(e)=> { e.stopPropagation(); try { econActs.deactivateItem(economyState, it.id); notify(); } catch(err){ console.warn(err);} }}
              className='progress-btn'
              style={{ flex:1, padding:'3px 4px', borderRadius:3, border:'1px solid #2d4b5c', background:'#20323d', color:'#d9e3ea', fontWeight:600, letterSpacing:0.35, cursor:'pointer', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
              Turn Off
            </button>
          </div>
        )}
        {/* Inline OFF toggle for active laser platform */}
        {!isGround && bp.type==='laser-platform' && it.state==='ACTIVE_LOCATION' && (()=> {
          const meteor = ENTITIES.find(e => (e as any).id && (e as any).id.startsWith('meteor')) as any;
          const allowedLocs: Record<string,string> = { 'SE_L1':'sun-earth-L1','SE_L3':'sun-earth-L3','SE_L4':'sun-earth-L4','SE_L5':'sun-earth-L5' };
            const loc = it.location as string | undefined;
            const sourceId = loc ? allowedLocs[loc] : undefined;
          const beamId = 'laser-beam-' + it.id;
          let beam = ENTITIES.find(e => (e as any).id === beamId) as any as LaserWeapon | undefined;
          const canToggle = !!beam || (!!meteor && !!sourceId);
          const onClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (beam && (beam as any).destroy && sourceId && (beam as any).sourceId !== sourceId) { (beam as any).destroy(); beam = undefined; }
            if (!beam && meteor && sourceId) { beam = new LaserWeapon(beamId, sourceId, meteor.id); registerSimEntity(beam); }
            if (beam) { beam.setActive(false); }
            it.state = 'AT_LOCATION';
            notify();
          };
          return (
            <div style={{ marginTop:4, display:'flex', gap:4 }}>
              <button onClick={onClick} disabled={!canToggle} className='progress-btn' style={{ flex:1, padding:'3px 4px', borderRadius:3, border:'1px solid #365036', background:'#1f2f1f', color:'#7dff7d', fontWeight:600, letterSpacing:0.35, cursor:canToggle? 'pointer':'default', fontSize:9, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', overflow:'hidden', opacity:canToggle?1:0.55 }}>
                <span style={{ minWidth:20, textAlign:'left' }} className='label-layer'></span>
                <span style={{ flex:1, textAlign:'center' }} className='label-layer'>Turn Off</span>
                <span style={{ minWidth:30, textAlign:'right', opacity:0.6 }} className='label-layer'></span>
              </button>
            </div>
          );
        })()}
        {!isGround && (bp.type==='small-impactor'||bp.type==='large-impactor'||bp.type==='giant-impactor') && (()=> {
          // Inline display ONLY for Abort Activation (after prep completes or during abort). Prep lives in command submenu.
          if (it.state==='IN_TRANSFER') return null;
          const abortAct = economyState.actions.find(a=> a.kind==='ABORT_PREP' && a.status==='PENDING' && a.payload.itemId===it.id && a.payload.target==='ACTIVATION');
          const isPrepped = it.state==='PREPPED_ACTIVATION';
          const isAborting = !!abortAct;
          if (!isPrepped && !isAborting) return null; // hide unless we have something to abort
          const activeAct = isAborting ? abortAct : null;
          const pct = activeAct ? Math.min(1, Math.max(0,(economyState.timeSec - activeAct.startTime)/(activeAct.endTime - activeAct.startTime))) : 0;
          return (
            <div style={{ marginTop:4, display:'flex', gap:4 }}>
              <button
                disabled={isAborting}
                onClick={(e)=> { e.stopPropagation(); try { if(isPrepped && !isAborting){ abortPrep(economyState, it.id, 'ACTIVATION'); notify(); } } catch(err){ console.warn(err);} }}
                className='progress-btn'
                style={{ flex:1, padding:'3px 4px', borderRadius:3, border:'1px solid #7a2d2d', background:'#411b1b', color:'#ff7878', fontWeight:600, letterSpacing:0.35, cursor:isAborting? 'default':'pointer', fontSize:9, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', overflow:'hidden', opacity:isAborting?0.75:1 }}>
                { isAborting && <div className='progress-fill' style={{ width:(pct*100)+'%', background:'linear-gradient(90deg,#ff9898,#ff5a5a)', opacity:0.85 }} /> }
                <span style={{ minWidth:20, textAlign:'left' }} className='label-layer'></span>
                <span style={{ flex:1, textAlign:'center' }} className='label-layer'>{isAborting? '...' : 'ABORT ACTIVATION'}</span>
                <span style={{ minWidth:30, textAlign:'right', opacity:0 }} className='label-layer'></span>
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export const EconomyPanel: React.FC = () => {
  const state = useEconomy();
  // Ground construct mode toggle
  const [constructMode, setConstructMode] = React.useState(false);
  // Command mode: which location panel is showing commands and for which item
  const [commandContext, setCommandContext] = React.useState<{ location: LocationId; itemId: string; mode: 'root' | 'transfer' | 'relocate' } | null>(null);
  const researchInQueue = new Set(state.actions.filter(a => a.kind==='RESEARCH' && a.status==='PENDING').map(a => a.payload.researchId));
  const canStartResearch = (id: string) => !state.researchUnlocked.has(id as any) && !researchInQueue.has(id);
  const doResearch = (id: string) => { try { startResearch(state, id as any); notify(); } catch(e){ console.warn(e);} };
  const anyLaunchActive = state.actions.some(a => a.kind==='LAUNCH' && a.status==='PENDING');
  const anyLandingActive = state.actions.some(a => a.kind==='LAND' && a.status==='PENDING');
  const anyActivationPrepActive = state.actions.some(a => a.kind==='ACTIVATE_PREP' && a.status==='PENDING');
  const anyAbortActive = state.actions.some(a => a.kind==='ABORT_PREP' && a.status==='PENDING');
  const anyPrepActive = anyLaunchActive || anyLandingActive || anyActivationPrepActive || anyAbortActive;
  const anyLaunchPrepped = state.inventory.some(i=>i.state==='PREPPED_LAUNCH');
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
  const atLoc = state.inventory.filter(i => {
    if (isGround) return false;
    const eligibleState = (i.state==='AT_LOCATION' || i.state==='ACTIVE_LOCATION' || i.state==='IN_TRANSFER' || i.state==='PREPPED_LANDING' || i.state==='PREPPED_ACTIVATION');
    if (!eligibleState) return false;
    if (locId === 'LEO') {
      // LEO panel should only show items actually at LEO and not en route to a Lagrange point
      if (i.state==='IN_TRANSFER' && i.transfer && i.transfer.destination !== 'LEO') return false; // migrating away -> show in DEPLOYED
      return i.location === 'LEO';
    }
    // DEPLOYED panel aggregates any non-LEO space locations and all in-transfer items heading to non-LEO
    if (i.state==='IN_TRANSFER' && i.transfer) {
      // Show all in-transfer items (both outbound from LEO and inbound to LEO) under DEPLOYED 'En Route' group.
      return true;
    }
    return i.location !== 'LEO' && i.location !== undefined; // stationed at any Lagrange region
  });
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
                        onClick={()=>{ if(!disabled){ try { startBuild(state, bp.type); setConstructMode(false); notify(); } catch(e){ console.warn(e);} } }}
                        style={{ marginTop:0, width:'100%', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'3px 4px', position:'relative', background:'#283744', border:'1px solid #345061', borderRadius:3, color:'#d4dde4', cursor:disabled?'default':'pointer', opacity:disabled?0.55:1 }}>
                        {thisActive && <div className="progress-fill" style={{ width:(pct*100)+'%', background:'linear-gradient(90deg,#34b4ff,#1485ff)' }} />}
                        <span style={{ minWidth:28, textAlign:'left' }} className="label-layer">{durDays}</span>
                        <span style={{ flex:1, textAlign:'center', fontWeight:600, letterSpacing:0.25 }} className="label-layer">{labelMid}</span>
                        <span style={{ minWidth:34, textAlign:'right' }} className="label-layer">{bp.buildCostFunds.toFixed(2)}B</span>
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
  // Simple otherLocation preview variable removed (legacy LEO<->DEPLOYED). Adjacency routes handled in submenu.
      // Legacy simple LEO<->DEPLOYED transfer preview removed; adjacency-based submenu now computes per-route costs directly.
  const activationFuel = bp?.activationFuelTons || 0;
  const activationDurationDays = bp?.activationDurationSec ? Math.max(bp.activationDurationSec, 7*24*3600)/86400 : 7; // ensure min week
  const canActivate = item && item.state==='AT_LOCATION' && bp && activationFuel <= (item.fuelTons||0);
      // Lagrange point list for transfer menu
  const isTanker = bp?.type === 'orbital-tanker';
  // Tanker specific: entering transfer fuel selection mode instead of generic activation
  const otherCraftSameLoc = item && item.location ? state.inventory.filter(o => o.id!==item.id && o.location===item.location && (o.state==='AT_LOCATION' || o.state==='ACTIVE_LOCATION')) : [];
  const isTransferMode = commandContext.mode==='transfer' || commandContext.mode==='relocate';
      return (
  <div key={locId} onMouseLeave={()=> setCommandContext(null)} style={{ flex:'1 1 0', minWidth:0, background: isTransferMode? '#294454' : '#22303c', border:'1px solid '+(isTransferMode?'#426d80':'#385166'), boxShadow: isTransferMode? '0 0 0 1px #335363 inset, 0 0 14px -2px #3d6f82' : '0 0 0 1px #2b3d4a inset, 0 0 12px -2px #2f4d61', borderRadius:4, padding:'4px 6px', display:'flex', flexDirection:'column', transition:'background 160ms, box-shadow 220ms', overflow:'hidden' }}>
          <div style={{ fontSize:11, fontWeight:600, marginBottom:2, display:'flex', alignItems:'center', justifyContent:'space-between', letterSpacing:0.2, lineHeight:1 }}>
            <span>{locId} {isTransferMode ? (isTanker ? (commandContext.mode==='transfer' ? 'FUEL TRANSFER' : 'CHANGE LOCATION') : 'TRANSFER') : 'COMMANDS'}</span>
            <button onClick={()=>{
              if(isTransferMode) {
                // Back from transfer to root (tanker or non-tanker)
                setCommandContext(ctx=> ctx ? { ...ctx, mode:'root'} : null);
              } else {
                // Close panel entirely
                setCommandContext(null);
              }
            }} style={{ background:'none', border:'1px solid #3b5466', color:'#8aa3b8', fontSize:10, cursor:'pointer', padding:'2px 8px', lineHeight:1, borderRadius:3 }}>Back</button>
          </div>
          {!item && <div style={{ fontSize:10, opacity:0.6 }}>Item not found.</div>}
          {item && bp && commandContext.mode==='root' && !isTanker && (
            <div style={{ fontSize:10, lineHeight:1.35, flex:1, display:'flex', flexDirection:'column', gap:6, overflowY:'auto', minHeight:0, paddingRight:2 }}>
              {/* Info panel: name, masses single line, large fuel bar */}
              <div style={{ background:'#1b2630', border:'1px solid #31414f', borderRadius:4, padding:'4px 6px 5px', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.45, textAlign:'center', color:'#d8e3ea' }}>{bp.name}</div>
                {bp.type==='orbital-habitat' ? null : (() => {
                  const fuelNow = (item.fuelTons||0);
                  const cap = (item.fuelCapacityTons||0);
                  const wet = bp.massTons + fuelNow;
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ display:'flex', justifyContent:'center', gap:14, fontSize:9.5, fontWeight:600, letterSpacing:0.45, color:'#b9c9d6' }}>
                        <span>Dry {bp.massTons.toFixed(1)} t</span>
                        <span>Total {wet.toFixed(1)} t</span>
                      </div>
                      <div style={{ position:'relative', height:18, border:'1px solid #4e3a27', background:'#0f161c', borderRadius:4, boxShadow:'0 0 0 1px #23170f inset' }}>
                        {(() => { const ratio = cap>0? Math.max(0, Math.min(1, fuelNow/cap)) : 0; const r = Math.round(0x40 + (0xff-0x40)*ratio); const g = Math.round(0x29 + (0x9b-0x29)*ratio); const b = Math.round(0x15 + (0x2f-0x15)*ratio); const color = `rgb(${r},${g},${b})`; return <div style={{ position:'absolute', top:1, bottom:1, left:1, width:(ratio*100)+'%', background: color, borderRadius:3, transition:'width 300ms, background-color 300ms' }} />; })()}
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 6px', fontSize:9.5, fontWeight:600, letterSpacing:0.4, color:'#d5e2ec' }}>
                          <span style={{ textShadow:'0 0 4px #000' }}>{fuelNow.toFixed(1)} t</span>
                          <span style={{ opacity:0.85, textShadow:'0 0 4px #000' }}>{cap.toFixed(1)} t</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* Prep Launch / Abort Launch Prep button only for ground-built items (command panel) except dam modules */}
              {(bp as any).type!=='tsunami-dam-module' && (item.state==='BUILT' || item.state==='PREPPED_LAUNCH') ? (()=> {
                const launchAction = state.actions.find(a=> a.kind==='LAUNCH' && a.status==='PENDING' && a.payload.itemId===item.id);
                const abortAction = state.actions.find(a=> a.kind==='ABORT_PREP' && a.status==='PENDING' && a.payload.itemId===item.id && a.payload.target==='LAUNCH');
                const isPrepping = !!launchAction;
                const isPrepped = item.state==='PREPPED_LAUNCH';
                const isAborting = !!abortAction;
                const globalLock = state.actions.some(a=> (a.kind==='LAUNCH'||a.kind==='LAND'||a.kind==='ACTIVATE_PREP'||a.kind==='ABORT_PREP') && a.status==='PENDING') || state.inventory.some(i=> i.state==='PREPPED_LAUNCH'||i.state==='PREPPED_LANDING'||i.state==='PREPPED_ACTIVATION');
                const disabled = (isPrepping && !isPrepped) || isAborting || (!isPrepped && !isPrepping && globalLock);
                const activeAct = (isPrepping && !isPrepped) ? launchAction : (isAborting ? abortAction : null);
                const pct = activeAct ? Math.min(1, Math.max(0, (state.timeSec - activeAct.startTime)/(activeAct.endTime - activeAct.startTime))) : 0;
                const label = isPrepped ? (isAborting? '...' : 'ABORT LAUNCH') : (isPrepping ? '...' : 'Prep Launch');
                return (
                  <button
                    className='progress-btn'
                    disabled={disabled}
                    onClick={()=> {
                      try {
                        if (isPrepped) { if(!isAborting) { abortLaunchPrep(state, item.id, 'LAUNCH'); notify(); } }
                        else if (!isPrepping && !globalLock) { launchItem(state, item.id); notify(); }
                      } catch(e){ console.warn(e); }
                    }}
                    style={{ padding:'4px 6px', borderRadius:4, border:'1px solid '+(isPrepped? '#7a2d2d':'#345061'), background:isPrepped? '#411b1b':'#25323e', color:isPrepped? '#ff7878':'#d9e3ea', fontWeight:600, letterSpacing:0.35, cursor:disabled? 'default':'pointer', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', overflow:'hidden', opacity:disabled?0.6:1 }}>
                    { (isPrepping && !isPrepped) || isAborting ? <div className='progress-fill' style={{ width:(pct*100)+'%', background:isPrepped? 'linear-gradient(90deg,#ff9898,#ff5a5a)' : 'linear-gradient(90deg,#4aa9ff,#1485ff)', opacity:0.8 }} /> : null }
                    {(()=>{ const wet = item.massTons + (item.fuelCapacityTons||0); return (
                      <span style={{ minWidth:28, textAlign:'left' }} className='label-layer'>{isPrepped? (isAborting? '' : '') : (isPrepping? '' : (Math.ceil(computeLaunchPrepDurationSec(wet)/86400)+'d'))}</span>
                    ); })()}
                    <span style={{ flex:1, textAlign:'center' }} className='label-layer'>{label}</span>
                    {(()=>{ const wet = item.massTons + (item.fuelCapacityTons||0); return (
                      <span style={{ minWidth:38, textAlign:'right', opacity: isPrepped? 0 : 1 }} className='label-layer'>{isPrepped? '' : (computeLaunchCostFunds(wet).toFixed(2)+'B')}</span>
                    ); })()}
                  </button>
                );
              })() : null}
              {/* No launch controls or hint for dam module */}
              {/* Activation / Prep Activation logic (refactored for clarity) */}
              {(() => {
                if (bp.type==='orbital-habitat') return null;

                if (bp.type==='laser-platform') {
                  // Laser platform: On/Off toggle allowed only at L1, L3, L4, L5
                  const isActive = item.state === 'ACTIVE_LOCATION';
                  const meteor = ENTITIES.find(e => (e as any).id && (e as any).id.startsWith('meteor')) as any;
                  const allowedLocs: Record<string,string> = { 'SE_L1':'sun-earth-L1','SE_L3':'sun-earth-L3','SE_L4':'sun-earth-L4','SE_L5':'sun-earth-L5' };
                  const loc = item.location as string | undefined;
                  const sourceId = loc ? allowedLocs[loc] : undefined;
                  const beamId = 'laser-beam-' + item.id;
                  let beam = ENTITIES.find(e => (e as any).id === beamId) as any as LaserWeapon | undefined;
                  const locationOk = !!sourceId;
                  const canToggle = !!meteor && locationOk;
                  const onClick = () => {
                    if (!canToggle) return;
                    if ((!beam || (beam as any).sourceId !== sourceId) && meteor && sourceId) {
                      if (beam && (beam as any).destroy) (beam as any).destroy();
                      beam = new LaserWeapon(beamId, sourceId, meteor.id);
                      registerSimEntity(beam);
                    }
                    if (beam) beam.setActive(!beam.isActive());
                    item.state = beam && beam.isActive() ? 'ACTIVE_LOCATION' : 'AT_LOCATION';
                    notify();
                  };
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <button
                        disabled={!canToggle}
                        onClick={onClick}
                        className='progress-btn'
                        style={{ padding:'4px 6px', borderRadius:4, border:'1px solid '+(isActive? '#2e6f2e':'#345061'), background:isActive? '#214021':'#25323e', color:isActive? '#6dff6d':'#d9e3ea', fontWeight:600, letterSpacing:0.35, cursor:canToggle? 'pointer':'default', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', opacity:canToggle?1:0.5 }}>
                        <span style={{ minWidth:28, textAlign:'left' }} className='label-layer'>{isActive? 'ON':'OFF'}</span>
                        <span style={{ flex:1, textAlign:'center' }} className='label-layer'>Laser</span>
                        <span style={{ minWidth:38, textAlign:'right', opacity:0.6 }} className='label-layer'>{' '}</span>
                      </button>
                      {(!locationOk || (locationOk && !meteor)) && (
                        <div style={{ fontSize:8.5, lineHeight:1.2, textAlign:'center', color:'#b9c6d4', opacity:0.75, padding:'0 2px' }}>
                          {!locationOk ? 'Move to L1, L3, L4 or L5 to enable' : 'Waiting for meteor target'}
                        </div>
                      )}
                    </div>
                  );
                }

                if (bp.type==='space-telescope') {
                  // Space telescope: On/Off only at L2
                  const isActive = item.state === 'ACTIVE_LOCATION';
                  const atL2 = item.location === 'SE_L2';
                  const canToggle = atL2;
                  const onClick = () => {
                    if (!canToggle) return;
                    try {
                      if (isActive) { econActs.deactivateItem(state, item.id); }
                      else { econActs.activateItem(state, item.id); }
                      notify();
                    } catch(e){ console.warn(e); }
                  };
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <button
                        disabled={!canToggle}
                        onClick={onClick}
                        className='progress-btn'
                        style={{ padding:'4px 6px', borderRadius:4, border:'1px solid '+(isActive? '#2e6f2e':'#345061'), background:isActive? '#214021':'#25323e', color:isActive? '#6dff6d':'#d9e3ea', fontWeight:600, letterSpacing:0.35, cursor:canToggle? 'pointer':'default', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', opacity:canToggle?1:0.5 }}>
                        <span style={{ minWidth:28, textAlign:'left' }} className='label-layer'>{isActive? 'ON':'OFF'}</span>
                        <span style={{ flex:1, textAlign:'center' }} className='label-layer'>Telescope</span>
                        <span style={{ minWidth:38, textAlign:'right', opacity:0.6 }} className='label-layer'>{' '}</span>
                      </button>
                      {!atL2 && (
                        <div style={{ fontSize:8.5, lineHeight:1.2, textAlign:'center', color:'#b9c6d4', opacity:0.75, padding:'0 2px' }}>
                          Move to L2 to enable
                        </div>
                      )}
                    </div>
                  );
                }

                // Impactor activation prep vs direct activation
                const isImpactorType = bp.type==='small-impactor'||bp.type==='large-impactor'||bp.type==='giant-impactor';
                if (isImpactorType) {
                  const prepAct = state.actions.find(a=> a.kind==='ACTIVATE_PREP' && a.status==='PENDING' && a.payload.itemId===item.id);
                  const abortAct = state.actions.find(a=> a.kind==='ABORT_PREP' && a.status==='PENDING' && a.payload.itemId===item.id && a.payload.target==='ACTIVATION');
                  const isPrepping = !!prepAct;
                  const isPrepped = item.state==='PREPPED_ACTIVATION';
                  const isAborting = !!abortAct;
                  const globalLock = state.actions.some(a=> (a.kind==='LAUNCH'||a.kind==='LAND'||a.kind==='ACTIVATE_PREP'||a.kind==='ABORT_PREP') && a.status==='PENDING') || state.inventory.some(i=> i.state==='PREPPED_LAUNCH'||i.state==='PREPPED_LANDING'||i.state==='PREPPED_ACTIVATION');
                  const disabledA = (isPrepping && !isPrepped) || isAborting || (!isPrepping && !isPrepped && globalLock);
                  const activeAct = (isPrepping && !isPrepped) ? prepAct : (isAborting ? abortAct : null);
                  const pctA = activeAct ? Math.min(1, Math.max(0,(state.timeSec - activeAct.startTime)/(activeAct.endTime - activeAct.startTime))) : 0;
                  const labelA = isPrepped ? (isAborting? '...' : 'ABORT ACTIVATION') : (isPrepping ? '...' : 'Prep Activation');
                  return (
                    <button
                      className='progress-btn'
                      disabled={disabledA}
                      onClick={()=> {
                        try {
                          if (isPrepped) { if(!isAborting){ abortPrep(state, item.id, 'ACTIVATION'); notify(); } }
                          else if (!isPrepping && !globalLock) { prepareActivation(state, item.id); notify(); }
                        } catch(e){ console.warn(e);} }
                      }
                      style={{ padding:'4px 6px', borderRadius:4, border:'1px solid '+(isPrepped? '#7a2d2d':'#345061'), background:isPrepped? '#411b1b':'#25323e', color:isPrepped? '#ff7878':'#d9e3ea', fontWeight:600, letterSpacing:0.35, cursor:disabledA? 'default':'pointer', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', overflow:'hidden', opacity:disabledA?0.6:1 }}>
                      {(isPrepping && !isPrepped) || isAborting ? <div className='progress-fill' style={{ width:(pctA*100)+'%', background:isPrepped? 'linear-gradient(90deg,#ff9898,#ff5a5a)' : 'linear-gradient(90deg,#4aa9ff,#1485ff)', opacity:0.8 }} /> : null }
                      <span style={{ minWidth:28, textAlign:'left' }} className='label-layer'>{isPrepped? (isAborting? '' : '') : (isPrepping? '' : '3d')}</span>
                      <span style={{ flex:1, textAlign:'center' }} className='label-layer'>{labelA}</span>
                      <span style={{ minWidth:38, textAlign:'right', opacity:0 }} className='label-layer'></span>
                    </button>
                  );
                }

                // Default direct activation
                return (
                  <button disabled={!canActivate} onClick={()=>{ if(canActivate){ activateItem(state, item.id); notify(); setCommandContext(null);} }} className="progress-btn" style={{ padding:'4px 6px', borderRadius:4, border:'1px solid #345061', background: canActivate? '#25323e' : '#1f2731', color: canActivate? '#d9e3ea' : '#7d8d99', fontWeight:600, letterSpacing:0.35, cursor:canActivate?'pointer':'default', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ minWidth:28, textAlign:'left' }} className="label-layer">{activationDurationDays.toFixed(0)}d</span>
                    <span style={{ flex:1, textAlign:'center' }} className="label-layer">Activate</span>
                    <span style={{ minWidth:38, textAlign:'right' }} className="label-layer">{activationFuel.toFixed(1)}t</span>
                  </button>
                );
              })()}
              {/* Transfer / Change Location button (always enabled; gating only in submenu) */}
              {bp.type==='orbital-habitat' ? null : (
              <button onClick={()=> setCommandContext(ctx=> ctx ? { ...ctx, mode:'transfer'} : null)} className="progress-btn" style={{ padding:'4px 6px', borderRadius:4, border:'1px solid #345061', background:'#283744', color:'#d4dde4', fontWeight:600, letterSpacing:0.35, cursor:'pointer', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                { (bp.type==='small-impactor'||bp.type==='large-impactor'||bp.type==='giant-impactor') ? (
                  <>
                    <span style={{ minWidth:28, textAlign:'left', opacity:0 }} className="label-layer">.</span>
                    <span style={{ flex:1, textAlign:'center' }} className="label-layer">Change Location</span>
                    <span style={{ minWidth:38, textAlign:'right', opacity:0 }} className="label-layer">.</span>
                  </>
                ) : (
                  <>
                    <span style={{ minWidth:28, textAlign:'left', opacity:0 }} className="label-layer">.</span>
                    <span style={{ flex:1, textAlign:'center' }} className="label-layer">{bp.type==='laser-platform' ? 'Change Location' : 'Transfer'}</span>
                    <span style={{ minWidth:38, textAlign:'right', opacity:0 }} className="label-layer">.</span>
                  </>
                ) }
              </button>)}
            </div>
          )}
          {item && bp && commandContext.mode==='root' && isTanker && (
            <div style={{ fontSize:10, lineHeight:1.35, flex:1, display:'flex', flexDirection:'column', gap:6, overflowY:'auto', minHeight:0, paddingRight:2 }}>
              <div style={{ background:'#1b2630', border:'1px solid #31414f', borderRadius:4, padding:'4px 6px 5px', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.45, textAlign:'center', color:'#d8e3ea' }}>{bp.name}</div>
                {(() => { const fuelNow = (item.fuelTons||0); const cap = (item.fuelCapacityTons||0); const wet = bp.massTons + fuelNow; return (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', justifyContent:'center', gap:14, fontSize:9.5, fontWeight:600, letterSpacing:0.45, color:'#b9c9d6' }}>
                      <span>Dry {bp.massTons.toFixed(1)} t</span>
                      <span>Total {wet.toFixed(1)} t</span>
                    </div>
                    <div style={{ position:'relative', height:18, border:'1px solid #4e3a27', background:'#0f161c', borderRadius:4, boxShadow:'0 0 0 1px #23170f inset' }}>
                      {(() => { const ratio = cap>0? Math.max(0, Math.min(1, fuelNow/cap)) : 0; const r = Math.round(0x40 + (0xff-0x40)*ratio); const g = Math.round(0x29 + (0x9b-0x29)*ratio); const b = Math.round(0x15 + (0x2f-0x15)*ratio); const color = `rgb(${r},${g},${b})`; return <div style={{ position:'absolute', top:1, bottom:1, left:1, width:(ratio*100)+'%', background: color, borderRadius:3, transition:'width 300ms, background-color 300ms' }} />; })()}
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 6px', fontSize:9.5, fontWeight:600, letterSpacing:0.4, color:'#d5e2ec' }}>
                        <span style={{ textShadow:'0 0 4px #000' }}>{fuelNow.toFixed(1)} t</span>
                        <span style={{ opacity:0.85, textShadow:'0 0 4px #000' }}>{cap.toFixed(1)} t</span>
                      </div>
                    </div>
                  </div>
                ); })()}
              </div>
              <button disabled={otherCraftSameLoc.length===0 || (item.fuelTons||0)<=0} onClick={()=> setCommandContext(ctx=> ctx? { ...ctx, mode:'transfer'}:null)} className="progress-btn" style={{ padding:'4px 6px', borderRadius:4, border:'1px solid #345061', background: (otherCraftSameLoc.length===0 || (item.fuelTons||0)<=0)? '#1f2731':'#283744', color: (otherCraftSameLoc.length===0 || (item.fuelTons||0)<=0)? '#7d8d99':'#d4dde4', fontWeight:600, letterSpacing:0.35, cursor:(otherCraftSameLoc.length===0 || (item.fuelTons||0)<=0)?'default':'pointer', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'center' }}>Transfer Fuel</button>
              <button onClick={()=> setCommandContext(ctx=> ctx? { ...ctx, mode:'relocate'}:null)} className="progress-btn" style={{ padding:'4px 6px', borderRadius:4, border:'1px solid #345061', background:'#283744', color:'#d4dde4', fontWeight:600, letterSpacing:0.35, cursor:'pointer', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'center' }}>Change Location</button>
              {(() => {
                const landingPrepInProgress = state.actions.some(a=>a.kind==='LAND' && a.status==='PENDING' && a.payload.itemId===item.id);
                const abortLandingInProgress = state.actions.some(a=>a.kind==='ABORT_PREP' && a.status==='PENDING' && a.payload.itemId===item.id && a.payload.target==='LAND');
                const label = item.state==='PREPPED_LANDING' ? (abortLandingInProgress ? '...' : 'ABORT LANDING') : (landingPrepInProgress ? '...' : 'Prep Landing');
                const disabled = item.state==='PREPPED_LANDING'
                  ? abortLandingInProgress
                  : ( (anyPrepActive && !landingPrepInProgress) || (anyLaunchPrepped && !landingPrepInProgress) || !(item.state==='AT_LOCATION' || item.state==='ACTIVE_LOCATION') );
                const isAbort = item.state==='PREPPED_LANDING';
                const durationLeftDays = (()=>{
                  const act = state.actions.find(a=> (a.kind==='LAND' || (a.kind==='ABORT_PREP' && a.payload.target==='LAND')) && a.status==='PENDING' && a.payload.itemId===item.id);
                  if(!act) return 1; // default display
                  const rem = Math.max(0, act.endTime - state.timeSec);
                  return Math.max(1, Math.ceil(rem/86400));
                })();
                return (
                  <button
                    disabled={disabled}
                    onClick={()=>{
                      if(isAbort) { if(!abortLandingInProgress) { try { abortPrep(state, item.id, 'LAND'); notify(); } catch(e){ console.warn(e);} } }
                      else { if(!landingPrepInProgress && !disabled) { try { prepareLanding(state, item.id); notify(); } catch(e){ console.warn(e);} } }
                    }}
                    className="progress-btn"
                    style={{ padding:'4px 6px', borderRadius:4, border:'1px solid '+(isAbort? '#693232':'#345061'), background: isAbort? '#3a1d1d':'#283744', color: isAbort? '#ff6d6d':'#d4dde4', fontWeight:600, letterSpacing:0.35, cursor:disabled? 'default':'pointer', fontSize:9.5, display:'flex', alignItems:'center', justifyContent:'space-between', opacity:disabled?0.6:1 }}>
                    <span style={{ minWidth:28, textAlign:'left' }} className="label-layer">{durationLeftDays}d</span>
                    <span style={{ flex:1, textAlign:'center' }} className="label-layer">{label}</span>
                    <span style={{ minWidth:24, textAlign:'right', opacity:0.0 }} className="label-layer"> </span>
                  </button>
                );
              })()}
            </div>
          )}
          {item && bp && commandContext.mode==='transfer' && !isTanker && (
            <div style={{ fontSize:10, lineHeight:1.3, flex:1, display:'flex', flexDirection:'column', gap:5 }}>
              {(() => { const fuelNow = (item.fuelTons||0); const cap = (item.fuelCapacityTons||0); const ratio = cap>0? Math.max(0, Math.min(1, fuelNow/cap)) : 0; const r = Math.round(0x40 + (0xff-0x40)*ratio); const g = Math.round(0x29 + (0x9b-0x29)*ratio); const b = Math.round(0x15 + (0x2f-0x15)*ratio); const color = `rgb(${r},${g},${b})`; return (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.45, textAlign:'center', color:'#d8e3ea' }}>{bp.name} Fuel</div>
                  <div style={{ position:'relative', height:16, border:'1px solid #4e3a27', background:'#0f161c', borderRadius:4, boxShadow:'0 0 0 1px #23170f inset' }}>
                    <div style={{ position:'absolute', top:1, bottom:1, left:1, width:(ratio*100)+'%', background:color, borderRadius:3, transition:'width 300ms, background-color 300ms' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 6px', fontSize:9, fontWeight:600, letterSpacing:0.4, color:'#d5e2ec' }}>
                      <span style={{ textShadow:'0 0 4px #000' }}>{fuelNow.toFixed(1)} t</span>
                      <span style={{ opacity:0.8, textShadow:'0 0 4px #000' }}>{cap.toFixed(1)} t</span>
                    </div>
                  </div>
                </div>
              ); })()}
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.4, textAlign:'center', marginBottom:2 }}>
                {(bp.type==='small-impactor'||bp.type==='large-impactor'||bp.type==='giant-impactor') ? 'Select New Location' : 'Choose Destination Lagrange Point'}
              </div>
              <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:3, paddingRight:2 }}>
              {(() => {
                const origin = item.location || 'LEO';
                const adjacency: Record<string,string[]> = {
                  'LEO': ['SE_L1','SE_L2'],
                  'SE_L1': ['LEO','SE_L2','SE_L4','SE_L5'],
                  'SE_L2': ['LEO','SE_L1','SE_L4','SE_L5'],
                  'SE_L3': ['SE_L4','SE_L5'],
                  'SE_L4': ['SE_L1','SE_L2','SE_L3'],
                  'SE_L5': ['SE_L1','SE_L2','SE_L3']
                };
                const list = adjacency[origin] || [];
                return list.map(lp => {
                  // Recompute cost/duration using mass and helper approximations (duplicated logic minimal for UI preview)
                  // Wet mass = dry + current onboard fuel for transfer preview
                  let simulatedMass = item.massTons + (item.fuelTons||0);
                  // Mirror factors from actions.ts computeFuelCostForTransfer for impactors
                  let factor = 0.6; let days = 60;
                  factor = 0.45; days = 60; // baseline unified with backend
                  if ((origin==='LEO' && (lp==='SE_L1'||lp==='SE_L2')) || ((lp==='LEO') && (origin==='SE_L1'||origin==='SE_L2'))) { factor=0.25; days=30; }
                  else if ((origin==='SE_L1'||origin==='SE_L2') && (lp==='SE_L4'||lp==='SE_L5')) { factor=0.35; days=90; }
                  else if ((origin==='SE_L4'||origin==='SE_L5') && (lp==='SE_L3')) { factor=0.3; days=120; }
                  else if (origin==='SE_L3' && (lp==='SE_L4'||lp==='SE_L5')) { factor=0.3; days=120; }
                  const cost = simulatedMass * (origin===lp ? 0.05 : factor);
                  const dur = origin===lp ? 7 : days;
                  // Legacy gating used !canTransfer which only reflected an old simple LEO<->dest rule.
                  // This incorrectly disabled valid adjacency routes (e.g., LEO -> SE_L1 with enough fuel).
                  // New rule: only fuel availability gates the button (and implicit state via transferObject safety checks).
                  const disabledBtn = (item.fuelTons||0) < cost;
                  return (
                    <button key={lp} disabled={disabledBtn} onClick={()=>{ if(!disabledBtn){ try { transferObject(state, item.id, lp as any); notify(); } catch(e){ console.warn(e);} setCommandContext(null);} }} className="progress-btn" style={{ padding:'3px 5px', borderRadius:4, border:'1px solid #345061', background: !disabledBtn? '#283744' : '#1f2731', color: !disabledBtn? '#d4dde4' : '#7d8d99', fontWeight:600, letterSpacing:0.35, cursor:!disabledBtn?'pointer':'default', fontSize:9, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ minWidth:28, textAlign:'left' }} className="label-layer">{dur}d</span>
                      <span style={{ flex:1, textAlign:'center' }} className="label-layer">{lp}</span>
                      <span style={{ minWidth:38, textAlign:'right' }} className="label-layer">{cost.toFixed(1)}t</span>
                    </button>
                  );
                });
              })()}
              </div>
              <div style={{ fontSize:9, opacity:0.5, textAlign:'center', marginTop:4 }}>More destinations later</div>
            </div>
          )}
          {item && bp && commandContext.mode==='transfer' && isTanker && (
            <div style={{ fontSize:10, lineHeight:1.3, flex:1, display:'flex', flexDirection:'column', gap:6 }}>
              {/* Tanker fuel bar */}
              {(() => { const fuelNow = (item.fuelTons||0); const cap = (item.fuelCapacityTons||0); const ratio = cap>0? Math.max(0, Math.min(1, fuelNow/cap)) : 0; const r = Math.round(0x40 + (0xff-0x40)*ratio); const g = Math.round(0x29 + (0x9b-0x29)*ratio); const b = Math.round(0x15 + (0x2f-0x15)*ratio); const color = `rgb(${r},${g},${b})`; return (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.45, textAlign:'center', color:'#d8e3ea' }}>{bp.name} Fuel</div>
                  <div style={{ position:'relative', height:18, border:'1px solid #4e3a27', background:'#0f161c', borderRadius:4, boxShadow:'0 0 0 1px #23170f inset' }}>
                    <div style={{ position:'absolute', top:1, bottom:1, left:1, width:(ratio*100)+'%', background:color, borderRadius:3, transition:'width 300ms, background-color 300ms' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 6px', fontSize:9.5, fontWeight:600, letterSpacing:0.4, color:'#d5e2ec' }}>
                      <span style={{ textShadow:'0 0 4px #000' }}>{fuelNow.toFixed(1)} t</span>
                      <span style={{ opacity:0.85, textShadow:'0 0 4px #000' }}>{cap.toFixed(1)} t</span>
                    </div>
                  </div>
                </div>
              ); })()}
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.4, textAlign:'center', marginBottom:2 }}>Select Craft to Receive Fuel</div>
              <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:3, paddingRight:2 }}>
              {otherCraftSameLoc.length===0 && <div style={{ fontSize:10, opacity:0.6, textAlign:'center' }}>No other craft present</div>}
              {otherCraftSameLoc.map(c=>{
                const cbp = BLUEPRINTS.find(b=>b.type===c.blueprint)!;
                const targetMissing = Math.max(0, (c.fuelCapacityTons||0) - (c.fuelTons||0));
                const available = item.fuelTons||0;
                const transferAmount = Math.min(available, targetMissing);
                const pending = state.actions.find(a=> a.kind==='FUEL_TRANSFER' && a.status==='PENDING' && a.payload.tankerId===item.id && a.payload.targetId===c.id);
                const pct = pending ? Math.min(1,(state.timeSec - pending.startTime)/(pending.endTime - pending.startTime)) : 0;
                return (
                  <button key={c.id} disabled={transferAmount<=0 || !!pending} onClick={()=>{ try { const moved = transferFuelBetweenCraft(state, item.id, c.id); if(moved>0){ notify(); setCommandContext(null);} } catch(e){ console.warn(e);} }} className="progress-btn" style={{ padding:'3px 5px', borderRadius:4, border:'1px solid #345061', background: (transferAmount>0 && !pending)? '#283744':'#1f2731', color: (transferAmount>0 && !pending)? '#d4dde4':'#7d8d99', fontWeight:600, letterSpacing:0.35, cursor:(transferAmount>0 && !pending)?'pointer':'default', fontSize:9, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
                    {pending && <div className="progress-fill" style={{ width:(pct*100)+'%', background:'linear-gradient(90deg,#34b4ff,#1485ff)' }} />}
                    <span style={{ minWidth:28, textAlign:'left', opacity:0.85 }} className="label-layer">7d</span>
                    <span style={{ flex:1, textAlign:'center' }} className="label-layer">{cbp.name}</span>
                    <span style={{ minWidth:38, textAlign:'right' }} className="label-layer">{pending ? '...' : transferAmount.toFixed(1)+'t'}</span>
                  </button>
                );
              })}
              </div>
              {/* Removed hint text per request */}
            </div>
          )}
          {item && bp && commandContext.mode==='relocate' && isTanker && (
            <div style={{ fontSize:10, lineHeight:1.3, flex:1, display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.4, textAlign:'center', marginBottom:2 }}>Select New Location</div>
              {(() => {
                const origin = item.location || 'LEO';
                const adj: Record<string,string[]> = {
                  'LEO': ['SE_L1','SE_L2'],
                  'SE_L1': ['LEO','SE_L2','SE_L4','SE_L5'],
                  'SE_L2': ['LEO','SE_L1','SE_L4','SE_L5'],
                  'SE_L4': ['SE_L1','SE_L2','SE_L5','SE_L3'],
                  'SE_L5': ['SE_L1','SE_L2','SE_L4','SE_L3'],
                  'SE_L3': ['SE_L4','SE_L5']
                };
                const list = adj[origin]||[];
                return <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:3, paddingRight:2 }}>{list.map(lp => {
                  // Reuse preview logic with generic factors (lighter than impactors): 20-40% mass fractions
                  let factor = 0.35; let days = 60;
                  if ((origin==='LEO' && (lp==='SE_L1'||lp==='SE_L2')) || ((lp==='LEO') && (origin==='SE_L1'||origin==='SE_L2'))) { factor=0.20; days=30; }
                  else if ((origin==='SE_L1'||origin==='SE_L2') && (lp==='SE_L4'||lp==='SE_L5')) { factor=0.30; days=75; }
                  else if ((origin==='SE_L4'||origin==='SE_L5') && (lp==='SE_L3')) { factor=0.28; days=110; }
                  else if (origin==='SE_L3' && (lp==='SE_L4'||lp==='SE_L5')) { factor=0.28; days=110; }
                  const cost = (item.massTons + (item.fuelTons||0)) * factor;
                  const dur = days;
                  const disabledBtn = (item.fuelTons||0) < cost;
                  return (
                    <button key={lp} disabled={disabledBtn} onClick={()=>{ if(!disabledBtn){ try { transferObject(state, item.id, lp as any); notify(); setCommandContext(null); } catch(e){ console.warn(e);} } }} className="progress-btn" style={{ padding:'3px 5px', borderRadius:4, border:'1px solid #345061', background: !disabledBtn? '#283744':'#1f2731', color: !disabledBtn? '#d4dde4':'#7d8d99', fontWeight:600, letterSpacing:0.35, cursor:!disabledBtn?'pointer':'default', fontSize:9, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ minWidth:28, textAlign:'left' }} className="label-layer">{dur}d</span>
                      <span style={{ flex:1, textAlign:'center' }} className="label-layer">{lp}</span>
                      <span style={{ minWidth:38, textAlign:'right' }} className="label-layer">{cost.toFixed(1)}t</span>
                    </button>
                  );
                })}</div>;
              })()}
              <div style={{ marginTop:'auto', fontSize:9, opacity:0.55, textAlign:'center' }}>Route durations subject to tuning</div>
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
          {/* Construct button now above ground list */}
          {isGround && BLUEPRINTS.some(bp => isUnlocked(state.researchUnlocked as any, bp.type)) && (()=>{
            const activeBuildAction = state.actions.find(a=>a.kind==='BUILD' && a.status==='PENDING');
            let pct = 0;
            if (activeBuildAction) pct = Math.min(1,(state.timeSec - activeBuildAction.startTime)/(activeBuildAction.endTime - activeBuildAction.startTime));
            return (
              <button
                className="progress-btn"
                style={{
                  margin:'0 0 6px 0',
                  width:'100%',
                  background:'#202b35',
                  border: activeBuildAction ? '1px solid #3d5668' : '1px solid #2d3a46',
                  color:'#d4dde4',
                  borderRadius:3,
                  padding:'2px 3px 3px',
                  fontSize:10,
                  fontWeight:600,
                  cursor:'pointer',
                  letterSpacing:0.3,
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
          {(() => {
            if (isGround) return groundItems.map(it => <InventoryRow key={it.id} it={it} isGround={true} locId={locId as LocationId} setCommandContext={setCommandContext} />);
            if (locId !== 'DEPLOYED') return atLoc.map(it => <InventoryRow key={it.id} it={it} isGround={false} locId={locId as LocationId} setCommandContext={setCommandContext} />);
            // Grouping for DEPLOYED
            const order: (string)[] = ['En Route','SE_L1','SE_L2','SE_L4','SE_L5','SE_L3'];
            const groups: Record<string, any[]> = { };
            groups['En Route'] = atLoc.filter(i=> i.state==='IN_TRANSFER');
            for (const loc of ['SE_L1','SE_L2','SE_L4','SE_L5','SE_L3']) {
              groups[loc] = atLoc.filter(i=> i.location===loc && i.state!=='IN_TRANSFER');
            }
            const elements: any[] = [];
            for (const g of order) {
              const items = groups[g];
              if (!items || items.length===0) continue;
              elements.push(<div key={g+':hdr'} style={{ margin:'4px 0 2px', fontSize:9, fontWeight:700, letterSpacing:0.6, opacity:0.82, padding:'0 2px', color:'#9fb2c1' }}>{g}</div>);
              for (const it of items) {
                elements.push(<InventoryRow key={it.id} it={it} isGround={false} locId={locId as LocationId} setCommandContext={setCommandContext} />);
              }
            }
            return elements;
          })()}
          {(isGround ? groundItems : atLoc).length===0 && null}
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
                          <span style={{ minWidth:34, textAlign:'left', color: completed? '#47d46a' : undefined }} className="label-layer">{completed ? '✓' : (r.durationSec/86400).toFixed(1)+'d'}</span>
                          <span style={{ flex:1, textAlign:'center', fontWeight:600, letterSpacing:0.3, color: completed? '#47d46a' : undefined }} className="label-layer">{completed ? 'Done' : (inProg ? '...' : 'Research')}</span>
                          <span style={{ minWidth:42, textAlign:'right' }} className="label-layer">{r.costFunds.toFixed(2)}B</span>
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
