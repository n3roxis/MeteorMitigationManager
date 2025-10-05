import { Vector } from './Vector';

/**
 * Compute classical L1-L5 Lagrange point positions in the rotating frame and convert
 * to inertial coordinates given instantaneous primary (M1) and secondary (M2) positions.
 * Assumptions:
 *  - Two-body system, M1 >> M2 (good for Sun-Earth, Earth-Moon)
 *  - Positions given in AU in inertial frame
 *  - Returns positions in AU in inertial frame
 *  - Uses standard approximate 1D solutions for collinear points; equilateral geometry for L4/L5
 */
export function computeLagrangePoints(primaryPos: Vector, secondaryPos: Vector, m1: number, m2: number) {
  // Mass ratio mu = m2/(m1+m2) with m1 the primary (larger) mass.
  const mu = m2 / (m1 + m2);
  const rVec = secondaryPos.subtract(primaryPos);
  const R = rVec.length();
  if (R === 0) {
    const zero = new Vector(primaryPos.x, primaryPos.y, primaryPos.z);
    return { L1: zero, L2: zero, L3: zero, L4: zero, L5: zero };
  }
  const rHat = rVec.scale(1 / R);

  // First-order small-mu approximations (good for Sun-Earth, Earth-Moon):
  // Distances from the secondary along the line toward/away from primary.
  // L1 distance d1 ≈ R * (mu/3)^{1/3}
  // L2 distance d2 ≈ R * (mu/3)^{1/3}
  // L3 from primary opposite side: R * (1 + 5*mu/12)
  const d = R * Math.cbrt(mu / 3);
  const rL1 = R - d;   // from primary to L1
  const rL2 = R + d;   // from primary to L2
  const rL3 = R * (1 + (5 * mu) / 12);

  const L1 = primaryPos.add(rHat.scale(rL1));
  const L2 = primaryPos.add(rHat.scale(rL2));
  const L3 = primaryPos.subtract(rHat.scale(rL3));

  // L4 / L5: equilateral triangle vertices with the primary-secondary baseline.
  // Construct using rotation about primary then translate.
  const rx = rVec.x, ry = rVec.y;
  const angle60 = Math.PI / 3;
  const cos60 = Math.cos(angle60); // 0.5
  const sin60 = Math.sin(angle60); // ~0.86602540378
  // Rotate secondary offset by +60 degrees for L4, -60 degrees for L5 around primary.
  const L4 = new Vector(
    primaryPos.x + rx * cos60 - ry * sin60,
    primaryPos.y + rx * sin60 + ry * cos60,
    primaryPos.z
  );
  const L5 = new Vector(
    primaryPos.x + rx * cos60 + ry * sin60,
    primaryPos.y - rx * sin60 + ry * cos60,
    primaryPos.z
  );

  return { L1, L2, L3, L4, L5 };
}
