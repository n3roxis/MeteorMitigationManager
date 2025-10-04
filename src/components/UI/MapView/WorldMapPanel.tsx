import { Application, Assets, Graphics, Sprite } from 'pixi.js';
import React, { useEffect, useRef } from 'react';
import WorldMap from './resources/WorldMap.png';
import { PanView } from './PanView';

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
        
          const map = await PanView(app);
          app.stage.addChild(map);
  
          // Resize observer to keep canvas filling the half panel
          const ro = new ResizeObserver(entries => {
            if (disposed) return;
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                  app.renderer.resize(width, height);
                  const offx = map.x / app.renderer.width;
                  const offy = map.y / app.renderer.height;
                  map.width = width;
                  map.scale.y = map.scale.x;
                  map.position.set(width * offx+app.renderer.width/2, height * offy+app.renderer.width/2);

                  const finalX = offx * width;
                  const finalY = offy * height;

                  map.position.set(finalX - (app.renderer.width - map.width) / 2,
                                  finalY - (app.renderer.height - map.height) / 2+app.renderer.height/4);
                  //map.position.set((offx-map.width)/2,(offy- map.height)/2);
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
