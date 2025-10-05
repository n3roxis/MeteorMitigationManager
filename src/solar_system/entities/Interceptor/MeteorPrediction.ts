import {Meteor} from "../Meteor.ts";
import {SIM_TIME_DAYS} from "../../state/simulation.ts";
import {getSimDaysPerPhysicsTick} from "../../config/scales.ts";
import {PLANETS} from "../../data/bodies.ts";
import {gravitationalAccelerationAtPoint, orbitalPositionAtTime} from "../../utils/orbitalMath.ts";
import {MEarthxGperAU3} from "../../utils/constants.ts";
import {Vector} from "../../utils/Vector.ts";

/**
 * Propagate a meteor forward (or backward) by T seconds of simulation time,
 * using the SAME fixed-step Euler scheme and analytic planet positions as PathPredictor.
 *
 * Returns the final position and velocity at exactly t0 + T (no mutation of the input meteor).
 *
 * @param meteor          The meteor whose current state is the start state.
 * @param T_seconds       Simulation seconds to propagate. Can be negative.
 * @param startSimDays    (optional) Absolute simulation time "now" in days. Defaults to SIM_TIME_DAYS.
 */
export function propagateMeteorToTime(
  meteor: Meteor,
  T_seconds: number,
  startSimDays: number = SIM_TIME_DAYS
): {position: Vector, velocity: Vector} {
  // Snapshot initial state (don’t mutate the meteor)
  let px = meteor.position.x;
  let py = meteor.position.y;
  let pz = meteor.position.z;
  let vx = meteor.velocity.x;
  let vy = meteor.velocity.y;
  let vz = meteor.velocity.z;

  // Step size identical to the physics tick used elsewhere
  const baseStepDays = getSimDaysPerPhysicsTick();
  const baseStepSec = baseStepDays * 86400;

  // Build a minimal, reusable snapshot of the planets' orbital elements
  const planetOrbitMeta = PLANETS.map(p => {
    const o = (p as any).orbit as any | undefined;
    if (!o) {
      return {
        body: p,
        hasOrbit: false as const,
      };
    }
    const {
      semiMajorAxis,
      eccentricity,
      inclinationDeg,
      longitudeAscendingNodeDeg,
      argumentOfPeriapsisDeg,
      periodDays,
    } = o;
    return {
      body: p,
      hasOrbit: true as const,
      semiMajorAxis,
      eccentricity,
      inclinationDeg,
      longitudeAscendingNodeDeg,
      argumentOfPeriapsisDeg,
      periodDays,
      orbitPhase: (p as any).orbitPhase || 0,
    };
  });

  // We might need a partial last step to land exactly at T
  const total = Math.abs(T_seconds);
  const nWhole = Math.floor(total / baseStepSec);
  const remainder = total - nWhole * baseStepSec;

  // Choose sign for forward/backward propagation
  const sgn = T_seconds >= 0 ? 1 : -1;

  const startAbsSec = startSimDays * 86400;

  // Advance for N whole steps
  for (let i = 0; i < nWhole; i++) {
    const dt = sgn * baseStepSec;
    const futureAbsSec = startAbsSec + (i + 1) * dt; // match PathPredictor’s use of “futureBodies” at t_{k+1}

    // Assemble planet states at this future instant
    const futureBodies: Array<{ massEarths: number; position: { x: number; y: number; z: number } }> = [];
    for (const meta of planetOrbitMeta) {
      if (meta.hasOrbit) {
        const [rx, ry, rz] = orbitalPositionAtTime(
          {
            semiMajorAxis: meta.semiMajorAxis,
            eccentricity: meta.eccentricity,
            periodDays: meta.periodDays,
            inclinationDeg: meta.inclinationDeg,
            longitudeAscendingNodeDeg: meta.longitudeAscendingNodeDeg,
            argumentOfPeriapsisDeg: meta.argumentOfPeriapsisDeg,
          },
          (meta as any).orbitPhase || 0,
          futureAbsSec
        );
        futureBodies.push({ massEarths: (meta.body as any).massEarths, position: { x: rx, y: ry, z: rz } });
      } else {
        futureBodies.push({ massEarths: (meta.body as any).massEarths, position: (meta.body as any).position });
      }
    }

    // Euler step (same as PathPredictor)
    const [ax, ay, az] = gravitationalAccelerationAtPoint(px, py, pz, futureBodies, MEarthxGperAU3);
    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;
    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
  }

  // Final partial step if needed (exact landing on T)
  if (remainder > 0) {
    const dt = sgn * remainder;
    const futureAbsSec = startAbsSec + nWhole * sgn * baseStepSec + dt;

    const futureBodies: Array<{ massEarths: number; position: { x: number; y: number; z: number } }> = [];
    for (const meta of planetOrbitMeta) {
      if ((meta as any).hasOrbit) {
        const [rx, ry, rz] = orbitalPositionAtTime(
          {
            semiMajorAxis: (meta as any).semiMajorAxis,
            eccentricity: (meta as any).eccentricity,
            periodDays: (meta as any).periodDays,
            inclinationDeg: (meta as any).inclinationDeg,
            longitudeAscendingNodeDeg: (meta as any).longitudeAscendingNodeDeg,
            argumentOfPeriapsisDeg: (meta as any).argumentOfPeriapsisDeg,
          },
          (meta as any).orbitPhase || 0,
          futureAbsSec
        );
        futureBodies.push({ massEarths: (meta.body as any).massEarths, position: { x: rx, y: ry, z: rz } });
      } else {
        futureBodies.push({ massEarths: (meta.body as any).massEarths, position: (meta.body as any).position });
      }
    }

    const [ax, ay, az] = gravitationalAccelerationAtPoint(px, py, pz, futureBodies, MEarthxGperAU3);
    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;
    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
  }

  return {position: new Vector(px, py, pz), velocity: new Vector(vx,vy,vz)}
}
