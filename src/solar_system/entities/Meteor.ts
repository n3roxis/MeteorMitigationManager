import {UpdatableEntity} from "./Entity";
import {Application, Graphics} from "pixi.js";
import {AU_IN_KM, MIN_PIXEL_RADIUS, POSITION_SCALE, RADIUS_SCALE} from "../config/scales";
import {Vector} from "../utils/Vector";
import {MEarthxGperAU3} from "../utils/constants";

export class Meteor implements UpdatableEntity {

  id: string;
  color: number;
  mass: number;

  position: Vector;
  velocity: Vector;

  private gfx: Graphics | null = null;

  constructor(id: string, x: number, y: number, z: number, dx: number = 0, dy: number = 0, dz: number = 0, mass: number, color: number = 0xff3333) {
    this.id = id;
    this.color = color;
    this.mass = mass;
    this.position = new Vector(x, y, z);
    this.velocity = new Vector(dx, dy, dz);
  }

  start(app: Application) {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(dt: number): void {
    if (dt !== 0) {
      // Sun-only gravity to stay consistent with Lambert two-body assumptions.
      // Sun treated as origin (0,0,0); MEarthxGperAU3 encodes Earth-mass * G per AU^3, so scale to solar mass.
      // Solar mass in Earth masses ≈ 332946; using 332981.79 from bodies data (SUN massEarths) for consistency.
      const GM_sun = MEarthxGperAU3 * 332981.79; // (AU^3 / day^2) if MEarthxGperAU3 is per Earth mass
      const x = this.position.x, y = this.position.y, z = this.position.z;
      const r2 = x*x + y*y + z*z;
      if (r2 > 0) {
        const r = Math.sqrt(r2);
        const invR3 = 1 / (r2 * r);
        const ax = -GM_sun * x * invR3;
        const ay = -GM_sun * y * invR3;
        const az = -GM_sun * z * invR3;
        this.velocity = this.velocity.add(new Vector(ax, ay, az).scale(dt));
        this.position = this.position.add(this.velocity.scale(dt));
      }
    }

    // Redraw radius each update
    if (this.gfx) {
      const pixelPhysical = (10 / AU_IN_KM) * POSITION_SCALE;
      const pr = Math.max(pixelPhysical * RADIUS_SCALE, MIN_PIXEL_RADIUS);
      this.gfx.clear();
      this.gfx.circle(0, 0, pr).fill(this.color);
      // Set position here based on scaled orbital coordinates; parent container will be centered
      this.gfx.position.set(this.position.x * POSITION_SCALE, this.position.y * POSITION_SCALE);
    }
  }


  get graphics(): Graphics | null {
    return this.gfx;
  }


  destroy() {
    this.gfx?.destroy();
    this.gfx = null;
  }
}
