
// JPL-like approximate heliocentric position from mean elements + rates
// References: JPL SSD "Approximate Positions of the Planets"; relation M = L - varpi.
// Angles in degrees in the input; a in AU; rates per Julian century.
// Output: heliocentric ecliptic J2000 (x,y,z) in AU.
// (c) you - use at will.

export type OrbitalElementsLinear = {
    // base values at J2000.0 (JD 2451545.0 TT)
    a: number;                 // AU
    e: number;                 // unitless
    i: number;                 // deg
    L: number;                 // mean longitude [deg]
    varpi: number;             // longitude of perihelion [deg]
    Omega: number;             // longitude of ascending node [deg]

    // rates per Julian century (T = centuries since J2000.0)
    a_dot: number;             // AU / century
    e_dot: number;             // 1 / century
    i_dot: number;             // deg / century
    L_dot: number;             // deg / century
    varpi_dot: number;         // deg / century
    Omega_dot: number;         // deg / century
};

type HeliocentricState = {
    x: number; y: number; z: number; // AU, ecliptic J2000
    r: number;                        // AU
    lon: number;                      // ecliptic longitude [deg]
    lat: number;                      // ecliptic latitude [deg]
    elementsAtDate: {
        a: number; e: number; i: number; L: number; varpi: number; Omega: number; // deg for angles
        M: number;  // mean anomaly [deg]
        omega: number; // argument of perihelion [deg] = varpi - Omega
        T: number;  // Julian centuries since J2000
        JD: number; // Julian Date used
    };
};

// --- Time utilities ---
function toJulianDate(date: Date): number {
    // Works for Gregorian dates; good enough for this use.
    const Y = date.getUTCFullYear();
    const M = date.getUTCMonth() + 1;
    const D = date.getUTCDate()
        + date.getUTCHours()/24
        + date.getUTCMinutes()/(24*60)
        + date.getUTCSeconds()/(24*3600)
        + date.getUTCMilliseconds()/(24*3600*1000);

    let y = Y, m = M;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y/100);
    const B = 2 - A + Math.floor(A/4);
    const JD = Math.floor(365.25*(y + 4716))
        + Math.floor(30.6001*(m + 1))
        + D + B - 1524.5;
    return JD;
}
function centuriesSinceJ2000(JD: number): number {
    return (JD - 2451545.0) / 36525.0; // T in Julian centuries (TT vs UTC difference is negligible for this approx)
}

// --- Angle helpers ---
const TAU = 2*Math.PI;
function deg2rad(d: number): number { return d * (Math.PI/180); }
function rad2deg(r: number): number { return r * (180/Math.PI); }
function normDeg(d: number): number { let x = d % 360; if (x < 0) x += 360; return x; }
function normRad(r: number): number { let x = r % TAU; if (x < 0) x += TAU; return x; }

// --- Kepler solver (elliptic, e<1) ---
function solveKeplerE(M: number, e: number): number {
    // M in rad, return E in rad
    const tol = 1e-12;
    let E = (e < 0.8) ? M : Math.PI; // reasonable start
    let dE = 1;
    let k = 0;
    while (Math.abs(dE) > tol && k++ < 50) {
        const f  = E - e*Math.sin(E) - M;
        const fp = 1 - e*Math.cos(E);
        dE = f/fp;
        E -= dE;
    }
    return E;
}

// --- Core computation ---
export function heliocentricStateAtDate(el0: OrbitalElementsLinear, date: Date): HeliocentricState {
    const JD = toJulianDate(date);
    const T = centuriesSinceJ2000(JD);

    // 1) Elements at epoch T (linear drift)
    const a     = el0.a     + el0.a_dot     * T;
    const e     = el0.e     + el0.e_dot     * T;
    const i_deg = el0.i     + el0.i_dot     * T;
    const L_deg = el0.L     + el0.L_dot     * T;
    const varpi_deg = el0.varpi + el0.varpi_dot * T;
    const Omega_deg = el0.Omega + el0.Omega_dot * T;

    // Normalize angles
    const iN = normDeg(i_deg);
    const LN = normDeg(L_deg);
    const varpiN = normDeg(varpi_deg);
    const OmegaN = normDeg(Omega_deg);

    // 2) Mean anomaly M = L - varpi  (JPL convention)
    const M_deg = normDeg(LN - varpiN);                     // :contentReference[oaicite:1]{index=1}
    const M = deg2rad(M_deg);

    // 3) Argument of perihelion ω = ϖ − Ω
    const omega_deg = normDeg(varpiN - OmegaN);
    const i = deg2rad(iN);
    const Omega = deg2rad(OmegaN);
    const omega = deg2rad(omega_deg);

    // 4) Solve Kepler: M -> E -> true anomaly ν
    const E = solveKeplerE(M, e);
    const cosE = Math.cos(E), sinE = Math.sin(E);
    const sqrt1me2 = Math.sqrt(1 - e*e);
    const nu = Math.atan2(sqrt1me2 * sinE, cosE - e);  // true anomaly
    const r = a * (1 - e*cosE);                        // distance [AU]

    // 5) Position in perifocal frame (PQW)
    const x_p = r * Math.cos(nu);
    const y_p = r * Math.sin(nu);
    const z_p = 0;

    // 6) Rotate PQW -> ecliptic J2000 with Ω, i, ω
    const cO = Math.cos(Omega), sO = Math.sin(Omega);
    const ci = Math.cos(i),     si = Math.sin(i);
    const co = Math.cos(omega), so = Math.sin(omega);

    // Rotation matrix R = Rz(Ω) * Rx(i) * Rz(ω)
    const x = (cO*co - sO*so*ci)*x_p + (-cO*so - sO*co*ci)*y_p;                 // + 0*z_p
    const y = (sO*co + cO*so*ci)*x_p + (-sO*so + cO*co*ci)*y_p;
    const z = (so*si)*x_p               + (co*si)*y_p;

    // Ecliptic spherical
    const lon = normDeg(rad2deg(Math.atan2(y, x)));
    const lat = rad2deg(Math.atan2(z, Math.hypot(x, y)));

    return {
        x, y, z, r, lon, lat,
        elementsAtDate: {
            a, e,
            i: iN, L: LN, varpi: varpiN, Omega: OmegaN,
            M: M_deg, omega: omega_deg,
            T, JD
        }
    };
}
