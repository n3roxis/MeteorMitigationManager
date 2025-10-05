import { Application } from "pixi.js";
import { UpdatableEntity } from "../../../solar_system/entities/Entity";
import { Vector } from "../../../solar_system/utils/Vector";
import { Shockwave } from "./Shockwave";


export class ImpactStack implements UpdatableEntity{
    id:string
    position:Vector
    waves:Shockwave[]
    private enabled = false

    constructor(id:string,position:Vector,waves:Shockwave[]){
        this.id = id;
        this.position = position;
        this.waves = waves;
    }
    
    start(app: Application): void {
        for(const w of this.waves){
            w.start(app);
            w.enabled = false;
        }
    }
    update(dt: number): void {
        if(this.enabled){
            for(const w of this.waves){
                w.update(dt);
            }
        }
    }

    move(position:Vector){
        this.position = position;
        for(const w of this.waves){
            w.move(position);
        }
    }

    destroy(): void {
        for(const w of this.waves){
            w.destroy();
        }
    }

    enable(){
        for(const w of this.waves){
            w.enabled = true;
        }
    }

    disable(){
        for(const w of this.waves){
            w.enabled = false;
        }
    }

    get isEnabled(){return this.enabled;}

}