// Orbital mechanics helpers (angles in radians unless *Deg)

export interface OrbitalElements {
  a: number;
  e: number;
  inclinationDeg: number;
  ascendingNodeDeg: number;
  argPeriapsisDeg: number;
}

/** Solve Kepler's Equation M = E - e sin E. */
export function solveEccentricAnomaly(M: number, e: number, iters = 5): number {
  let E = M;
  for (let i = 0; i < iters; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    E -= f / fp;
  }
  return E;
}

/** Orbital-plane position (periapsis on +x). */
export function orbitalPlanePosition(a: number, e: number, E: number): [number, number] {
  const xPrime = a * (Math.cos(E) - e);
  const yPrime = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return [xPrime, yPrime];
}

/** Transform orbital-plane (x', y') to inertial XYZ. */
export function rotateOrbitalToXYZ(xPrime: number, yPrime: number, inclinationDeg: number, ascendingNodeDeg: number, argPeriapsisDeg: number): [number, number, number] {
  const inc = (inclinationDeg * Math.PI) / 180;
  const Omega = (ascendingNodeDeg * Math.PI) / 180;
  const omega = (argPeriapsisDeg * Math.PI) / 180;
  // Rz(omega)
  const cosw = Math.cos(omega), sinw = Math.sin(omega);
  const x1 = cosw * xPrime - sinw * yPrime;
  const y1 = sinw * xPrime + cosw * yPrime;
  const z1 = 0;
  // Rx(inc)
  const cosi = Math.cos(inc), sini = Math.sin(inc);
  const x2 = x1;
  const y2 = cosi * y1 - sini * z1;
  const z2 = sini * y1 + cosi * z1;
  // Rz(Omega)
  const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
  const x = cosO * x2 - sinO * y2;
  const y = sinO * x2 + cosO * y2;
  const z = z2;
  return [x, y, z];
}

/** Mean anomaly with phase offset. */
export function meanAnomaly(timeSec: number, phase: number, periodSec: number): number {
  const n = (2 * Math.PI) / periodSec; // mean motion
  return (phase + n * timeSec) % (2 * Math.PI);
}

/** Sample an orbit into XY (inertial frame projected) points (z discarded) */
export function sampleOrbit(
  semiMajorAxis: number,
  eccentricity: number,
  inclinationDeg: number,
  ascendingNodeDeg: number,
  argPeriapsisDeg: number,
  steps: number
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let k = 0; k <= steps; k++) {
    const E = (k / steps) * Math.PI * 2;
    const [xPrime, yPrime] = orbitalPlanePosition(semiMajorAxis, eccentricity, E);
    const [x, y] = rotateOrbitalToXYZ(xPrime, yPrime, inclinationDeg, ascendingNodeDeg, argPeriapsisDeg);
    pts.push([x, y]);
  }
  return pts;
}
