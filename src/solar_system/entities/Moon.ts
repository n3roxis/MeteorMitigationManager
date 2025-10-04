import { Application, Graphics } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Planet } from './Planet';
import { Vector } from '../utils/Vector';
import { POSITION_SCALE, RADIUS_SCALE, MIN_PIXEL_RADIUS, AU_IN_KM } from '../config/scales';
import { meanAnomaly, solveEccentricAnomaly, orbitalPlanePosition, rotateOrbitalToXYZ } from '../utils/orbitalMath';
import { Orbit } from './Orbit';
import { SIM_TIME_SECONDS } from '../state/simulation';

// Moon now uses a normal Orbit instance (with parent) for drawing. This class only updates
// the moon body's position relative to its parent and the orbit parameters.

export class Moon implements UpdatableEntity {
    id: string;
    position: Vector = new Vector(0, 0, 0);
    radiusKm: number;
    massEarths: number; // still Earth-mass units for consistency
    color: number;
    parent: Planet;
    orbit: Orbit; // references an Orbit entity whose parent is the same parent planet
    phase: number;
    private gfx: Graphics | null = null;

    constructor(id: string, parent: Planet, orbit: Orbit, radiusKm: number, massEarths: number, color: number, phase = 0) {
        this.id = id;
        this.parent = parent;
        this.orbit = orbit;
        this.radiusKm = radiusKm;
        this.massEarths = massEarths;
        this.color = color;
        this.phase = phase;
    }

    start(app: Application): void {
        this.gfx = new Graphics();
        app.stage.addChild(this.gfx);
    }

    update(dt: number): void { // dt unused; time from global
        // Parent absolute position
        const px = this.parent.position.x;
        const py = this.parent.position.y;
        const pz = this.parent.position.z;

        const { semiMajorAxis, eccentricity, periodDays, inclinationDeg, longitudeAscendingNodeDeg, argumentOfPeriapsisDeg } = this.orbit as any;
        const periodSec = periodDays * 86400;
        const M = meanAnomaly(SIM_TIME_SECONDS, this.phase, periodSec);
        const E = solveEccentricAnomaly(M, eccentricity);
        const [xPrime, yPrime] = orbitalPlanePosition(semiMajorAxis, eccentricity, E);
        const [rx, ry, rz] = rotateOrbitalToXYZ(xPrime, yPrime, inclinationDeg, longitudeAscendingNodeDeg, argumentOfPeriapsisDeg);

        // Absolute position
        this.position.x = px + rx;
        this.position.y = py + ry;
        this.position.z = pz + rz;

        // Draw body
        if (this.gfx) {
            const pixelPhysical = (this.radiusKm / AU_IN_KM) * POSITION_SCALE;
            const pr = Math.max(pixelPhysical * RADIUS_SCALE, MIN_PIXEL_RADIUS);
            this.gfx.clear();
            this.gfx.circle(0, 0, pr).fill(this.color);
            this.gfx.position.set(this.position.x * POSITION_SCALE, this.position.y * POSITION_SCALE);
        }
    }

    destroy(): void {
        this.gfx?.destroy();
        this.gfx = null;
    }
    get graphics(): Graphics | null { return this.gfx; }
}
