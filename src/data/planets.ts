import { Planet } from '../entities/Planet';
import * as Orbits from './orbits';

// Planet constants
export const SUN = new Planet('sun', 0.69634, 0xffd54f);
export const MERCURY = new Planet('mercury', 0.0024397, 0xc0c0c0, Orbits.MERCURY_ORBIT, 0);
export const VENUS = new Planet('venus', 0.0060518, 0xffc58f, Orbits.VENUS_ORBIT, 0.1);
export const EARTH = new Planet('earth', 0.006371, 0x4fa3ff, Orbits.EARTH_ORBIT, 0.2);
export const MARS = new Planet('mars', 0.0033895, 0xff6f4f, Orbits.MARS_ORBIT, 0.3);
export const JUPITER = new Planet('jupiter', 0.069911, 0xffe29b, Orbits.JUPITER_ORBIT, 1.0);
export const SATURN = new Planet('saturn', 0.058232, 0xffd58f, Orbits.SATURN_ORBIT, 2.0);
export const URANUS = new Planet('uranus', 0.025362, 0x99e6ff, Orbits.URANUS_ORBIT, 3.0);
export const NEPTUNE = new Planet('neptune', 0.024622, 0x4f7dff, Orbits.NEPTUNE_ORBIT, 4.0);

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
