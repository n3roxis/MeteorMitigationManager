import {Vector} from "../utils/Vector.ts";
import {DEBUG_AU, RADIUS_OF_EARTH_KM} from "../utils/constants.ts";
import {DataBroker, Impact} from "../../Logic/Utils/TranslationInterface.ts";
import {Meteor} from "./Meteor.ts";


export class MeteorImpactMonitor {

  readonly meteor: Meteor
  readonly impact: Vector
  readonly velocity: Vector
  readonly velocityNormalized: Vector
  readonly horizontalProjection: Vector
  readonly verticalProjection: Vector = new Vector(0, 0, 1);

  horizontalOffset: number = 0; // km
  verticalOffset: number = 0; // TODO random number between +- sqrt0.5 * radius of earth

  constructor(meteor: Meteor, impact: Vector, velocity: Vector) {
    this.meteor = meteor;
    this.impact = impact;
    this.velocity = new Vector(velocity.x, velocity.y, 0);
    this.velocityNormalized = this.velocity.normalized();
    this.horizontalProjection = new Vector(this.velocityNormalized.y, -this.velocityNormalized.x, 0);
  }

  // Compare new value to previous value and send update to impact


  notifyNewImpact(newImpact: Vector) {
    const delta = newImpact.subtract(this.impact);
    const shiftHorizontal = (delta.dot(this.horizontalProjection)) * DEBUG_AU + this.horizontalOffset// Now in km
    const shiftVertical = (delta.dot(this.verticalProjection)) * DEBUG_AU + this.verticalOffset// Now in km

    if (Math.hypot(shiftHorizontal, shiftVertical) > RADIUS_OF_EARTH_KM) {
      DataBroker.instance.setImpact(null)
    } else {
      // HIT
      const impact: Impact = {
        angle: this.shiftsToAngle(shiftHorizontal, shiftVertical),
        density: 0, // TODO this.meteor.density,
        mass: this.meteor.mass,
        longLat:
          this.shiftsToLongLat(shiftHorizontal, shiftVertical),
        velocity: this.velocity.length()
      }
      console.log("Impact: " + "   " + impact.longLat.longitude + "   " + impact.longLat.latitude + "   " + impact.angle + "   " + impact.mass + "   " + impact.velocity + "   " + impact.density)
      DataBroker.instance.setImpact(impact)
    }
  }

  shiftsToAngle(horizontalShift: number, verticalShift: number) {
    const shift = Math.hypot(horizontalShift, verticalShift)
    return -Math.atan(shift / Math.sqrt(1 + RADIUS_OF_EARTH_KM * RADIUS_OF_EARTH_KM - shift * shift))
  }

  shiftsToLongLat(horizontalShift: number, verticalShift: number): { longitude: number, latitude: number } {
    const R = RADIUS_OF_EARTH_KM;
    const x = horizontalShift; // km
    const y = verticalShift;   // km

    // Sicherheitscheck: außerhalb des Sichtkreises wäre vorher schon gefiltert,
    // aber clamp zur Sicherheit.
    const r2 = x*x + y*y;
    const z = Math.sqrt(Math.max(0, R*R - r2)); // km

    // Kamera-Basis aus Blickrichtung w (forward)
    const w = this.velocityNormalized.normalized();  // forward zur Erdmitte
    const tmpUp = Math.abs(w.z) > 0.9 ? new Vector(1, 0, 0) : new Vector(0, 0, 1);
    const u = tmpUp.cross(w).normalized();  // right
    const v = w.cross(u).normalized();      // up

    // Richtungsvektor vom Erdmittelpunkt zum Oberflächenpunkt (geozentrisch)
    const rHat = u.scale(x / R)
      .add(v.scale(y / R))
      .add(w.scale(z / R))
      .normalized();

    // Geozentrische Koordinaten (ohne Erdrotation in ECEF)
    const longitude = Math.atan2(rHat.y, rHat.x);
    const latitude  = Math.asin(rHat.z);

    return { longitude, latitude };
  }

  /**
   * Hilfsfunktion: rotiert einen Vektor v um Achse k (Einheitsvektor) um Winkel ang (rad)
   */
  private rotateAround(v: Vector, k: Vector, ang: number): Vector {
    const c = Math.cos(ang);
    const s = Math.sin(ang);

    const kv = k.dot(v);
    const kxv = k.cross(v);

    // Rodrigues-Rotationsformel:
    return v.scale(c)
      .add(kxv.scale(s))
      .add(k.scale(kv * (1 - c)));
  }

}

