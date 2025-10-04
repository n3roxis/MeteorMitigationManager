import { Application, Graphics } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Planet } from './Planet';
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
  parent?: Planet; // Optional parent body for relative orbit (e.g., Moon around Earth)

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
    argumentOfPeriapsisDeg = 0,
    parent?: Planet
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
    this.parent = parent;
  }

  start(app: Application) {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(dt: number): void { // dt retained for interface symmetry (unused)
    if (!this.gfx) return;
    const g = this.gfx;
    const { semiMajorAxis, eccentricity, inclinationDeg, longitudeAscendingNodeDeg, argumentOfPeriapsisDeg } = this;
  // Fixed segment count for simplicity & consistency at high zoom
  const apparentRadiusPx = semiMajorAxis * POSITION_SCALE;
    const pts = sampleOrbit(
      semiMajorAxis,
      eccentricity,
      inclinationDeg,
      longitudeAscendingNodeDeg,
      argumentOfPeriapsisDeg,
      1024
    );
    g.clear();
    // Parent offset (if orbiting a moving body)
    const baseX = this.parent ? this.parent.position.x : 0;
    const baseY = this.parent ? this.parent.position.y : 0;

    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const sx = (baseX + x) * POSITION_SCALE;
      const sy = (baseY + y) * POSITION_SCALE;
      if (i === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
    }
    // Adaptive stroke: tiny orbits can become subpixel; boost line width if projected semi-major axis < 2px
  const adaptiveWidth = apparentRadiusPx < 2 ? Math.max(this.lineWidth, 2) : this.lineWidth;
    g.stroke({ width: adaptiveWidth, color: this.color, alpha: this.alpha });
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }
  get graphics(): Graphics | null { return this.gfx; }
}
