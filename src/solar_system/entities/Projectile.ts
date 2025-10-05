import { UpdatableEntity } from './Entity';
import { Application, Graphics } from 'pixi.js';
import { Vector } from '../utils/Vector';
import { POSITION_SCALE, RADIUS_SCALE, AU_IN_KM, MIN_PIXEL_RADIUS } from '../config/scales';
import { gravitationalAccelerationAtPoint } from '../utils/orbitalMath';
import { PLANETS } from '../data/bodies';
import { MEarthxGperAU3 } from '../utils/constants';

/**
 * Projectile launched with initial velocity; now influenced by gravity from PLANETS (same as Meteor).
 */
export class Projectile implements UpdatableEntity {
  id: string;
  position: Vector;
  velocity: Vector;
  color: number;
  private gfx: Graphics | null = null;

  constructor(id: string, origin: Vector, velocity: Vector, color: number = 0x00ff55) { // green default
    this.id = id;
    this.position = new Vector(origin.x, origin.y, origin.z);
    this.velocity = new Vector(velocity.x, velocity.y, velocity.z);
    this.color = color;
  }

  start(app: Application): void {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(dt: number): void {
    if (dt !== 0) {
      const [ax, ay, az] = gravitationalAccelerationAtPoint(
        this.position.x,
        this.position.y,
        this.position.z,
        PLANETS,
        MEarthxGperAU3
      );
      this.velocity = this.velocity.add(new Vector(ax, ay, az).scale(dt));
      this.position = this.position.add(this.velocity.scale(dt));
    }
    if (this.gfx) {
      const pixelPhysical = (8 / AU_IN_KM) * POSITION_SCALE; // 8 km nominal display size
      const pr = Math.max(pixelPhysical * RADIUS_SCALE, MIN_PIXEL_RADIUS);
      this.gfx.clear();
      this.gfx.circle(0, 0, pr).fill(this.color);
      this.gfx.position.set(this.position.x * POSITION_SCALE, this.position.y * POSITION_SCALE);
    }
  }

  get graphics(): Graphics | null { return this.gfx; }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }
}
