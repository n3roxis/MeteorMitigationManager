import { Application, Color, Graphics } from "pixi.js"
import { UpdatableEntity } from "../../../solar_system/entities/Entity"
import { Vector } from "../../../solar_system/utils/Vector"


export class Shockwave implements UpdatableEntity{
    id: string
    position = Vector.zero
    off = Vector.zero
    radius:number
    color = new Color('#00abff')
    opacity = 0.4;
    private gfx: Graphics | null = null
    private period = 2
    private cT = 0
    animate = false
    enabled = true


    constructor(id:string,position:Vector,radius:number){
        this.id = id
        this.position = position;
        this.radius = radius;
        this.gfx = new Graphics();
    }
    

    start(app: Application): void {
        this.off = new Vector(app.renderer.width/2,app.renderer.height/2,0);
    }
    
    destroy(): void {
        this.gfx?.destroy();
        this.gfx = null;
    }

    move(v:Vector){
        this.position = v;
    }
    update(dt:number){
        if(this.enabled){
            const perc = Math.min(this.cT / this.period,1);
            if (this.animate){
                if(this.cT < this.period)this.cT = this.cT + (2*dt/(100+(perc*100)));
            }
            const currentRadius = perc * this.radius;
            if(this.gfx){
                this.gfx.clear();
                const circ = this.gfx.circle(this.position.x, this.position.y, this.animate ? currentRadius : this.radius);
                circ.alpha = this.opacity;
                circ.fill(this.color);
                
                this.gfx.position.set(this.off.x, this.off.y);
            }
        }
    }

    static createAir(position:Vector,radius:number):Shockwave {
        return new Shockwave("air",position,radius);
    }
    static createTherm(position:Vector,radius:number):Shockwave{
        return new Shockwave("therm",position,radius);
    }
    static createSeis(position:Vector, radius:number):Shockwave{
        return new Shockwave("seis",position,radius);
    }

    get graphics(): Graphics | null { return this.gfx; }
    setPeriod(p:number){
        this.period = p;
    }
    getPeriod():number{
        return this.period;
    }
}