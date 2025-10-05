import { Application, Graphics } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Vector } from '../utils/Vector';
import { POSITION_SCALE, RADIUS_SCALE, AU_IN_KM, MIN_PIXEL_RADIUS } from '../config/scales';
import { MSunxGperAU3 } from '../utils/constants';
import { ENTITIES } from '../state/entities';
import { GLOBAL_PIXI_APP } from '../../components/UI/OrbitView/SolarSystemPanel';

/**
 * Projectile with a fixed flight time; on impact it applies a velocity change to the meteor and self-destructs.
 */
export class InterceptorProjectile implements UpdatableEntity {
  id: string;
  position: Vector;
  velocity: Vector;
  color: number;
  private gfx: Graphics | null = null;
  private elapsed = 0;
  private flightTime: number; // seconds
  private meteorId: string;
  private deltaV: Vector; // applied to meteor on impact
  private impactorInventoryId: string; // remove associated impactor from economy when done
  private onImpact?: ()=>void; // no-arg callback
  private appRef: Application | null = null; // store app to recreate graphics if needed
  private debugFrameCount = 0;
  private destroyed = false; // guard to prevent post-impact updates / re-renders
  // (Glow removed)

  constructor(id: string, origin: Vector, velocity: Vector, flightTime: number, meteorId: string, deltaV: Vector, impactorInventoryId: string, onImpact?: ()=>void, color: number = 0xffff55) {
    this.id = id;
    this.position = new Vector(origin.x, origin.y, origin.z);
    this.velocity = new Vector(velocity.x, velocity.y, velocity.z);
    this.flightTime = flightTime;
    this.meteorId = meteorId;
    this.deltaV = deltaV;
    this.impactorInventoryId = impactorInventoryId;
    this.onImpact = onImpact;
    this.color = color;
  }

  start(app: Application): void {
    this.appRef = app;
    if (!this.gfx) {
      this.gfx = new Graphics();
      // Prefer attaching to main scene container (first child of stage) to inherit camera transforms
      const scene = app.stage.children[0];
      if (scene) scene.addChild(this.gfx); else app.stage.addChild(this.gfx);
    }
  }

  private ensureGraphics() {
    if (this.destroyed) return; // do not recreate after destruction
    if (!this.gfx) {
      const app = this.appRef || GLOBAL_PIXI_APP;
      if (!app) return;
      this.gfx = new Graphics();
      const scene = app.stage.children[0];
      if (scene) scene.addChild(this.gfx); else app.stage.addChild(this.gfx);
      console.debug(`[InterceptorProjectile ${this.id}] Created graphics (ensureGraphics)`);
    } else if (!this.gfx.parent) {
      const app = this.appRef || GLOBAL_PIXI_APP; if (!app) return;
      const scene = app.stage.children[0];
      if (scene) scene.addChild(this.gfx); else app.stage.addChild(this.gfx);
    }
  }

  update(dt: number): void {
    if (this.destroyed) return; // safety: skip any updates after impact
    if (dt>0) {
      // Break large dt into smaller substeps for stability & visibility (prevents huge frame jumps)
      const MAX_SUB_DT = 60; // seconds per physics micro-step
      let remaining = dt;
      while (remaining > 0) {
        const step = remaining > MAX_SUB_DT ? MAX_SUB_DT : remaining;
        // Integrate gravity using ONLY the Sun (to stay consistent with Lambert solver assumptions)
        const rx = this.position.x;
        const ry = this.position.y;
        const rz = this.position.z;
        const r2 = rx*rx + ry*ry + rz*rz;
        const r = Math.sqrt(r2) || 1e-9;
        const mu = MSunxGperAU3; // G*M_sun in AU^3/s^2 (scaled)
        const factor = -mu / (r*r*r);
        const ax = rx * factor;
        const ay = ry * factor;
        const az = rz * factor;
        this.velocity = this.velocity.add(new Vector(ax, ay, az).scale(step));
        this.position = this.position.add(this.velocity.scale(step));
        this.elapsed += step;
        remaining -= step;
        if (this.elapsed >= this.flightTime) { this.impact(); break; }
      }
    }
    // Diagnostics: first few frames + NaN / Infinity / out-of-range checks
    if (this.debugFrameCount < 5) {
      console.debug(`[ImpProj ${this.id}] frame=${this.debugFrameCount} pos=(${this.position.x.toExponential(3)},${this.position.y.toExponential(3)}) vel=(${this.velocity.x.toExponential(3)},${this.velocity.y.toExponential(3)}) elapsed=${this.elapsed.toFixed(1)}/${this.flightTime.toFixed(1)}`);
    }
    if (!isFinite(this.position.x) || !isFinite(this.position.y) || !isFinite(this.position.z)) {
      console.warn(`[ImpProj ${this.id}] Non-finite position`, this.position);
    }
    if (Math.abs(this.position.x) > 1e6 || Math.abs(this.position.y) > 1e6) {
      console.warn(`[ImpProj ${this.id}] Position very large (AU units?)`, this.position);
    }
    this.debugFrameCount++;
    // Guarantee graphics exist and are attached
    this.ensureGraphics();
    // Early impact check: if within small AU distance of meteor, trigger impact immediately
    if (this.elapsed < this.flightTime) {
      const meteor: any = ENTITIES.find(e=> (e as any).id === this.meteorId);
      if (meteor && meteor.position) {
        const dx = this.position.x - meteor.position.x;
        const dy = this.position.y - meteor.position.y;
        const dz = this.position.z - meteor.position.z;
        const dist2 = dx*dx + dy*dy + dz*dz;
        const threshold = 0.00001; // ~1500 km (since 1 AU ~1.496e8 km)
        if (dist2 < threshold*threshold) {
          console.debug(`[ImpProj ${this.id}] Early impact proximity reached (d=${Math.sqrt(dist2).toExponential(3)} AU)`);
          this.impact();
        }
      }
    }
    if (this.gfx) {
      const pixelPhysical = (10 / AU_IN_KM) * POSITION_SCALE; // 10 km nominal (original)
      const pr = Math.max(pixelPhysical * RADIUS_SCALE, MIN_PIXEL_RADIUS);
      this.gfx.clear();
      // (Optional heartbeat pulse for debugging - uncomment to visualize renders)
      // const pulse = (Math.floor(performance.now()/250) % 2) === 0;
      // const drawColor = pulse ? this.color : (this.color ^ 0x222222);
      this.gfx.circle(0, 0, pr).fill(this.color);
      this.gfx.position.set(this.position.x * POSITION_SCALE, this.position.y * POSITION_SCALE);
      this.gfx.visible = true;
      this.gfx.alpha = 1;
    } else {
      // If still no gfx, attempt creation once more via global app
      this.ensureGraphics();
    }
    // Glow removed
  }

  private impact() {
    // Apply delta-V to meteor
    const meteor: any = ENTITIES.find(e=> (e as any).id === this.meteorId);
    if (meteor && meteor.velocity && this.deltaV) {
      meteor.velocity = meteor.velocity.add(this.deltaV);
    }
    console.debug(`[ImpProj ${this.id}] Impact reached at elapsed=${this.elapsed.toFixed(1)}s`);
    // Signal economy to remove impactor (via callback)
  if (this.onImpact) this.onImpact();
    this.destroy();
  }

  get graphics(): Graphics | null { return this.gfx; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.gfx) {
      // Immediately hide and remove from scene before destroying to avoid a 1-frame residual
      this.gfx.visible = false;
      if (this.gfx.parent) this.gfx.parent.removeChild(this.gfx);
      this.gfx.destroy();
      this.gfx = null;
    }
    // glow removed
    // Remove from ENTITIES array
    const idx = ENTITIES.indexOf(this as any);
    if (idx>=0) ENTITIES.splice(idx,1);
  }
}