// --- Impact Parameters (change often) ---
import {Impact} from "./Utils/TranslationInterface";

const impactAngle = 45; // degrees
const impactorDensity = 3000; // kg/m^3
const impactorSpeed = 20000; // m/s
const impactorDiameter = 10000; // m
const impactorLatitude = 0; // degrees
const impactorLongitude = 0; // degrees

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

import {
    impactEnergy,
    craterDiameter,
    craterDepth,
    fireballRadius,
    durationOfFireballAtRadius,
    ratioOfFireballAboveHorizon,
    thermalExposureAtRadius,
    epicentralAngle,
    seismicIntensityDistance,
    burningDistance,
    seismicMagnitude,
    seismicIntensityatRadius,
    arrivalTimeAtRadius,
    blastWaveOverpressureAtRadius,
    blastWindSpeedAtRadius,
    haversineDistance, calculateImpactRadii
} from './formulas';

console.log('--- Impact Parameters ---');
console.log({ impactAngle, impactorDensity, impactorSpeed, impactorDiameter, impactorLatitude, impactorLongitude });
console.log('--- Environmental/Target Parameters ---');
console.log({ targetDensity, targetGravity, ambientPressure, targetLatitude, targetLongitude });
console.log(' --- Haversine Distance between impact and target (km) ---');
const distance = haversineDistance(impactorLatitude, impactorLongitude, targetLatitude, targetLongitude);
console.log('Distance (m):', distance.toExponential());

console.log('--- Formula Tests ---');
const energy = impactEnergy(impactorSpeed, impactorDensity, impactorDiameter);
console.log('impactEnergy:', energy.toExponential());

const craterDiam = craterDiameter(targetDensity, impactorDensity, impactorDiameter, impactorSpeed, impactAngle, targetGravity);
console.log('craterDiameter:', craterDiam);

const craterDep = craterDepth(craterDiam);
console.log('craterDepth:', craterDep);

const epicAngle = epicentralAngle(impactorLatitude, impactorLongitude, targetLatitude, targetLongitude);
console.log('epicentralAngle:', epicAngle);

const fireballRad = fireballRadius(energy);
console.log('fireballRadius:', fireballRad);

const fireballRatio = ratioOfFireballAboveHorizon(radiusEarth, fireballRad, epicAngle);
console.log('fireballRatio:', fireballRatio);

const thermalExp = thermalExposureAtRadius(energy, distance, luminous_efficiency, fireballRatio);
console.log('thermalExposureAtRadius:', thermalExp.toExponential());

const duration = durationOfFireballAtRadius(energy, luminous_efficiency, fireballRatio, fireballRad, radiantEnergyFlux);
console.log('durationOfFireballAtRadius:', duration);


const distance_clothing = burningDistance(energy, luminous_efficiency, "Clothing");
console.log('distance_clothing (km):', distance_clothing/1000);
//console.log('is clothes burning at this distance?:', isThisBurningAtRadius(energy, thermalExp, distance, "Clothing"));



const magnitude = seismicMagnitude(energy);
console.log('seismicMagnitude:', magnitude);
console.log('seismicIntensityatRadius:', seismicIntensityatRadius(magnitude, distance, epicAngle));

// for range 1 to 9:
for (let i = 1; i <= 9; i++) {
    const dist = seismicIntensityDistance(magnitude, i)
    console.log(`seismicIntensityDistance at MAG${i} ${i} (km):`, dist/1000);
    console.log('arrivalTime for MAG', i, 'at this distance (s):', arrivalTimeAtRadius(dist));
}

//const overpressure = blastWaveOverpressureAtRadius(75000, 290, distance)
//console.log('blastWaveOverpressureAtRadius:', overpressure);
//console.log('blastWindSpeedAtRadius:', blastWindSpeedAtRadius(overpressure, ambientPressure));
//console.log('--- End of Tests ---');

/**
 * Returns latitude and longitude at a given distance (km) and bearing (deg) from the impact point (0°, 0°)
 * @param distanceKm Distance from impact in kilometers
 * @param bearingDeg Bearing in degrees (default: 0 = north)
 */

// estimate: time to prepare + earthquake intensity -> casualities

