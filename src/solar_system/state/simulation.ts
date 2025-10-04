// Global simulation time stored in DAYS for clarity.
export let SIM_TIME_DAYS = 0;

export function resetSimulationTime() {
  SIM_TIME_DAYS = 0;
}

// Advance simulation by a delta expressed directly in simulation days
export function advanceSimulation(simDeltaDays: number) {
  SIM_TIME_DAYS += simDeltaDays;
}
