import { GameEconomyState, ScheduledAction, ResearchId, BuildableType, LocationId } from './models';
import { BLUEPRINT_INDEX, RESEARCH_INDEX } from './data';

let actionCounter = 0;
const newActionId = () => `act-${++actionCounter}`;

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
  // This now represents "Prep Launch" phase only. Actual insertion into orbit will be triggered by global Launch button.
  const item = state.inventory.find(i => i.id === itemId); if (!item || item.state !== 'BUILT') throw new Error('Not launch-prepable');
  const bp = BLUEPRINT_INDEX.get(item.blueprint)!;
  if (state.fundsBillion < bp.launchCostFunds) throw new Error('Funds');
  state.fundsBillion -= bp.launchCostFunds;
  const prepDur = 7 * 24 * 3600; // 1 week prep
  push(state, { id: newActionId(), kind: 'LAUNCH', startTime: state.timeSec, endTime: state.timeSec + prepDur, payload: { itemId, duration: prepDur } });
}

export function finalizePreparedLaunch(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i=>i.id===itemId);
  if (!item || item.state !== 'PREPPED_LAUNCH') throw new Error('Not prepped');
  // Immediate insertion to location: tsunami dam modules deploy directly to DEPLOYED instead of LEO
  const bp = item ? BLUEPRINT_INDEX.get(item.blueprint) : undefined;
  item.state = 'AT_LOCATION';
  item.location = bp && bp.type === 'tsunami-dam-module' ? 'DEPLOYED' : 'LEO';
}

export function activateItem(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i => i.id === itemId); if (!item) throw new Error('Missing');
  const bp = BLUEPRINT_INDEX.get(item.blueprint)!;
  const fuel = bp.activationFuelTons || 0;
  const rawDur = bp.activationDurationSec || 7*24*3600;
  // Enforce >= one week even if blueprint shorter (blueprints already increased)
  const dur = Math.max(rawDur, 7*24*3600);
  if (!(item.state === 'AT_LOCATION')) throw new Error('Wrong state');
  if (fuel > 0 && item.location) {
    const loc = item.location as LocationId;
    if (fuel > state.fuel[loc] - state.fuelReserved[loc]) throw new Error('Fuel at location');
    state.fuelReserved[loc] += fuel;
  }
  push(state, { id: newActionId(), kind: 'ACTIVATE', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId, fuel } });
}

export function deactivateItem(state: GameEconomyState, itemId: string) {
  const item = state.inventory.find(i => i.id === itemId); if (!item) throw new Error('Missing');
  if (item.state !== 'ACTIVE_LOCATION') throw new Error('Not active');
  // Deactivation we will treat as fast operational change but still scheduled (minimum 7 days for consistency)
  const dur = 7 * 24 * 3600;
  push(state, { id: newActionId(), kind: 'DEACTIVATE', startTime: state.timeSec, endTime: state.timeSec + dur, payload: { itemId } });
}

export function transferObject(state: GameEconomyState, itemId: string, destination: LocationId) {
  const item = state.inventory.find(i => i.id === itemId); if (!item) throw new Error('Missing');
  const origin: LocationId = (item.state === 'AT_LOCATION' || item.state === 'ACTIVE_LOCATION') && item.location ? item.location : 'LEO';
  if (!(item.state === 'AT_LOCATION' || item.state === 'ACTIVE_LOCATION')) throw new Error('State');
  const mass = item.massTons;
  const fuelCost = computeFuelCostForTransfer(mass, origin, destination);
  if (fuelCost > state.fuel[origin] - state.fuelReserved[origin]) throw new Error('Fuel origin');
  state.fuelReserved[origin] += fuelCost;
  // Transfer durations now weeks/months via computeTransferDuration; enforce at least a week
  const duration = Math.max(computeTransferDuration(origin, destination), 7*24*3600);
  item.state = 'IN_TRANSFER';
  item.transfer = { origin, destination, arrivalTime: state.timeSec + duration, fuelCost };
  push(state, { id: newActionId(), kind: 'TRANSFER_OBJECT', startTime: state.timeSec, endTime: state.timeSec + duration, payload: { itemId, origin, destination, fuelCost } });
}

export function transferFuel(state: GameEconomyState, amount: number, destination: LocationId) {
  // Move fuel from LEO stock to destination
  if (amount <= 0) throw new Error('amount');
  if (amount > state.fuel['LEO'] - state.fuelReserved['LEO']) throw new Error('Fuel LEO');
  // Simple fuel move (legacy) now at least a week; scale mildly with amount
  const duration = Math.max(7*24*3600, Math.max(12*3600, amount * 1800));
  state.fuelReserved['LEO'] += amount; // reserve until completion
  push(state, { id: newActionId(), kind: 'FUEL_MOVE', startTime: state.timeSec, endTime: state.timeSec + duration, payload: { amount, destination } });
}

export function moveFuelLPtoLP(state: GameEconomyState, amount: number, origin: LocationId, destination: LocationId) {
  if (origin === destination) throw new Error('same');
  if (amount <= 0) throw new Error('amt');
  if (amount > state.fuel[origin] - state.fuelReserved[origin]) throw new Error('Fuel origin');
  // Propulsive fuel requirement to move 'amount' of fuel is computed like transferring a payload of that mass.
  const propNeeded = computeFuelCostForTransfer(amount, origin, destination);
  if (propNeeded > state.fuel[origin] - state.fuelReserved[origin] - amount) {
    // Need both the payload fuel (amount) and the propellant margin present at origin.
    throw new Error('Not enough propellant at origin to move fuel');
  }
  // Inter-location fuel movement now takes at least 2 weeks, scaling with amount
  const duration = Math.max(14*24*3600, Math.max(24*3600, amount * 3600));
  // Reserve BOTH the payload amount plus propellant so UI reflects locked resources.
  state.fuelReserved[origin] += amount + propNeeded;
  push(state, { id: newActionId(), kind: 'FUEL_MOVE', startTime: state.timeSec, endTime: state.timeSec + duration, payload: { amount, origin, destination, propNeeded } });
}

// Direct purchase of fuel to LEO: cost in funds is linear per ton.
export function buyFuelToLEO(state: GameEconomyState, tons: number, costPerTonBillion = 0.05) {
  if (tons <= 0) throw new Error('tons');
  const cost = tons * costPerTonBillion;
  if (state.fundsBillion < cost) throw new Error('Funds');
  // Deduct funds immediately, but fuel arrives after duration
  state.fundsBillion -= cost;
  // Fuel purchase lead time: at least one week; scale with tonnage (half-day per ton)
  const duration = Math.max(7*24*3600, Math.max(12*3600, tons * 12 * 3600));
  push(state, { id: newActionId(), kind: 'FUEL_PURCHASE', startTime: state.timeSec, endTime: state.timeSec + duration, payload: { tons, cost } });
}

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
      break;
    }
    case 'LAUNCH': {
      const item = state.inventory.find(i => i.id === act.payload.itemId);
      if (item && item.state === 'BUILT') { item.state = 'PREPPED_LAUNCH'; }
      break;
    }
    case 'ACTIVATE': {
      const { itemId, fuel } = act.payload;
      const it = state.inventory.find(i => i.id === itemId);
      if (it) {
        const bp = BLUEPRINT_INDEX.get(it.blueprint)!;
        if (fuel > 0 && it.location) {
          const loc = it.location as LocationId;
            state.fuel[loc] -= fuel; state.fuelReserved[loc] -= fuel;
        }
        // If impactor: upon activation, we consider it departing immediately (transition to in-transfer / en route)
        if (bp.type === 'small-impactor' || bp.type === 'large-impactor') {
          if (it.state === 'AT_LOCATION' && it.location) {
            // Create a notional transfer representing its intercept trajectory.
            // Destination left as same location for now; arrival far future placeholder.
            const origin = it.location as LocationId;
            const duration = 120 * 24 * 3600; // 120 days placeholder mission flight
            it.state = 'IN_TRANSFER';
            it.transfer = { origin, destination: origin, arrivalTime: state.timeSec + duration, fuelCost: 0 };
          }
        } else if (bp.type === 'laser-platform') {
          if (it.state === 'AT_LOCATION') it.state = 'ACTIVE_LOCATION';
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
      const { itemId, destination, origin, fuelCost } = act.payload as { itemId: string; destination: LocationId; origin: LocationId; fuelCost: number };
      const item = state.inventory.find(i => i.id === itemId);
      state.fuel[origin] -= fuelCost; state.fuelReserved[origin] -= fuelCost;
      if (item) { item.state = 'AT_LOCATION'; item.location = destination; item.transfer = undefined; }
      break;
    }
    case 'FUEL_MOVE': {
      const { amount, destination, origin, propNeeded } = act.payload as { amount: number; destination: LocationId; origin?: LocationId; propNeeded?: number };
      if (origin) {
        const o = origin as LocationId; const d = destination as LocationId;
        // Deduct payload and propellant reserved
        if (propNeeded) state.fuel[o] -= propNeeded;
        state.fuel[o] -= amount;
        state.fuelReserved[o] -= amount + (propNeeded || 0);
        state.fuel[d] += amount; // payload arrives entirely
      } else {
        // Legacy path (LEO purchase or LEO→dest simple send) should not appear now; kept for safety.
      }
      break;
    }
    case 'FUEL_PURCHASE': {
      const { tons } = act.payload as { tons: number };
      state.fuel['LEO'] += tons;
      break;
    }
  }
}

export function computeFuelCostForTransfer(massTons: number, origin: LocationId, destination: LocationId) {
  if (origin === destination) return massTons * 0.1; // small reposition cost
  // LEO <-> DEPLOYED transfer cost flat factor
  return massTons * 0.6; // aggregated propellant requirement
}
function computeTransferDuration(origin: LocationId, destination: LocationId) {
  if (origin === destination) return 7 * 24 * 3600; // one week internal ops
  return 60 * 24 * 3600; // 60 days between LEO and DEPLOYED
}

// Preview helpers (pure functions)
export const previewFuelPurchaseCost = (tons: number, costPerTonBillion = 0.05) => tons > 0 ? tons * costPerTonBillion : 0;
export const previewFuelMovePropellant = (tons: number, origin: LocationId, dest: LocationId) => {
  if (tons <= 0) return 0;
  return computeFuelCostForTransfer(tons, origin, dest);
};
export const previewItemTransferPropellant = (massTons: number, origin: LocationId, dest: LocationId) => previewFuelMovePropellant(massTons, origin, dest);
