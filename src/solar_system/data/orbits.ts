import {Orbit} from '../entities/Orbit';

// Sun
export const SUN_ORBIT = new Orbit(
    'sun-orbit',
    0.005,        // ≈ mittlere Entfernung vom Baryzentrum in AU
    0.0,          // Näherung: fast kreisförmig
    4332.59,      // ≈ Jupiters Umlaufzeit (Sonne-Jupiter-Baryzentrum-Schleife)
    0xffd54f, 1.0, 1.0,
    1.304,        // gleiche Inklination wie Jupiter
    100.474,      // gleicher aufsteigender Knoten wie Jupiter
    274.255       // gleiche Argument-Periapsis wie Jupiter
);

// Mercury
export const MERCURY_ORBIT = new Orbit(
    'mercury-orbit',
    0.38709927,
    0.20563593,
    87.969250,           // P = sqrt(a^3)*365.256
    0x555555, 0.55, 1,
    7.00497902,          // i
    48.33076593,         // Ω
    29.12703035          // ω = 77.45779628 - 48.33076593
);

// Venus
export const VENUS_ORBIT = new Orbit(
    'venus-orbit',
    0.72333566,
    0.00677672,
    224.702122,
    0x555555, 0.5, 1,
    3.39467605,
    76.67984255,
    54.92262463          // 131.60246718 - 76.67984255
);

// Earth-Moon system barycenter (heliocentric)
export const EARTH_MOON_SYSTEM_ORBIT = new Orbit(
    'earth-moon-system-orbit',
    1.00000261,
    0.01671123,
    365.257430,
    0x555555, 0.55, 1,
    0.0,                 // Tabelle gibt -0.00001531°, du kannst hier 0° lassen
    0.0,
    102.93768193         // varpi, weil Ω=0
);

// Mars
export const MARS_ORBIT = new Orbit(
    'mars-orbit',
    1.52371034,
    0.09339410,
    686.990894,
    0x553333, 0.55, 1,
    1.84969142,
    49.55953891,
    286.49683150         // -23.94362959 - 49.55953891 = -73.503... → +360
);

// Jupiter
export const JUPITER_ORBIT = new Orbit(
    'jupiter-orbit',
    5.20288700,
    0.04838624,
    4334.748942,
    0x665533, 0.5, 1,
    1.30439695,
    100.47390909,
    274.25457074         // 14.72847983 - 100.47390909 → +360
);

// Saturn
export const SATURN_ORBIT = new Orbit(
    'saturn-orbit',
    9.53667594,
    0.05386179,
    10757.042806,
    0x665533, 0.45, 1,
    2.48599187,
    113.66242448,
    338.93645383         // 92.59887831 - 113.66242448 → +360
);

// Uranus
export const URANUS_ORBIT = new Orbit(
    'uranus-orbit',
    19.18916464,
    0.04725744,
    30703.045933,
    0x335566, 0.45, 1,
    0.77263783,
    74.01692503,
    96.93735127          // 170.95427630 - 74.01692503
);

// Neptune
export const NEPTUNE_ORBIT = new Orbit(
    'neptune-orbit',
    30.06992276,
    0.00859048,
    60227.637467,
    0x334466, 0.45, 1,
    1.77004347,
    131.78422574,
    273.18053653         // 44.96476227 - 131.78422574 → +360
);

// Moon orbit (nicht in der Tabelle; deine Werte sind okay als mittlere Bahn)
export const MOON_ORBIT = new Orbit(
    'moon-orbit',
    384400 / 149597870.7,
    0.0549,
    27.321661,
    0x666666, 0.5, 1,
    5.145,
    125.08,
    318.15
);

// Earth wobble around EMB (Visualisierungstrick; weiterhin okay)
export const EARTH_WOBBLE_ORBIT = new Orbit(
    'earth-wobble-orbit',
    4670 / 149597870.7,
    0.0,
    27.321661,
    0x777777, 0.4, 1,
    5.145,
    125.08,
    (318.15 + 180) % 360
);


/*
// Orbit constants (semiMajorAxis now in AU)
export const MERCURY_ORBIT = new Orbit('mercury-orbit', 0.387098, 0.205630, 87.9691, 0x555555, 0.55, 1, 7.005, 48.331, 29.124);
export const VENUS_ORBIT   = new Orbit('venus-orbit', 0.723332, 0.006772, 224.700, 0x555555, 0.5, 1, 3.3947, 76.680, 54.884);
// Earth-Moon system barycenter orbit (real heliocentric Earth orbital elements)
export const EARTH_MOON_SYSTEM_ORBIT = new Orbit('earth-moon-system-orbit', 1.0, 0.0167086, 365.256, 0x555555, 0.55, 1, 0, 0, 102.9372);
// Earth wobble (barycentric) orbit: approximate semi-major axis of Earth about system barycenter (~4670 km)
// 4670 km in AU ≈ 4670 / 149597870.7 ≈ 3.123e-5 AU. Use circular small orbit for visualization.
export const EARTH_WOBBLE_ORBIT = new Orbit(
  'earth-wobble-orbit',
  4670 / 149597870.7,
  0.0,
  27.321661,
  0x777777,
  0.4,
  1,
  5.145, // match moon inclination for shared plane
  125.08, // same ascending node
  (318.15 + 180) % 360 // approximately opposite side of barycenter from Moon
);
export const MARS_ORBIT    = new Orbit('mars-orbit', 1.523679, 0.0934, 686.980, 0x553333, 0.55, 1, 1.850, 49.558, 286.502);
export const JUPITER_ORBIT = new Orbit('jupiter-orbit', 5.20260, 0.0489, 4332.59, 0x665533, 0.5, 1, 1.303, 100.464, 273.867);
export const SATURN_ORBIT  = new Orbit('saturn-orbit', 9.5549, 0.0565, 10759.22, 0x665533, 0.45, 1, 2.485, 113.665, 339.392);
export const URANUS_ORBIT  = new Orbit('uranus-orbit', 19.2184, 0.046381, 30685.4, 0x335566, 0.45, 1, 0.773, 74.006, 96.998857);
export const NEPTUNE_ORBIT = new Orbit('neptune-orbit', 30.1104, 0.008678, 60190.0, 0x334466, 0.45, 1, 1.770, 131.784, 273.187);
// Moon orbit (parent assigned after EARTH is defined to avoid circular dependency)
export const MOON_ORBIT = new Orbit('moon-orbit', 384400 / 149597870.7, 0.0549, 27.321661, 0xff6666, 0.85, 1, 5.145, 125.08, 318.15);


 */

// Aggregate array for iteration elsewhere
export const ORBITS = [
    SUN_ORBIT,
    MERCURY_ORBIT,
    VENUS_ORBIT,
    EARTH_MOON_SYSTEM_ORBIT,
    EARTH_WOBBLE_ORBIT,
    MARS_ORBIT,
    JUPITER_ORBIT,
    SATURN_ORBIT,
    URANUS_ORBIT,
    NEPTUNE_ORBIT,
    MOON_ORBIT
];
