import { Planet } from '../entities/Planet';
import * as Orbits from './orbits';

// Planet constants
// Radii now expressed directly in kilometers (mean radii)
// Masses remain Earth masses: Sun ~332946, Mercury 0.0553, Venus 0.815, Earth 1, Mars 0.107, Jupiter 317.8, Saturn 95.16, Uranus 14.54, Neptune 17.15
export const SUN = new Planet('sun', 696340, 332946, 0xffd54f);
export const MERCURY = new Planet('mercury', 2439.7, 0.0553, 0xc0c0c0, Orbits.MERCURY_ORBIT, 0);
export const VENUS = new Planet('venus', 6051.8, 0.815, 0xffc58f, Orbits.VENUS_ORBIT, 0.1);
export const EARTH = new Planet('earth', 6371, 1.0, 0x4fa3ff, Orbits.EARTH_ORBIT, 0.2);
export const MARS = new Planet('mars', 3389.5, 0.107, 0xff6f4f, Orbits.MARS_ORBIT, 0.3);
export const JUPITER = new Planet('jupiter', 69911, 317.8, 0xffe29b, Orbits.JUPITER_ORBIT, 1.0);
export const SATURN = new Planet('saturn', 58232, 95.16, 0xffd58f, Orbits.SATURN_ORBIT, 2.0);
export const URANUS = new Planet('uranus', 25362, 14.54, 0x99e6ff, Orbits.URANUS_ORBIT, 3.0);
export const NEPTUNE = new Planet('neptune', 24622, 17.15, 0x4f7dff, Orbits.NEPTUNE_ORBIT, 4.0);

export const PLANETS = [
  SUN,
  MERCURY,
  VENUS,
  EARTH,
  MARS,
  JUPITER,
  SATURN,
  URANUS,
  NEPTUNE
];
