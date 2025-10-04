import { Application, Graphics } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Orbit } from './Orbit';
import { RADIUS_SCALE, MIN_PIXEL_RADIUS, POSITION_SCALE, AU_IN_KM } from '../config/scales';
import { SIM_TIME_SECONDS } from '../state/simulation';
import { meanAnomaly, solveEccentricAnomaly, orbitalPlanePosition, rotateOrbitalToXYZ } from '../utils/orbitalMath';

export class Planet implements UpdatableEntity {
  id: string;
  x = 0;
  y = 0;
  z = 0;
  radiusKm: number; // radius in kilometers
  massEarths: number; // mass in Earth masses
  color: number;
  orbit?: Orbit;
  phase: number;
  private gfx: Graphics | null = null;
  // Removed internal time accumulator; now uses global SIM_TIME_SECONDS

  constructor(id: string, radiusKm: number, massEarths: number, color: number, orbit?: Orbit, phase: number = 0) {
    this.id = id;
    this.radiusKm = radiusKm;
    this.massEarths = massEarths;
    this.color = color;
    this.orbit = orbit;
    this.phase = phase;
  }

  start(app: Application) {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  update(dt: number) {
    if (this.orbit) {
      const { semiMajorAxis, eccentricity, periodDays, inclinationDeg, longitudeAscendingNodeDeg, argumentOfPeriapsisDeg } = this.orbit as any;
      const periodSec = periodDays * 86400;
      const M = meanAnomaly(SIM_TIME_SECONDS, this.phase, periodSec);
      const E = solveEccentricAnomaly(M, eccentricity);
      const [xPrime, yPrime] = orbitalPlanePosition(semiMajorAxis, eccentricity, E);
      const [x, y, z] = rotateOrbitalToXYZ(xPrime, yPrime, inclinationDeg, longitudeAscendingNodeDeg, argumentOfPeriapsisDeg);
      this.x = x;
      this.y = y;
      this.z = z;
    } else {
      this.x = 0;
      this.y = 0;
      this.z = 0;
    }

    // Redraw radius each update
    if (this.gfx) {
  // Convert physical radius (km) to AU, scale to pixels, apply exaggeration factor
  const pixelPhysical = (this.radiusKm / AU_IN_KM) * POSITION_SCALE;
  const pr = Math.max(pixelPhysical * RADIUS_SCALE, MIN_PIXEL_RADIUS);
      this.gfx.clear();
      this.gfx.circle(0, 0, pr).fill(this.color);
      // Set position here based on scaled orbital coordinates; parent container will be centered
      this.gfx.position.set(this.x * POSITION_SCALE, this.y * POSITION_SCALE);
    }
  }

  get graphics(): Graphics | null { return this.gfx; }

  destroy() {
    this.gfx?.destroy();
    this.gfx = null;
  }
}
