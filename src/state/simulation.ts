// Global simulation time in seconds (sidereal days converted to seconds)
export let SIM_TIME_SECONDS = 0;

export function resetSimulationTime() {
  SIM_TIME_SECONDS = 0;
}

// Advance simulation by a delta expressed directly in simulation days
export function advanceSimulation(simDeltaDays: number) {
  // Convert days -> seconds
  SIM_TIME_SECONDS += simDeltaDays * 86400;
}
