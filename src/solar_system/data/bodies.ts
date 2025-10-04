import { Planet } from '../entities/Planet';
import { MOON_ORBIT, MERCURY_ORBIT, VENUS_ORBIT, EARTH_WOBBLE_ORBIT, EARTH_MOON_SYSTEM_ORBIT, MARS_ORBIT, JUPITER_ORBIT, SATURN_ORBIT, URANUS_ORBIT, NEPTUNE_ORBIT } from './orbits';
import { Moon } from '../entities/Moon';

// Star / Planets / Moon constants
export const SUN = new Planet('sun', 696340, 332946, 0xffd54f);
export const MERCURY = new Planet('mercury', 2439.7, 0.0553, 0xc0c0c0, MERCURY_ORBIT, 0);
export const VENUS = new Planet('venus', 6051.8, 0.815, 0xffc58f, VENUS_ORBIT, 0.1);
// Barycenter (fictional) uses the system orbit (Earth's original orbital elements)
export const EARTH_MOON_BARYCENTER = new Planet('earth-moon-bary', 10, 0, 0xaaaaaa, EARTH_MOON_SYSTEM_ORBIT, 0.0);
// Earth now orbits barycenter with a tiny wobble orbit
export const EARTH = new Planet('earth', 6371, 1.0, 0x4fa3ff, EARTH_WOBBLE_ORBIT, 0.2, EARTH_MOON_BARYCENTER);
export const MARS = new Planet('mars', 3389.5, 0.107, 0xff6f4f, MARS_ORBIT, 0.3);
export const JUPITER = new Planet('jupiter', 69911, 317.8, 0xffe29b, JUPITER_ORBIT, 1.0);
export const SATURN = new Planet('saturn', 58232, 95.16, 0xffd58f, SATURN_ORBIT, 2.0);
export const URANUS = new Planet('uranus', 25362, 14.54, 0x99e6ff, URANUS_ORBIT, 3.0);
export const NEPTUNE = new Planet('neptune', 24622, 17.15, 0x4f7dff, NEPTUNE_ORBIT, 4.0);

// Moon body uses existing MOON_ORBIT (parent Earth already set there)
export const MOON = new Moon('moon', EARTH_MOON_BARYCENTER, MOON_ORBIT, 1737.4, 0.0123, 0xb0b0b0, 0.7);

// Link orbit parent now that EARTH exists
MOON_ORBIT.parent = EARTH_MOON_BARYCENTER as any;
EARTH_WOBBLE_ORBIT.parent = EARTH_MOON_BARYCENTER as any; // barycentric wobble

// Synchronize orbit stroke colors with their primary body colors
MERCURY_ORBIT.color = MERCURY.color;
VENUS_ORBIT.color = VENUS.color;
EARTH_MOON_SYSTEM_ORBIT.color = EARTH_MOON_BARYCENTER.color;
EARTH_WOBBLE_ORBIT.color = EARTH.color;
MARS_ORBIT.color = MARS.color;
JUPITER_ORBIT.color = JUPITER.color;
SATURN_ORBIT.color = SATURN.color;
URANUS_ORBIT.color = URANUS.color;
NEPTUNE_ORBIT.color = NEPTUNE.color;
MOON_ORBIT.color = MOON.color;

export const BODIES = [
    SUN,
    MERCURY,
    VENUS,
    EARTH_MOON_BARYCENTER,
    EARTH,
    MARS,
    JUPITER,
    SATURN,
    URANUS,
    NEPTUNE,
    MOON
];

export const PLANETS = [SUN, MERCURY, VENUS, EARTH_MOON_BARYCENTER, EARTH, MARS, JUPITER, SATURN, URANUS, NEPTUNE];