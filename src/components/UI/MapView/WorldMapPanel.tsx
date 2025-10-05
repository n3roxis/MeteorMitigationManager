import { Viewport } from 'pixi-viewport';
import { Application, Assets, Sprite } from 'pixi.js';
import React, { useEffect, useRef } from 'react';
import { calculateImpactRadii } from '../../../Logic/formulas';
import '../../../Logic/formulas.test';
import { DataBroker, toMercator } from '../../../Logic/Utils/TranslationInterface';
import { Vector } from '../../../solar_system/utils/Vector';
import { ImpactStack } from '../../Graphics/Impact/ImpactStack';
import WorldMap from './resources/WorldMap.png';




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
        
          // setup impact stack (layers for impact visualization)
          const stack = new ImpactStack('impact-stack', new Vector(0,0,0), []);
          stack.start(app as any);
          stack.updateViewPort(viewport);
          viewport.fit(true);
          

          app.ticker.add((tick)=>{
            const impact = DataBroker.instance.getImpact()
            if(impact){
              stack.applyList(calculateImpactRadii(impact));
              const cord = toMercator(impact.longLat.lamb,impact.longLat.phi);
              stack.move(new Vector(cord.x,cord.y,0));
              stack.updateViewPort(viewport);
              stack.update(tick.deltaTime);
            }else{
              stack.disable();
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

export default WorldMapPanel;
