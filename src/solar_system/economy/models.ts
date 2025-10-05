// Economy models and types
export type ResearchId = 'small-kinetic' | 'large-kinetic' | 'space-laser' | 'tsunami-dams' | 'giant-kinetic' | 'orbital-tanker-tech' | 'orbital-habitat-tech';
export type BuildableType = 'small-impactor' | 'large-impactor' | 'giant-impactor' | 'laser-platform' | 'fuel-tank' | 'tsunami-dam-module' | 'orbital-tanker' | 'orbital-habitat';
// Simplified location model: only Low Earth Orbit and an aggregated 'DEPLOYED' region for anything beyond
export type LocationId = 'LEO' | 'DEPLOYED' | 'SE_L1' | 'SE_L2' | 'SE_L3' | 'SE_L4' | 'SE_L5';

export interface ResearchDef {
  id: ResearchId;
  name: string;
  costFunds: number; // billions
  durationSec: number;
  unlocks: BuildableType[];
  prereq?: ResearchId[];
}

export interface BuildableBlueprint {
  type: BuildableType;
  name: string;
  buildCostFunds: number; // billions
  buildDurationSec: number; // seconds
  massTons: number;
  launchCostFunds: number; // billions
  activationFuelTons?: number;
  activationDurationSec?: number;
}

export type InventoryState =
  | 'PLANNED'
  | 'BUILDING'
  | 'BUILT'
  | 'PREPPED_LAUNCH'
  | 'PREPPED_LANDING'
  | 'PREPPED_ACTIVATION'
  | 'AT_LOCATION'
  | 'ACTIVE_LOCATION'
  | 'IN_TRANSFER';

export interface InventoryItem {
  id: string;
  blueprint: BuildableType;
  state: InventoryState;
  massTons: number;
  location?: LocationId;
  transfer?: { origin: LocationId; destination: LocationId; departureTime: number; arrivalTime: number; fuelCost: number; realDepartureMs: number; realArrivalMs: number };
  // Optional onboard fuel tracking for space-capable assets
  fuelTons?: number; // current onboard fuel
  fuelCapacityTons?: number; // maximum onboard fuel (initialized from activationFuelTons if defined)
  prevStateForLanding?: InventoryState; // remember original state (AT_LOCATION or ACTIVE_LOCATION) before landing prep
  // Cached activation (Lambert) trajectory viability while in PREPPED_ACTIVATION for impactors
  // This lets the UI disable the ACTIVATE button until a viable flight path is found.
  activationTrajectory?: {
    viable: boolean;            // true if at least one trajectory solution currently exists
    checkedAt: number;          // ms timestamp of last solver attempt
    flightTimeSec?: number;     // cached chosen path flight time
    depVel?: [number,number,number];   // departure velocity vector components
    meteorDelta?: [number,number,number]; // meteor delta-v to apply at impact
  };
}

export type ActionKind =
  | 'RESEARCH'
  | 'BUILD'
  | 'LAUNCH'
  | 'ACTIVATE_PREP'
  | 'LAND'
  | 'ABORT_PREP'
  | 'FUEL_TRANSFER'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'TRANSFER_OBJECT'
  | 'FUEL_MOVE'
  | 'FUEL_PURCHASE';

export interface ScheduledAction {
  id: string;
  kind: ActionKind;
  startTime: number;
  endTime: number;
  payload: any;
  status: 'PENDING' | 'DONE' | 'CANCELLED';
}

export interface GameEconomyState {
  timeSec: number;
  fundsBillion: number;
  researchUnlocked: Set<ResearchId>;
  researchInProgress: Set<ResearchId>;
  inventory: InventoryItem[];
  actions: ScheduledAction[];
}
