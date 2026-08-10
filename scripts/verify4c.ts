import { CubieCube, MoveSeq } from "../src/lib/CubeLib";
import { arrayEqual } from "../src/lib/Math";
import { generateCase, ALL_CASES, allCaseIds } from "../src/lib/FourCGenerator";
import { CachedSolver } from "../src/lib/CachedSolver";

const lseSolver = CachedSolver.get("lse");

let failures: string[] = [];

console.log("--- full generateCase() pipeline, everything enabled ---");
const N = 4000;
let comboCounts: Record<string, number> = {};
let minMovesByCase: Record<string, number[]> = {};
// How often the displayed scramble happens to equal the *naive* inversion
// of that case's bare textbook solution (no AUF padding) -- should be
// ~never, since a real scramble includes 2 random AUFs the bare inverse
// wouldn't have, and even the padded inverse should get displaced by the
// solver's alternate-path search some of the time.
let trivialInverseHits = 0;

const CASE_BY_ID = new Map(ALL_CASES.map((c) => [c.id, c]));

// U/M-only algs never touch D-layer corners, but a net U rotation baked
// into the scramble legitimately carries the U-layer corners along as a
// block -- so the only 4 valid corner states are solved-plus-{none, U, U2,
// U'}, not literal identity.
const VALID_CORNER_STATES = ["", "U", "U2", "U'"].map((m) => {
    const c = new CubieCube().apply(m);
    return { cp: c.cp, co: c.co };
});
function cornersAreValid(cube: CubieCube): boolean {
    return VALID_CORNER_STATES.some((s) => arrayEqual(s.cp, cube.cp) && arrayEqual(s.co, cube.co));
}

for (let i = 0; i < N; i++) {
    const { cube, scramble, solutions, minMoves, caseId } = generateCase(allCaseIds());
    comboCounts[caseId] = (comboCounts[caseId] || 0) + 1;
    (minMovesByCase[caseId] ||= []).push(minMoves);
    const tag = `#${i} (${caseId})`;

    // Scramble must exactly reproduce the displayed cube, byte-for-byte.
    const replay = new CubieCube().apply(new MoveSeq(scramble));
    if (!arrayEqual(replay.cp, cube.cp) || !arrayEqual(replay.co, cube.co) ||
        !arrayEqual(replay.ep, cube.ep) || !arrayEqual(replay.eo, cube.eo) ||
        !arrayEqual(replay.tp, cube.tp)) {
        failures.push(`${tag}: scramble does NOT exactly reproduce the displayed cube`);
    }

    if (!cornersAreValid(cube)) {
        failures.push(`${tag}: corners not in a valid U-rotation state (cp=${cube.cp}, co=${cube.co})`);
    }

    if (solutions.length === 0) failures.push(`${tag}: solver found zero solutions`);
    for (const sol of solutions) {
        const seq = new MoveSeq(sol.alg);
        if (seq.moves.length !== sol.moveCount) {
            failures.push(`${tag}: solution "${sol.alg}" moveCount=${sol.moveCount} but parses to ${seq.moves.length}`);
        }
        if (!lseSolver.is_solved(cube.apply(seq))) {
            failures.push(`${tag}: solution "${sol.alg}" does not solve the case`);
        }
    }

    const trueMin = Math.min(...solutions.map((s) => s.moveCount));
    if (minMoves !== trueMin) failures.push(`${tag}: minMoves=${minMoves} but true min is ${trueMin}`);

    // The scramble should not literally be the naive inversion of the bare
    // (un-padded) textbook solution -- that's the exact "trivially
    // reversible" pattern the new generator exists to avoid.
    const caseDef = CASE_BY_ID.get(caseId)!;
    const naiveInverse = new MoveSeq(caseDef.solution).inv().toString().trim();
    if (scramble.trim() === naiveInverse) trivialInverseHits++;
}

console.log("case distribution over", N, "generations:", comboCounts);
console.log("\nmin-moves range per case (sanity: should roughly track alg length + AUF padding):");
for (const [key, arr] of Object.entries(minMovesByCase).sort()) {
    console.log(`  ${key}: min=${Math.min(...arr)} max=${Math.max(...arr)} avg=${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)}`);
}
console.log(`\ntrivial (bare-solution-inverse) scrambles: ${trivialInverseHits}/${N}`);

console.log("\n--- single-case pool selection ---");
for (const id of allCaseIds()) {
    const result = generateCase([id]);
    if (result.caseId !== id) failures.push(`pool=[${id}]: got ${result.caseId} instead`);
}

console.log("\n--- case roster ---");
for (const c of ALL_CASES) {
    console.log(`  ${c.id}: "${c.label}" -> ${c.solution}`);
}
if (ALL_CASES.length !== 17) failures.push(`expected exactly 17 cases, found ${ALL_CASES.length}`);

if (failures.length === 0) {
    console.log("\nALL CHECKS PASSED");
} else {
    console.log(`\n${failures.length} FAILURES:`);
    failures.slice(0, 40).forEach((f) => console.log("  " + f));
    process.exit(1);
}
