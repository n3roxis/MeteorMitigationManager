import { RADSCALE, SCALE } from "./Constants";

export const toMercator = (lambda:number,phi:number,rad?:boolean) =>{
    if(rad){
        let x= RADSCALE*(lambda - 0);
        let y = RADSCALE*Math.log(Math.tan(Math.PI/4-phi/2));
        return {x,y}
    }else{
        let x= SCALE*(lambda - 0);
        let y = SCALE*Math.log(Math.tan(Math.PI/4-phi/2));
        return {x,y}
    }
}

export class Impact{
    name:string
    mass:number
    density:number
    velocity:number
    angle:number
    longLat:{lamb: number,phi: number}

    /**
     * longLat = longitude Latitude in a 2 tuple in named order
     */
    constructor(name:string,mass:number,density:number,velocity:number,angle:number,longLat:{lamb: number, phi: number}){
        this.name = name;
        this.mass = mass;
        this.density = density;
        this.velocity = velocity;
        this.angle = angle;
        this.longLat = longLat;
    }
}

export class DataBroker {
    static #instance: DataBroker;
    private _impact:Impact | null = null;
    private constructor() { }

    public static get instance(): DataBroker {
        if (!DataBroker.#instance) {
            DataBroker.#instance = new DataBroker();
        }

        return DataBroker.#instance;
    }

    public getImpact():Impact | null{
        return this._impact;
    }

    public setImpact(impact:Impact | null){
        this._impact = impact;
    }
}

export enum RadiusType{
    THERM_VIS, // two points
    THERM_ACT, // two points
    SEIS, //two points and richter
    CRATER, // two points and depth
    SHOCK // two points
}

export class Radius{
    type:RadiusType
    center:{long:number,lat:number}
    radius:{long:number,lat:number}
    data:number
    tooltip:string

    constructor(type:RadiusType,center:{long:number,lat:number},radius:{long:number,lat:number},data:number,tooltip:string){
        this.type = type;
        this.center = center;
        this.radius = radius;
        this.data = data;
        this.tooltip = tooltip;
    }
}