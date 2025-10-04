// Beispiel: „Erde“ mit (fiktiven) Raten – nimm hier die Zahlen aus der JPL-Tabelle.
import {heliocentricStateAtDate} from "./gpt_example";
import type {OrbitalElementsLinear} from "./gpt_example";

const earth:OrbitalElementsLinear  = {
    a: 1.00000011, a_dot: -0.00000005,
    e: 0.01671022, e_dot: -0.00003804,
    i: 0.00005,    i_dot: -46.94/3600,          // arcsec/century -> deg/century
    L: 100.46457166, L_dot: 35999.37244981,     // deg/century
    varpi: 102.93768193, varpi_dot: 0.32327364, // deg/century
    Omega: -11.26064, Omega_dot: -0.24123856
};

const state = heliocentricStateAtDate(earth, new Date(Date.UTC(2025, 9, 4)));
console.log(state.x, state.y, state.z, state.r, state.lon, state.lat);
