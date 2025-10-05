// Economy models and types
export type ResearchId = 'small-kinetic' | 'large-kinetic' | 'space-laser' | 'tsunami-dams' | 'giant-kinetic';
export type BuildableType = 'small-impactor' | 'large-impactor' | 'giant-impactor' | 'laser-platform' | 'fuel-tank' | 'tsunami-dam-module';
// Simplified location model: only Low Earth Orbit and an aggregated 'DEPLOYED' region for anything beyond
export type LocationId = 'LEO' | 'DEPLOYED';

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
  | 'AT_LOCATION'
  | 'ACTIVE_LOCATION'
  | 'IN_TRANSFER';

export interface InventoryItem {
  id: string;
  blueprint: BuildableType;
  state: InventoryState;
  massTons: number;
  location?: LocationId;
  transfer?: { origin: LocationId; destination: LocationId; arrivalTime: number; fuelCost: number };
}

export type ActionKind =
  | 'RESEARCH'
  | 'BUILD'
  | 'LAUNCH'
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
  fuel: Record<LocationId, number>; // free fuel at each location (LEO + DEPLOYED)
  fuelReserved: Record<LocationId, number>; // reserved fuel at each location
  researchUnlocked: Set<ResearchId>;
  researchInProgress: Set<ResearchId>;
  inventory: InventoryItem[];
  actions: ScheduledAction[];
}
