import React, { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

const WIDTH = 800;
const HEIGHT = 600;
const BG_COLOR = 0x111111; // dark background

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  // No animation needed; just static scene

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Pixi Application
    const app = new Application({
      width: WIDTH,
      height: HEIGHT,
      background: BG_COLOR,
      antialias: true
    });
    appRef.current = app;

    // Append view (canvas)
    containerRef.current.appendChild(app.view as HTMLCanvasElement);

    // Create Sun
    const sun = new Graphics();
    sun.beginFill(0xffd54f); // yellow
    const sunRadius = 60;
    sun.drawCircle(0, 0, sunRadius);
    sun.endFill();
    sun.x = WIDTH / 2;
    sun.y = HEIGHT / 2;
    app.stage.addChild(sun);

    // Cleanup on unmount
    return () => {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', gap: '1rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#eee', fontWeight: 500 }}>Meteor Mitigation Manager - PixiJS Starter</h1>
      <div ref={containerRef} style={{ width: WIDTH, height: HEIGHT, border: '1px solid #333' }} />
    </div>
  );
};

export default App;
