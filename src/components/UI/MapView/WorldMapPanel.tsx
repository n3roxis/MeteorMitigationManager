import { Viewport } from 'pixi-viewport';
import { Application, Assets, Color, DEG_TO_RAD, Graphics, Sprite } from 'pixi.js';
import React, { useEffect, useRef } from 'react';
import { toMercator } from '../../../Logic/Utils/TranslationInterface';
import WorldMap from './resources/WorldMap.png';
import { Vector } from '../../../solar_system/utils/Vector';

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

          const offset = new Vector(rect.width/2,rect.height/2,0);
          const viewport = new Viewport({
            screenWidth: rect.width,
            screenHeight: rect.height,
            worldWidth: rect.width,
            worldHeight: rect.height,
            events: app.renderer.events,
            passiveWheel:false
          });

          // add the viewport to the stage
          app.stage.addChild(viewport);

          // activate plugins
          viewport.drag().pinch().wheel().decelerate();
          const tex = await Assets.load(WorldMap);
          const map = new Sprite(tex);
          viewport.addChild(map);
          map.anchor.set(0.5,0.5);
          map.position.set(rect.width/2,rect.height/2);
          
          const cord =  toMercator(DEG_TO_RAD*0,DEG_TO_RAD*51.508742);
          console.log(cord);
          const container = new Graphics();
          container.circle(cord.x,cord.y,2).fill(new Color('red'))
          container.position.set(rect.width/2,rect.height/2);
          viewport.addChild(container);
  
          viewport.fit();
          // Resize observer to keep canvas filling the half panel
          const ro = new ResizeObserver(entries => {
            if (disposed) return;
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                  app.renderer.resize(width, height);
                  viewport.resize(width,height,width,height);
                  viewport.clampZoom({
                    maxWidth: width * 2,
                    minWidth:width/3,
                    minScale:0.48
                  }).setZoom(0.48);
                  viewport.moveCenter(width/2,height/2);
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
