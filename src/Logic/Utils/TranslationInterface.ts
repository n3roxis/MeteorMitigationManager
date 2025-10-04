import { Vector } from "../../solar_system/utils/Vector";
import { SCALE } from "./Constants";

export const toMercator = (lambda:number,phi:number) =>{
    let x = SCALE*(lambda - 0);
    let y = SCALE*Math.log(Math.tan(Math.PI/4-phi/2));
    return {x,y}
}

export class Impact{
    mass:number
    velocity:number
    angle:number
    longLat:{lamb: number,phi: number}

    /**
     * longLat = longitude Latitude in a 2 tuple in named order
     */
    constructor(mass:number,velocity:number,angle:number,longLat:{lamb: number, phi: number}){
        this.mass = mass;
        this.velocity = velocity;
        this.angle = angle;
        this.longLat = longLat;
    }
}

export class SanitizedImpact{
    radius:number=0
    position:Vector=Vector.zero();

    constructor(impact:Impact){

    }


}

export class DataBroker {
    static #instance: DataBroker;
    private _impact:Impact | null = null;
    private _inUse:boolean = false;
    private constructor() { }

    public static get instance(): DataBroker {
        if (!DataBroker.#instance) {
            DataBroker.#instance = new DataBroker();
        }

        return DataBroker.#instance;
    }

    /**
     * 
     * @returns used impact data and clears used state
     */
    public getImpact():Impact | null{
        this._inUse = false;
        return this._impact;
    }

    /**
     * 
     * @param impact sets impact data if data is not in use
     * @returns false if data is in use
     */
    public setImpact(impact:Impact){
        if(!this._inUse){
            this._inUse = true;
            this._impact = impact;
        }else{
            return false;
        }
    }
}