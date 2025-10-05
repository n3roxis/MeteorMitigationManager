// If your setup prefers require(), uncomment the next two lines and remove the import.
// // eslint-disable-next-line @typescript-eslint/no-var-requires
// const cephes: { hyp2f1: (a: number, b: number, c: number, z: number) => number } = require("cephes");
import {Vector} from "./Vector.ts";

const pi = Math.PI;


export interface LambertOptions {
    M?: number;               // revolutions (>= 0)
    prograde?: boolean;       // true = prograde, false = retrograde
    low_path?: boolean;       // when two multi-rev solutions exist, choose low or high
    maxiter?: number;         // iteration cap
    atol?: number;            // absolute tolerance
    rtol?: number;            // relative tolerance
}

export type LambertResult = [v1: Vector, v2: Vector];

/* -------------------------------------------------------------------------- */

/**
 * Solve Lambert's problem using Dario Izzo's algorithm (2015).
 * Ported from your JS version; numerics and flow are the same.
 *
 * Returns initial and final velocity vectors (in the same frame as r1, r2).
 *
 * @param mu  Gravitational parameter (GM) of the central body [m^3/s^2]
 * @param r1  Initial position vector [m]
 * @param r2  Final position vector [m]
 * @param tof Time of flight [s]
 * @param opts Optional settings (revolutions, pro/retrograde, tolerances, etc.)
 */
export function lambertIzzo(
    mu: number,
    r1: Vector,
    r2: Vector,
    tof: number,
    opts: LambertOptions = {}
): LambertResult {
    const {
        M = 0,
        prograde = true,
        low_path = true,
        maxiter = 35,
        atol = 1e-5,
        rtol = 1e-7,
    } = opts;

    validateGravitationalParam(mu);
    validatePositions(r1, r2);

    // Chord
    const c = r2.subtract(r1);
    const c_norm = c.length();
    const r1_norm = r1.length();
    const r2_norm = r2.length();

    // Semiperimeter
    const s = 0.5 * (r1_norm + r2_norm + c_norm);

    // Versors
    const i_r1 = r1.normalized();
    const i_r2 = r2.normalized();
    let i_h = i_r1.cross(i_r2);
    i_h = i_h.normalized();

    // Geometry of the problem
    let ll = Math.sqrt(1 - Math.min(1.0, c_norm / s));

    // Fundamental tangential directions
    let i_t1: Vector;
    let i_t2: Vector;

    if (i_h.z < 0) {
        ll = -ll;
        i_t1 = i_r1.cross(i_h);
        i_t2 = i_r2.cross(i_h);
    } else {
        i_t1 = i_h.cross(i_r1);
        i_t2 = i_h.cross(i_r2);
    }

    // Correct transfer angle / tangential vectors for retrograde
    if (!prograde) {
        ll = -ll;
        i_t1 = i_t1.scale(-1);
        i_t2 = i_t2.scale(-1);
    }

    // Non-dimensional time of flight
    const T = Math.sqrt((2 * mu) / (s ** 3)) * tof;

    // Solve for x, y
    const [x, y] = _findXY(ll, T, M, maxiter, atol, rtol, low_path);

    // Reconstruct
    const gamma = Math.sqrt((mu * s) / 2);
    const rho = (r1_norm - r2_norm) / c_norm;
    const sigma = Math.sqrt(1 - rho ** 2);

    const [V_r1, V_r2, V_t1, V_t2] = _reconstruct(x, y, r1_norm, r2_norm, ll, gamma, rho, sigma);

    // Initial and final velocity vectors
    const v1 = r1.scale(V_r1 / r1_norm).add(i_t1.scale(V_t1));
    const v2 = r2.scale(V_r2 / r2_norm).add(i_t2.scale(V_t2));

    return [new Vector(v1.x, v1.y, v1.z), new Vector(v2.x, v2.y, v2.z)];
}

/* --------------------------------- checks --------------------------------- */
function validateGravitationalParam(mu: number): void {
    if (!(mu > 0)) throw new Error("Gravitational parameter must be positive");
}

function validatePositions(r1: Vector, r2: Vector): void {
    validatePosition(r1);
    validatePosition(r2);
    const same = r1.subtract(r2).length() === 0; // strict compare; change to epsilon if desired
    if (same) throw new Error("Initial and final positions can not be the same");
}

function validatePosition(r: Vector): void {
    if (r.x === 0 && r.y === 0 && r.z === 0) throw new Error("Position can not be at origin");
}

/* -------------------------------------------------------------------------- */

/* ---------------------------- core math helpers --------------------------- */
function _reconstruct(
    x: number,
    y: number,
    r1: number,
    r2: number,
    ll: number,
    gamma: number,
    rho: number,
    sigma: number
): [V_r1: number, V_r2: number, V_t1: number, V_t2: number] {
    const V_r1 = (gamma * ((ll * y - x) - rho * (ll * y + x))) / r1;
    const V_r2 = (-gamma * ((ll * y - x) + rho * (ll * y + x))) / r2;
    const V_t1 = (gamma * sigma * (y + ll * x)) / r1;
    const V_t2 = (gamma * sigma * (y + ll * x)) / r2;
    return [V_r1, V_r2, V_t1, V_t2];
}

function _findXY(
    ll: number,
    T: number,
    M: number,
    maxiter: number,
    atol: number,
    rtol: number,
    low_path: boolean
): [x: number, y: number] {
    if (Math.abs(ll) >= 1) throw new Error("Derivative is not continuous");

    let M_max = Math.floor(T / pi);
    const T_00 = Math.acos(ll) + ll * Math.sqrt(1 - ll ** 2); // T_xM (Eq. 19 without + Mπ)

    // Refine M_max if necessary
    if (T < T_00 + M_max * pi && M_max > 0) {
        const T_min = _computeTMin(ll, M_max, maxiter, atol, rtol);
        if (T < T_min) M_max -= 1;
    }

    if (M > M_max) throw new Error("No feasible solution, try lower M!");

    // Initial guess
    const x0 = _initialGuess(T, ll, M, low_path);

    // Householder iterations for x, then compute y
    const x = _householder(x0, T, ll, M, atol, rtol, maxiter);
    const y = _computeY(x, ll);
    return [x, y];
}

const _computeY = (x: number, ll: number): number => Math.sqrt(1 - ll ** 2 * (1 - x ** 2));

function _computePsi(x: number, y: number, ll: number): number {
    if (-1 <= x && x < 1) {
        // Elliptic
        return Math.acos(x * y + ll * (1 - x ** 2));
    } else if (x > 1) {
        // Hyperbolic
        return Math.asinh((y - x * ll) * Math.sqrt(x ** 2 - 1));
    } else {
        // Parabolic limit
        return 0.0;
    }
}

const _tofEquation = (x: number, T0: number, ll: number, M: number): number =>
    _tofEquationY(x, _computeY(x, ll), T0, ll, M);

function _tofEquationY(x: number, y: number, T0: number, ll: number, M: number): number {
    let T_: number;

    // Time of flight equation with externally computed y
    if (M === 0 && Math.sqrt(0.6) < x && x < Math.sqrt(1.4)) {
        const eta = y - ll * x;
        const S1 = 0.5 * (1 - ll - x * eta);
        const Q = (4 / 3) * hyp2f1(3, 1, 5 / 2, S1);
        T_ = 0.5 * (eta ** 3 * Q + 4 * ll * eta);
    } else {
        const psi = _computePsi(x, y, ll);
        T_ = ((psi + M * pi) / Math.sqrt(Math.abs(1 - x ** 2)) - x + ll * y) / (1 - x ** 2);
    }

    return T_ - T0;
}

const _tofEquationP = (x: number, y: number, T: number, ll: number): number =>
    (3 * T * x - 2 + (2 * ll ** 3 * x) / y) / (1 - x ** 2);

const _tofEquationP2 = (x: number, y: number, T: number, dT: number, ll: number): number =>
    (3 * T + 5 * x * dT + (2 * (1 - ll ** 2) * ll ** 3) / (y ** 3)) / (1 - x ** 2);

const _tofEquationP3 = (
    x: number,
    y: number,
    _T: number,
    dT: number,
    ddT: number,
    ll: number
): number =>
    (7 * x * ddT + 8 * dT - (6 * (1 - ll ** 2) * ll ** 5 * x) / (y ** 5)) / (1 - x ** 2);

function _computeTMin(
    ll: number,
    M: number,
    maxiter: number,
    atol: number,
    rtol: number
): number {
    let x_T_min: number;
    let T_min: number;

    if (ll === 1) {
        x_T_min = 0.0;
        T_min = _tofEquation(x_T_min, 0.0, ll, M);
    } else {
        if (M === 0) {
            x_T_min = Number.POSITIVE_INFINITY;
            T_min = 0.0;
        } else {
            const x_i = 0.1; // avoid issues near ll = -1
            const T_i = _tofEquation(x_i, 0.0, ll, M);
            x_T_min = _halley(x_i, T_i, ll, atol, rtol, maxiter);
            T_min = _tofEquation(x_T_min, 0.0, ll, M);
        }
    }

    return T_min;
}

function _initialGuess(T: number, ll: number, M: number, low_path: boolean): number {
    if (M === 0) {
        // Single revolution
        const T0 = Math.acos(ll) + ll * Math.sqrt(1 - ll ** 2) + M * pi; // Eq. 19
        const T1 = (2 * (1 - ll ** 3)) / 3;                               // Eq. 21

        if (T >= T0) {
            return (T0 / T) ** (2 / 3) - 1;
        } else if (T < T1) {
            return ((5 / 2) * (T1 / T) * (T1 - T)) / (1 - ll ** 5) + 1;
        } else {
            // T1 < T < T0  (approx form used in your JS)
            return (T0 / T) ** (Math.log2(T1 / T0)) - 1;
        }
    } else {
        // Multiple revolution
        const A = ((M * pi + pi) / (8 * T)) ** (2 / 3);
        const B = ((8 * T) / (M * pi)) ** (2 / 3);

        const x0l = (A - 1) / (A + 1);
        const x0r = (B - 1) / (B + 1);

        return low_path ? Math.max(x0l, x0r) : Math.min(x0l, x0r);
    }
}

/* ------------------------- root-finding iterations ------------------------- */
function _halley(
    p0: number,
    T0: number,
    ll: number,
    atol: number,
    rtol: number,
    maxiter: number
): number {
    for (let ii = 1; ii <= maxiter; ii++) {
        const y = _computeY(p0, ll);
        const fder = _tofEquationP(p0, y, T0, ll);
        const fder2 = _tofEquationP2(p0, y, T0, fder, ll);

        if (fder2 === 0) throw new Error("Derivative was zero");

        const fder3 = _tofEquationP3(p0, y, T0, fder, fder2, ll);

        // Halley step (cubic)
        const p = p0 - (2 * fder * fder2) / (2 * fder2 ** 2 - fder * fder3);

        if (Math.abs(p - p0) < rtol * Math.abs(p0) + atol) return p;
        p0 = p;
    }
    throw new Error("Failed to converge");
}

function _householder(
    p0: number,
    T0: number,
    ll: number,
    M: number,
    atol: number,
    rtol: number,
    maxiter: number
): number {
    for (let ii = 1; ii <= maxiter; ii++) {
        const y = _computeY(p0, ll);
        const fval = _tofEquationY(p0, y, T0, ll, M);
        const T = fval + T0;

        const fder = _tofEquationP(p0, y, T, ll);
        const fder2 = _tofEquationP2(p0, y, T, fder, ll);
        const fder3 = _tofEquationP3(p0, y, T, fder, fder2, ll);

        // Householder step (quartic)
        const numerator = fder ** 2 - (fval * fder2) / 2;
        const denominator = fder * (fder ** 2 - fval * fder2) + (fder3 * fval ** 2) / 6;
        const p = p0 - fval * (numerator / denominator);

        if (Math.abs(p - p0) < rtol * Math.abs(p0) + atol) return p;
        p0 = p;
    }
    throw new Error("Failed to converge");
}

/**
 * Lightweight real-valued approximation of the Gaussian hypergeometric function ₂F₁(a,b;c;z)
 * using a simple power-series expansion.
 * Valid for |z| < 1 (and converges slowly near 1).
 * For most Lambert solver use cases (small z) this is sufficient.
 */

export function hyp2f1(a: number, b: number, c: number, z: number): number {
  if (Math.abs(z) >= 1) {
    console.warn("hyp2f1(): |z| >= 1 may diverge; result may be inaccurate.");
  }

  let term = 1.0;
  let sum = 1.0;

  // series expansion: sum_{n=0}^∞ [(a)_n (b)_n / (c)_n] * z^n / n!
  for (let n = 1; n < 1000; n++) {
    term *= ((a + n - 1) * (b + n - 1)) / ((c + n - 1) * n) * z;
    sum += term;
    if (Math.abs(term) < 1e-14) break;
  }

  return sum;
}

/* -------------------------------------------------------------------------- */
