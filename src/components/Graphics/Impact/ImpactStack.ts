import { Viewport } from "pixi-viewport";
import { AlphaFilter, Application, Container, DEG_TO_RAD } from "pixi.js";
import { CRATER_COL, SEIS_COL_MAX, SHOCK_COL, THERM_ACT_COL, THERM_VIS_COL } from "../../../Logic/Utils/Constants";
import { Radius, RadiusType, toMercator } from "../../../Logic/Utils/TranslationInterface";
import { UpdatableEntity } from "../../../solar_system/entities/Entity";
import { Vector } from "../../../solar_system/utils/Vector";
import { Shockwave } from "./Shockwave";


export class ImpactStack implements UpdatableEntity{
    id:string
    position:Vector
    waves:Shockwave[] = []
    private enabled = false
    container = new Container()
    off = Vector.zero;

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
        const opacity = new AlphaFilter();
        opacity.alpha = 0.7;
        this.container.filters = [opacity];
    }
    updateViewPort(viewport:Viewport){
        for(const w of this.waves){
            const gfx = w.graphics; if (gfx) this.container.addChild(gfx);
        }
        viewport.addChild(this.container);
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
        this.enabled = true;
        for(const w of this.waves){
            w.enabled = true;
        }
    }

    disable(){
        this.enabled = false;
        for(const w of this.waves){
            w.enabled = false;
        }
    }

    applyList(data:Radius[],app:Application){
        this.waves = this.waves.filter((w)=>{
            if(w.type == RadiusType.SEIS){
                w.destroy()
            }else{
                return w;
            }
        })
        for(let r of data){
            const radius = this.convertRadius(r.center,r.radius);
            switch(r.type){
                case RadiusType.THERM_VIS: {let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = THERM_VIS_COL;
                }else{
                    const wave = Shockwave.createThermVis(radius);
                    wave.color = THERM_VIS_COL;
                    wave.start(app);
                    this.waves.push(wave);
                }}break;
                case RadiusType.THERM_ACT:{let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = THERM_ACT_COL;
                }else{
                    const wave = Shockwave.createThermAct(radius);
                    wave.color = THERM_ACT_COL;
                    wave.start(app);
                    this.waves.push(wave);
                }}break;
                case RadiusType.SEIS:{
                    const alpha = Number(SEIS_COL_MAX.alpha) * r.data/12;
                    const colorScaled = {color:SEIS_COL_MAX.color,alpha:alpha};
                    const wave = Shockwave.createSeis(radius);
                    wave.color = SEIS_COL_MAX;
                    wave.start(app);
                    this.waves.push(wave);
                }break;
                case RadiusType.CRATER:{let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = CRATER_COL;
                }else{
                    const wave = Shockwave.createCrate(radius);
                    wave.color = CRATER_COL;
                    wave.start(app);
                    this.waves.push(wave);
                }}break;
                case RadiusType.SHOCK:{let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = SHOCK_COL;
                }else{
                    const wave = Shockwave.createShock(radius);
                    wave.color = SHOCK_COL;
                    wave.start(app);
                    this.waves.push(wave);
                }}break;
            }
        }
        this.waves = this.waves.sort((a,b)=>{
            if(a.radius > b.radius){
                return -1;
            }else if(a.radius == b.radius){
                return 0;
            }
            return 1;
        })
        this.enable();
    }

    contains(type:RadiusType){
        for(let i of this.waves){
            if(i.type == type){
                return i;
            }
        }
        return false;
    }

    convertRadius(a:{long:number,lat:number},b:{long:number,lat:number}){
        const aproj = toMercator(DEG_TO_RAD*a.long,DEG_TO_RAD*a.lat);
        const bproj = toMercator(DEG_TO_RAD*b.long,DEG_TO_RAD*b.lat,true);
        return this.getDistance(aproj,bproj);
    }
    getDistance(a:{x:number,y:number},b:{x:number,y:number}){
        return Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2)
    }

    get isEnabled(){return this.enabled;}

}