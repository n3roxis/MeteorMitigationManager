// Centralized gameplay balance constants & helper functions for cost/time scaling
// All tunable numbers for quick iteration.

export const LAUNCH_COST_BASE_FUNDS = 0.10; // B$ base cost per launch
export const LAUNCH_COST_FUNDS_PER_TON = 0.09; // B$ per ton of mass

export const LAUNCH_PREP_BASE_DAYS = 3; // minimum prep
export const LAUNCH_PREP_DAYS_PER_TON = 0.15; // additional days per ton

// Transfer (delta-v) fuel factors (mass * factor = tons fuel)
export const TRANSFER_BASE_FACTOR = 0.45; // default orbital edge
export const TRANSFER_FACTOR_NEAR_L1_L2 = 0.25; // LEO <-> L1/L2 or L1 <-> L2
export const TRANSFER_FACTOR_L1L2_TO_L4L5 = 0.35; // L1/L2 <-> L4/L5
export const TRANSFER_FACTOR_L4L5_TO_L3 = 0.30; // L4/L5 <-> L3 (and reverse via rules)
export const TRANSFER_SAME_LOCATION_FACTOR = 0.05; // trivial reposition

// Transfer durations (days) for edges
export const TRANSFER_DAYS_BASE = 60;
export const TRANSFER_DAYS_NEAR_L1_L2 = 30;
export const TRANSFER_DAYS_L1L2_TO_L4L5 = 90;
export const TRANSFER_DAYS_L4L5_TO_L3 = 120;
export const TRANSFER_DAYS_SAME_LOCATION = 7;

// Rounding helpers
const round2 = (v:number) => Math.round(v*100)/100;

export function computeLaunchCostFunds(massTons: number): number {
  return round2(LAUNCH_COST_BASE_FUNDS + massTons * LAUNCH_COST_FUNDS_PER_TON);
}

export function computeLaunchPrepDurationSec(massTons: number): number {
  const days = Math.ceil(LAUNCH_PREP_BASE_DAYS + massTons * LAUNCH_PREP_DAYS_PER_TON);
  return days * 24 * 3600;
}
