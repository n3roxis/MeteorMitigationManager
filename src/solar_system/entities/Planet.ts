import { Application, Graphics } from 'pixi.js';
import { AU_IN_KM, MIN_PIXEL_RADIUS, POSITION_SCALE, RADIUS_SCALE } from '../config/scales';
import { SIM_TIME_DAYS } from '../state/simulation';
import { orbitalPositionAtTime } from '../utils/orbitalMath';
import { Vector } from '../utils/Vector';
import { UpdatableEntity } from './Entity';
import { Orbit } from './Orbit';

export class Planet implements UpdatableEntity {
  id: string;
  position: Vector = new Vector(0, 0, 0);
  radiusKm: number;
  massEarths: number;
  color: number;
  orbit?: Orbit; // primary orbital path (around parent or star)
  orbitPhase: number; // initial phase offset (0..1)
  parent?: Planet; // parent body for hierarchical systems
  wobbleOrbit?: Orbit; // optional small orbit for barycentric wobble
  private gfx: Graphics | null = null;

  constructor(
    id: string,
    radiusKm: number,
    massEarths: number,
    color: number,
    orbit?: Orbit,
    orbitPhase = 0,
    parent?: Planet,
    wobbleOrbit?: Orbit
  ) {
    this.id = id;
    this.radiusKm = radiusKm;
    this.massEarths = massEarths;
    this.color = color;
    this.orbit = orbit;
    this.orbitPhase = orbitPhase;
    this.parent = parent;
    this.wobbleOrbit = wobbleOrbit;
  }

  start(app: Application): void {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(): void { // time from global time source
    let baseX = 0, baseY = 0, baseZ = 0;
    if (this.parent) {
      baseX = this.parent.position.x;
      baseY = this.parent.position.y;
      baseZ = this.parent.position.z;
    }

    // Primary orbital motion
    if (this.orbit) {
      const o: any = this.orbit;
      const [rx, ry, rz] = orbitalPositionAtTime({
        semiMajorAxis: o.semiMajorAxis,
        eccentricity: o.eccentricity,
        periodDays: o.periodDays,
        inclinationDeg: o.inclinationDeg,
        longitudeAscendingNodeDeg: o.longitudeAscendingNodeDeg,
        argumentOfPeriapsisDeg: o.argumentOfPeriapsisDeg
      }, this.orbitPhase, SIM_TIME_DAYS * 86400);
      baseX += rx; baseY += ry; baseZ += rz;
    }

    // Optional wobble orbit (barycentric wobble)
    if (this.wobbleOrbit) {
      const o: any = this.wobbleOrbit;
      const [wx, wy, wz] = orbitalPositionAtTime({
        semiMajorAxis: o.semiMajorAxis,
        eccentricity: o.eccentricity,
        periodDays: o.periodDays,
        inclinationDeg: o.inclinationDeg,
        longitudeAscendingNodeDeg: o.longitudeAscendingNodeDeg,
        argumentOfPeriapsisDeg: o.argumentOfPeriapsisDeg
      }, 0, SIM_TIME_DAYS * 86400);
      baseX += wx; baseY += wy; baseZ += wz;
    }

    this.position.x = baseX;
    this.position.y = baseY;
    this.position.z = baseZ;

    if (this.gfx) {
      const pixelPhysical = (this.radiusKm / AU_IN_KM) * POSITION_SCALE;
      const pr = Math.max(pixelPhysical * RADIUS_SCALE, MIN_PIXEL_RADIUS);
      this.gfx.clear();
      this.gfx.circle(0, 0, pr).fill(this.color);
      this.gfx.position.set(this.position.x * POSITION_SCALE, this.position.y * POSITION_SCALE);
    }
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }

  get graphics(): Graphics | null { return this.gfx; }
}
