import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

// Minimal isolated Pixi panel
export const SolarSystemPanel = () => {
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

        const sun = new Graphics().circle(0, 0, 60).fill(0xffd54f);
        sun.position.set(app.renderer.width / 2, app.renderer.height / 2);
        app.stage.addChild(sun);

        // Resize observer to keep canvas filling the half panel
        const ro = new ResizeObserver(entries => {
          if (disposed) return;
            for (const entry of entries) {
              const { width, height } = entry.contentRect;
              if (width > 0 && height > 0) {
                app.renderer.resize(width, height);
                sun.position.set(width / 2, height / 2);
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

export default SolarSystemPanel;
