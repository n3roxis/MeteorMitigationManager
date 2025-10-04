import { Application, Graphics, BlurFilter } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Vector } from '../utils/Vector';
import { POSITION_SCALE } from '../config/scales';

// Simplified glow effect:
//  - Single logical radius (AU) converted to pixels via POSITION_SCALE.
//  - Two-pass draw: outer diffuse halo (outerAlpha) then optional bright core (coreAlpha) at coreFraction * radius.
//  - No multi-step gradient logic for simplicity & performance.
export class GlowEffect implements UpdatableEntity {
  id: string;
  position: Vector = new Vector(0, 0, 0);
  private gfx: Graphics | null = null;
  private blur: BlurFilter;
  private target: UpdatableEntity;
  private radiusAu: number;
  private color: number;
  private outerAlpha: number;
  private coreAlpha: number;
  private coreFraction: number; // fraction of radius for inner bright core (0 disables core if <=0)
  // Adaptive blur scaling
  private basePositionScale: number | null = null;
  private blurBaseStrength: number;
  private blurScalePower: number = 1.0; // exponent for scaling
  private blurMin: number = 8;
  private blurMax: number = 96;

  constructor(
    id: string,
    target: UpdatableEntity,
    radiusAu: number,
    color?: number,
    outerAlpha = 0.25,
    blurStrength = 48,
    coreAlpha = 0.6,
    coreFraction = 0.15
  ) {
    this.id = id;
    this.target = target;
    this.radiusAu = radiusAu;
    const targetColor = (target as any).color;
    this.color = color ?? targetColor ?? 0xffffff;
    this.outerAlpha = outerAlpha;
    this.coreAlpha = coreAlpha;
    this.coreFraction = Math.min(0.95, Math.max(0, coreFraction));
    this.blur = new BlurFilter({ strength: blurStrength, quality: 4, resolution: 1 });
    this.blurBaseStrength = blurStrength;
  }

  start(_app: Application) {
    this.gfx = new Graphics();
    this.gfx.filters = [this.blur];
    (this.gfx as any).blendMode = 'add';
  }

  update(): void {
    if (!this.gfx) return;
    this.position.x = this.target.position.x;
    this.position.y = this.target.position.y;
    this.position.z = this.target.position.z;

    if (this.basePositionScale === null) this.basePositionScale = POSITION_SCALE;
    const zoomRatio = POSITION_SCALE / this.basePositionScale;
    let scaled: number;
    if (zoomRatio >= 1) {
      const grow = Math.pow(zoomRatio - 1 + 1e-6, 0.5 * this.blurScalePower);
      scaled = this.blurBaseStrength * (1 + grow * 0.6);
    } else {
      scaled = this.blurBaseStrength * Math.pow(zoomRatio, this.blurScalePower);
    }
    const clampedStrength = Math.min(this.blurMax, Math.max(this.blurMin, scaled));
    if (Math.abs(clampedStrength - this.blur.strength) > 0.5) {
      this.blur.strength = clampedStrength;
    }

    const glowRadiusPx = this.radiusAu * POSITION_SCALE;
    this.gfx.clear();
    this.gfx.circle(0, 0, glowRadiusPx).fill({ color: this.color, alpha: this.outerAlpha });
    if (this.coreFraction > 0 && this.coreAlpha > 0) {
      const coreR = glowRadiusPx * this.coreFraction;
      this.gfx.circle(0, 0, coreR).fill({ color: this.color, alpha: this.coreAlpha });
    }
    this.gfx.position.set(this.position.x * POSITION_SCALE, this.position.y * POSITION_SCALE);
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }
  get graphics(): Graphics | null { return this.gfx; }
  setRadiusAu(r: number) { this.radiusAu = r; }
  setColor(c: number) { this.color = c; }
  setOuterAlpha(a: number) { this.outerAlpha = a; }
  setCore(coreAlpha: number, coreFraction?: number) {
    this.coreAlpha = coreAlpha;
    if (coreFraction !== undefined) this.coreFraction = Math.min(0.95, Math.max(0, coreFraction));
  }
  setBlurScaling(power: number, min?: number, max?: number) {
    this.blurScalePower = Math.max(0, power);
    if (min !== undefined) this.blurMin = Math.max(0, min);
    if (max !== undefined) this.blurMax = Math.max(this.blurMin, max);
  }
}
