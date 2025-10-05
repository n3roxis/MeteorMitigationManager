// --- Impact Parameters (change often) ---
import { Impact } from "./Utils/TranslationInterface";
import { calculateImpactRadii } from "./formulas";

const impactAngle = 45; // degrees
const impactorDensity = 3000; // kg/m^3
const impactorSpeed = 20000; // m/s
const impactorDiameter = 10000; // m
const impactorLatitude = 2; // degrees
const impactorLongitude = 20; // degrees

// --- Environmental/Target Parameters (change less often) ---
const targetDensity = 2500; // kg/m^3
const targetGravity = 9.8; // m/s^2
const ambientPressure = 100000; // Pa (1 bar)
const targetLatitude = 5.4; // degrees
const targetLongitude = 0; // degrees
const radiusEarth = 6371000; // m
const radiantEnergyFlux = 5.67 * Math.pow(10, -8) * Math.pow(3000, 4); // W/m^2 (Stefan-Boltzmann law at 3000 K)
const luminous_efficiency = 3*Math.pow(10, -3);
// --- Sample Calculations ---

export const testing_impact = new Impact("Test Impact", (Math.PI/6)*Math.pow(impactorDiameter/2,3)*impactorDensity*4, impactorDensity, impactorSpeed, impactAngle, {lamb: impactorLongitude, phi: impactorLatitude});

const radii = calculateImpactRadii(testing_impact)
console.log("Calculated Impact Radii (m):", radii);
