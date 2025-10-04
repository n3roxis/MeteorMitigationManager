import { Application } from 'pixi.js';

export interface UpdatableEntity {
  id: string;
  x: number;
  y: number;
  z: number;
  start(app: Application): void;
  update(dt: number): void;
  destroy(): void;
}
