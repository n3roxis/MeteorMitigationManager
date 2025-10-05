import { Application } from "pixi.js";
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

    applyList(data:Radius[]){
        for(let r of data){
            const radius = this.convertRadius(r.center,r.radius);
            switch(r.type){
                case RadiusType.THERM_VIS: {let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = THERM_VIS_COL;
                }else{
                    const wave = Shockwave.createThermVis(radius);
                    wave.color = THERM_VIS_COL;
                    this.waves.push(wave);
                }}
                case RadiusType.THERM_ACT:{let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = THERM_ACT_COL;
                }else{
                    const wave = Shockwave.createThermAct(radius);
                    wave.color = THERM_ACT_COL;
                    this.waves.push(wave);
                }}
                case RadiusType.SEIS:{let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = SEIS_COL_MAX;
                }else{
                    const wave = Shockwave.createSeis(radius);
                    wave.color = SEIS_COL_MAX;
                    this.waves.push(wave);
                }}
                case RadiusType.CRATER:{let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = CRATER_COL;
                }else{
                    const wave = Shockwave.createCrate(radius);
                    wave.color = CRATER_COL;
                    this.waves.push(wave);
                }}
                case RadiusType.SHOCK:{let item = this.contains(r.type); if (item){
                    item.radius = radius;
                    item.color = SHOCK_COL;
                }else{
                    const wave = Shockwave.createShock(radius);
                    wave.color = SHOCK_COL;
                    this.waves.push(wave);
                }}
            }
        }
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
        const aproj = toMercator(a.long,a.lat);
        const bproj = toMercator(b.long,b.lat);
        return this.getDistance(aproj,bproj);
    }
    getDistance(a:{x:number,y:number},b:{x:number,y:number}){
        return Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2)
    }

    get isEnabled(){return this.enabled;}

}