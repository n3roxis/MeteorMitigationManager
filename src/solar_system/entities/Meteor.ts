import {UpdatableEntity} from "./Entity";
import {Application, Graphics} from "pixi.js";
import {AU_IN_KM, MIN_PIXEL_RADIUS, POSITION_SCALE, RADIUS_SCALE, SIM_DAYS_PER_REAL_SECOND} from "../config/scales";
import {Vector} from "../utils/Vector";
import {PLANETS} from "../data/bodies";
import {DEBUG_AU, DEBUG_G, DEBUG_ME, MExGperAU3, SECONDS_PER_DAY} from "../utils/constants";

export class Meteor implements UpdatableEntity {

  id: string;
  color: number;

  position: Vector;
  velocity: Vector;

  private gfx: Graphics | null = null;

  constructor(id: string, x: number, y: number, z: number, dx: number = 0, dy: number = 0, dz: number = 0, color: number = 0xc0c0c0) {
    this.id = id;
    this.color = color;
    this.position = new Vector(x, y, z);
    this.velocity = new Vector(dx, dy, dz);
  }

  start(app: Application) {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(dt: number): void {
    if (dt !== 0) {
      let acc: Vector = new Vector(0, 0, 0);
      for (const body of PLANETS) {
        const mass = body.massEarths;
        const distanceVector = this.position.subtract(body.position);
        const distance = distanceVector.length();
        const singleAcc = - mass / distance / distance * MExGperAU3; // m/s^2
        const singleAccVector = distanceVector.normalized().scale(singleAcc);
        acc = acc.add(singleAccVector)
      }

      this.velocity = this.velocity.add(acc.scale(dt));
      this.position = this.position.add(this.velocity.scale(dt));
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
