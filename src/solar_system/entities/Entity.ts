import { Application } from 'pixi.js';
import { Vector } from '../utils/Vector';

export interface UpdatableEntity {
  id: string;
  position: Vector;
  start(app: Application): void;
  update(dt: number): void;
  destroy(): void;
}
