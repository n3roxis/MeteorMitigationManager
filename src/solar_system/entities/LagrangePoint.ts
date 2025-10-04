import { Application, Text } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Vector } from '../utils/Vector';
import { POSITION_SCALE } from '../config/scales';

export class LagrangePoint implements UpdatableEntity {
  id: string;
  position: Vector = new Vector(0,0,0);
  private label: Text | null = null;
  private color: number;
  private compute: () => Vector;
  private displayName: string;

  constructor(id: string, color: number, _sizePx: number, compute: () => Vector) {
    this.id = id;
    this.color = color;
    this.compute = compute;
    // Derive short display name (last segment like L1, L2, etc.)
    const parts = id.split('-');
    this.displayName = parts[parts.length - 1].toUpperCase();
  }

  start(app: Application): void {
    const text = new Text({ text: this.displayName, style: { fill: this.color, fontSize: 11, fontFamily: 'monospace', fontWeight: '600' } });
    // center the text so it stays anchored on the exact point
    text.anchor.set(0.5);
    this.label = text;
    app.stage.addChild(text);
  }

  update(): void {
    this.position = this.compute();
    if (this.label) {
      this.label.position.set(this.position.x * POSITION_SCALE, this.position.y * POSITION_SCALE);
    }
  }

  destroy(): void {
    this.label?.destroy();
    this.label = null;
  }

  get graphics(): Text | null { return this.label; }
}
