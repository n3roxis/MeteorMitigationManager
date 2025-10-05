
export const SECONDS_PER_DAY = 86400

export const DEBUG_AU = 1.4959787 * 10 ** 11 // Astronomical Unit in meters
export const DEBUG_ME = 5.9722 * 10 ** 24 // Earth mass in kilograms
export const DEBUG_MS = 1.989 * 10 ** 30
export const DEBUG_G = 6.67430 * 10 ** -11 // Gravitational constants
export const RADIUS_OF_EARTH = 6371000;

export const MEarthxGperAU3 = DEBUG_ME * DEBUG_G / DEBUG_AU / DEBUG_AU / DEBUG_AU; // Gravitational constant times earth mass * astronomical unit (multiplied to reduce floating point errors)

export const MSunxGperAU3 = DEBUG_MS * DEBUG_G / DEBUG_AU / DEBUG_AU / DEBUG_AU;


export const SecondsPerDay = 86400
export const SecondsPerMonth = SecondsPerDay * 365.25 / 12