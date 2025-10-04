import { Application, Assets, Sprite } from 'pixi.js';
import React, { useEffect, useRef } from 'react';
import WorldMap from './resources/WorldMap.png';

import { Viewport } from 'pixi-viewport';

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
            worldHeight: app.renderer.height,
            worldWidth: app.renderer.width,
            passiveWheel: false,
            events: app.renderer.events
          });
          viewport.drag().decelerate().pinch().wheel()
          viewport.fit();

          

          const tex = await Assets.load(WorldMap);
          const map = new Sprite(tex);
          map.anchor.set(0.5,0.5);
          map.position.set(0,0)
          viewport.addChild(map);
          viewport.fit();
  
          // Resize observer to keep canvas filling the half panel
          const ro = new ResizeObserver(entries => {
            if (disposed) return;
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                  app.renderer.resize(width, height);
                  viewport.resize(width,height);
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
