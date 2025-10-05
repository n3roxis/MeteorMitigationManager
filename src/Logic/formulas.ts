export function impactEnergy(velocity_impactor: number,
                             density_impactor: number,
                             diameter_impactor: number): number {
  return (Math.PI / 12) * density_impactor * Math.pow(diameter_impactor, 3) * Math.pow(velocity_impactor, 2)
}

export function craterDiameter(target_density: number,
                               impactor_density: number,
                               diameter_impactor: number,
                               velocity_impactor: number,
                               angle_impactor: number,
                               target_gravity: number): number {
    return 1.161 * Math.pow((impactor_density / target_density), 0.333) *
           Math.pow(diameter_impactor, 0.78) *
           Math.pow(velocity_impactor, 0.44) *
           Math.pow(Math.sin(angle_impactor * Math.PI / 180), 0.333) *
           Math.pow(target_gravity, -0.22);
}

export function craterDepth(crater_diameter: number): number {
    return crater_diameter / (2 * Math.sqrt(2));
}

// Energy in Joules
export function fireballRadius(energy: number): number {
    return 0.002 * Math.pow(energy, 0.3333)
}

export function ratioOfFireballAboveHorizon(radius_earth: number,  fireball_radius : number, epicentral_angle: number): number{
    let h : number = (1 - Math.cos(epicentral_angle))*radius_earth

    if (h >= fireball_radius) return 0
    let sigma : number = Math.acos(h/fireball_radius)
    return 2/Math.PI * (sigma - (h/fireball_radius)* Math.sin(sigma))
}

export function thermalExposureAtRadius(impact_energy: number,
                                        observer_distance: number,
                                        luminous_efficiency: number,
                                        ratio_of_fireball_above_horizon : number): number {
                return ratio_of_fireball_above_horizon * (luminous_efficiency * impact_energy) /
                    (2 * Math.PI * Math.pow(observer_distance, 2));
}

export function durationOfFireballAtRadius(impact_energy: number,
                                           luminous_efficiency: number,
                                           ratio_of_fireball_above_horizon : number,
                                           fireball_radius: number,
                                           radiant_energy_flux : number,
                                           ): number {
        return (luminous_efficiency * impact_energy * ratio_of_fireball_above_horizon) /
               (2 * Math.PI * Math.pow(fireball_radius, 2) * radiant_energy_flux);
}



// Calculates the epicentral angle (in radians) between two points on a sphere given their latitudes and longitudes (in degrees)

// Ignition factors for various materials (MJ/m^2 required to ignite during a 1 Mt explosion)
export const ignitionFactors: { material: string; factor: number }[] = [
  { material: 'Clothing', factor: 1.0 },
  { material: 'Plywood', factor: 0.67 },
  { material: 'Grass', factor: 0.38 },
  { material: 'Newspaper', factor: 0.33 },
  { material: 'Deciduous trees', factor: 0.25 },
  { material: 'Third degree burns', factor: 0.42 },
  { material: 'Second degree burns', factor: 0.25 },
  { material: 'First degree burns', factor: 0.13 },
];
// Source: Glasstone and Dolan (1977)

export function isThisBurningAtRadius(impact_energy: number, thermal_exposure: number, radius: number, material: string): boolean {
    // Convert energy from Joules to Megatons of TNT
    // 1 Mt TNT = 4.184e15 Joules
    const energy_Mt = impact_energy / 4.184e15;

    const factorEntry : number = ignitionFactors.find(entry => entry.material === material)?.factor;
    if (!factorEntry) {
        throw new Error(`Material "${material}" not found in ignition factors.`);
    }
    if ((factorEntry * Math.pow(energy_Mt, (1/6))) <= thermal_exposure) {
        return true;
    }
    return false;
}

function thisIsNotBurning(current_radius : number, energy : number, luminous_efficiency : number, material : string) {
    const radiusEarth : number = 6371 * 1000;
    current_radius = current_radius * 1000;
    const epicentralAngle : number = current_radius / radiusEarth; //current radius in km = mid
    const fireballRad = fireballRadius(energy);
    const fireballRatio = ratioOfFireballAboveHorizon(radiusEarth, fireballRad, epicentralAngle);
    const thermalExposure = thermalExposureAtRadius(energy, current_radius, luminous_efficiency, fireballRatio);
    const is_this_burning = isThisBurningAtRadius(energy, thermalExposure, current_radius, material)

    return !is_this_burning;
}

export function burningDistance(impact_energy: number,
                                luminous_efficiency: number,
                                material : string,
                                ): number {
    //binary search for distance where isThisBurningAtRadius returns true
    const earth_circumference = 40075; // in km accuracy
    let low = 1;
    let high = earth_circumference;
    let mid;
    while (low < high) {
        mid = Math.floor((low + high) / 2);

        if (thisIsNotBurning(mid, impact_energy, luminous_efficiency, material)) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }
    return low * 1000; // return in meters
}


export function seismicMagnitude(energy: number): number {
    return 0.76 * Math.log10(energy * Math.pow(10,-4)) - 5.87;
}

export function seismicIntensityatRadius(magnitude: number, radius: number, epicentral_angle : number): number {
    radius = radius / 1000 // calc in km
     if (radius <= 60) {
         return magnitude - 0.0238 * radius;
     }
     else if (radius <= 700) {
         return magnitude - 0.0048 * radius - 1.1644;
     }
     else {
         return magnitude - 1.66*Math.log10(epicentral_angle) - 6.399;
    }
}


function thisIsLowerMagnitude(current_radius: number, magnitude: number, intensity: number) {
    const radiusEarth : number = 6371; //km
    const epicentralAngle : number = current_radius / radiusEarth;
    const current_intensity = seismicIntensityatRadius(magnitude, current_radius*1000, epicentralAngle);
    return current_intensity < intensity;
}

export function seismicIntensityDistance(magnitude: number, intensity: number): number {
    //careful, we calculate in km here
    const earth_circumference = 40075; // in km accuracy
    let low = 1;
    let high = earth_circumference;
    let mid;
    while (low < high) {
        mid = Math.floor((low + high) / 2);

        if (thisIsLowerMagnitude(mid, magnitude, intensity)) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }
    return low * 1000; // return in meters
}

export function arrivalTimeAtRadius(radius: number): number {
    return radius / 5
}

export function blastWaveOverpressureAtRadius(crossover_pressure: number,
                                      crossover_radius: number,
                                      radius: number): number {
     return ((crossover_pressure * crossover_radius) / 4*radius)*(1 + 3*Math.pow((crossover_radius / radius), 1.3));
}

export function blastWindSpeedAtRadius(blast_overpressure: number, ambient_pressure: number): number {
    const c0 = 330; // Speed of sound in air (m/s)
    const numerator = (5 * blast_overpressure) / (7 * ambient_pressure) * c0;
    const denominator = Math.sqrt(1 + (6 * blast_overpressure) / (7 * ambient_pressure));
    return numerator / denominator;
}

export function blastWaveArrivalTimeAtRadius(radius: number): number {
    const c0 = 330;
    return radius / c0
}

// Calculates the distance in meters between two latitude/longitude points using the Haversine formula
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const R = 6371; // Earth's mean radius in km
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);
    const a = Math.sin(deltaPhi / 2) ** 2 +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
}

export function epicentralAngle(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Convert degrees to radians
    const toRad = (deg: number) => deg * Math.PI / 180;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const lambda1 = toRad(lon1);
    const lambda2 = toRad(lon2);
    return Math.acos(
        Math.sin(phi1) * Math.sin(phi2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1)
    );
}
