import { Application, Graphics } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { POSITION_SCALE } from '../config/scales';
import { Vector } from '../utils/Vector';
import { sampleOrbit } from '../utils/orbitalMath';

export class Orbit implements UpdatableEntity {
  id: string;
  position: Vector = new Vector(0,0,0);
  semiMajorAxis: number;
  eccentricity: number;
  periodDays: number;
  color: number;
  alpha: number;
  lineWidth: number;
  inclinationDeg: number;
  longitudeAscendingNodeDeg: number;
  argumentOfPeriapsisDeg: number;
  private gfx: Graphics | null = null;

  constructor(
    id: string,
    semiMajorAxis: number,
    eccentricity: number,
    periodDays: number,
    color = 0x333333,
    alpha = 0.7,
    lineWidth = 1,
    inclinationDeg = 0,
    longitudeAscendingNodeDeg = 0,
    argumentOfPeriapsisDeg = 0
  ) {
  this.id = id;
  this.semiMajorAxis = semiMajorAxis;
    this.eccentricity = eccentricity;
    this.periodDays = periodDays;
    this.color = color;
    this.alpha = alpha;
    this.lineWidth = lineWidth;
    this.inclinationDeg = inclinationDeg;
    this.longitudeAscendingNodeDeg = longitudeAscendingNodeDeg;
    this.argumentOfPeriapsisDeg = argumentOfPeriapsisDeg;
  }

  start(app: Application) {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(dt: number): void { // dt retained for interface symmetry (unused)
    if (!this.gfx) return;
    const g = this.gfx;
    const { semiMajorAxis, eccentricity, inclinationDeg, longitudeAscendingNodeDeg, argumentOfPeriapsisDeg } = this;
    const pts = sampleOrbit(
      semiMajorAxis,
      eccentricity,
      inclinationDeg,
      longitudeAscendingNodeDeg,
      argumentOfPeriapsisDeg,
      256
    );
    g.clear();
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const sx = x * POSITION_SCALE;
      const sy = y * POSITION_SCALE;
      if (i === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
    }
    g.stroke({ width: this.lineWidth, color: this.color, alpha: this.alpha });
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }
  get graphics(): Graphics | null { return this.gfx; }
}
