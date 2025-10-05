import {Application, Graphics} from 'pixi.js';
import {UpdatableEntity} from './Entity';
import {Meteor} from './Meteor';
import {PLANETS} from '../data/bodies';
import {orbitalPositionAtTime, gravitationalAccelerationAtPoint} from '../utils/orbitalMath';
import {POSITION_SCALE, getSimDaysPerPhysicsTick} from '../config/scales';
import {SIM_TIME_DAYS} from '../state/simulation';
import {MEarthxGperAU3, RADIUS_OF_EARTH} from '../utils/constants';
import {Vector} from "../utils/Vector.ts";

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
  private recomputeIntervalSimSeconds = 24 * 3600; // recompute every simulation day (large horizon expensive)
  private accumulatorSimSeconds = 0;   // accumulate simulation seconds
  // Throttling: only recompute every N physics ticks unless large change
  private ticksSinceLast = 0;
  // Baseline periodic recompute frequency. Previously 20 (5/sec) which was expensive with a 1-year horizon.
  // Relaxed to 60 (~1.67/sec) to cut cost dramatically while still updating reasonably often.
  private recomputeEveryTicks = 60; // 100Hz / 60 ≈ 1.67 recomputes per second baseline
  // Heading / speed thresholds were very sensitive (0.5° / 1%) causing bursts of recomputes near perihelion.
  // Loosen them so we don't thrash when gravity sharply turns the trajectory near the Sun.
  private headingEpsilonDeg = 2.0; // degrees
  private speedRelEpsilon = 0.05; // 5% relative speed change
  // Enforce a minimum spacing between forced recomputes even if thresholds keep triggering.
  private minForcedRecomputeTicks = 60; // at least ~0.6s between forced (non-periodic) recomputes
  private lastSpeed = NaN;
  private lastHeadingDeg = NaN;

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

    function checkCollision() {

      if (previousEarthLoc) {
        const E1 = previousEarthLoc
        const E2 = futureEarthLoc!
        const A1 = previousMeteorLoc!
        const A2 = futureMeteorLoc!

        const T1 = futureAbsSeconds - stepSeconds
        const T2 = futureAbsSeconds
        const dT = stepSeconds

        const deltaE = E2.subtract(E1)
        const deltaA = A2.subtract(A1)

        // Transform in rest frame of earth, posE = const, posA = A1 + dt * deltaATilde
        const deltaATilde = deltaA.subtract(deltaE)

        let closestDistance = 0
        let collisionT: number | null = null

        ChatGPT: {
          const r0 = A1.subtract(E1);                 // relative position at start
          const d = deltaATilde;                     // relative displacement over dT
          const R = RADIUS_OF_EARTH;

          // --- Abstand während des Schritts: r(t) = r0 + (t/dT)*d ---
          // Gesucht: |r(t)| = R  →  (r0 + (t/dT)*d)² = R²
          const a = d.dot(d);
          const b = 2 * r0.dot(d);
          const c = r0.dot(r0) - R * R;

          let _closestDistance = Infinity;
          let _collisionT: number | null = null;

          if (a > 0) {
            // Zeitpunkt minimaler Distanz (ggf. außerhalb des Schritts clampen)
            let sClosest = -r0.dot(d) / a;
            sClosest = Math.max(0, Math.min(1, sClosest));
            const rClosest = r0.add(d.scale(sClosest));
            _closestDistance = rClosest.length();

            // Diskriminante für Schnittpunkt(e) mit der Kugel
            const disc = b * b - 4 * a * c;
            if (disc >= 0) {
              const sqrtDisc = Math.sqrt(disc);
              const s1 = (-b - sqrtDisc) / (2 * a);
              const s2 = (-b + sqrtDisc) / (2 * a);
              const sHit = [s1, s2].find(s => s >= 0 && s <= 1);
              if (sHit !== undefined) {
                _collisionT = sHit * dT; // Zeit seit T1
              }
            }
          } else {
            _closestDistance = r0.length(); // keine Bewegung
          }

          (closestDistance as any) = _closestDistance;
          (collisionT as any) = _collisionT;
        }


        if (closestDistance < RADIUS_OF_EARTH) {
          // Collision detected
          const collisionE = E1.add(deltaE.scale(collisionT!))
          const collisionA = A1.add(deltaATilde.scale(collisionT!))

          const collisionR = collisionA.subtract(collisionE) // Vector pointing from earth center to impact point
          const velocityImpact = deltaATilde.scale(1 / (T2 - T1))

          // Output parameters, dont change
          const velocity = velocityImpact.length()
          const angle = Math.acos(collisionR.normalized().dot(deltaATilde.normalized()))
          const secondsUntilImpact = startSimSeconds + T1 + collisionT!
        }
      }
      previousEarthLoc = futureEarthLoc;
      previousMeteorLoc = futureMeteorLoc;
    }


    for (let i = 0; i < this.steps; i++) {
      futureAbsSeconds = startSimSeconds + (i + 1) * stepSeconds;
      // Build temporary bodies array with analytic planet positions at this future time
      const futureBodies: Array<{ massEarths: number; position: { x: number; y: number; z: number } }> = [];
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

          //// Check collisions with the Earth
          if (meta.body.id === 'earth') {
            futureEarthLoc = new Vector(rx, ry, rz)
          }
        } else {
          futureBodies.push({massEarths: meta.body.massEarths, position: meta.body.position});
        }
      }


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

      checkCollision()

    }

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
