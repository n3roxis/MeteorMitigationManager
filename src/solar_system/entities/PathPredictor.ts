import {Application, Graphics} from 'pixi.js';
import {UpdatableEntity} from './Entity';
import {Meteor} from './Meteor';
import {PLANETS} from '../data/bodies';
import {orbitalPositionAtTime, gravitationalAccelerationAtPoint} from '../utils/orbitalMath';
import {POSITION_SCALE, getSimDaysPerPhysicsTick} from '../config/scales';
import {SIM_TIME_DAYS} from '../state/simulation';
import {DEBUG_ME, MEarthxGperAU3, RADIUS_OF_EARTH_AU} from '../utils/constants';
import {Vector} from "../utils/Vector.ts";
import {DataBroker, Impact, vectorToLongLat} from "../../Logic/Utils/TranslationInterface.ts";

/**
 * PathPredictor attaches to a dynamic body (e.g., Meteor) and renders a dashed
 * future trajectory based on current position + velocity. Simplified version:
 * per prediction step planets are advanced with the SAME analytic Kepler math
 * used in Planet.update (no per-step caching) and the meteor is advanced with
 * the SAME Euler scheme as Meteor.update. Step size approximates one simulation
 * frame (SIM_DAYS_PER_REAL_SECOND / 60 days). This yields a preview that matches
 * the main simulation integrator behavior instead of a higher-order scheme.
 */
export class PathPredictor implements UpdatableEntity {
  id: string;
  private target: Meteor;
  private gfx: Graphics | null = null;
  // Position required by UpdatableEntity. For a predictor we mirror target position.
  position = {x: 0, y: 0, z: 0} as any; // minimal vector-like object; target holds real state

  // Prediction parameters (simulation time based)
  // steps is the CURRENT dynamically allocated count of prediction samples.
  // It is NOT a constant horizon indicator. We start at 0 so it's obvious that
  // the first call to recomputePath() derives the real value from horizonDays
  // and step size (SIM_DAYS_PER_REAL_SECOND / 60). Keeping an old non-zero
  // literal here (like 1500) was misleading because the code immediately
  // recomputed it, making that literal meaningless.
  private steps = 0;
  private horizonDays = 365;           // one year ahead (simpler for now)
  private recomputeIntervalSimSeconds = 24 * 3600 * 4; // recompute every simulation day (large horizon expensive)
  private accumulatorSimSeconds = 0;   // accumulate simulation seconds
  // Throttling: only recompute every N physics ticks unless large change
  private ticksSinceLast = 0;
  // Baseline periodic recompute frequency. Previously 20 (5/sec) which was expensive with a 1-year horizon.
  // Relaxed to 60 (~1.67/sec) to cut cost dramatically while still updating reasonably often.
  private recomputeEveryTicks = 60 * 2; // 100Hz / 60 ≈ 1.67 recomputes per second baseline
  // Heading / speed thresholds were very sensitive (0.5° / 1%) causing bursts of recomputes near perihelion.
  // Loosen them so we don't thrash when gravity sharply turns the trajectory near the Sun.
  private headingEpsilonDeg = 2.0; // degrees
  private speedRelEpsilon = 0.05; // 5% relative speed change
  // Enforce a minimum spacing between forced recomputes even if thresholds keep triggering.
  private minForcedRecomputeTicks = 60; // at least ~0.6s between forced (non-periodic) recomputes
  private lastSpeed = NaN;
  private lastHeadingDeg = NaN;

  DEBUG_SAMPLE = -1

  // Cached last state to detect major changes (optional future use)
  private lastVX = NaN;
  private lastVY = NaN;
  private lastPX = NaN;
  private lastPY = NaN;

  // Reusable arrays to avoid allocations
  private path: Float32Array; // screen-space x,y pairs after scaling
  // Minimal orbital element snapshot (no per-step position cache)
  private planetOrbitMeta: {
    body: any;
    hasOrbit: boolean;
    semiMajorAxis: number;
    eccentricity: number;
    inclinationDeg: number;
    longitudeAscendingNodeDeg: number;
    argumentOfPeriapsisDeg: number;
    periodDays: number;
    orbitPhase: number;
  }[] = [];

  constructor(id: string, target: Meteor) {
    this.id = id;
    this.target = target;
    // Allocate an empty buffer; real size allocated on first recompute.
    this.path = new Float32Array(0);
  }

  private forceNext = false;

  // External hook: force a path rebuild on next update (e.g., zoom / resize changes scale perception)
  markDirty() {
    this.forceNext = true;
  }

  private metaEarth!: typeof this.planetOrbitMeta[number];
  private metaEarthBary!: typeof this.planetOrbitMeta[number];
  private metaSun!: typeof this.planetOrbitMeta[number];

  private futureBodies = [{massEarths: 0, position: {x: 0, y: 0, z: 0}}]; // length 1: SUN only

  start(app: Application): void {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
    // Snapshot orbital elements; reuse planet.orbitPhase (same param Planet.ts uses in meanAnomaly)
    this.planetOrbitMeta = PLANETS.map(p => {
      const o = p.orbit as any;
      if (!o) return {
        body: p,
        hasOrbit: false,
        semiMajorAxis: 0,
        eccentricity: 0,
        inclinationDeg: 0,
        longitudeAscendingNodeDeg: 0,
        argumentOfPeriapsisDeg: 0,
        periodDays: 1,
        orbitPhase: 0
      };
      const {
        semiMajorAxis,
        eccentricity,
        inclinationDeg,
        longitudeAscendingNodeDeg,
        argumentOfPeriapsisDeg,
        periodDays
      } = o;
      return {
        body: p,
        hasOrbit: true,
        semiMajorAxis,
        eccentricity,
        inclinationDeg,
        longitudeAscendingNodeDeg,
        argumentOfPeriapsisDeg,
        periodDays,
        orbitPhase: (p as any).orbitPhase || 0
      };
    });

    const byId = new Map(this.planetOrbitMeta.map(m => [m.body.id, m]));
    this.metaEarth = byId.get('earth')!;
    this.metaEarthBary = byId.get('earth-moon-bary')!;
    this.metaSun = byId.get('sun')!;

    this.futureBodies[0].massEarths = this.metaSun.body.massEarths;

    this.recomputePath();
  }

  update(dt: number): void {
    if (!this.gfx) return;
    // Accumulate simulation seconds (dt passed into entities is sim seconds)
    this.accumulatorSimSeconds += dt;
    this.ticksSinceLast++;

    const stateChanged = (
      this.target.velocity.x !== this.lastVX ||
      this.target.velocity.y !== this.lastVY ||
      this.target.position.x !== this.lastPX ||
      this.target.position.y !== this.lastPY
    );
    let force = false;
    // Heading & speed change detection
    const vx = this.target.velocity.x;
    const vy = this.target.velocity.y;
    const speed = Math.hypot(vx, vy);
    if (speed > 0) {
      const headingDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
      if (!Number.isNaN(this.lastHeadingDeg)) {
        const dh = Math.abs(headingDeg - this.lastHeadingDeg);
        if (dh > this.headingEpsilonDeg) force = true;
      }
      if (!Number.isNaN(this.lastSpeed)) {
        const dsRel = Math.abs(speed - this.lastSpeed) / (this.lastSpeed || 1);
        if (dsRel > this.speedRelEpsilon) force = true;
      }
      this.lastHeadingDeg = headingDeg;
      this.lastSpeed = speed;
    }

    const timeBased = this.accumulatorSimSeconds >= this.recomputeIntervalSimSeconds;
    const tickBased = this.ticksSinceLast >= this.recomputeEveryTicks;
    // Only allow force-triggered recompute if we've waited long enough since last one
    const allowForced = this.ticksSinceLast >= this.minForcedRecomputeTicks;
    if (this.forceNext || timeBased || (force && allowForced) || (tickBased && stateChanged)) {
      this.recomputePath();
      this.accumulatorSimSeconds = 0;
      this.ticksSinceLast = 0;
      this.forceNext = false;
    }
  }

  // Maybe useful for debugging
  private collisionDetected = false
  private debug_closest: number = 100
  private debug_Rclosest: Vector | null = null

  private recomputePath() {
    if (!this.gfx) return;
    let px = this.target.position.x;
    let py = this.target.position.y;
    let pz = this.target.position.z;
    let vx = this.target.velocity.x;
    let vy = this.target.velocity.y;
    let vz = this.target.velocity.z;

    // Use same physics tick as the meteor (100Hz fixed) for matching integration.
    const stepDays = getSimDaysPerPhysicsTick();
    const stepSeconds = stepDays * 86400; // entity dt seconds identical to Meteor.update usage
    const horizonSeconds = this.horizonDays * 86400;
    // Derive how many fixed-size steps fit into the horizon. Clamped to avoid
    // pathological allocations. This is the ONLY place steps is set.
    const neededSteps = Math.max(50, Math.min(20000, Math.floor(horizonSeconds / stepSeconds)));
    if (neededSteps !== this.steps) {
      this.steps = neededSteps;
      if (this.path.length !== this.steps * 2) this.path = new Float32Array(this.steps * 2);
    }

    const startSimSeconds = SIM_TIME_DAYS * 86400; // convert stored days to seconds

    let previousEarthLoc: Vector | null = null
    let previousMeteorLoc: Vector | null = null
    let futureEarthLoc: Vector | null = null
    let futureMeteorLoc: Vector | null = null
    let futureAbsSeconds: number = 0

    const checkCollision = (): boolean => {

      if (!previousEarthLoc || !previousMeteorLoc || !futureEarthLoc || !futureMeteorLoc) {
        previousEarthLoc = futureEarthLoc;
        previousMeteorLoc = futureMeteorLoc;
        return false
      }

      const E1 = previousEarthLoc
      const E2 = futureEarthLoc!
      const A1 = previousMeteorLoc!
      const A2 = futureMeteorLoc!

      const T1 = futureAbsSeconds - stepSeconds
      const dT = stepSeconds

      const deltaE = E2.subtract(E1)
      const deltaA = A2.subtract(A1)


      // Transform in rest frame of earth, posE = const, posA = A1 + dt * deltaATilde
      const deltaATilde = deltaA.subtract(deltaE)

      let closestDistance = Infinity
      let rClosest!: Vector
      let collisionT: number | null = null
      let collisionS: number | null = null  // dimensionsloser Parameter 0..1

      ChatGPT: {
        const r0 = A1.subtract(E1);                 // AU

        const deltaATildeP2 = deltaATilde.dot(deltaATilde);
        const b = 2 * r0.dot(deltaATilde);
        const roP2 = r0.dot(r0) - RADIUS_OF_EARTH_AU * RADIUS_OF_EARTH_AU;

        let _collisionS: number | null = null;

        if (deltaATildeP2 > 0) {
          let sClosest = -r0.dot(deltaATilde) / deltaATildeP2;
          sClosest = Math.max(0, Math.min(1, sClosest));
          rClosest = r0.add(deltaATilde.scale(sClosest)); // AU
          closestDistance = rClosest.length();       // AU

          const disc = b * b - 4 * deltaATildeP2 * roP2;
          const eps = 1e-14;
          if (disc >= -eps) {
            const sqrtDisc = Math.sqrt(Math.max(0, disc));
            const s1 = (-b - sqrtDisc) / (2 * deltaATildeP2);
            const s2 = (-b + sqrtDisc) / (2 * deltaATildeP2);
            const sHit = [s1, s2].find(s => s >= 0 && s <= 1);
            if (sHit !== undefined) {
              _collisionS = sHit; // 0..1
            }
          }
        } else {
          closestDistance = r0.length();
        }
        collisionS = _collisionS;
        collisionT = _collisionS !== null ? _collisionS * dT : null; // Sekunden
      }

      if (closestDistance < this.debug_closest) {
        this.debug_closest = closestDistance
        this.debug_Rclosest = rClosest
      }


      // Impact nur, wenn echter Schnitt innerhalb des Schritts gefunden wurde
      if (collisionS !== null) {
        const s = collisionS
        const collisionE = E1.add(deltaE.scale(s))           // AU
        const collisionA = A1.add(deltaA.scale(s))           // AU
        const collisionR = collisionA.subtract(collisionE)   // AU

        const vRelAuPerSec = deltaATilde.scale(1 / dT)       // AU/s

        const velocity = vRelAuPerSec.length()               // AU/s
        const angle = Math.acos(collisionR.normalized().dot(vRelAuPerSec.normalized()))
        const timeOfImpact = startSimSeconds + T1 + (collisionT ?? 0) // TODO this value is wrong
        const {longitude, latitude} = vectorToLongLat(collisionR, timeOfImpact)
        const impact: Impact = {
          velocity: velocity,            // AU/s
          angle: angle,
          mass: this.target.mass * DEBUG_ME,
          density: 0,
          longLat: {longitude, latitude},
        }
        DataBroker.instance.setImpact(impact)
        console.log("Collision detected: " + collisionR.x + " " + collisionR.y + " " + collisionR.z) // " " + impact.velocity + " " + impact.angle)
      } else {
        DataBroker.instance.setImpact(null)
      }
      previousEarthLoc = futureEarthLoc;
      previousMeteorLoc = futureMeteorLoc;

      return collisionS !== null;
    }

    this.DEBUG_SAMPLE++

    for (let i = 0; i < this.steps; i++) {
      futureAbsSeconds = startSimSeconds + (i + 1) * stepSeconds;
      // Build temporary bodies array with analytic planet positions at this future time

      futureEarthLoc = new Vector(0, 0, 0)
      const futureBodies: Array<{ massEarths: number; position: { x: number; y: number; z: number } }> = []

      EARTH: {
        const meta = this.metaEarth
        const [rx, ry, rz] = orbitalPositionAtTime({
          semiMajorAxis: meta.semiMajorAxis,
          eccentricity: meta.eccentricity,
          periodDays: meta.periodDays,
          inclinationDeg: meta.inclinationDeg,
          longitudeAscendingNodeDeg: meta.longitudeAscendingNodeDeg,
          argumentOfPeriapsisDeg: meta.argumentOfPeriapsisDeg
        }, meta.orbitPhase || 0, futureAbsSeconds);
        futureEarthLoc = futureEarthLoc.add(new Vector(rx, ry, rz))
      }

      EARTH_MOON_BARY: {
        const meta = this.metaEarthBary
        const [rx, ry, rz] = orbitalPositionAtTime({
          semiMajorAxis: meta.semiMajorAxis,
          eccentricity: meta.eccentricity,
          periodDays: meta.periodDays,
          inclinationDeg: meta.inclinationDeg,
          longitudeAscendingNodeDeg: meta.longitudeAscendingNodeDeg,
          argumentOfPeriapsisDeg: meta.argumentOfPeriapsisDeg
        }, meta.orbitPhase || 0, futureAbsSeconds);
        futureEarthLoc = futureEarthLoc.add(new Vector(rx, ry, rz))
      }

      SUN : {
        const meta = this.metaSun
        /*
        const [rx, ry, rz] = orbitalPositionAtTime({
          semiMajorAxis: meta.semiMajorAxis,
          eccentricity: meta.eccentricity,
          periodDays: meta.periodDays,
          inclinationDeg: meta.inclinationDeg,
          longitudeAscendingNodeDeg: meta.longitudeAscendingNodeDeg,
          argumentOfPeriapsisDeg: meta.argumentOfPeriapsisDeg
        }, meta.orbitPhase || 0, futureAbsSeconds);
         */
        futureBodies.push({massEarths: meta.body.massEarths, position: {x: 0, y: 0, z: 0}});
      }

      /*
      for (const meta of this.planetOrbitMeta) {
        if (meta.hasOrbit) {
          const [rx, ry, rz] = orbitalPositionAtTime({
            semiMajorAxis: meta.semiMajorAxis,
            eccentricity: meta.eccentricity,
            periodDays: meta.periodDays,
            inclinationDeg: meta.inclinationDeg,
            longitudeAscendingNodeDeg: meta.longitudeAscendingNodeDeg,
            argumentOfPeriapsisDeg: meta.argumentOfPeriapsisDeg
          }, meta.orbitPhase || 0, futureAbsSeconds);
          futureBodies.push({massEarths: meta.body.massEarths, position: {x: rx, y: ry, z: rz}});
          if (meta.body.id === 'earth' || meta.body.id === 'earth-moon-bary') {
            futureEarthLoc = futureEarthLoc.add(new Vector(rx, ry, rz))
          }
        } else {
          futureBodies.push({massEarths: meta.body.massEarths, position: meta.body.position});
        }
      }

       */

      const [ax, ay, az] = gravitationalAccelerationAtPoint(px, py, pz, futureBodies, MEarthxGperAU3);
      vx += ax * stepSeconds;
      vy += ay * stepSeconds;
      vz += az * stepSeconds;
      px += vx * stepSeconds;
      py += vy * stepSeconds;
      pz += vz * stepSeconds;
      const o = i * 2;
      this.path[o] = px * POSITION_SCALE;
      this.path[o + 1] = py * POSITION_SCALE;

      futureMeteorLoc = new Vector(px, py, pz)
      this.collisionDetected = this.collisionDetected || checkCollision() // Only check if not yet collided
    }

    console.log("Closest: " + this.debug_closest)

    this.debug_closest = 100
    this.debug_Rclosest = null
    this.collisionDetected = false

    this.lastVX = this.target.velocity.x;

    this.lastVY = this.target.velocity.y;
    this.lastPX = this.target.position.x;
    this.lastPY = this.target.position.y;
    this.position.x = this.target.position.x * POSITION_SCALE;
    this.position.y = this.target.position.y * POSITION_SCALE;
    this.position.z = this.target.position.z * POSITION_SCALE;
    this.drawContinuous();

  }



  private drawContinuous() {
    if (!this.gfx) return;
    const g = this.gfx;
    g.clear();
    if (this.path.length < 4) return;
    // Compute total length once for gradient alpha distribution
    let totalLen = 0;
    for (let i = 2; i < this.path.length; i += 2) {
      const dx = this.path[i] - this.path[i - 2];
      const dy = this.path[i + 1] - this.path[i - 1];
      totalLen += Math.hypot(dx, dy);
    }
    if (totalLen === 0) return;

    const startAlpha = 1.0;
    const endAlpha = 0.0;
    let traversed = 0;
    // We draw segment-by-segment so we can fade alpha smoothly along length.
    for (let i = 2; i < this.path.length; i += 2) {
      const x0 = this.path[i - 2];
      const y0 = this.path[i - 1];
      const x1 = this.path[i];
      const y1 = this.path[i + 1];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      if (segLen === 0) continue;
      // Use midpoint of segment to determine alpha for that segment
      const midDist = traversed + segLen * 0.5;
      const frac = Math.min(1, Math.max(0, midDist / totalLen));
      const alpha = startAlpha + (endAlpha - startAlpha) * frac;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke({width: 2, color: 0xff3333, alpha});
      traversed += segLen;
    }
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }

  get graphics(): Graphics | null {
    return this.gfx;
  }
}
