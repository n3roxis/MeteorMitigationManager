import { SCALE } from "./Constants";

export const toMercator = (lambda:number,phi:number) =>{
    let x = SCALE*(lambda - 0);
    let y = SCALE*Math.log(Math.tan(Math.PI/4-phi/2));
    return {x,y}
}