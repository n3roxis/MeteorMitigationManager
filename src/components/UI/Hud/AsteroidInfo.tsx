import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { DataBroker } from "../../../Logic/Utils/TranslationInterface";
import { RadarScreen } from "../../Graphics/Impact/RadarScreen";

export const AsteroidInfo: React.FC =()=>{
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
          await app.init({ width: rect.width || 1, height: rect.height || 1, backgroundAlpha:0, antialias: true });
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
            if(impact){
              const a = tick.deltaTime;
            }
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
    }, []);
  
    return <div ref={containerRef} style={{width: '100%', height: '100%'}} />;
};