import { useEffect, useRef } from 'react';
import { Application, Container } from 'pixi.js';
import { PLANETS, BODIES, MOON, EARTH_MOON_BARYCENTER, SUN } from '../data/bodies';
import { ORBITS } from '../data/orbits';
import { updateScales, POSITION_SCALE, SIM_DAYS_PER_REAL_SECOND } from '../config/scales';
import { advanceSimulation, resetSimulationTime } from '../state/simulation';
import { ENTITIES, registerEntity, clearEntities } from '../state/entities';
import { MOON_ORBIT } from '../data/orbits';
import { Moon } from '../entities/Moon';
import { Orbit } from '../entities/Orbit';
import { GlowEffect } from '../entities/GlowEffect';
import {METEORS} from "../data/meteors";

export const SolarSystemPanel = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const planets = PLANETS; // constants for planets only
  const orbits = ORBITS;   // includes planetary + moon orbit
  const meteors = METEORS;   //

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    const app = new Application();
    let centerX = 0; // viewport center in pixels
    let centerY = 0;
    const scene = new Container();
    app.stage.addChild(scene);

    // One-time initialization
    const init = async () => {
      await app.init({ width: 1, height: 1, background: 0x111111, antialias: true });
      if (disposed) return;
      el.appendChild(app.canvas);

      // Create and register sun glow (visual-only) FIRST so it is behind everything.
      // Simplified glow: outer halo alpha=0.25, bright core alpha=0.6 at 15% radius.
      const sunGlow = new GlowEffect('sun-glow', SUN, 0.1, 0xffd54f, 0.25, 48, 0.6, 0.15);
      // Blur scaling: power 0.5 (gentle inverse), min 12, max 80
      sunGlow.setBlurScaling(0.5, 12, 80);
      sunGlow.start(app);
      const glowGfx = sunGlow.graphics; if (glowGfx) scene.addChildAt(glowGfx, 0);
      registerEntity(sunGlow);

      // Start and register orbits next (they go behind planets but above glow)
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
      for (const m of meteors) {
        m.start(app);
        const gfx = m.graphics; if (gfx) scene.addChild(gfx); // reparent
        registerEntity(m);
      }

      // Add Moon body (already defined in bodies.ts)
      MOON.start(app);
      const moonGfx = MOON.graphics; if (moonGfx) scene.addChild(moonGfx);
      registerEntity(MOON);

      resetSimulationTime();

      resizeToElement();
      app.ticker.add(tick);
    };

    // Per-tick update (simulation logic placeholder)
    const tick = (ticker: { deltaMS: number }) => {
      if (disposed) return;
      const realDtSeconds = ticker.deltaMS / 1000 * 86400 * SIM_DAYS_PER_REAL_SECOND; // scale real time -> simulation days
      advanceSimulation(realDtSeconds);
      for (const e of ENTITIES) {
        if (!(e instanceof (Orbit as any))) e.update(realDtSeconds);
      }
      for (const e of ENTITIES) {
        if (e instanceof (Orbit as any)) e.update(realDtSeconds);
      }
      if (EARTH_MOON_BARYCENTER) {
        const tx = EARTH_MOON_BARYCENTER.position.x * POSITION_SCALE;
        const ty = EARTH_MOON_BARYCENTER.position.y * POSITION_SCALE;
        scene.position.set(centerX - tx, centerY - ty);
      }
    };

    const resizeToElement = () => {
      if (disposed) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        app.renderer.resize(rect.width, rect.height);
        centerX = rect.width / 2;
        centerY = rect.height / 2;
      }
      // Camera centering happens in tick; here we only update base center values
    };

    const onWheel = (e: WheelEvent) => {
      // Prevent page scroll while zooming canvas
      e.preventDefault();
      // Increased zoom sensitivity (was 1.1); 1.2 ~ double the per-notch scale change
      const zoomFactor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      updateScales(zoomFactor);
      // Entities will detect scale change and redraw in their update; immediately reposition
      // Force redraw in two phases for consistency after zoom
      for (const e of ENTITIES) { if (!(e instanceof (Orbit as any))) e.update(0); }
      for (const e of ENTITIES) { if (e instanceof (Orbit as any)) e.update(0); }
      // Reposition immediately so zoom feels responsive
      if (EARTH_MOON_BARYCENTER) {
        const tx = EARTH_MOON_BARYCENTER.position.x * POSITION_SCALE;
        const ty = EARTH_MOON_BARYCENTER.position.y * POSITION_SCALE;
        scene.position.set(centerX - tx, centerY - ty);
      }
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
