import { Application, Text } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Vector } from '../utils/Vector';
import { Planet } from './Planet';
import { POSITION_SCALE, RADIUS_SCALE, MIN_PIXEL_RADIUS, AU_IN_KM } from '../config/scales';
import { EARTH } from '../data/bodies';

/**
 * Renders a text label above a planet, following its position each tick.
 */
export class PlanetLabel implements UpdatableEntity {
  id: string;
  position: Vector = new Vector(0,0,0);
  private planet: Planet;
  private textObj: Text | null = null;

  constructor(id: string, planet: Planet) {
    this.id = id;
    this.planet = planet;
  }

  start(app: Application): void {
    const label = new Text({
      text: this.planet.id.replace(/-.*/, ''),
      style: { fill: this.planet.color, fontSize: 12, fontFamily: 'monospace', fontWeight: '600' }
    });
    label.anchor.set(0.5, 1); // center horizontally, bottom at position
    this.textObj = label;
    app.stage.addChild(label);
  }

  update(): void {
    // Mirror planet world position
    this.position.x = this.planet.position.x;
    this.position.y = this.planet.position.y;
    this.position.z = this.planet.position.z;

    if (this.textObj) {
      // Moon-specific gating: only show moon label if zoomed in enough that Earth-Moon pixel separation is noticeable
      if (this.planet.id === 'moon' && EARTH) {
        const dx = (this.planet.position.x - EARTH.position.x) * POSITION_SCALE;
        const dy = (this.planet.position.y - EARTH.position.y) * POSITION_SCALE;
        const distPx = Math.hypot(dx, dy);
        // Threshold: show only if separation > 40 pixels
        this.textObj.visible = distPx > 20;
      } else {
        this.textObj.visible = true;
      }
      // Determine on-screen offset based on rendered radius
      const pixelPhysical = (this.planet.radiusKm / AU_IN_KM) * POSITION_SCALE;
      const pr = Math.max(pixelPhysical * RADIUS_SCALE, MIN_PIXEL_RADIUS);
      const offset = pr + 6; // 6px gap
      this.textObj.position.set(
        this.position.x * POSITION_SCALE,
        this.position.y * POSITION_SCALE - offset
      );
    }
  }

  destroy(): void {
    this.textObj?.destroy();
    this.textObj = null;
  }

  get graphics(): Text | null { return this.textObj; }
}
