// Scales
export let POSITION_SCALE = 2; // px / million km
export let RADIUS_SCALE = 50;  // px / million km
export const MIN_PIXEL_RADIUS = 2;

// Sim time scale: simulated days per real second (default ~30 ≈ 1 month/sec)
export let SIM_DAYS_PER_REAL_SECOND = 30;

// Adjust time speed
export function setSimulationSpeed(daysPerSecond: number) {
  SIM_DAYS_PER_REAL_SECOND = Math.max(0, daysPerSecond);
}

export function updateScales(mult: number) {
  const newPos = POSITION_SCALE * mult;
  const newRad = RADIUS_SCALE * mult;
  // Clamp ranges
  POSITION_SCALE = Math.min(200, Math.max(0.1, newPos));
  RADIUS_SCALE = Math.min(1000, Math.max(1, newRad));
}
