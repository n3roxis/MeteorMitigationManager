import React, { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { DataBroker } from "../../../Logic/Utils/TranslationInterface";
import { RadarScreen } from "../../Graphics/Impact/RadarScreen";

interface AsteroidInfoProps { diameter?: number; }

export const AsteroidInfo: React.FC<AsteroidInfoProps> = ({ diameter = 200 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
  
      let disposed = false;
      const app = new Application();

      (async () => {
        try {
          // Use provided width/height explicitly for initial canvas size to avoid 1px fallback when rect not yet laid out
          await app.init({ width: diameter, height: diameter, backgroundAlpha:0, antialias: true });
          if (disposed) return;
          el.appendChild(app.canvas);
          
          // setup ui container
          const display = new RadarScreen();
          display.start(app);

          // setup Radar background
          
        
          // setup Asteroid visuals
          
          app.stage.addChild(display.display);

          app.ticker.add((tick)=>{
            const impact = DataBroker.instance.getImpact()
            //take impact name,size,angle, dense, vel
            if(impact){ /* future impact-based updates here */ }
            display.update(tick.deltaTime);
          })
          
          //setup stat text
          
          // Resize observer to keep canvas filling the half panel
          const ro = new ResizeObserver(entries => {
            if (disposed) return;
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                  app.renderer.resize(width, height);
                  display.sizeTo(width,height);
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
    }, [diameter]);

    return (
      <div
        ref={containerRef}
        style={{
          width: diameter,
          height: diameter,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 0 8px 2px #4cc3ff55, 0 0 0 1px #1c2a33 inset',
          backdropFilter: 'blur(2px)',
          WebkitMaskImage: 'radial-gradient(circle at center, #000 70%, rgba(0,0,0,0.0) 100%)'
        }}
      />
    );
};