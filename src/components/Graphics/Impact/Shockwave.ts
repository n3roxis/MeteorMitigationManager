import { Application, Graphics } from "pixi.js"
import { RadiusType } from "../../../Logic/Utils/TranslationInterface"
import { UpdatableEntity } from "../../../solar_system/entities/Entity"
import { Vector } from "../../../solar_system/utils/Vector"


export class Shockwave implements UpdatableEntity{
    id: string = ""
    type: RadiusType
    position = Vector.zero
    off = Vector.zero
    radius:number
    color = {color:'#00df00'}
    private gfx: Graphics | null = null
    private period = 2
    private cT = 0
    animate = false
    enabled = true


    constructor(type:RadiusType,position:Vector,radius:number){
        this.type = type
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
                circ.fill(this.color);
                
                this.gfx.position.set(this.off.x, this.off.y);
            }
        }
    }

    static createShock(radius:number):Shockwave {
        return new Shockwave(RadiusType.SHOCK,Vector.zero,radius);
    }
    static createThermVis(radius:number):Shockwave{
        return new Shockwave(RadiusType.THERM_VIS,Vector.zero,radius);
    }
    static createThermAct(radius:number):Shockwave{
        return new Shockwave(RadiusType.THERM_ACT,Vector.zero,radius);
    }
    static createSeis(radius:number):Shockwave{
        return new Shockwave(RadiusType.SEIS,Vector.zero,radius);
    }
    static createCrate(radius:number):Shockwave{
        return new Shockwave(RadiusType.CRATER,Vector.zero,radius);
    }

    get graphics(): Graphics | null { return this.gfx; }
    setPeriod(p:number){
        this.period = p;
    }
    getPeriod():number{
        return this.period;
    }
}