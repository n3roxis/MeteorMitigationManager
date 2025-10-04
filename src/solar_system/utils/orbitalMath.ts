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

/** Sample orbit directly into a preallocated Float32Array buffer (x,y pairs). Length must be >= (steps+1)*2. */
export function sampleOrbitInto(
  semiMajorAxis: number,
  eccentricity: number,
  inclinationDeg: number,
  ascendingNodeDeg: number,
  argPeriapsisDeg: number,
  steps: number,
  out: Float32Array
): void {
  for (let k = 0; k <= steps; k++) {
    const E = (k / steps) * Math.PI * 2;
    const [xPrime, yPrime] = orbitalPlanePosition(semiMajorAxis, eccentricity, E);
    const [x, y] = rotateOrbitalToXYZ(xPrime, yPrime, inclinationDeg, ascendingNodeDeg, argPeriapsisDeg);
    const o = k * 2;
    if (o + 1 < out.length) {
      out[o] = x;
      out[o + 1] = y;
    }
  }
}

// ---------- NEW SHARED HELPERS ----------

export interface FullOrbitalElements {
  semiMajorAxis: number; // AU
  eccentricity: number;
  periodDays: number; // orbital period in days
  inclinationDeg: number;
  longitudeAscendingNodeDeg: number;
  argumentOfPeriapsisDeg: number;
}

/** Compute inertial position [x,y,z] of a body with given orbital elements at absolute time (seconds) and phase (0..1). */
export function orbitalPositionAtTime(elements: FullOrbitalElements, phase: number, timeSeconds: number): [number, number, number] {
  const periodSec = elements.periodDays * 86400;
  const M = meanAnomaly(timeSeconds, phase, periodSec);
  const E = solveEccentricAnomaly(M, elements.eccentricity);
  const [xPrime, yPrime] = orbitalPlanePosition(elements.semiMajorAxis, elements.eccentricity, E);
  return rotateOrbitalToXYZ(
    xPrime,
    yPrime,
    elements.inclinationDeg,
    elements.longitudeAscendingNodeDeg,
    elements.argumentOfPeriapsisDeg
  );
}

/**
 * Compute total gravitational acceleration vector at point (px,py,pz) due to bodies.
 * Bodies must expose massEarths and position{x,y,z}. Gscaled is gravitational constant scaled for AU & Earth masses.
 */
export function gravitationalAccelerationAtPoint(
  px: number,
  py: number,
  pz: number,
  bodies: Array<{ massEarths: number; position: { x: number; y: number; z: number } }>,
  Gscaled: number,
  eps = 1e-12
): [number, number, number] {
  let ax = 0, ay = 0, az = 0;
  for (const b of bodies) {
    const dx = px - b.position.x;
    const dy = py - b.position.y;
    const dz = pz - b.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + eps;
    const invR = 1 / dist;
    const accMag = - b.massEarths * Gscaled * invR * invR; // -GM/r^2 (direction from body to point)
    ax += dx * invR * accMag;
    ay += dy * invR * accMag;
    az += dz * invR * accMag;
  }
  return [ax, ay, az];
}
