import { Application } from "pixi.js";
import { UpdatableEntity } from "../../../solar_system/entities/Entity";
import { Vector } from "../../../solar_system/utils/Vector";

export class Population implements UpdatableEntity{
    id: string;
    position: Vector

    constructor(id:string,offset:Vector){
        this.id = id;
        this.position = offset;
    }
    start(app: Application): void {
        throw new Error("Method not implemented.");
    }
    update(dt: number): void {
        throw new Error("Method not implemented.");
    }
    destroy(): void {
        throw new Error("Method not implemented.");
    }
       
}