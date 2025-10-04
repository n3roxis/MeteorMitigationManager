import {Application, Assets, Sprite } from 'pixi.js';
import WorldMap from './resources/WorldMap.png';


export async function PanView(app:Application):Promise<any>{
        const tex = await Assets.load(WorldMap);
        const map = new Sprite(tex);
        map.anchor.set(0.5,0.5)
        map.eventMode = 'static';
        map.position.set(app.renderer.width/2,app.renderer.height/2);

        map.on('wheel',(e)=>{
            const offx = (map.x)/ app.renderer.width;
            const offy = (map.y)/ app.renderer.height;
            map.width = Math.max(map.width + e.deltaY*10,app.renderer.width);
            map.scale.y = map.scale.x;
            
            const finalX = offx * width;
            const finalY = offy * height;

            map.position.set(finalX - (app.renderer.width - map.width) / 2,
                            finalY - (app.renderer.height - map.height) / 2+app.renderer.height/4);
          })
        return map;
        }
        
