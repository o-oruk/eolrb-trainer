import { CubieCube, MoveSeq } from "../src/lib/CubeLib";
import { getParity, arrayEqual } from "../src/lib/Math";
import { generateCase, buildEOLRbCube, allCombos, EO_CASES, type EOCaseId } from "../src/lib/EOLRbGenerator";
import { CachedSolver } from "../src/lib/CachedSolver";

const eolrbSolver = CachedSolver.get("eolr-b");

const UF = 0, UL = 1, UB = 2, UR = 3, DF = 4, DL = 5, DB = 6, DR = 7, FL = 8, BL = 9, BR = 10, FR = 11;
const BOTTOM = new Set([DF, DB]);
const LR_HOME = new Set([UL, UR]); // piece-ids 1 and 3
const OPPOSITE_PAIRS = [[UF, UB], [UL, UR]];
const ALL_SLOTS = [UF, UL, UB, UR, DF, DB];

// The 6 edges never assigned by construction -- they belong to the
// already-solved F2L blocks and must stay exactly solved. A prior, buggy
// single-y2 mirror implementation silently scrambled these; nothing had
// ever checked them before.
const UNTRACKED_SLOTS = [DL, DR, FL, BL, BR, FR];
function untrackedEdgesSolved(cube: CubieCube): boolean {
    return UNTRACKED_SLOTS.every((s) => cube.ep[s] === s && cube.eo[s] === 0);
}

const OPPOSITE_OF: Record<number, number> = { [UF]: UB, [UB]: UF, [UL]: UR, [UR]: UL };

const IDENTITY_CENTERS = new CubieCube().tp;
const M2_CENTERS = new CubieCube().apply("M2").tp;
function centersAreExactlyValid(cube: CubieCube): boolean {
    return arrayEqual(cube.tp, IDENTITY_CENTERS) || arrayEqual(cube.tp, M2_CENTERS);
}

function findLrSlots(cube: CubieCube): [number, number] {
    const slots = ALL_SLOTS.filter((s) => LR_HOME.has(cube.ep[s]));
    if (slots.length !== 2) throw new Error(`expected exactly 2 LR slots, found ${slots.length}: ${slots}`);
    return [slots[0], slots[1]];
}

// Independent (from-scratch, not reusing generator internals) classifiers,
// used to cross-check the generator's output rather than just echo it back.

function classifyPositional(cube: CubieCube): string {
    const [a, b] = findLrSlots(cube);
    const aBottom = BOTTOM.has(a), bBottom = BOTTOM.has(b);
    if (aBottom && bBottom) return "both-bottom";
    if (!aBottom && !bBottom) {
        const opposite = OPPOSITE_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
        return opposite ? "top-opposite" : "top-adjacent";
    }
    return "one-top-one-bottom";
}

// Reads orientation directly off the cube's actual eo array at the LR
// slots -- valid regardless of AUF, since a real U-turn rotates piece and
// orientation together (verified separately by the eoIs() check below).
// "Mixed" (one misoriented + one oriented top piece) further splits into
// opposite/adjacent subcases only for EO cases where both actually occur
// (2a/0, 2a/2) -- for 2o/0 and 2o/2, mixed is geometrically always adjacent,
// so `validIds` won't contain the opposite/adjacent variants and this falls
// back to the single "top-mixed" id, mirroring the generator's own logic.
function makeOrientationSplitClassifier(eoCase: EOCaseId): (cube: CubieCube) => string {
    const validIds = new Set(EO_CASES.find((c) => c.id === eoCase)!.subcases.map((s) => s.id));
    return (cube: CubieCube): string => {
        const [a, b] = findLrSlots(cube);
        const aBottom = BOTTOM.has(a), bBottom = BOTTOM.has(b);
        if (aBottom && bBottom) return "both-bottom";
        if (aBottom !== bBottom) {
            const topSlot = aBottom ? b : a;
            return cube.eo[topSlot] === 1 ? "bottom-top-misoriented" : "bottom-top-oriented";
        }
        const aM = cube.eo[a] === 1, bM = cube.eo[b] === 1;
        if (aM && bM) return "top-both-misoriented";
        if (!aM && !bM) return "top-both-oriented";
        const opposite = OPPOSITE_OF[a] === b;
        if (opposite) return validIds.has("top-mixed-opposite") ? "top-mixed-opposite" : "top-mixed";
        return validIds.has("top-mixed-adjacent") ? "top-mixed-adjacent" : "top-mixed";
    };
}

// Independent classifier for the "tip/side/back" shape (arrow: 3 top
// misoriented + 1 oriented; 1/1: 1 top misoriented + 3 oriented; DF/DB
// asymmetric in both). Determines each top slot's role purely from the
// realized cube's own eo values, not from any assumed canonical labeling --
// valid under any AUF, since a real U-turn carries piece and orientation
// together. Exactly one top slot always has the *minority* orientation
// value (misoriented alone for 1/1, oriented alone for arrow) -- for 1/1
// that minority slot *is* the tip; for arrow it's "back", geometrically
// opposite the tip. Working out which case we're in from the count lets one
// classifier handle both without knowing in advance which value is the odd
// one out.
const TOP = [UF, UL, UB, UR];

function classifyTipSideBack(cube: CubieCube): string {
    const misorientedTops = TOP.filter((s) => cube.eo[s] === 1);
    let tip: number;
    if (misorientedTops.length === 1) {
        tip = misorientedTops[0];
    } else if (misorientedTops.length === 3) {
        const orientedTop = TOP.find((s) => cube.eo[s] === 0)!;
        tip = OPPOSITE_OF[orientedTop];
    } else {
        throw new Error(`expected 1 or 3 misoriented top slots, got ${misorientedTops.length}`);
    }
    const back = OPPOSITE_OF[tip];
    const roleOf = (s: number): "tip" | "side" | "back" => (s === tip ? "tip" : s === back ? "back" : "side");

    const [a, b] = findLrSlots(cube);
    const aBottom = BOTTOM.has(a), bBottom = BOTTOM.has(b);
    if (aBottom && bBottom) return "both-bottom";

    if (aBottom !== bBottom) {
        const bottomSlot = aBottom ? a : b;
        const topSlot = aBottom ? b : a;
        const bottomType = cube.eo[bottomSlot] === 1 ? "misoriented" : "oriented";
        return `bottom-${bottomType}-top-${roleOf(topSlot)}`;
    }

    const roles = [roleOf(a), roleOf(b)].sort().join("-");
    if (roles === "side-tip") return "top-tip-side";
    if (roles === "side-side") return "top-sides";
    if (roles === "back-tip") return "top-tip-back";
    if (roles === "back-side") return "top-side-back";
    throw new Error(`unexpected role combo: ${roles}`);
}

const CLASSIFIERS: Record<EOCaseId, (cube: CubieCube) => string> = {
    "4/0": classifyPositional,
    "0/2": classifyPositional,
    "2o/0": makeOrientationSplitClassifier("2o/0"),
    "2a/0": makeOrientationSplitClassifier("2a/0"),
    "2a/2": makeOrientationSplitClassifier("2a/2"),
    "2o/2": makeOrientationSplitClassifier("2o/2"),
    "arrow": classifyTipSideBack,
    "1/1": classifyTipSideBack,
};

function eoPatternOf(cube: CubieCube): number[] {
    return [cube.eo[UF], cube.eo[UL], cube.eo[UB], cube.eo[UR], cube.eo[DF], cube.eo[DB]];
}
const EO_PATTERNS = new Map(EO_CASES.map((c) => [c.id, c.pattern.join(",")]));

// Tries all 4 U-rotations, and (since the generator can now produce the y2
// mirror of a chiral pattern, which no U-rotation can ever reach -- that's
// the whole point) all 4 U-rotations of the y2-mirrored cube too.
function classifyEOCase(cube: CubieCube): EOCaseId | "unknown" {
    for (const base of [cube, cube.apply("y2")]) {
        let c = base;
        for (let r = 0; r < 4; r++) {
            const eo = eoPatternOf(c).join(",");
            for (const [id, pattern] of EO_PATTERNS) {
                if (eo === pattern) return id;
            }
            c = c.apply("U");
        }
    }
    return "unknown";
}

let failures: string[] = [];

console.log("--- direct buildEOLRbCube() per (EO case x subcase) ---");
const N_PER_COMBO = 300;
for (const { id: eoCase, subcases } of EO_CASES) {
    for (const { id: subcase, detail } of subcases) {
        let centerCounts: Record<string, number> = {};
        let chiralityCounts: Record<string, number> = {};
        for (let i = 0; i < N_PER_COMBO; i++) {
            const cube = buildEOLRbCube(eoCase, subcase);
            const tag = `${eoCase}/${subcase} #${i}`;

            const parityOk = (getParity(cube.cp) + getParity(cube.ep)) % 2 === 0;
            if (!parityOk) failures.push(`${tag}: illegal permutation parity`);

            const actualSubcase = CLASSIFIERS[eoCase](cube);
            if (actualSubcase !== subcase) failures.push(`${tag}: requested subcase ${subcase} but built ${actualSubcase}`);

            const actualEo = classifyEOCase(cube);
            if (actualEo !== eoCase) failures.push(`${tag}: requested EO case ${eoCase} but built ${actualEo} (eo=${cube.eo})`);

            if (!untrackedEdgesSolved(cube)) {
                failures.push(`${tag}: F2L-block edges got disturbed (ep=${cube.ep}, eo=${cube.eo})`);
            }
            if (!centersAreExactlyValid(cube)) {
                failures.push(`${tag}: centers aren't exactly identity or M2 (tp=${cube.tp}) -- front/up color convention broken`);
            }

            if (cube.tp[0] !== 0 && cube.tp[0] !== 1) {
                failures.push(`${tag}: unexpected U-center piece tp[0]=${cube.tp[0]}`);
            }
            centerCounts[cube.tp[0]] = (centerCounts[cube.tp[0]] || 0) + 1;

            // For chiral EO cases (DF != DB in the canonical pattern), DF/DB
            // are untouched by any U-rotation, so cube.eo[DF] directly tells
            // us which mirror chirality this sample landed on.
            if (eoCase === "arrow" || eoCase === "1/1") {
                chiralityCounts[cube.eo[DF]] = (chiralityCounts[cube.eo[DF]] || 0) + 1;
            }
        }
        const chiralityNote = Object.keys(chiralityCounts).length > 0 ? `  chirality(eo[DF])=${JSON.stringify(chiralityCounts)}` : "";
        console.log(`${eoCase}/${subcase} (${detail}): centers`, centerCounts, chiralityNote);
    }
}

console.log("\n--- full generateCase() pipeline, everything enabled ---");
let comboCounts: Record<string, number> = {};
let minMovesBySubcase: Record<string, number[]> = {};
const N = 2000;
for (let i = 0; i < N; i++) {
    const { cube, scramble, solutions, minMoves, eoCase, subcase } = generateCase(allCombos());
    const key = `${eoCase}/${subcase}`;
    comboCounts[key] = (comboCounts[key] || 0) + 1;
    (minMovesBySubcase[key] ||= []).push(minMoves);
    const tag = `#${i} (${key})`;

    const parityOk = (getParity(cube.cp) + getParity(cube.ep)) % 2 === 0;
    if (!parityOk) failures.push(`${tag}: illegal permutation parity`);
    if (CLASSIFIERS[eoCase](cube) !== subcase) failures.push(`${tag}: classify mismatch`);
    if (classifyEOCase(cube) !== eoCase) failures.push(`${tag}: classifyEOCase mismatch (eo=${cube.eo})`);
    if (!untrackedEdgesSolved(cube)) failures.push(`${tag}: displayed cube has disturbed F2L-block edges (ep=${cube.ep})`);
    if (!centersAreExactlyValid(cube)) failures.push(`${tag}: displayed cube centers invalid (tp=${cube.tp})`);

    // This is the exact bug that was reported: applying the displayed
    // scramble to a solved cube must reproduce *exactly* the displayed
    // cube -- not just an equivalent-enough one. Byte-for-byte, not just
    // matching classification.
    const replay = new CubieCube().apply(new MoveSeq(scramble));
    if (!arrayEqual(replay.cp, cube.cp) || !arrayEqual(replay.co, cube.co) ||
        !arrayEqual(replay.ep, cube.ep) || !arrayEqual(replay.eo, cube.eo)) {
        failures.push(`${tag}: scramble does NOT exactly reproduce the displayed cube (cube.ep=${cube.ep}, replay.ep=${replay.ep})`);
    }
    if (CLASSIFIERS[eoCase](replay) !== subcase) failures.push(`${tag}: scramble replay subcase mismatch`);
    if (classifyEOCase(replay) !== eoCase) failures.push(`${tag}: scramble replay EO mismatch`);
    if (!untrackedEdgesSolved(replay)) failures.push(`${tag}: scramble replay has disturbed F2L-block edges (ep=${replay.ep})`);

    if (solutions.length === 0) failures.push(`${tag}: solver found zero solutions`);
    for (const sol of solutions) {
        const seq = new MoveSeq(sol.alg);
        if (seq.moves.length !== sol.moveCount) {
            failures.push(`${tag}: solution "${sol.alg}" moveCount=${sol.moveCount} but parses to ${seq.moves.length}`);
        }
        if (!eolrbSolver.is_solved(cube.apply(seq))) {
            failures.push(`${tag}: solution "${sol.alg}" does not solve the case`);
        }
    }

    const trueMin = Math.min(...solutions.map((s) => s.moveCount));
    if (minMoves !== trueMin) failures.push(`${tag}: minMoves=${minMoves} but true min is ${trueMin}`);
}
console.log("combo distribution over", N, "cases:", comboCounts);
console.log("\nmin-moves range per combo (sanity: should differ across combos):");
for (const [key, arr] of Object.entries(minMovesBySubcase)) {
    console.log(`  ${key}: min=${Math.min(...arr)} max=${Math.max(...arr)} avg=${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)}`);
}

console.log("\n--- single-combo pool selection ---");
for (const combo of allCombos()) {
    const result = generateCase([combo]);
    if (result.eoCase !== combo.eoCase || result.subcase !== combo.subcase) {
        failures.push(`pool=[${combo.eoCase}/${combo.subcase}]: got ${result.eoCase}/${result.subcase} instead`);
    }
}

if (failures.length === 0) {
    console.log("\nALL CHECKS PASSED");
} else {
    console.log(`\n${failures.length} FAILURES:`);
    failures.slice(0, 40).forEach((f) => console.log("  " + f));
    process.exit(1);
}
