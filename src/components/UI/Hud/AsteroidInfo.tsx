import React, { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { DataBroker } from "../../../Logic/Utils/TranslationInterface";
import { RadarScreen } from "../../Graphics/Impact/RadarScreen";
import { economyState } from '../../../solar_system/economy/state';
// Import asteroid image (ensure file added to src/assets as asteroid.png)
import asteroidImg from '../../../Asteroid_golevk.png';

interface AsteroidInfoProps { diameter?: number; }

export const AsteroidInfo: React.FC<AsteroidInfoProps> = ({ diameter = 200 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

  let disposed = false;
    let started = false;
  let app: Application | null = null;
  let display: RadarScreen | null = null;
  let raf: number | null = null;
  let overlayImg: HTMLImageElement | null = null;
  let rotateRaf: number | null = null;
  let rotation = 0; // degrees
  const rotationSpeedDegPerSec = 6; // slow rotation (6 deg/s => 1 rotation per minute)

    const hasActiveTelescope = () => {
      return economyState.inventory.some(i => i.blueprint === 'space-telescope' && i.state === 'ACTIVE_LOCATION');
    };

    const tryStart = async () => {
      if (started || disposed || !hasActiveTelescope()) return;
      started = true;
      app = new Application();
      try {
        await app.init({ width: diameter, height: diameter, backgroundAlpha: 0, antialias: true });
  if (disposed) return;
  const host = containerRef.current;
  if (!host) return;
  host.appendChild(app.canvas);
  // create an overlay image element and append after the canvas so it sits on top
  overlayImg = document.createElement('img');
  overlayImg.src = asteroidImg;
  overlayImg.style.position = 'absolute';
  overlayImg.style.top = '50%';
  overlayImg.style.left = '50%';
  overlayImg.style.transform = 'translate(-50%, -50%)';
  overlayImg.style.width = '80%';
  overlayImg.style.height = 'auto';
  overlayImg.style.pointerEvents = 'none';
  overlayImg.style.opacity = '0.8';
  overlayImg.style.zIndex = '999';
  host.appendChild(overlayImg);
        // start a rotation loop for the overlay image
        let lastTs = performance.now();
        const rotateLoop = (ts: number) => {
          if (!overlayImg) return;
          const dt = (ts - lastTs) / 1000;
          lastTs = ts;
          rotation = (rotation + rotationSpeedDegPerSec * dt) % 360;
          overlayImg.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
          rotateRaf = requestAnimationFrame(rotateLoop);
        };
        rotateRaf = requestAnimationFrame(rotateLoop);
        display = new RadarScreen();
        display.start(app);
        if (display.display) app.stage.addChild(display.display);
        app.ticker.add(tick => {
          if (disposed) return;
          const impact = DataBroker.instance.getImpact();
          if (impact) { /* future dynamic update */ }
          display?.update(tick.deltaTime);
        });
        const ro = new ResizeObserver(entries => {
          if (disposed || !app || !display) return;
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              app.renderer.resize(width, height);
              display.sizeTo(width, height);
            }
          }
        });
        ro.observe(host);
        (app as any)._ro = ro;
      } catch(err) {
        console.error('[AsteroidInfo] init error', err);
      }
    };

    const poll = () => {
      if (disposed) return;
      if (!started) tryStart();
      if (!started) raf = requestAnimationFrame(poll); // keep polling until telescope active
    };
    // Start polling immediately; inexpensive (single frame each while inactive)
    raf = requestAnimationFrame(poll);

    return () => {
      disposed = true;
  if (raf) cancelAnimationFrame(raf);
  if (rotateRaf) cancelAnimationFrame(rotateRaf);
  if (overlayImg && overlayImg.parentElement) overlayImg.parentElement.removeChild(overlayImg);
  overlayImg = null;
      if (app) {
        const ro: ResizeObserver | undefined = (app as any)._ro;
        if (ro) ro.disconnect();
        app.destroy(true, { children: true, texture: true });
      }
      app = null;
      display = null;
    };
  }, [diameter]);

  // While inactive (no active telescope) show dark green; when active show image background (canvas overlays but transparent areas reveal it)
  const telescopeActive = economyState.inventory.some(i => i.blueprint === 'space-telescope' && i.state === 'ACTIVE_LOCATION');
  const activeBg: React.CSSProperties = telescopeActive ? {
    backgroundImage: `url(${asteroidImg})`,
    backgroundSize: '80% 80%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    boxShadow: '0 0 8px 2px #4cc3ff55, 0 0 0 1px #1c2a33 inset, inset 0 0 40px 18px #000a'
  } : { background: '#031a0f', boxShadow: '0 0 8px 2px #4cc3ff55, 0 0 0 1px #1c2a33 inset' };
  return (
    <div
      ref={containerRef}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        ...activeBg,
        backdropFilter: 'blur(2px)',
        WebkitMaskImage: 'radial-gradient(circle at center, #000 70%, rgba(0,0,0,0.0) 100%)'
      }}
    />
  );
};