// src/solar_system/utils/run_lambert_tests.ts
import {performance} from "perf_hooks";
import {lambertIzzo} from "./lambert_solver.ts";
import {Vector} from "./Vector.ts";

console.log("SLKDFJLSJDF")

function nearlyEqual(a: number, b: number, absTol: number, relTol: number): boolean {
    const diff = Math.abs(a - b);
    if (diff <= absTol) return true;
    const maxab = Math.max(1, Math.abs(a), Math.abs(b));
    return diff <= relTol * maxab;
}

function assertNearlyEqualVec(actual: Vector, expected: Vector, absTol: number, relTol: number, label: string) {
    let ok = true;
    ok = ok && nearlyEqual(actual.x, expected.x, absTol, relTol);
    ok = ok && nearlyEqual(actual.y, expected.y, absTol, relTol);
    ok = ok && nearlyEqual(actual.z, expected.z, absTol, relTol);
    if (!ok) {
        throw new Error(
            `${label} failed:\n` +
            `x: got ${actual.x.toFixed(8)} vs exp ${expected.x.toFixed(8)}\n` +
            `y: got ${actual.y.toFixed(8)} vs exp ${expected.y.toFixed(8)}\n` +
            `z: got ${actual.z.toFixed(8)} vs exp ${expected.z.toFixed(8)}\n` +
            `(absTol=${absTol}, relTol=${relTol})`
        );
    }
}

const absTol = 0.01;
const relTol = 0.001;

async function runCase(
    name: string,
    fn: () => Promise<void> | void
): Promise<{ name: string; ok: boolean; ms: number; err?: unknown }> {
    const t0 = performance.now();
    try {
        await fn();
        const ms = performance.now() - t0;
        console.log(`✔ ${name}  (${ms.toFixed(3)} ms)`);
        return {name, ok: true, ms};
    } catch (err) {
        const ms = performance.now() - t0;
        console.error(`✖ ${name}  (${ms.toFixed(3)} ms)`);
        console.error(err);
        return {name, ok: false, ms, err};
    }
}

async function main() {
    const results = [];

    // Vallado 5.7
    results.push(
        await runCase("Vallado 5.7 (4th ed.)", () => {
            const mu_earth = 3.986004418e5;
            const r1 = new Vector(15945.34, 0.0, 0.0);
            const r2 = new Vector(12214.83899, 10249.46731, 0.0);
            const tof = 76 * 60;

            const t0 = performance.now();
            const [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof);
            const t1 = performance.now();
            console.log(`  Dauer: ${(t1 - t0).toFixed(3)} ms`);

            const expected_v1 = new Vector(2.058913, 2.915965, 0.0);
            const expected_v2 = new Vector(-3.451565, 0.910315, 0.0);

            assertNearlyEqualVec(v1, expected_v1, absTol, relTol, "v1");
            assertNearlyEqualVec(v2, expected_v2, absTol, relTol, "v2");
        })
    );

    // Curtis 5.2
    results.push(
        await runCase("Curtis 5.2 (3rd ed.)", () => {
            const mu_earth = 3.986004418e5;
            const r1 = new Vector(5000.0, 10000.0, 2100.0);
            const r2 = new Vector(-14600.0, 2500.0, 7000.0);
            const tof = 3600;

            const t0 = performance.now();
            const [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof);
            const t1 = performance.now();
            console.log(`  Dauer: ${(t1 - t0).toFixed(3)} ms`);

            const expected_v1 = new Vector(-5.9925, 1.9254, 3.2456);
            const expected_v2 = new Vector(-3.3125, -4.1966, -0.38529);

            assertNearlyEqualVec(v1, expected_v1, absTol, relTol, "v1");
            assertNearlyEqualVec(v2, expected_v2, absTol, relTol, "v2");
        })
    );

    // Battin 7.12
    results.push(
        await runCase("Battin 7.12", () => {
            const mu_sun = 39.47692641; // AU^3/year^2
            const r1 = new Vector(0.159321004, 0.579266185, 0.052359607);
            const r2 = new Vector(0.057594337, 0.605750797, 0.068345246);
            const tof = 0.010794065; // year

            const t0 = performance.now();
            const [v1] = lambertIzzo(mu_sun, r1, r2, tof);
            const t1 = performance.now();
            console.log(`  Dauer: ${(t1 - t0).toFixed(3)} ms`);

            const expected_v1 = new Vector(-9.303603251, 3.01864133, 1.536362143); // km/s
            assertNearlyEqualVec(v1, expected_v1, absTol, relTol, "v1");
        })
    );

    // GMAT Orbit 1
    results.push(
        await runCase("GMAT 2020a – Orbit 1", () => {
            const mu_earth = 3.986004418e5;
            const r1 = new Vector(7100, 200, 1300);
            const r2 = new Vector(-38113.5870, 67274.1946, 29309.5799);
            const tof = 12000;

            const t0 = performance.now();
            const [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof);
            const t1 = performance.now();
            console.log(`  Dauer: ${(t1 - t0).toFixed(3)} ms`);

            const expected_v1 = new Vector(0, 10.35, 5.5);
            const expected_v2 = new Vector(-3.6379, 4.4932, 1.7735);
            assertNearlyEqualVec(v1, expected_v1, absTol, relTol, "v1");
            assertNearlyEqualVec(v2, expected_v2, absTol, relTol, "v2");
        })
    );

    // GMAT Orbit 2 (retrograde)
    results.push(
        await runCase("GMAT 2020a – Orbit 2 (retrograde)", () => {
            const mu_earth = 3.986004418e5;
            const r1 = new Vector(7100, 200, 1300);
            const r2 = new Vector(-47332.7499, -54840.2027, -37100.17067);
            const tof = 12000;

            const t0 = performance.now();
            const [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof, {M: 0, prograde: false});
            const t1 = performance.now();
            console.log(`  Dauer: ${(t1 - t0).toFixed(3)} ms`);

            const expected_v1 = new Vector(0, -10.35, -5.5);
            const expected_v2 = new Vector(-4.3016, -3.4314, -2.5467);
            assertNearlyEqualVec(v1, expected_v1, absTol, relTol, "v1");
            assertNearlyEqualVec(v2, expected_v2, absTol, relTol, "v2");
        })
    );

    // Der – Example 1
    results.push(
        await runCase("Der – Astrodynamics 102 – Example 1", () => {
            const mu_earth = 3.986004418e5;
            const r1 = new Vector(2249.171260, 1898.007100, 5639.599193);
            const r2 = new Vector(1744.495443, -4601.556054, 4043.864391);
            const tof = 1618.5;

            // prograde, low
            let [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof);
            assertNearlyEqualVec(v1, new Vector(-2.09572809, 3.92602196, -4.94516810), absTol, relTol, "v1 (prog/low)");
            assertNearlyEqualVec(v2, new Vector(2.46309613, 0.84490197, 6.10890863), absTol, relTol, "v2 (prog/low)");

            // retrograde, high
            [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof, {M: 0, prograde: false, low_path: false});
            assertNearlyEqualVec(v1, new Vector(1.94312182, -4.35300015, 4.54630439), absTol, relTol, "v1 (retro/high)");
            assertNearlyEqualVec(v2, new Vector(-2.38885563, -1.42519647, -5.95772225), absTol, relTol, "v2 (retro/high)");
        })
    );

    // Der – Example 2
    results.push(
        await runCase("Der – Astrodynamics 102 – Example 2", () => {
            const mu_earth = 3.986004418e5;
            const r1 = new Vector(22592.145603, -1599.915239, -19783.950506);
            const r2 = new Vector(1922.067697, 4054.157051, -8925.727465);
            const tof = 36000;

            // prograde, high
            let [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof, {M: 0, prograde: true, low_path: false});
            assertNearlyEqualVec(v1, new Vector(2.000652697, 0.387688615, -2.666947760), absTol, relTol, "v1 (prog/high)");
            assertNearlyEqualVec(v2, new Vector(-3.79246619, -1.77707641, 6.856814395), absTol, relTol, "v2 (prog/high)");

            // retrograde, high
            [v1, v2] = lambertIzzo(mu_earth, r1, r2, tof, {M: 0, prograde: false, low_path: false});
            assertNearlyEqualVec(v1, new Vector(2.96616042, -1.27577231, -0.75545632), absTol, relTol, "v1 (retro/high)");
            assertNearlyEqualVec(v2, new Vector(5.8437455, -0.20047673, -5.48615883), absTol, relTol, "v2 (retro/high)");
        })
    );

    // Zusammenfassung
    const passed = results.filter(r => r.ok).length;
    const failed = results.length - passed;
    console.log(`\n== Summary: ${passed}/${results.length} passed, ${failed} failed ==`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
