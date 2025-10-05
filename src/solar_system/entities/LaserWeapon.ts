import { Application, Graphics } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Vector } from '../utils/Vector';
import { ENTITIES } from '../state/entities';
import { POSITION_SCALE } from '../config/scales';

// Convert a tiny thrust acceleration (m/s^2) to AU/s^2
const AU_IN_METERS = 149597870700;
const DEFAULT_THRUST_M_S2 = 0.0002; // gentle continuous push
const THRUST_AU_PER_S2 = DEFAULT_THRUST_M_S2 / AU_IN_METERS;

/**
 * LaserWeapon: draws a beam from a source entity (e.g., L1) to a target (meteor) and
 * applies a small accelerating push to the target while active.
 * Assumes target has a 'velocity' Vector property in AU/sec.
 */
export class LaserWeapon implements UpdatableEntity {
  id: string;
  position: Vector = new Vector(0,0,0); // not used for rendering; beam uses endpoints
  private sourceId: string;
  private targetId: string;
  private active = false;
  private gfx: Graphics | null = null;
  private baseScale = POSITION_SCALE; // capture initial scale to normalize width changes

  constructor(id: string, sourceId: string, targetId: string) {
    this.id = id;
    this.sourceId = sourceId;
    this.targetId = targetId;
  }

  start(app: Application): void {
    if (!this.gfx) {
      this.gfx = new Graphics();
      app.stage.addChild(this.gfx);
    }
  }

  toggle() { this.active = !this.active; }
  setActive(v: boolean) { this.active = v; }
  isActive() { return this.active; }

  private findEntity(id: string): any {
    return ENTITIES.find(e => (e as any).id === id);
  }

  update(dtSimSeconds: number): void {
    if (!this.gfx) return;
    const src = this.findEntity(this.sourceId);
    const tgt: any = this.findEntity(this.targetId);
    this.gfx.clear();
    if (!src || !tgt || !src.position || !tgt.position) return;

  let sx = src.position.x * POSITION_SCALE;
  let sy = src.position.y * POSITION_SCALE;
  const tx = tgt.position.x * POSITION_SCALE;
  const ty = tgt.position.y * POSITION_SCALE;

    if (this.active) {
      // Physical beam width target: 0.001 AU, converted to pixels each frame.
      const physicalWidthAU = 0.0001; // also used for offset distance
      const basePx = physicalWidthAU * POSITION_SCALE;
      // Beam start offset in direction toward target (visual only; force still from true source)
      const dxp = (tgt.position.x - src.position.x);
      const dyp = (tgt.position.y - src.position.y);
      const dzp = (tgt.position.z - src.position.z);
      const dlen = Math.hypot(dxp, dyp, dzp);
      if (dlen > 0) {
        const offAU = 0.0002; // one beam width ahead
        sx += (dxp / dlen) * offAU * POSITION_SCALE;
        sy += (dyp / dlen) * offAU * POSITION_SCALE;
      }
      const coreColor = 0xffffff;
      const coreW = basePx;            // physical width
      const midW = basePx * 3;         // glow layers scale proportionally
      const outerW = basePx * 5;
      // Core line
      this.gfx.setStrokeStyle({ width: coreW, color: coreColor, alpha: 1.0 });
      this.gfx.moveTo(sx, sy).lineTo(tx, ty).stroke();
      // Glow passes
      this.gfx.setStrokeStyle({ width: midW, color: coreColor, alpha: 0.14 });
      this.gfx.moveTo(sx, sy).lineTo(tx, ty).stroke();
      this.gfx.setStrokeStyle({ width: outerW, color: coreColor, alpha: 0.08 });
      this.gfx.moveTo(sx, sy).lineTo(tx, ty).stroke();
    } else {
      // Inactive: no preview drawn
      return;
    }

    if (this.active && tgt.velocity instanceof Vector) {
      const dx = tgt.position.x - src.position.x;
      const dy = tgt.position.y - src.position.y;
      const dz = (tgt.position.z || 0) - (src.position.z || 0);
      const len = Math.hypot(dx, dy, dz);
      if (len > 0) {
        const ax = (dx / len) * THRUST_AU_PER_S2;
        const ay = (dy / len) * THRUST_AU_PER_S2;
        const az = (dz / len) * THRUST_AU_PER_S2;
        tgt.velocity.x += ax * dtSimSeconds;
        tgt.velocity.y += ay * dtSimSeconds;
        tgt.velocity.z += az * dtSimSeconds;
      }
    }
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }

  get graphics(): Graphics | null { return this.gfx; }
}
