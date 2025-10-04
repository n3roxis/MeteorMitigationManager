import { Orbit } from '../entities/Orbit';

// Orbit constants (semiMajorAxis now in AU)
export const MERCURY_ORBIT = new Orbit('mercury-orbit', 0.387098, 0.205630, 87.9691, 0x555555, 0.55, 1, 7.005, 48.331, 29.124);
export const VENUS_ORBIT   = new Orbit('venus-orbit', 0.723332, 0.006772, 224.700, 0x555555, 0.5, 1, 3.3947, 76.680, 54.884);
export const EARTH_ORBIT   = new Orbit('earth-orbit', 1.0, 0.0167086, 365.256, 0x444444, 0.55, 1, 0, 0, 102.9372);
export const MARS_ORBIT    = new Orbit('mars-orbit', 1.523679, 0.0934, 686.980, 0x553333, 0.55, 1, 1.850, 49.558, 286.502);
export const JUPITER_ORBIT = new Orbit('jupiter-orbit', 5.20260, 0.0489, 4332.59, 0x665533, 0.5, 1, 1.303, 100.464, 273.867);
export const SATURN_ORBIT  = new Orbit('saturn-orbit', 9.5549, 0.0565, 10759.22, 0x665533, 0.45, 1, 2.485, 113.665, 339.392);
export const URANUS_ORBIT  = new Orbit('uranus-orbit', 19.2184, 0.046381, 30685.4, 0x335566, 0.45, 1, 0.773, 74.006, 96.998857);
export const NEPTUNE_ORBIT = new Orbit('neptune-orbit', 30.1104, 0.008678, 60190.0, 0x334466, 0.45, 1, 1.770, 131.784, 273.187);

// Aggregate array for iteration elsewhere
export const ORBITS = [
  MERCURY_ORBIT,
  VENUS_ORBIT,
  EARTH_ORBIT,
  MARS_ORBIT,
  JUPITER_ORBIT,
  SATURN_ORBIT,
  URANUS_ORBIT,
  NEPTUNE_ORBIT
];
