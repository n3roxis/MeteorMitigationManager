import { UpdatableEntity } from '../entities/Entity';

export const ENTITIES: UpdatableEntity[] = [];

export function registerEntity(e: UpdatableEntity) {
  ENTITIES.push(e);
}

export function clearEntities() {
  ENTITIES.length = 0;
}
