import {useEffect, useRef} from 'react';
import {Application, Container} from 'pixi.js';
import {ORBITS} from "../../../solar_system/data/orbits";
import {EARTH_MOON_BARYCENTER, MOON, PLANETS, SUN, EARTH} from "../../../solar_system/data/bodies";
import {METEOR_UNO, METEORS} from "../../../solar_system/data/meteors";
import {GlowEffect} from "../../../solar_system/entities/GlowEffect";
import {clearEntities, ENTITIES, registerEntity} from "../../../solar_system/state/entities";
import {advanceSimulation, resetSimulationTime, SIM_TIME_DAYS} from "../../../solar_system/state/simulation";
import {POSITION_SCALE, updateScales, getSimDaysPerPhysicsTick, PHYSICS_TICKS_PER_SECOND} from "../../../solar_system/config/scales";
import {Orbit} from "../../../solar_system/entities/Orbit";
import {PathPredictor} from "../../../solar_system/entities/PathPredictor";
import {PlanetLabel} from "../../../solar_system/entities/PlanetLabel";
import LaunchButton from './LaunchButton';
import { computeLagrangePoints } from '../../../solar_system/utils/lagrange';
import { LagrangePoint } from '../../../solar_system/entities/LagrangePoint';
import { Vector } from '../../../solar_system/utils/Vector';
import { processActions } from '../../../solar_system/economy/actions';
import { economyState } from '../../../solar_system/economy/state';

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
  // Performance overlay DOM element
  const perfDiv = document.createElement('div');
  perfDiv.style.position = 'absolute';
  perfDiv.style.top = '4px';
  // Shift right to clear 300px economy panel width + 12px gap
  perfDiv.style.left = '8px';
  perfDiv.style.padding = '4px 6px';
  perfDiv.style.background = 'rgba(0,0,0,0.45)';
  perfDiv.style.color = '#fff';
  perfDiv.style.font = '12px monospace';
  perfDiv.style.pointerEvents = 'none';
  perfDiv.style.borderRadius = '4px';
  el.appendChild(perfDiv);
    let centerX = 0; // viewport center in pixels
    let centerY = 0;
    const scene = new Container();
    app.stage.addChild(scene);
    // Track last entity count to start newly added entities (e.g., projectiles)
    let lastEntityCount = 0;
  // Camera mode toggle (press 'c' to switch between barycenter and sun)
  let cameraMode: 'barycenter' | 'sun' = 'barycenter';

        // One-time initialization
        const init = async () => {
            await app.init({width: 1, height: 1, background: 0x111111, antialias: true});
            if (disposed) return;
            el.appendChild(app.canvas);

            // Create and register sun glow (visual-only) FIRST so it is behind everything.
            // Simplified glow: outer halo alpha=0.25, bright core alpha=0.6 at 15% radius.
            const sunGlow = new GlowEffect('sun-glow', SUN, 0.1, 0xffd54f, 0.25, 48, 0.6, 0.15);
            // Blur scaling: power 0.5 (gentle inverse), min 12, max 80
            sunGlow.setBlurScaling(0.5, 12, 80);
            sunGlow.start(app);
            const glowGfx = sunGlow.graphics;
            if (glowGfx) scene.addChildAt(glowGfx, 0);
            registerEntity(sunGlow);

            // Start and register orbits next (they go behind planets but above glow)
            for (const o of orbits) {
                o.start(app);
                const gfx = o.graphics;
                if (gfx) scene.addChild(gfx); // reparent to scene
                registerEntity(o);
            }
            for (const p of planets) {
                p.start(app);
                const gfx = p.graphics;
                if (gfx) scene.addChild(gfx); // reparent
                registerEntity(p);
            }
            // Planet labels (skip barycenter pseudo-planet)
            for (const p of planets) {
                if (p.id === 'earth-moon-bary') continue;
                const label = new PlanetLabel(`${p.id}-label`, p);
                label.start(app);
                const lg = label.graphics;
                if (lg) scene.addChild(lg);
                registerEntity(label);
            }
            // Lagrange points for Sun-Earth system (use SUN as primary, EARTH as secondary)
            if (SUN && EARTH) {
                const sunEarthCompute = () => computeLagrangePoints(SUN.position, EARTH.position, SUN.massEarths, EARTH.massEarths);
                const color = EARTH.color; // Earth's blue for Sun-Earth L points
                const size = 3;
                const addLP = (id: string, getter: () => Vector) => {
                    const lp = new LagrangePoint(id, color, size, getter);
                    lp.start(app);
                    const g = lp.graphics;
                    if (g) scene.addChild(g);
                    registerEntity(lp);
                };
                addLP('sun-earth-L1', () => sunEarthCompute().L1);
                addLP('sun-earth-L2', () => sunEarthCompute().L2);
                addLP('sun-earth-L3', () => sunEarthCompute().L3);
                addLP('sun-earth-L4', () => sunEarthCompute().L4);
                addLP('sun-earth-L5', () => sunEarthCompute().L5);
            }
            for (const m of meteors) {
                m.start(app);
                const gfx = m.graphics;
                if (gfx) scene.addChild(gfx); // reparent
                registerEntity(m);
                const predictor = new PathPredictor(`${m.id}-predictor`, m);
                predictor.start(app);
                const pg = predictor.graphics;
                if (pg) scene.addChild(pg);
                registerEntity(predictor);
            }

            // Add Moon body (already defined in bodies.ts) and its label
            MOON.start(app);
            const moonGfx = MOON.graphics;
            if (moonGfx) scene.addChild(moonGfx);
            registerEntity(MOON);
            const moonLabel = new PlanetLabel('moon-label', MOON as any);
            moonLabel.start(app);
            const mlg = moonLabel.graphics;
            if (mlg) scene.addChild(mlg);
            registerEntity(moonLabel);

            resetSimulationTime();

            resizeToElement();
            startFixedLoop();
        };
        // Fixed timestep physics loop @ PHYSICS_TICKS_PER_SECOND
        const physicsDtSimDays = getSimDaysPerPhysicsTick();
        const physicsDtSimSeconds = physicsDtSimDays * 86400;
        let accumulatorMs = 0;
        let lastMs = performance.now();
        // Stats accumulation
        let frames = 0;
        let physicsTicks = 0;
        let statsTimer = 0; // ms
        let lastPerfUpdate = 0;

    const physicsStep = () => {
      advanceSimulation(physicsDtSimDays); // sim time advanced in days
      for (const e of ENTITIES) { if (!(e instanceof (Orbit as any))) e.update(physicsDtSimSeconds); }
      for (const e of ENTITIES) { if (e instanceof (Orbit as any)) e.update(physicsDtSimSeconds); }
      // Economy action processing (convert sim days to seconds)
      if (economyState.actions.length) {
        processActions(economyState, SIM_TIME_DAYS * 86400);
      } else {
        // still keep time in sync even if no actions pending
        economyState.timeSec = SIM_TIME_DAYS * 86400;
      }
      // Start any entities added after initialization (e.g., new projectiles)
      if (ENTITIES.length > lastEntityCount) {
        for (let i = lastEntityCount; i < ENTITIES.length; i++) {
          const ent: any = ENTITIES[i];
          if (!ent.graphics && ent.start) { ent.start(app); if (ent.graphics) scene.addChild(ent.graphics); }
        }
        lastEntityCount = ENTITIES.length;
      }
      physicsTicks++;
    };

        const startFixedLoop = () => {
            const tickMs = 1000 / PHYSICS_TICKS_PER_SECOND;
            const loop = () => {
                if (disposed) return;
                const now = performance.now();
                let frame = now - lastMs;
                if (frame > 250) frame = 250; // clamp pause
                lastMs = now;
                accumulatorMs += frame;
                while (accumulatorMs >= tickMs) {
                    physicsStep();
                    accumulatorMs -= tickMs;
                }
                // Camera update after physics
                if (cameraMode === 'sun' && SUN) {
                    scene.position.set(centerX, centerY);
                } else if (EARTH_MOON_BARYCENTER) {
                    const tx = EARTH_MOON_BARYCENTER.position.x * POSITION_SCALE;
                    const ty = EARTH_MOON_BARYCENTER.position.y * POSITION_SCALE;
                    scene.position.set(centerX - tx, centerY - ty);
                }
                app.render();
                frames++;
                statsTimer += frame;
                if (now - lastPerfUpdate >= 500) { // update overlay twice a second
                    const fps = (frames * 1000) / statsTimer;
                    const pps = (physicsTicks * 1000) / statsTimer;
                    perfDiv.textContent = `FPS ${fps.toFixed(1)} | Physics ${pps.toFixed(1)}Hz`;
                    frames = 0;
                    physicsTicks = 0;
                    statsTimer = 0;
                    lastPerfUpdate = now;
                }
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        };

        const resizeToElement = () => {
            if (disposed) return;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                app.renderer.resize(rect.width, rect.height);
                for (const e of ENTITIES) {
                    if ((e as any).markDirty) (e as any).markDirty();
                }
                // Force immediate predictor rebuild pass (zero dt update) for visual responsiveness
                for (const e of ENTITIES) {
                    if ((e as any).markDirty && (e as any).recomputePath) (e as any).update(0);
                }
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
            for (const e of ENTITIES) {
                if ((e as any).markDirty) (e as any).markDirty();
            }
            // Force predictors to rebuild instantly so zoom feedback is immediate
            for (const e of ENTITIES) {
                if ((e as any).markDirty && (e as any).recomputePath) (e as any).update(0);
            }
            // Entities will detect scale change and redraw in their update; immediately reposition
            // Force redraw in two phases for consistency after zoom
            for (const e of ENTITIES) {
                if (!(e instanceof (Orbit as any))) e.update(0);
            }
            for (const e of ENTITIES) {
                if (e instanceof (Orbit as any)) e.update(0);
            }
            // Reposition immediately so zoom feels responsive
            if (EARTH_MOON_BARYCENTER) {
                const tx = EARTH_MOON_BARYCENTER.position.x * POSITION_SCALE;
                const ty = EARTH_MOON_BARYCENTER.position.y * POSITION_SCALE;
                scene.position.set(centerX - tx, centerY - ty);
            }
        };

        el.addEventListener('wheel', onWheel, {passive: false});

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'c' || e.key === 'C') {
                cameraMode = cameraMode === 'barycenter' ? 'sun' : 'barycenter';
            }

            if (e.key === 'v' || e.key === 'V') {
                console.log("Creating new Interceptor")
                interceptor = new InterceptPath("interceptor_test", EARTH, METEOR_UNO)
                registerEntity(interceptor)
            }
            if (e.key === 'b' || e.key === 'B') {
                if (interceptor) {
                    console.log("Finding trajectory")
                    interceptor?.findTrajectory([SecondsPerDay * 10, SecondsPerMonth, SecondsPerMonth * 2, SecondsPerMonth * 3, SecondsPerMonth * 4, SecondsPerMonth * 5, SecondsPerMonth * 6, SecondsPerMonth * 7, SecondsPerMonth * 8, SecondsPerMonth * 9], 100000)
                }
            }
            if (e.key === 'n' || e.key === 'N') {
                if (interceptor) {
                    console.log("Calculating interceptor path")
                    interceptor?.calculatePath()
                }
            }
            if (e.key === 'm' || e.key === 'M') {
                if (interceptor) {
                    console.log("Drawing interceptor path")
                    interceptor?.drawTrace()
                }
            }




            /*
            TODO mach genau hier weiter:

            npm i hyp2f1

            declare module "hyp2f1" {
  // 2F1(a,b;c;z) -> number (real)
  export default function hyp2f1(
    a: number,
    b: number,
    c: number,
    z: number
  ): number;
}

        Cephes raauslöschen weil wtf


        Dann möglicherweise wrapper für mehr clean?

        import hyp2f1 from "hyp2f1";

export function gauss2F1(
  a: number,
  b: number,
  c: number,
  z: number
): number {
  return hyp2f1(a, b, c, z);
}


            functions auf keys setzen
            testen wann es lösungen gibt,
            wie viele es gibt,
            ob der draw klappt
            ob die lösungen tatsächlich treffen
             */

        };
        window.addEventListener('keydown', onKey);

        const ro = new ResizeObserver(resizeToElement);
        ro.observe(el);
        (app as any)._ro = ro;

        init().catch(err => console.error('[SolarSystemPanel] init error', err));

        const markAllDirty = (forceImmediate = false) => {
            for (const e of ENTITIES) {
                if ((e as any).markDirty) (e as any).markDirty();
            }
            if (forceImmediate) {
                // Run a zero-dt update pass so geometry appears instantly after tab switch
                for (const e of ENTITIES) {
                    (e as any).update && (e as any).update(0);
                }
            }
        };
        const onFocus = () => {
            markAllDirty(true);
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') markAllDirty(true);
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            disposed = true;
            if (perfDiv.parentElement) perfDiv.parentElement.removeChild(perfDiv);
            el.removeEventListener('wheel', onWheel as any);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('visibilitychange', onVisibility);
            const ro: ResizeObserver | undefined = (app as any)._ro;
            if (ro) ro.disconnect();
            for (const e of ENTITIES) e.destroy();
            clearEntities();
            if ((app as any).renderer) app.destroy(true, {children: true, texture: true});
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <LaunchButton />
    </div>
  );
};

export default SolarSystemPanel;
