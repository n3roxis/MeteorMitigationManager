import { Application, BlurFilter, Container, Graphics } from "pixi.js";
import { UpdatableEntity } from "../../../solar_system/entities/Entity";
import { Vector } from "../../../solar_system/utils/Vector";


export class RadarScreen implements UpdatableEntity{
    id = "radar";
    position= Vector.zero;
    display = new Container();
    off = Vector.zero
    radius = 150
    colors = {rim:'#116511ff',bg:'#074f00',grating:'rgba(158, 239, 161, 1)'}
    private gfx: Graphics | null = null
    private fxs: Graphics | null = null
    private blur = new BlurFilter();
    private spacing = 30;
    private num = 0;
    private cT = 0;

    

    constructor(){
        this.gfx = new Graphics();
        this.fxs = new Graphics();
    }

    start(app: Application): void {
        if(this.gfx) this.display.addChild(this.gfx);
        if(this.fxs) this.display.addChild(this.fxs);
        this.sizeTo(app.renderer.width,app.renderer.height);
        
    }
    update(dt: number): void {
        this.cT += dt/100;
        this.spacing = Math.sin(this.cT*4) + 20;
        if (this.cT > 2 * Math.PI){
            this.cT = 0;
        }

        if(this.gfx && this.fxs){
            this.gfx.clear();
            this.fxs.clear();
            this.gfx.circle(0,0,this.radius).fill(this.colors.bg).stroke({width:10,color:this.colors.rim});
            this.blur.blur = 3;
            for(let i = 0;i < Math.max(this.num,this.radius%this.spacing +1); i++){
                this.fxs.circle(0,0,this.radius-i*this.spacing).stroke({width:4,color:this.colors.grating}).filters = [this.blur];
            }
            
        }
    }
    destroy(): void {
        throw new Error("Method not implemented.");
    }

    search(){

    }
    
    sizeTo(width:number,height:number){
        this.display.width = width*0.15;
        this.display.scale.y = this.display.scale.x;
        this.display.position.set(width/2,height/2);
    }
}