import { Viewport } from 'pixi-viewport';
import { Application, Assets, Sprite } from 'pixi.js';
import React, { useEffect, useRef } from 'react';
import { DataBroker, toMercator } from '../../../Logic/Utils/TranslationInterface';
import { Vector } from '../../../solar_system/utils/Vector';
import { ImpactStack } from '../../Graphics/Impact/ImpactStack';
import { Shockwave } from '../../Graphics/Impact/Shockwave';
import WorldMap from './resources/WorldMap.png';
import DensityMap from '.resources/DensityMap.png'


const waves = [
            Shockwave.createAir(Vector.zero(),0),
            Shockwave.createSeis(Vector.zero(),0),
            Shockwave.createTherm(Vector.zero(),0)
          ]
const stack = new ImpactStack("prediction",Vector.zero(),waves);

// Placeholder world map panel to build on later
export const WorldMapPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
  
      let disposed = false;
      const app = new Application();

      (async () => {
        try {

          // Temporary init size; will resize immediately after
          const rect = el.getBoundingClientRect();
          await app.init({ width: rect.width || 1, height: rect.height || 1, background: 0x111111, antialias: true });
          if (disposed) return;
          el.appendChild(app.canvas);

          const viewport = new Viewport({
            screenWidth: rect.width,
            screenHeight: rect.height,
            worldWidth: 3500,
            worldHeight: 3500,
            events: app.renderer.events,
            passiveWheel:false
          });

          // add the viewport to the stage
          app.stage.addChild(viewport);

          // activate plugins
          viewport.drag().pinch().wheel().decelerate();

          // setup map background
          const tex = await Assets.load(WorldMap);
          const map = new Sprite(tex);
          viewport.addChild(map);
          map.anchor.set(0.5,0.5);
          map.position.set(rect.width/2,rect.height/2);
          //Bevölkerungsdichtekarte
          const density= await Assets.load(DensityMap);
          const place= new Sprite(density);
          //TODO:Karten aufeinander passend strecken.
        
          // setup impact Stack
          viewport.fit(true);
          

          app.ticker.add((tick)=>{
            const impact = DataBroker.instance.getImpact()
            if(impact){
              const cord = toMercator(impact.longLat.lamb,impact.longLat.phi);
              stack.move(new Vector(cord.x,cord.y,0));
              //TODO: Astrid stuff
              stack.update(tick.deltaTime);
            }
          })
  
          // Resize observer to keep canvas filling the half panel
          const ro = new ResizeObserver(entries => {
            if (disposed) return;
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                  app.renderer.resize(width, height);
                  viewport.resize(width,height);
                  viewport.clampZoom({
                    maxScale:5,
                    minScale:0.25,
                  })
                  viewport.moveCenter(width/2,height/2);
                  viewport.fit(true);
                }
              }
          });
          
          ro.observe(el);
          (app as any)._ro = ro;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[SolarSystemPanel] init error', err);
        }
      })();
  
      return () => {
        disposed = true;
        const ro: ResizeObserver | undefined = (app as any)._ro;
        if (ro) ro.disconnect();
        if ((app as any).renderer) app.destroy(true, { children: true, texture: true });
      };
    }, []);
  
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

//Fehlerhaft



//onclick: set(x,y), get (r)/get(circleoffire)/get(circleofpressure)/get(seismiccircle) -> draw circle, collect pixel data within area, calculate range
const GetPopulationinArea=(context:CanvasRenderingContext2D,x:number,y:number,radius:number):Array<number>=>{
    const population:Array<number>=[];
    number ly=0;
    number my=0;
    number ty=0;
    number O=0;
    number or=0;
    number r=0;
    number dr=0;
    number m=0;
    for(let i=-radius;i<=radius;i++){
        for(let j=-radius;j<=radius;j++){
            if(i*i+j*j<=radius*radius){
                const color=GetColorOfPixel(context,x+i,y+j);
                
                switch (color.join(' ');) {
                  case '255 255 190': 
                  ly++;
                  
                  break;
                  case '255 255 115':
                  my++;
                  
                  break;
                  case '255 255 0':
                  ty++;
                  
                  break;
                  case '255 170 0':
                  O++;
                  
                  break;
                  case '255 102 0':
                  or++;
                  
                  break;  
                  case '255 0 0':
                  r++;
                  
                  break;  
                  case '204 0 0':                    
                  dr++;
                  
                  break;  
                  case '115 0 0':
                  m++;
                  
                    break;
                
                  default:
                    break;
                }
                
            }
        }
      }
      console.log(ly,my,ty,O,or,r,dr,m);

      PopulationLB=ly+my*6+ty*26+O*51+or*101+r*501+dr*2501+m*5001;
      PopulationUB=ly*5+my*25+ty*50+O*100+or*500+r*2500+dr*5000+m*185000;
      population.push(PopulationLB,PopulationUB);
      return population;
}

const GetColorOfPixel=(context:CanvasRenderingContext2D,x:number,y:number):Array<number> =>
{
    const imageData:Uint8ClampedArray=context.getImageData(x,y,1,1).data;
    const rgb:Array<number>=[imageData[0],imageData[1],imageData[2]];
    return rgb;
}


export default WorldMapPanel;
