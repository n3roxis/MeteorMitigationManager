import {UpdatableEntity} from "./Entity";
import {Application, Graphics} from "pixi.js";
import {MIN_PIXEL_RADIUS, POSITION_SCALE, RADIUS_SCALE, SIM_DAYS_PER_REAL_SECOND} from "../config/scales";
import {PLANETS} from "../data/planets";
import {Vector} from "../utils/Vector";
import {DEBUG_AU, GxMExAU, SECONDS_PER_DAY} from "../utils/constants";

export class Meteor implements UpdatableEntity {

  id: string;
  color: number;

  x: number;
  y: number;
  z: number;

  dx: number;
  dy: number;
  dz: number;

  private gfx: Graphics | null = null;

  constructor(id: string, x: number, y: number, z: number, dx: number = 0, dy: number = 0, dz: number = 0, color: number = 0xc0c0c0) {
    this.id = id;
    this.color = color;
    this.x = x;
    this.y = y;
    this.z = z;
    this.dx = dx;
    this.dy = dy;
    this.dz = dz;
  }

  start(app: Application) {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(dt: number): void {
    const position = new Vector(this.x, this.y, this.z);
    var acc: Vector = new Vector(0, 0, 0);
    for (const body of PLANETS) {
      const bodyLoc = new Vector(body.x, body.y, body.z);
      const mass = body.massEarths;
      const distanceVector = position.subtract(bodyLoc);
      const distance = distanceVector.length();
      const singleAcc = mass / distance * GxMExAU
      const singleAccVector = distanceVector.normalized().scale(singleAcc);
      acc = acc.add(singleAccVector)
    }
    acc = acc.scale(-1)
    acc = acc.scale((SIM_DAYS_PER_REAL_SECOND * SECONDS_PER_DAY) ** -2);
    acc = acc.scale(dt !== 0 ? 1 / dt : 0);
    acc = acc.scale(1/10000);
    this.dx += acc.x;
    this.dy += acc.y;
    this.dz += acc.z;
    this.x += this.dx;
    this.y += this.dy;
    this.z += this.dz;

    // Redraw radius each update
    if (this.gfx) {
      this.gfx.clear();
      this.gfx.circle(0, 0, MIN_PIXEL_RADIUS*5).fill(this.color);
      // Set position here based on scaled orbital coordinates; parent container will be centered
      this.gfx.position.set(this.x * POSITION_SCALE, this.y * POSITION_SCALE);
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
