import { useEffect, useRef } from 'react';
import { Application, Container } from 'pixi.js';
import { PLANETS } from '../data/planets';
import { ORBITS } from '../data/orbits';
import { updateScales, POSITION_SCALE } from '../config/scales';
import { advanceSimulation, resetSimulationTime } from '../state/simulation';
import { ENTITIES, registerEntity, clearEntities } from '../state/entities';

export const SolarSystemPanel = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const planets = PLANETS; // constants
  const orbits = ORBITS;   // constants

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    const app = new Application();
    let centerX = 0;
    let centerY = 0;
    const scene = new Container();
    app.stage.addChild(scene);

    // One-time initialization
    const init = async () => {
      await app.init({ width: 1, height: 1, background: 0x111111, antialias: true });
      if (disposed) return;
      el.appendChild(app.canvas);

      // Start and register orbits first (so they render behind planets)
      for (const o of orbits) {
        o.start(app);
        const gfx = o.graphics; if (gfx) scene.addChild(gfx); // reparent to scene
        registerEntity(o);
      }
      for (const p of planets) {
        p.start(app);
        const gfx = p.graphics; if (gfx) scene.addChild(gfx); // reparent
        registerEntity(p);
      }
      resetSimulationTime();

      resizeToElement();
      app.ticker.add(tick);
    };

    // Per-tick update (simulation logic placeholder)
    const tick = (ticker: { deltaMS: number }) => {
      if (disposed) return;
      const dt = ticker.deltaMS / 1000;
      advanceSimulation(dt);
      for (const e of ENTITIES) e.update(dt);
    };

    const resizeToElement = () => {
      if (disposed) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        app.renderer.resize(rect.width, rect.height);
        centerX = rect.width / 2;
        centerY = rect.height / 2;
      }
      // Center the whole scene container instead of each entity
      scene.position.set(centerX, centerY);
    };

    const onWheel = (e: WheelEvent) => {
      // Prevent page scroll while zooming canvas
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      updateScales(zoomFactor);
      // Entities will detect scale change and redraw in their update; immediately reposition
      for (const e of ENTITIES) e.update(0); // force redraw without advancing time
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(resizeToElement);
    ro.observe(el);
    (app as any)._ro = ro;

    init().catch(err => console.error('[SolarSystemPanel] init error', err));

    return () => {
      disposed = true;
      el.removeEventListener('wheel', onWheel as any);
      const ro: ResizeObserver | undefined = (app as any)._ro;
      if (ro) ro.disconnect();
      for (const e of ENTITIES) e.destroy();
      clearEntities();
      if ((app as any).renderer) app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default SolarSystemPanel;
