// src/solar_system/utils/path_tools.ts
import { Graphics } from "pixi.js";
import { getSimDaysPerPhysicsTick, POSITION_SCALE } from "../../config/scales.ts";
import { SIM_TIME_DAYS } from "../../state/simulation.ts";
import { PLANETS } from "../../data/bodies.ts";
import { gravitationalAccelerationAtPoint, orbitalPositionAtTime } from "../../utils/orbitalMath.ts";
import { MEarthxGperAU3 } from "../../utils/constants.ts";
import {Vector} from "../../utils/Vector.ts";

export type PathPoint = { t: number; pos: Vector };

type Meta =
  | { body: any; hasOrbit: false }
  | {
  body: any; hasOrbit: true;
  semiMajorAxis: number; eccentricity: number; periodDays: number;
  inclinationDeg: number; longitudeAscendingNodeDeg: number; argumentOfPeriapsisDeg: number;
  orbitPhase: number;
};

/**
 * 1) Integriert über T_seconds und liefert Punkte mit Zeitstempeln (Sim-Sekunden).
 *    - Euler, Planeten am Schrittende (wie dein PathPredictor)
 *    - dt = getSimDaysPerPhysicsTick() (optional überschreibbar)
 */
export function computePathWithTimestamps(
  initialPos: Vector,
  initialVel: Vector,
  T_seconds: number,
  opts?: {
    stepSeconds?: number;   // optional: Schrittweite in Sim-Sekunden
    startSimDays?: number;  // optional: Start in Sim-Tagen (default: SIM_TIME_DAYS)
    maxSteps?: number;      // optional: Kappung (default 20000)
  }
): { points: PathPoint[]; endPos: Vector; endVel: Vector } {
  const stepSec = Math.abs(opts?.stepSeconds ?? getSimDaysPerPhysicsTick() * 86400);
  const sign = T_seconds >= 0 ? 1 : -1;
  const absT = Math.abs(T_seconds);
  const nWhole = Math.min(Math.floor(absT / stepSec), opts?.maxSteps ?? 20000);
  const remainder = absT - nWhole * stepSec;
  const startAbsSec = (opts?.startSimDays ?? SIM_TIME_DAYS) * 86400;

  // Planeten-Metadaten
  const meta: Meta[] = PLANETS.map(p => {
    const o = (p as any).orbit as any | undefined;
    if (!o) return { body: p, hasOrbit: false } as const;
    return {
      body: p, hasOrbit: true,
      semiMajorAxis: o.semiMajorAxis, eccentricity: o.eccentricity, periodDays: o.periodDays,
      inclinationDeg: o.inclinationDeg, longitudeAscendingNodeDeg: o.longitudeAscendingNodeDeg,
      argumentOfPeriapsisDeg: o.argumentOfPeriapsisDeg,
      orbitPhase: (p as any).orbitPhase || 0
    } as const;
  }).filter(m => m.body.massEarths > 300000) as Meta[];

  // Zustand (Vector, unverändert nach außen)
  let p = new Vector(initialPos.x, initialPos.y, initialPos.z);
  let v = new Vector(initialVel.x, initialVel.y, initialVel.z);

  const points: PathPoint[] = [];
  let accT = 0; // Sim-Sekunden relativ zum Start

  // Ein Euler-Schritt (dt signed), Planeten bei t_end
  const stepOnce = (dt: number) => {
    const futureAbsSec = startAbsSec + accT + dt;

    const bodies: { massEarths: number; position: { x: number; y: number; z: number } }[] = [];
    for (const m of meta) {
      if (m.hasOrbit) {
        const [rx, ry, rz] = orbitalPositionAtTime(
          {
            semiMajorAxis: m.semiMajorAxis, eccentricity: m.eccentricity, periodDays: m.periodDays,
            inclinationDeg: m.inclinationDeg, longitudeAscendingNodeDeg: m.longitudeAscendingNodeDeg,
            argumentOfPeriapsisDeg: m.argumentOfPeriapsisDeg
          },
          m.orbitPhase, futureAbsSec
        );
        bodies.push({ massEarths: (m.body as any).massEarths, position: { x: rx, y: ry, z: rz } });
      } else {
        bodies.push({ massEarths: (m.body as any).massEarths, position: (m.body as any).position });
      }
    }

    const [ax, ay, az] = gravitationalAccelerationAtPoint(p.x, p.y, p.z, bodies, MEarthxGperAU3);
    const a = new Vector(ax, ay, az);

    v = v.add(a.scale(dt));
    p = p.add(v.scale(dt));

    accT += dt;
    points.push({ t: accT, pos: p });
  };

  for (let i = 0; i < nWhole; i++) stepOnce(sign * stepSec);
  if (remainder > 0) stepOnce(sign * remainder);

  return { points, endPos: p, endVel: v };
}

/**
 * 2) Zeichnet eine Pfadliste (x,y werden mit POSITION_SCALE skaliert).
 *    Sehr simpel: Polyline, konstantes Alpha.
 */
export function drawPath(
  g: Graphics,
  path: PathPoint[],
  opts?: { width?: number; color?: number; alpha?: number }
) {
  const w = opts?.width ?? 2;
  const color = opts?.color ?? 0xff3333;
  const alpha = opts?.alpha ?? 1.0;

  g.clear();
  if (path.length < 2) return;

  g.moveTo(path[0].pos.x * POSITION_SCALE, path[0].pos.y * POSITION_SCALE);

  for (let i = 1; i < path.length; i++) {
    const p = path[i].pos;
    g.lineTo(p.x * POSITION_SCALE, p.y * POSITION_SCALE);
  }
  g.stroke({ width: w, color, alpha });
}
