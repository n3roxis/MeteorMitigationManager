import {Application, Graphics} from 'pixi.js';
import {UpdatableEntity} from './Entity';
import {Meteor} from './Meteor';
import {PLANETS} from '../data/bodies';
import {orbitalPositionAtTime, gravitationalAccelerationAtPoint} from '../utils/orbitalMath';
import {POSITION_SCALE, getSimDaysPerPhysicsTick} from '../config/scales';
import {getCurrentSimSeconds, SIM_TIME_DAYS} from '../state/simulation';
import {DEBUG_ME, MEarthxGperAU3, RADIUS_OF_EARTH_AU} from '../utils/constants';
import {Vector} from "../utils/Vector.ts";
import {DataBroker, Impact, vectorToLongLat} from "../../Logic/Utils/TranslationInterface.ts";
import {MeteorImpactMonitor} from "./MeteorImpactMonitor.ts";

// HINWEIS: getCurrentSimSeconds() wird extern importiert (du fügst den Import hinzu).
// function getCurrentSimSeconds(): number;

export class PathPredictor implements UpdatableEntity {
  id: string;
  private target: Meteor;
  private meteorImpact: MeteorImpactMonitor | null = null;
  private gfx: Graphics | null = null;
  position = {x: 0, y: 0, z: 0} as any;

  private steps = 0;
  private horizonDays = 365;
  private recomputeIntervalSimSeconds = 24 * 3600 * 4;
  private accumulatorSimSeconds = 0;
  private ticksSinceLast = 0;
  private recomputeEveryTicks = 60 * 2;
  private headingEpsilonDeg = 2.0;
  private speedRelEpsilon = 0.05;
  private minForcedRecomputeTicks = 60;
  private lastSpeed = NaN;
  private lastHeadingDeg = NaN;

  DEBUG_SAMPLE = -1

  private lastVX = NaN;
  private lastVY = NaN;
  private lastPX = NaN;
  private lastPY = NaN;

  private path: Float32Array;

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

  // ---- AliveTime/ToF relativ zu t0 ----
  private readonly aliveTimeSecondsRaw: number;
  private readonly t0AbsSeconds: number;
  private endStepIndex: number | null = null; // ganzzahliger End-Schritt ab t0
  private hitCalled = false;
  private positionAtToF: Vector | null = null;
  // -------------------------------------

  constructor(id: string, target: Meteor) {
    this.id = id;
    this.target = target;
    this.aliveTimeSecondsRaw = Math.max(0, target.timeOfFlight ?? 0);
    this.t0AbsSeconds = getCurrentSimSeconds(); // absolute Simulationszeit beim Anlegen
    this.path = new Float32Array(0);
  }

  notifyMeteorImpactMonitor(hitLocation: Vector, velocity: Vector) {
    if(this.meteorImpact == null) {
      this.meteorImpact = new MeteorImpactMonitor(this.target, hitLocation, velocity);
    } else {
      this.meteorImpact.notifyNewImpact(hitLocation)
    }
  }

  private forceNext = false;
  markDirty() { this.forceNext = true; }

  private metaEarth!: typeof this.planetOrbitMeta[number];
  private metaEarthBary!: typeof this.planetOrbitMeta[number];
  private metaSun!: typeof this.planetOrbitMeta[number];

  private futureBodies = [{massEarths: 0, position: {x: 0, y: 0, z: 0}}];

  start(app: Application): void {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);

    this.planetOrbitMeta = PLANETS.map(p => {
      const o = p.orbit as any;
      if (!o) return {
        body: p, hasOrbit: false,
        semiMajorAxis: 0, eccentricity: 0, inclinationDeg: 0,
        longitudeAscendingNodeDeg: 0, argumentOfPeriapsisDeg: 0,
        periodDays: 1, orbitPhase: 0
      };
      const {
        semiMajorAxis, eccentricity, inclinationDeg,
        longitudeAscendingNodeDeg, argumentOfPeriapsisDeg, periodDays
      } = o;
      return {
        body: p, hasOrbit: true,
        semiMajorAxis, eccentricity, inclinationDeg,
        longitudeAscendingNodeDeg, argumentOfPeriapsisDeg, periodDays,
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
    this.accumulatorSimSeconds += dt;
    this.ticksSinceLast++;

    const stateChanged = (
      this.target.velocity.x !== this.lastVX ||
      this.target.velocity.y !== this.lastVY ||
      this.target.position.x !== this.lastPX ||
      this.target.position.y !== this.lastPY
    );
    let force = false;

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
    const allowForced = this.ticksSinceLast >= this.minForcedRecomputeTicks;

    if (this.forceNext || timeBased || (force && allowForced) || (tickBased && stateChanged)) {
      this.recomputePath();
      this.accumulatorSimSeconds = 0;
      this.ticksSinceLast = 0;
      this.forceNext = false;
    }
  }

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

    const stepDays = getSimDaysPerPhysicsTick();
    const stepSeconds = stepDays * 86400;
    const horizonSeconds = this.horizonDays * 86400;

    // End-Schritt (ab t0) einmalig auf Diskretisierung runden — nach oben,
    // damit bei kleiner AliveTime > 0 nicht sofort "hit()" ausgelöst wird.
    if (this.endStepIndex === null) {
      this.endStepIndex = Math.max(0, Math.ceil(this.aliveTimeSecondsRaw / stepSeconds));
    }

    const nowAbsSeconds = getCurrentSimSeconds();
    const stepsElapsed = Math.max(0, Math.floor((nowAbsSeconds - this.t0AbsSeconds) / stepSeconds));
    const remainingStepsToToF = Math.max(0, (this.endStepIndex ?? 0) - stepsElapsed);

    const horizonSteps = Math.floor(horizonSeconds / stepSeconds);
    const neededSteps = Math.min(remainingStepsToToF, Math.min(20000, horizonSteps)); // nur bis ToF!

    if (neededSteps !== this.steps) {
      this.steps = neededSteps;
      if (this.path.length !== this.steps * 2) this.path = new Float32Array(this.steps * 2);
    }

    // Wenn AliveTime bereits abgelaufen ist: NICHT vorhersagend hit() auslösen,
    // sondern nur, wenn die reale Simulationszeit >= Endzeit ist.
    if (this.steps === 0) {
      const endAbsSeconds = this.t0AbsSeconds + (this.endStepIndex ?? 0) * stepSeconds;
      if (!this.hitCalled && nowAbsSeconds >= endAbsSeconds) this.hit();

      // Finale Position ausgeben, falls bekannt
      if (this.positionAtToF) {
        console.log("[PathPredictor3] Absolute Last Final explosion position (AU):", this.positionAtToF.x, this.positionAtToF.y, this.positionAtToF.z, "at t =", endAbsSeconds, "s");
      }
      this.clearAndDraw();
      return;
    }

    const startSimSeconds = SIM_TIME_DAYS * 86400;

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

      const deltaATilde = deltaA.subtract(deltaE)

      let closestDistance = Infinity
      let rClosest!: Vector
      let collisionT: number | null = null
      let collisionS: number | null = null

      ChatGPT: {
        const r0 = A1.subtract(E1);

        const deltaATildeP2 = deltaATilde.dot(deltaATilde);
        const b = 2 * r0.dot(deltaATilde);
        const roP2 = r0.dot(r0) - RADIUS_OF_EARTH_AU * RADIUS_OF_EARTH_AU;

        let _collisionS: number | null = null;

        if (deltaATildeP2 > 0) {
          let sClosest = -r0.dot(deltaATilde) / deltaATildeP2;
          sClosest = Math.max(0, Math.min(1, sClosest));
          rClosest = r0.add(deltaATilde.scale(sClosest));
          closestDistance = rClosest.length();

          const disc = b * b - 4 * deltaATildeP2 * roP2;
          const eps = 1e-14;
          if (disc >= -eps) {
            const sqrtDisc = Math.sqrt(Math.max(0, disc));
            const s1 = (-b - sqrtDisc) / (2 * deltaATildeP2);
            const s2 = (-b + sqrtDisc) / (2 * deltaATildeP2);
            const sHit = [s1, s2].find(s => s >= 0 && s <= 1);
            if (sHit !== undefined) _collisionS = sHit;
          }
        } else {
          closestDistance = r0.length();
        }
        collisionS = _collisionS;
        collisionT = _collisionS !== null ? _collisionS * dT : null;
      }

      if (closestDistance < this.debug_closest) {
        this.debug_closest = closestDistance
        this.debug_Rclosest = rClosest
      }

      if (collisionS !== null) {
        const s = collisionS
        const collisionE = E1.add(deltaE.scale(s))
        const collisionA = A1.add(deltaA.scale(s))
        const collisionR = collisionA.subtract(collisionE)

        const vRelAuPerSec = deltaATilde.scale(1 / dT)

        const velocity = vRelAuPerSec.length()
        const angle = Math.acos(collisionR.normalized().dot(vRelAuPerSec.normalized()))
        const timeOfImpact = startSimSeconds + T1 + (collisionT ?? 0) // TODO ggf. korrigieren
        const {longitude, latitude} = vectorToLongLat(collisionR, timeOfImpact)
        const impact: Impact = {
          velocity,
          angle,
          mass: this.target.mass * DEBUG_ME,
          density: 0,
          longLat: {longitude, latitude},
        }
        //DataBroker.instance.setImpact(impact)
        //console.log("Collision detected: " + collisionR.x + " " + collisionR.y + " " + collisionR.z)
      } else {
        //DataBroker.instance.setImpact(null)
      }
      previousEarthLoc = futureEarthLoc;
      previousMeteorLoc = futureMeteorLoc;

      return collisionS !== null;
    }

    this.DEBUG_SAMPLE++

    for (let i = 0; i < this.steps; i++) {
      futureAbsSeconds = startSimSeconds + (i + 1) * stepSeconds;

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
        futureBodies.push({massEarths: meta.body.massEarths, position: {x: 0, y: 0, z: 0}});
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
      this.collisionDetected = this.collisionDetected || checkCollision()

      // Globaler Schrittindex relativ zu t0:
      const globalStep = stepsElapsed + (i + 1);
      if (this.endStepIndex !== null && globalStep === this.endStepIndex) {
        this.positionAtToF = new Vector(px, py, pz);
        // NICHT hit() hier auslösen – nur reale Zeit darf hit() triggern.
        const endAbsSeconds = this.t0AbsSeconds + this.endStepIndex * stepSeconds;
        //console.log("[PathPredictor2] Final explosion position (AU):", this.positionAtToF.x, this.positionAtToF.y, this.positionAtToF.z, "at t =", endAbsSeconds, "s");
        this.notifyMeteorImpactMonitor(this.positionAtToF, new Vector(vx, vy, vz));
      }
    }

    // Reset Debug-Tracker
    this.debug_closest = 100
    this.debug_Rclosest = null
    this.collisionDetected = false

    // Mirror live position
    this.lastVX = this.target.velocity.x;
    this.lastVY = this.target.velocity.y;
    this.lastPX = this.target.position.x;
    this.lastPY = this.target.position.y;
    this.position.x = this.target.position.x * POSITION_SCALE;
    this.position.y = this.target.position.y * POSITION_SCALE;
    this.position.z = this.target.position.z * POSITION_SCALE;

    this.clearAndDraw();
  }

  private clearAndDraw() { this.drawContinuous(); }

  private drawContinuous() {
    if (!this.gfx) return;
    const g = this.gfx;
    g.clear();
    if (this.path.length < 4) return;

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

    for (let i = 2; i < this.path.length; i += 2) {
      const x0 = this.path[i - 2];
      const y0 = this.path[i - 1];
      const x1 = this.path[i];
      const y1 = this.path[i + 1];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      if (segLen === 0) continue;
      const midDist = traversed + segLen * 0.5;
      const frac = Math.min(1, Math.max(0, midDist / totalLen));
      const alpha = startAlpha + (endAlpha - startAlpha) * frac;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke({width: 2, color: 0xff3333, alpha});
      traversed += segLen;
    }
  }

  destroy(): void { this.gfx?.destroy(); this.gfx = null; }
  get graphics(): Graphics | null { return this.gfx; }

  getPositionAtTimeOfFlight(): Vector | null { return this.positionAtToF; }

  private hit(): void {
    if (this.hitCalled) return;
    this.hitCalled = true;
    console.log("[PathPredictor] aliveTime reached — hit()"); //TODO kill this whole thing
    this.destroy()
    // Hook für spätere Aktionen (Trigger/Callback etc.)
  }
}
