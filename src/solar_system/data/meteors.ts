import {Meteor} from "../entities/Meteor";
import { MSunxGperAU3 } from "../utils/constants";
import { lambertIzzo } from "../utils/lambert_solver";
import { Vector } from "../utils/Vector";
import { EARTH, EARTH_MOON_BARYCENTER } from "./bodies";
import { orbitalPositionAtTime } from "../utils/orbitalMath";

// Helper: generate a meteor at ~2 AU that will (ballistically) reach the Sun/Earth vicinity (~1 AU) in a target time using Lambert.
// We assume Earth at (1,0,0) AU and use that as arrival point for simplicity.
function createInboundMeteor400d(): Meteor {
  const flightDays = 365; // Adjust this to change time-of-flight
  const tof = flightDays * 86400; // seconds
  // Start 2 AU from Sun along -X axis (so moving inward toward +X Earth position) but offset slightly in Y to give some approach angle.
  const start = new Vector(-2, 0.15, 0); // AU
  // Compute precise Earth position after TOF using same orbital math as Planet update (barycenter + wobble)
  // Barycenter primary orbit
  let ex = 0, ey = 0, ez = 0;
  if ((EARTH_MOON_BARYCENTER as any).orbit) {
    const o: any = (EARTH_MOON_BARYCENTER as any).orbit;
    const [rx, ry, rz] = orbitalPositionAtTime({
      semiMajorAxis: o.semiMajorAxis,
      eccentricity: o.eccentricity,
      periodDays: o.periodDays,
      inclinationDeg: o.inclinationDeg,
      longitudeAscendingNodeDeg: o.longitudeAscendingNodeDeg,
      argumentOfPeriapsisDeg: o.argumentOfPeriapsisDeg
    }, (EARTH_MOON_BARYCENTER as any).orbitPhase || 0, tof);
    ex += rx; ey += ry; ez += rz;
  }
  // Earth wobble orbit about barycenter
  if ((EARTH as any).orbit) {
    const o: any = (EARTH as any).orbit;
    const [wx, wy, wz] = orbitalPositionAtTime({
      semiMajorAxis: o.semiMajorAxis,
      eccentricity: o.eccentricity,
      periodDays: o.periodDays,
      inclinationDeg: o.inclinationDeg,
      longitudeAscendingNodeDeg: o.longitudeAscendingNodeDeg,
      argumentOfPeriapsisDeg: o.argumentOfPeriapsisDeg
    }, (EARTH as any).orbitPhase || 0, tof);
    ex += wx; ey += wy; ez += wz;
  }
  const end = new Vector(ex, ey, ez);
  const [vStart] = lambertIzzo(MSunxGperAU3, start, end, tof);
  // Give the meteor a modest mass; color gray.
  const m = new Meteor('meteor_uno', start.x, start.y, start.z, vStart.x, vStart.y, vStart.z, 5e12, 0xc0c0c0);
  return m;
}


export const METEOR_UNO = createInboundMeteor400d();
export const METEORS = [ METEOR_UNO ];