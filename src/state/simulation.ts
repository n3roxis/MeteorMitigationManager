import { SIM_DAYS_PER_REAL_SECOND } from '../config/scales';

// Global simulation time in seconds (sidereal days converted to seconds)
export let SIM_TIME_SECONDS = 0;

export function resetSimulationTime() {
  SIM_TIME_SECONDS = 0;
}

export function advanceSimulation(realDeltaSeconds: number) {
  // Advance by configured days/sec * 86400 to convert days to seconds
  SIM_TIME_SECONDS += realDeltaSeconds * SIM_DAYS_PER_REAL_SECOND * 86400;
}
