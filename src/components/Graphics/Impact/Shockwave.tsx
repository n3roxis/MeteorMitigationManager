import { Application, Color, Graphics } from "pixi.js"
import { PRESSURE_FACTOR } from "../../../Logic/Utils/Constants"
import { UpdatableEntity } from "../../../solar_system/entities/Entity"
import { Vector } from "../../../solar_system/utils/Vector"


export class Shockwave implements UpdatableEntity{
    id: string
    position = new Vector(0,0,0)
    off = new Vector(0,0,0)
    radius:number
    pressure:number
    color = new Color('#00abff')
    opacity = 0.4;
    private gfx: Graphics | null = null
    period:number
    cT = 0


    constructor(id:string,position:Vector,offset:Vector,radius:number,pressure:number){
        this.id = id
        this.position = position;
        this.off = offset;
        this.radius = radius;
        this.pressure = pressure;
        this.period = pressure * PRESSURE_FACTOR;
        this.gfx = new Graphics();
    }
    
    start(app: Application): void {
        
    }
    destroy(): void {
        this.gfx?.destroy();
        this.gfx = null;
    }

    move(v:Vector){
        this.position = v;
    }
    

    update(dt:number){
        const perc = Math.min(this.cT / this.period,1);
        if(this.cT < this.period)this.cT = this.cT + (2*dt/(100+(perc*100)));
        const currentRadius = perc * this.radius;
        if(this.gfx){
            this.gfx.clear();
            const circ = this.gfx.circle(this.position.x, 0, currentRadius);
            circ.alpha = this.opacity;
            circ.fill(this.color);
            
            this.gfx.position.set(this.off.x, this.position.y + this.off.y);
        }
        
    }

    get graphics(): Graphics | null { return this.gfx; }
}