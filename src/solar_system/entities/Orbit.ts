import { Application, Graphics } from 'pixi.js';
import { UpdatableEntity } from './Entity';
import { Planet } from './Planet';
import { POSITION_SCALE } from '../config/scales';
import { Vector } from '../utils/Vector';
import { sampleOrbitInto } from '../utils/orbitalMath';

export class Orbit implements UpdatableEntity {
    id: string;
    position: Vector = new Vector(0, 0, 0);
    semiMajorAxis: number;
    eccentricity: number;
    periodDays: number;
    color: number;
    alpha: number;
    lineWidth: number;
    inclinationDeg: number;
    longitudeAscendingNodeDeg: number;
    argumentOfPeriapsisDeg: number;
    private gfx: Graphics | null = null;
    private points: Float32Array | null = null;
    private segments = 1024;
    private dirty = true;
    private lastScale = POSITION_SCALE;
    private lastParentX = NaN;
    private lastParentY = NaN;
    parent?: Planet;

    constructor(
        id: string,
        semiMajorAxis: number,
        eccentricity: number,
        periodDays: number,
        color = 0x333333,
        alpha = 0.7,
        lineWidth = 1,
        inclinationDeg = 0,
        longitudeAscendingNodeDeg = 0,
        argumentOfPeriapsisDeg = 0,
        parent?: Planet
    ) {
        this.id = id;
        this.semiMajorAxis = semiMajorAxis;
        this.eccentricity = eccentricity;
        this.periodDays = periodDays;
        this.color = color;
        this.alpha = alpha;
        this.lineWidth = lineWidth;
        this.inclinationDeg = inclinationDeg;
        this.longitudeAscendingNodeDeg = longitudeAscendingNodeDeg;
        this.argumentOfPeriapsisDeg = argumentOfPeriapsisDeg;
        this.parent = parent;
    }

    start(app: Application) {
        if (this.gfx) return;
        this.gfx = new Graphics();
        app.stage.addChild(this.gfx);
        this.points = new Float32Array((this.segments + 1) * 2);
        this.resample();
        this.redraw();
    }

    markDirty() { this.dirty = true; }

    private resample() {
        if (!this.points) return;
        sampleOrbitInto(
            this.semiMajorAxis,
            this.eccentricity,
            this.inclinationDeg,
            this.longitudeAscendingNodeDeg,
            this.argumentOfPeriapsisDeg,
            this.segments,
            this.points
        );
    }

    private redraw() {
        if (!this.gfx || !this.points) return;
        const g = this.gfx;
        g.clear();
        // Draw in pixel space directly (no Graphics scale). This avoids extremely tiny local stroke
        // widths for very small orbits (Moon, wobble) that were being quantized away at high zoom.
        const len = (this.segments + 1) * 2;
        for (let o = 0; o < len; o += 2) {
            const xPx = this.points[o] * POSITION_SCALE;
            const yPx = this.points[o + 1] * POSITION_SCALE;
            if (o === 0) g.moveTo(xPx, yPx); else g.lineTo(xPx, yPx);
        }
        g.stroke({ width: this.lineWidth, color: this.color, alpha: this.alpha });
        this.dirty = false;
    }

    private applyTransform(force = false) {
        if (!this.gfx) return;
        const scaleChanged = POSITION_SCALE !== this.lastScale;
        if (scaleChanged) {
            this.lastScale = POSITION_SCALE;
            // Rebuild pixel geometry on scale change
            this.redraw();
        }
        const px = this.parent ? this.parent.position.x : 0;
        const py = this.parent ? this.parent.position.y : 0;
        if (force || px !== this.lastParentX || py !== this.lastParentY || scaleChanged) {
            this.gfx.position.set(px * POSITION_SCALE, py * POSITION_SCALE);
            // No scaling of the Graphics itself; geometry already in pixel space.
            this.lastParentX = px;
            this.lastParentY = py;
        }
    }

    update(): void {
        if (!this.gfx) return;
        if (this.dirty) {
            this.resample();
            this.redraw();
        }
        this.applyTransform();
    }

    destroy(): void {
        this.gfx?.destroy();
        this.gfx = null;
    }
    get graphics(): Graphics | null { return this.gfx; }
}
