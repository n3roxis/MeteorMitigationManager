import { GameEconomyState, ScheduledAction, ResearchId, BuildableType, LocationId } from './models';
import { BLUEPRINT_INDEX, RESEARCH_INDEX } from './data';
import { InterceptPath } from '../entities/Interceptor/InterceptPath';
import { METEOR_UNO } from '../data/meteors';
import { ENTITIES, registerEntity } from '../state/entities';
import { InterceptorProjectile } from '../entities/InterceptorProjectile';
import { Vector } from '../utils/Vector';
import { computeLaunchCostFunds, computeLaunchPrepDurationSec } from './balance';
import { resolveOriginEntityId } from '../utils/locationMap';

let actionCounter = 0;
const newActionId = () => `act-${++actionCounter}`;

// Utility: ensure an inventory item appears at the top of list (index 0) for UI ordering
function moveItemToFront(state: GameEconomyState, item: { id: string }) {
  const idx = state.inventory.indexOf(item as any);
  if (idx > 0) {
    state.inventory.splice(idx, 1);
    state.inventory.unshift(item as any);
  }
}

export function processActions(state: GameEconomyState, newTime: number) {
  state.timeSec = newTime;
  for (const act of state.actions) {
    if (act.status !== 'PENDING') continue;
    if (act.endTime <= state.timeSec) finalizeAction(state, act);
  }
}

function push(state: GameEconomyState, partial: Omit<ScheduledAction,'status'>) {
  state.actions.push({ ...partial, status: 'PENDING' });
}

export function startResearch(state: GameEconomyState, id: ResearchId) {
  const def = RESEARCH_INDEX.get(id);
  if (!def) throw new Error('Unknown research');
  if (state.researchUnlocked.has(id) || state.researchInProgress.has(id)) return;
  if (def.prereq?.some(p => !state.researchUnlocked.has(p))) throw new Error('Prerequisites missing');
  if (state.fundsBillion < def.costFunds) throw new Error('Insufficient funds');
  state.fundsBillion -= def.costFunds;
  state.researchInProgress.add(id);
  push(state, { id: newActionId(), kind: 'RESEARCH', startTime: state.timeSec, endTime: state.timeSec + def.durationSec, payload: { researchId: id } });
}

export function startBuild(state: GameEconomyState, type: BuildableType) {
  const bp = BLUEPRINT_INDEX.get(type); if (!bp) throw new Error('Unknown blueprint');
  if (state.fundsBillion < bp.buildCostFunds) throw new Error('Insufficient funds');
  state.fundsBillion -= bp.buildCostFunds;
  const itemId = `inv-${type}-${Date.now()}`;
  state.inventory.push({ id: itemId, blueprint: type, state: 'BUILDING', massTons: bp.massTons });
  push(state, { id: newActionId(), kind: 'BUILD', startTime: state.timeSec, endTime: state.timeSec + bp.buildDurationSec, payload: { itemId } });
}

export function launchItem(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i => i.id === itemId); if (!item || item.state !== 'BUILT') throw new Error('Not launch-prepable');
  const bp = BLUEPRINT_INDEX.get(item.blueprint)!;
  if (bp.type === 'tsunami-dam-module') throw new Error('Tsunami dam modules are ground infrastructure and cannot be launched');
  // Launch cost uses fully-fueled (wet) mass: dry mass + max fuel capacity (assumed filled for launch logistics)
  const wetLaunchMass = item.massTons + (item.fuelCapacityTons || 0);
  const cost = computeLaunchCostFunds(wetLaunchMass);
  if (state.fundsBillion < cost) throw new Error('Funds');
  state.fundsBillion -= cost;
  const prepDur = computeLaunchPrepDurationSec(item.massTons);
  push(state, { id: newActionId(), kind: 'LAUNCH', startTime: state.timeSec, endTime: state.timeSec + prepDur, payload: { itemId, duration: prepDur, massTons: item.massTons, dynamicLaunchCost: cost } });
}

export function finalizePreparedLaunch(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i=>i.id===itemId);
  if (!item || item.state !== 'PREPPED_LAUNCH') throw new Error('Not prepped');
  // Immediate insertion to location: tsunami dam modules deploy directly to DEPLOYED instead of LEO
  const bp = item ? BLUEPRINT_INDEX.get(item.blueprint) : undefined;
  item.state = 'AT_LOCATION';
  item.location = bp && bp.type === 'tsunami-dam-module' ? 'DEPLOYED' : 'LEO';
  moveItemToFront(state, item); // entering space location -> top
  // Orbital tanker arrives with full tanks
  if (bp && bp.type === 'orbital-tanker' && item.fuelCapacityTons !== undefined) {
    item.fuelTons = item.fuelCapacityTons; // refill on each successful launch insertion
  }
}

export function deorbitItem(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i=>i.id===itemId);
  if (!item) throw new Error('Missing');
  if (!(item.state === 'PREPPED_LANDING')) throw new Error('Not in landing prep');
  // Finalize landing: return to ground
  item.state = 'BUILT';
  item.location = undefined;
  item.transfer = undefined;
  if (item.fuelTons !== undefined) item.fuelTons = 0;
  moveItemToFront(state, item); // re-enter ground at top
}

export function prepareLanding(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i=>i.id===itemId);
  if (!item) throw new Error('Missing');
  const bp = BLUEPRINT_INDEX.get(item.blueprint);
  if (bp && bp.type==='orbital-habitat') throw new Error('Orbital habitat cannot be landed');
  if (!(item.state === 'AT_LOCATION' || item.state === 'ACTIVE_LOCATION')) throw new Error('Cannot prep landing from current state');
  // 1 day landing prep
  const dur = 1 * 24 * 3600;
  item.prevStateForLanding = item.state;
  push(state, { id: newActionId(), kind: 'LAND', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId, duration: dur } });
}

export function abortPrep(state: GameEconomyState, itemId: string, target: 'LAUNCH' | 'LAND' | 'ACTIVATION') {
  const item = state.inventory.find(i=>i.id===itemId); if(!item) throw new Error('Missing');
  if (target==='LAUNCH' && item.state!=='PREPPED_LAUNCH') throw new Error('Not launch prepped');
  if (target==='LAND' && item.state!=='PREPPED_LANDING') throw new Error('Not landing prepped');
  if (target==='ACTIVATION' && item.state!=='PREPPED_ACTIVATION') throw new Error('Not activation prepped');
  const dur = 1 * 24 * 3600; // 1 day abort rollback
  push(state, { id: newActionId(), kind: 'ABORT_PREP', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId, target } });
}

export function prepareActivation(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i=>i.id===itemId);
  if(!item) throw new Error('Missing');
  const bp = item ? BLUEPRINT_INDEX.get(item.blueprint) : undefined;
  if(!(bp && (bp.type==='small-impactor'||bp.type==='large-impactor'||bp.type==='giant-impactor'))) throw new Error('Not an impactor');
  if(item.state!=='AT_LOCATION') throw new Error('Wrong state');
  const dur = 3 * 24 * 3600; // couple of days (3) prep activation
  push(state, { id: newActionId(), kind: 'ACTIVATE_PREP', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId, duration: dur } });
}

export function transferFuelBetweenCraft(state: GameEconomyState, tankerId: string, targetId: string) {
  // Schedule a 7-day transfer action; actual fuel movement on completion
  const tanker = state.inventory.find(i=>i.id===tankerId);
  const target = state.inventory.find(i=>i.id===targetId);
  if (!tanker || !target) throw new Error('Missing craft');
  if (tanker.blueprint !== 'orbital-tanker') throw new Error('Not a tanker');
  if (!(tanker.location && target.location && tanker.location === target.location)) throw new Error('Different locations');
  const available = tanker.fuelTons || 0;
  if (available <= 0) return 0;
  const targetCap = target.fuelCapacityTons ?? 0;
  const targetCurrent = target.fuelTons ?? 0;
  const targetMissing = Math.max(0, targetCap - targetCurrent);
  if (targetMissing <= 0) return 0;
  const amount = Math.min(available, targetMissing);
  const dur = 7 * 24 * 3600; // 7 day transfer operation
  push(state, { id: newActionId(), kind: 'FUEL_TRANSFER', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { tankerId, targetId, amount } });
  return amount; // return scheduled amount (not yet moved)
}

export function activateItem(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i => i.id === itemId); if (!item) throw new Error('Missing');
  const bp = BLUEPRINT_INDEX.get(item.blueprint)!;
  // Instant toggle path for space telescope (no scheduling, no fuel, only at L2)
  if (bp.type === 'space-telescope') {
    if (!(item.state === 'AT_LOCATION' || item.state === 'PREPPED_ACTIVATION')) throw new Error('Wrong state');
    if (item.location !== 'SE_L2') throw new Error('Must be at L2');
    if (item.state==='PREPPED_ACTIVATION') item.state='AT_LOCATION';
    item.state = 'ACTIVE_LOCATION';
    return;
  }
  const fuel = bp.activationFuelTons || 0;
  const rawDur = bp.activationDurationSec || 7*24*3600;
  const dur = Math.max(rawDur, 7*24*3600);
  if (!(item.state === 'AT_LOCATION' || item.state==='PREPPED_ACTIVATION')) throw new Error('Wrong state');
  if (item.state==='PREPPED_ACTIVATION') {
    item.state='AT_LOCATION';
  }
  // TEMP: Fuel requirement bypass for impactor troubleshooting
  if (!(bp.type==='small-impactor' || bp.type==='large-impactor' || bp.type==='giant-impactor')) {
    if (fuel > 0) {
      if ((item.fuelTons||0) < fuel) throw new Error('Insufficient onboard fuel');
      item.fuelTons = (item.fuelTons||0) - fuel;
    }
  }
  // Immediate activation path for impactors if cached trajectory is viable
  if (bp.type==='small-impactor' || bp.type==='large-impactor' || bp.type==='giant-impactor') {
    const cached: any = (item as any).activationTrajectory;
    const hasCache = cached && cached.viable && cached.depVel && cached.meteorDelta && cached.flightTimeSec;
    if (hasCache && item.location) {
      try {
        console.log('[Impactor Immediate Activation] Using cached trajectory for', item.id, 'cache=', cached);
        // set transfer state immediately and spawn projectile (same as finalize path logic)
        const origin = item.location as LocationId;
        const missionDuration = cached.flightTimeSec as number; // approximate mission length to flight time
        item.state = 'IN_TRANSFER';
        const nowMs = Date.now();
        item.transfer = { origin, destination: 'IMPACT' as any, departureTime: state.timeSec, arrivalTime: state.timeSec + missionDuration, fuelCost: 0, realDepartureMs: nowMs, realArrivalMs: nowMs + missionDuration*1000 };
  const originEntId = resolveOriginEntityId(item.location);
        const originEnt: any = ENTITIES.find(e=> (e as any).id === originEntId);
        const meteorEnt: any = ENTITIES.find(e=> (e as any).id === METEOR_UNO.id);
        console.log('[Impactor Immediate Activation] originEntId=', originEntId, 'originEntFound=', !!originEnt, 'meteorFound=', !!meteorEnt);
        if (originEnt && meteorEnt) {
          const depVel = new Vector(cached.depVel[0], cached.depVel[1], cached.depVel[2]);
          const meteorDelta = new Vector(cached.meteorDelta[0], cached.meteorDelta[1], cached.meteorDelta[2]);
          console.log('[Impactor Immediate Activation] Spawning projectile', { depVel, meteorDelta, flightTime: cached.flightTimeSec });
          const proj = new InterceptorProjectile(
            `imp-proj-${item.id}`,
            new Vector(originEnt.position.x, originEnt.position.y, originEnt.position.z),
            depVel,
            cached.flightTimeSec,
            meteorEnt.id,
            meteorDelta,
            item.id,
            ()=> {
              const idx = state.inventory.findIndex(iv=>iv.id===item.id);
              if (idx>=0) state.inventory.splice(idx,1);
              console.log('[Impactor Immediate Activation] Impact complete; removed inventory item', item.id);
            }
          );
          registerEntity(proj);
          console.log('[Impactor Immediate Activation] Projectile registered. ENTITIES length now', ENTITIES.length);
        } else {
          console.warn('[Impactor Immediate Activation] Missing origin or meteor entity, falling back to scheduled activation');
          push(state, { id: newActionId(), kind: 'ACTIVATE', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId, fuel } });
        }
      } catch(err) {
        console.warn('[Impactor Immediate Activation] Cache spawn failed, fallback schedule', err);
        push(state, { id: newActionId(), kind: 'ACTIVATE', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId, fuel } });
      }
      return; // done
    }
    // If no viable cache, proceed with scheduled activation (will attempt solver on finalize)
  }
  push(state, { id: newActionId(), kind: 'ACTIVATE', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId, fuel } });
}

export function deactivateItem(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i => i.id === itemId); if (!item) throw new Error('Missing');
  if (item.state !== 'ACTIVE_LOCATION') throw new Error('Not active');
  const bp = BLUEPRINT_INDEX.get(item.blueprint)!;
  if (bp.type === 'space-telescope') {
    // Instant off
    item.state = 'AT_LOCATION';
    return;
  }
  // Deactivation we will treat as fast operational change but still scheduled (minimum 7 days for consistency)
  const dur = 7 * 24 * 3600;
  push(state, { id: newActionId(), kind: 'DEACTIVATE', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId } });
}

export function transferObject(state: GameEconomyState, itemId: string, destination: LocationId) {
  const item = state.inventory.find(i => i.id === itemId); if (!item) throw new Error('Missing');
  const bp = BLUEPRINT_INDEX.get(item.blueprint);
  if (bp && bp.type==='orbital-habitat') throw new Error('Orbital habitat is stationary in LEO');
  const origin: LocationId = (item.state === 'AT_LOCATION' || item.state === 'ACTIVE_LOCATION') && item.location ? item.location : 'LEO';
  if (!(item.state === 'AT_LOCATION' || item.state === 'ACTIVE_LOCATION')) throw new Error('State');
  // Transfer fuel cost uses current instantaneous wet mass (dry + current onboard fuel)
  const wetMass = item.massTons + (item.fuelTons || 0);
  const fuelCost = computeFuelCostForTransfer(wetMass, origin, destination);
  // Use onboard craft fuel
  if ((item.fuelTons||0) < fuelCost) throw new Error('Insufficient onboard fuel');
  item.fuelTons = (item.fuelTons||0) - fuelCost; // deduct immediately
  const duration = Math.max(computeTransferDuration(origin, destination), 7*24*3600);
  item.state = 'IN_TRANSFER';
  const nowMs = Date.now();
  item.transfer = { origin, destination, departureTime: state.timeSec, arrivalTime: state.timeSec + duration, fuelCost, realDepartureMs: nowMs, realArrivalMs: nowMs + duration*1000 };
  push(state, { id: newActionId(), kind: 'TRANSFER_OBJECT', startTime: state.timeSec, endTime: state.timeSec + duration, payload: { itemId, origin, destination, fuelCost } });
}

// Removed location fuel logistics (transfer/move/purchase) in favor of per-craft fuel only

function finalizeAction(state: GameEconomyState, act: ScheduledAction) {
  act.status = 'DONE';
  switch (act.kind) {
    case 'RESEARCH': {
      const { researchId } = act.payload;
      state.researchUnlocked.add(researchId);
      state.researchInProgress.delete(researchId);
      break;
    }
    case 'BUILD': {
      const item = state.inventory.find(i => i.id === act.payload.itemId);
      if (item && item.state === 'BUILDING') item.state = 'BUILT'; // Remains on ground (no launch path) even for tsunami-dam-module
      if (item && item.state === 'BUILT') {
        const bp = BLUEPRINT_INDEX.get(item.blueprint);
        if (bp) {
          let cap: number;
            switch (bp.type) {
              case 'small-impactor':
                cap = 2; // custom override
                break;
              case 'orbital-tanker':
                cap = 4; // custom override
                break;
              default:
                cap = (bp.activationFuelTons || 0) > 0 ? (bp.activationFuelTons || 0) * 2 : 1;
            }
            item.fuelCapacityTons = cap;
            if (bp.type === 'orbital-tanker') {
              item.fuelTons = cap; // tanker starts full
            } else {
              item.fuelTons = 0; // others start empty
            }
        }
        moveItemToFront(state, item); // new ground asset appears at top
      }
      break;
    }
    case 'LAUNCH': {
      const item = state.inventory.find(i => i.id === act.payload.itemId);
      if (item && item.state === 'BUILT') { item.state = 'PREPPED_LAUNCH'; }
      break;
    }
    case 'LAND': {
      const item = state.inventory.find(i => i.id === act.payload.itemId);
      if (item && (item.prevStateForLanding === 'AT_LOCATION' || item.prevStateForLanding === 'ACTIVE_LOCATION')) { item.state = 'PREPPED_LANDING'; }
      break;
    }
    case 'ACTIVATE_PREP': {
      const item = state.inventory.find(i=>i.id===act.payload.itemId);
      if (item && item.state==='AT_LOCATION') { item.state = 'PREPPED_ACTIVATION'; }
      break;
    }
    case 'ABORT_PREP': {
      const { itemId, target } = act.payload as { itemId: string; target: 'LAUNCH' | 'LAND' | 'ACTIVATION' };
      const it = state.inventory.find(i=>i.id===itemId);
      if (it) {
        if (target==='LAUNCH' && it.state==='PREPPED_LAUNCH') it.state='BUILT';
        if (target==='LAND' && it.state==='PREPPED_LANDING') it.state = it.prevStateForLanding === 'ACTIVE_LOCATION' ? 'ACTIVE_LOCATION' : 'AT_LOCATION';
        if (target==='ACTIVATION' && it.state==='PREPPED_ACTIVATION') it.state='AT_LOCATION';
      }
      break;
    }
    case 'ACTIVATE': {
      const { itemId } = act.payload;
      const it = state.inventory.find(i => i.id === itemId);
      if (it) {
        const bp = BLUEPRINT_INDEX.get(it.blueprint)!;
        // Onboard fuel already deducted at scheduling; nothing to remove from pools.
        // If impactor: upon activation, we consider it departing immediately (transition to in-transfer / en route)
        if (bp.type === 'small-impactor' || bp.type === 'large-impactor' || bp.type === 'giant-impactor') {
          if (it.state === 'AT_LOCATION' && it.location) {
            const origin = it.location as LocationId;
            const duration = 120 * 24 * 3600; // placeholder mission duration
            it.state = 'IN_TRANSFER';
            const nowMs = Date.now();
            it.transfer = { origin, destination: 'IMPACT' as any, departureTime: state.timeSec, arrivalTime: state.timeSec + duration, fuelCost: 0, realDepartureMs: nowMs, realArrivalMs: nowMs + duration*1000 };
              // Lambert-based projectile spawn
              try {
                // Prefer a precomputed cached activation trajectory if present (from PREPPED_ACTIVATION polling)
                const cached = (it as any).activationTrajectory;
                let usedCache = false;
                // Determine start position entity id mapping from location
                const originEntId = resolveOriginEntityId(it.location);
                const originEnt: any = ENTITIES.find(e=> (e as any).id === originEntId);
                const meteorEnt: any = ENTITIES.find(e=> (e as any).id === METEOR_UNO.id);
                if (originEnt && meteorEnt) {
                  if (cached && cached.viable && cached.depVel && cached.meteorDelta && cached.flightTimeSec) {
                    // Use cached solution
                    const depVel = { x: cached.depVel[0], y: cached.depVel[1], z: cached.depVel[2] };
                    const meteorDelta = { x: cached.meteorDelta[0], y: cached.meteorDelta[1], z: cached.meteorDelta[2] };
                    const proj = new InterceptorProjectile(
                      `imp-proj-${it.id}`,
                      new Vector(originEnt.position.x, originEnt.position.y, originEnt.position.z),
                      new Vector(depVel.x, depVel.y, depVel.z),
                      cached.flightTimeSec,
                      meteorEnt.id,
                      new Vector(meteorDelta.x, meteorDelta.y, meteorDelta.z),
                      it.id,
                      ()=> {
                        const idx = state.inventory.findIndex(iv=>iv.id===it.id);
                        if (idx>=0) state.inventory.splice(idx,1);
                      }
                    );
                    registerEntity(proj);
                    usedCache = true;
                  }
                  if (!usedCache) {
                    const dt = duration; // fallback time-of-flight seconds
                    const interceptor = new InterceptPath(`solver-${it.id}`, originEnt, meteorEnt, false);
                    const candidates = [dt, dt*0.9, dt*1.1];
                    const massGuess = (it.massTons||1) * 1000; // simple scaling
                    const found = interceptor.findTrajectories(candidates, massGuess);
                    if (found>0) {
                      interceptor.chooseTrajectory(0); // pick first for now (could choose best delta-v)
                      const path = interceptor.chosenPath;
                      if (path) {
                        const depVel = path.departureVelocity;
                        const meteorDelta = path.meteorVelocityChange || path.arrivalDeltaVelocity;
                        const proj = new InterceptorProjectile(
                          `imp-proj-${it.id}`,
                          new Vector(originEnt.position.x, originEnt.position.y, originEnt.position.z),
                          new Vector(depVel.x, depVel.y, depVel.z),
                          path.flightTime,
                          meteorEnt.id,
                          new Vector(meteorDelta.x, meteorDelta.y, meteorDelta.z),
                          it.id,
                          ()=> {
                            const idx = state.inventory.findIndex(iv=>iv.id===it.id);
                            if (idx>=0) state.inventory.splice(idx,1);
                          }
                        );
                        registerEntity(proj);
                      }
                    }
                  }
                }
              } catch(err) {
                console.warn('[Impactor Activation] Lambert spawn failed', err);
              }
          }
        } else if (bp.type === 'laser-platform') {
          if (it.state === 'AT_LOCATION') it.state = 'ACTIVE_LOCATION';
        } else if (bp.type === 'space-telescope') {
          // Only activates (turns on instruments) if currently stationed at SE_L2
          if (it.state === 'AT_LOCATION' && it.location === 'SE_L2') it.state = 'ACTIVE_LOCATION';
        }
      }
      break;
    }
    case 'DEACTIVATE': {
      const { itemId } = act.payload as { itemId: string };
      const it = state.inventory.find(i => i.id === itemId);
      if (it && it.state === 'ACTIVE_LOCATION') {
        it.state = 'AT_LOCATION';
      }
      break;
    }
    case 'TRANSFER_OBJECT': {
      const { itemId, destination } = act.payload as { itemId: string; destination: LocationId; origin: LocationId; fuelCost: number };
      const item = state.inventory.find(i => i.id === itemId);
      if (item) { item.state = 'AT_LOCATION'; item.location = destination; item.transfer = undefined; moveItemToFront(state, item); }
      break;
    }
    case 'FUEL_TRANSFER': {
      const { tankerId, targetId, amount } = act.payload as { tankerId: string; targetId: string; amount: number };
      const tanker = state.inventory.find(i=>i.id===tankerId);
      const target = state.inventory.find(i=>i.id===targetId);
      if (tanker && target && tanker.location && target.location && tanker.location===target.location && amount>0) {
        const deliverable = Math.min(amount, tanker.fuelTons||0);
        const targetCap = target.fuelCapacityTons ?? 0;
        const targetCurrent = target.fuelTons ?? 0;
        const targetMissing = Math.max(0, targetCap - targetCurrent);
        const actual = Math.min(deliverable, targetMissing);
        if (actual>0) {
          tanker.fuelTons = (tanker.fuelTons||0) - actual;
          target.fuelTons = targetCurrent + actual;
        }
      }
      break;
    }
    // FUEL_MOVE and FUEL_PURCHASE removed
  }
  // After handling this finalized action, purge any impactors whose mission has completed (destination IMPACT reached)
  for (let i = state.inventory.length -1; i>=0; i--) {
    const it = state.inventory[i];
    if (it.state==='IN_TRANSFER' && it.transfer && (it.transfer as any).destination==='IMPACT' && it.transfer.arrivalTime <= state.timeSec) {
      state.inventory.splice(i,1);
    }
  }
}

// Adjacency graph for orbital location changes (applies to all movable orbital items)
const ORBITAL_ADJACENCY: Record<LocationId, LocationId[]> = {
  'LEO': ['SE_L1','SE_L2','DEPLOYED'],
  'SE_L1': ['LEO','SE_L2','SE_L4','SE_L5'],
  'SE_L2': ['LEO','SE_L1','SE_L4','SE_L5'],
  'SE_L3': ['SE_L4','SE_L5'],
  'SE_L4': ['SE_L1','SE_L2','SE_L3'],
  'SE_L5': ['SE_L1','SE_L2','SE_L3'],
  // DEPLOYED kept separate (non-graph transfers use legacy logic)
  'DEPLOYED': ['LEO']
};

export function computeFuelCostForTransfer(massTons: number, origin: LocationId, destination: LocationId) {
  if (origin === destination) return massTons * 0.05; // trivial reposition cost
  // Use unified orbital adjacency for any craft that is not a purely ground asset
  if (ORBITAL_ADJACENCY[origin]?.includes(destination)) {
    let factor = 0.45; // default slightly higher baseline
    if ((origin==='LEO' && (destination==='SE_L1' || destination==='SE_L2')) || ((destination==='LEO') && (origin==='SE_L1' || origin==='SE_L2'))) factor = 0.25;
    else if ((origin==='SE_L1' || origin==='SE_L2') && (destination==='SE_L4' || destination==='SE_L5')) factor = 0.35;
    else if ((origin==='SE_L4' || origin==='SE_L5') && (destination==='SE_L3')) factor = 0.3;
    else if (origin==='SE_L3' && (destination==='SE_L4' || destination==='SE_L5')) factor = 0.3;
    return massTons * factor;
  }
  // Legacy path (LEO <-> DEPLOYED or anything not enumerated)
  return massTons * 0.6;
}
function computeTransferDuration(origin: LocationId, destination: LocationId) {
  if (origin === destination) return 7 * 24 * 3600;
  if (ORBITAL_ADJACENCY[origin]?.includes(destination)) {
    let days = 60; // baseline
    if ((origin==='LEO' && (destination==='SE_L1' || destination==='SE_L2')) || ((destination==='LEO') && (origin==='SE_L1' || origin==='SE_L2'))) days = 30;
    else if ((origin==='SE_L1' || origin==='SE_L2') && (destination==='SE_L4' || destination==='SE_L5')) days = 90;
    else if ((origin==='SE_L4' || origin==='SE_L5') && (destination==='SE_L3')) days = 120;
    else if (origin==='SE_L3' && (destination==='SE_L4' || destination==='SE_L5')) days = 120;
    return days * 24 * 3600;
  }
  return 60 * 24 * 3600;
}

// Preview helpers (pure functions)
export const previewItemTransferPropellant = (massTons: number, origin: LocationId, dest: LocationId) => computeFuelCostForTransfer(massTons, origin, dest);
