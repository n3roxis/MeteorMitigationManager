// Scales
// POSITION_SCALE: pixels per AU (orbital distances stay in AU)
// RADIUS_SCALE: dimensionless exaggeration factor (1 = true physical radius relative to AU scale)
//   pixelRadius = (radiusKm / AU_IN_KM) * POSITION_SCALE * RADIUS_SCALE
//   NOTE: RADIUS_SCALE does NOT change when zooming (updateScales); zoom affects only orbital distances.
export const AU_IN_KM = 149_597_870.7;
export let POSITION_SCALE = 30; // px / AU
export let RADIUS_SCALE = 1; // exaggeration factor; 1 = true scale (would be subpixel for planets)
export const MIN_PIXEL_RADIUS = 2; // floor for visibility

// Sim time scale: simulated days per real second (default ~30 ≈ 1 month/sec)
export let SIM_DAYS_PER_REAL_SECOND = 1;

// Fixed physics rate (ticks per real second). Predictor and meteor should use same dt derived from this.
export const PHYSICS_TICKS_PER_SECOND = 300; // 100Hz physics
export function getSimDaysPerPhysicsTick(): number {
  return SIM_DAYS_PER_REAL_SECOND / PHYSICS_TICKS_PER_SECOND;
}

// Adjust time speed
export function setSimulationSpeed(daysPerSecond: number) {
  SIM_DAYS_PER_REAL_SECOND = Math.max(0, daysPerSecond);
}

export const MAX_POSITION_SCALE = 200000; // allow deep zoom
export const MIN_POSITION_SCALE = 10;

export function updateScales(mult: number) {
  const newPos = POSITION_SCALE * mult;
  POSITION_SCALE = Math.min(MAX_POSITION_SCALE, Math.max(MIN_POSITION_SCALE, newPos));
}

export function setRadiusScale(exaggeration: number) {
  RADIUS_SCALE = Math.min(20000, Math.max(1, exaggeration));
}
