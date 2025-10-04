import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

const App = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const app = new Application();
    let destroyed = false;
    (async () => {
      try {
        await app.init({ width: 800, height: 600, background: 0x111111, antialias: true });
        if (destroyed) return;
        ref.current?.appendChild(app.canvas);
        const sun = new Graphics().circle(0, 0, 60).fill(0xffd54f);
        sun.position.set(400, 300); // center of 800x600
        app.stage.addChild(sun);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    })();
    return () => {
      destroyed = true;
      if ((app as any).renderer) app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return <div ref={ref} />;
};

export default App;
