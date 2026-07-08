import { CubieCube, MoveSeq } from "./CubeLib";
import { rand_choice, rand_shuffle, getParity } from "./Math";
import { CachedSolver } from "./CachedSolver";

// Edge slot indices, matching Defs.tsx's edges_coord order:
// [UF, UL, UB, UR, DF, DL, DB, DR, FL, BL, BR, FR]
const UF = 0, UL = 1, UB = 2, UR = 3, DF = 4, DB = 6;
const ALL_SLOTS = [UF, UL, UB, UR, DF, DB];
const SLOT_NAMES: Record<number, string> = { [UF]: "UF", [UL]: "UL", [UB]: "UB", [UR]: "UR", [DF]: "DF", [DB]: "DB" };

const AUF_CHOICES = ["", "U", "U'", "U2"];

// The center array (tp) after an M2: swaps U<->D and F<->B centers, i.e.
// "yellow on top" instead of "white on top". M2 also permutes/reorients 4 of
// our 6 edges, so we can't apply it as a real move on the finished cube --
// we copy just its effect on centers, which is independent of the edges.
const M2_CENTERS = new CubieCube().apply("M2").tp;
const IDENTITY_CENTERS = new CubieCube().tp;

// The LR (bar) edges are, by definition, always the pieces whose solved
// home is UL and UR -- independent of which EO case or subcase is chosen.
const LR_PIECE_A = UL; // piece-id 1
const LR_PIECE_B = UR; // piece-id 3

export type SubcaseDef = {
    id: string;
    label: string;
    detail: string;
    // Picks the 2 canonical slots the LR pieces get dropped into, before the
    // random post-AUF spreads that placement out over all 4 AUF-equivalent
    // rotations. May internally randomize among equivalent options (e.g.
    // "either bottom slot") -- called fresh for every generated case.
    getTargetSlots: () => [number, number];
};

// Subcase set for EO cases where all 4 top positions share the same
// orientation (4/0: all misoriented, 0/2: all oriented). The only
// distinguishing structure among LR placements is position (bottom/top,
// adjacent/opposite) -- there's no orientation-type split to make.
const POSITIONAL_SUBCASES: SubcaseDef[] = [
    { id: "both-bottom", label: "Both on bottom", detail: "DF & DB", getTargetSlots: () => [DF, DB] },
    { id: "one-top-one-bottom", label: "One top, one bottom", detail: "UF & DF/DB", getTargetSlots: () => [UF, rand_choice([DF, DB])] },
    { id: "top-opposite", label: "Both on top, opposite", detail: "UF & UB", getTargetSlots: () => [UF, UB] },
    { id: "top-adjacent", label: "Both on top, adjacent", detail: "UF & UR", getTargetSlots: () => [UF, UR] },
];

// Subcase set for EO cases where the top 4 positions split 2-and-2 into a
// misoriented opposite-pair and an oriented opposite-pair (e.g. 2o/0: UF/UB
// misoriented, UL/UR oriented). Any two adjacent top slots are always one of
// each type, so "both top" splits into three distinct cases -- both
// misoriented, both oriented, or mixed -- that don't exist in the purely
// positional set above.
function orientationSplitSubcases(misoriented: [number, number], oriented: [number, number]): SubcaseDef[] {
    const name = (s: number) => SLOT_NAMES[s];
    return [
        { id: "both-bottom", label: "Both on bottom", detail: "DF & DB", getTargetSlots: () => [DF, DB] },
        {
            id: "bottom-top-misoriented", label: "1 bottom, 1 top (misoriented)", detail: "DF/DB & " + misoriented.map(name).join("/"),
            getTargetSlots: () => [rand_choice([DF, DB]), rand_choice(misoriented)],
        },
        {
            id: "bottom-top-oriented", label: "1 bottom, 1 top (oriented)", detail: "DF/DB & " + oriented.map(name).join("/"),
            getTargetSlots: () => [rand_choice([DF, DB]), rand_choice(oriented)],
        },
        {
            id: "top-both-misoriented", label: "Both top, misoriented", detail: misoriented.map(name).join(" & "),
            getTargetSlots: () => [misoriented[0], misoriented[1]],
        },
        {
            id: "top-both-oriented", label: "Both top, oriented", detail: oriented.map(name).join(" & "),
            getTargetSlots: () => [oriented[0], oriented[1]],
        },
        {
            id: "top-mixed", label: "Both top, mixed", detail: misoriented.map(name).join("/") + " & " + oriented.map(name).join("/"),
            getTargetSlots: () => [rand_choice(misoriented), rand_choice(oriented)],
        },
    ];
}

// Subcase set for EO cases with one distinguished top slot ("tip") opposite
// a differently-oriented "back" slot, and two interchangeable "sides"
// flanking both -- the "arrow" shape (arrow: tip+sides misoriented, back
// oriented; 1/1: only tip misoriented, sides+back oriented). Unlike every
// EO case above, DF and DB are no longer symmetric here either: one is
// misoriented and the other is oriented, so *which* bottom slot an LR piece
// lands on matters too. Note the tip+side subcase is deliberately labeled
// without claiming an orientation combination -- for arrow that pairing is
// "both misoriented", but for 1/1 it's "one misoriented, one oriented"
// (mixed), so only a neutral, positional label is accurate for both.
function tipSideBackSubcases(params: {
    bottomMisoriented: number;
    bottomOriented: number;
    tip: number;
    sides: [number, number];
    back: number;
}): SubcaseDef[] {
    const { bottomMisoriented: bm, bottomOriented: bo, tip, sides, back } = params;
    const name = (s: number) => SLOT_NAMES[s];
    const sidesLabel = sides.map(name).join("/");
    return [
        { id: "both-bottom", label: "Both on bottom", detail: `${name(bm)} & ${name(bo)}`, getTargetSlots: () => [bm, bo] },
        { id: "bottom-misoriented-top-tip", label: "1 bottom (misoriented), 1 top (tip)", detail: `${name(bm)} & ${name(tip)}`, getTargetSlots: () => [bm, tip] },
        { id: "bottom-misoriented-top-side", label: "1 bottom (misoriented), 1 top (side)", detail: `${name(bm)} & ${sidesLabel}`, getTargetSlots: () => [bm, rand_choice(sides)] },
        { id: "bottom-misoriented-top-back", label: "1 bottom (misoriented), 1 top (back)", detail: `${name(bm)} & ${name(back)}`, getTargetSlots: () => [bm, back] },
        { id: "bottom-oriented-top-tip", label: "1 bottom (oriented), 1 top (tip)", detail: `${name(bo)} & ${name(tip)}`, getTargetSlots: () => [bo, tip] },
        { id: "bottom-oriented-top-side", label: "1 bottom (oriented), 1 top (side)", detail: `${name(bo)} & ${sidesLabel}`, getTargetSlots: () => [bo, rand_choice(sides)] },
        { id: "bottom-oriented-top-back", label: "1 bottom (oriented), 1 top (back)", detail: `${name(bo)} & ${name(back)}`, getTargetSlots: () => [bo, back] },
        { id: "top-tip-side", label: "2 top, tip + side", detail: `${name(tip)} & ${sidesLabel}`, getTargetSlots: () => [tip, rand_choice(sides)] },
        { id: "top-sides", label: "2 top, both sides", detail: sides.map(name).join(" & "), getTargetSlots: () => [sides[0], sides[1]] },
        { id: "top-tip-back", label: "2 top, tip + back", detail: `${name(tip)} & ${name(back)}`, getTargetSlots: () => [tip, back] },
        { id: "top-side-back", label: "2 top, side + back", detail: `${sidesLabel} & ${name(back)}`, getTargetSlots: () => [rand_choice(sides), back] },
    ];
}

// EO patterns, in [UF, UL, UB, UR, DF, DB] order (same order/positions used
// by onionhoney's own lseEODef table). 1 = misoriented, 0 = oriented.
export type EOCaseId = "4/0" | "0/2" | "2o/0" | "2a/0" | "2a/2" | "2o/2" | "arrow" | "1/1";

export type EOCaseDef = {
    id: EOCaseId;
    label: string;
    pattern: [number, number, number, number, number, number];
    subcases: SubcaseDef[];
};

export const EO_CASES: EOCaseDef[] = [
    { id: "4/0", label: "4/0", pattern: [1, 1, 1, 1, 0, 0], subcases: POSITIONAL_SUBCASES },
    { id: "0/2", label: "0/2", pattern: [0, 0, 0, 0, 1, 1], subcases: POSITIONAL_SUBCASES },
    { id: "2o/0", label: "2o/0", pattern: [1, 0, 1, 0, 0, 0], subcases: orientationSplitSubcases([UF, UB], [UL, UR]) },
    { id: "2a/0", label: "2a/0", pattern: [1, 0, 0, 1, 0, 0], subcases: orientationSplitSubcases([UF, UR], [UL, UB]) },
    { id: "2a/2", label: "2a/2", pattern: [1, 0, 0, 1, 1, 1], subcases: orientationSplitSubcases([UF, UR], [UL, UB]) },
    { id: "2o/2", label: "2o/2", pattern: [0, 1, 0, 1, 1, 1], subcases: orientationSplitSubcases([UL, UR], [UF, UB]) },
    {
        id: "arrow", label: "Arrow", pattern: [1, 1, 0, 1, 1, 0],
        subcases: tipSideBackSubcases({ bottomMisoriented: DF, bottomOriented: DB, tip: UF, sides: [UL, UR], back: UB }),
    },
    {
        id: "1/1", label: "1/1", pattern: [1, 0, 0, 0, 0, 1],
        subcases: tipSideBackSubcases({ bottomMisoriented: DB, bottomOriented: DF, tip: UF, sides: [UL, UR], back: UB }),
    },
];

const EO_CASE_BY_ID = new Map(EO_CASES.map((c) => [c.id, c]));

export type Solution = {
    alg: string;
    moveCount: number;
};

export type EOLRbCase = {
    cube: CubieCube;
    scramble: string;
    solutions: Solution[];
    minMoves: number;
    eoCase: EOCaseId;
    subcase: string;
};

/**
 * Builds a random EOLRb case for the given EO case and subcase (i.e. which
 * two slots the LR edges land in).
 *
 * Construction order (see conversation for why each step is here):
 *  1. decide whether to build the mirrored chirality of this EO case (see
 *     the mirror-sandwich comment below), then random pre-AUF on top --
 *     shuffles which corners end up next to the edges we're about to place,
 *     independent of the final display orientation.
 *  2. drop the two LR pieces into the subcase's target slots (random which
 *     piece goes into which slot).
 *  3. drop the remaining 4 pieces into whatever 4 slots are left, in random
 *     order.
 *  4. fix permutation parity with a single swap if needed (must happen
 *     before orienting, while all pieces are still "oriented").
 *  5. apply the EO case's orientation pattern -- purely positional (doesn't
 *     care which piece, LR or not, sits in a given slot), so this step is
 *     identical across every subcase and reused as-is for every EO case.
 *  6. random post-AUF -- decides which slot label the finished pattern
 *     displays at, independent of step 1. Rotations preserve adjacency/
 *     opposite-ness (and therefore orientation-type grouping) among the 4
 *     top slots, and never move anything into or out of DF/DB, so the
 *     subcase's identity survives this step. Close the mirror sandwich here.
 *  7. random center alignment -- white or yellow center on top, independent
 *     of everything else, and applied *after* the mirror sandwich closes
 *     (see below for why that order matters).
 */
export function buildEOLRbCube(eoCase: EOCaseId, subcase: string): CubieCube {
    const eoCaseDef = EO_CASE_BY_ID.get(eoCase)!;
    const subcaseDef = eoCaseDef.subcases.find((s) => s.id === subcase)!;

    // Chiral EO patterns (e.g. arrow: UF/UL/UR misoriented, DF misoriented,
    // DB oriented) have a mirror image that no U-turn can ever reach, since
    // U-turns never touch DF/DB -- only a y2 gets there. A *bare* y2 at the
    // end works for the EO pattern itself, but it's a real move: it also
    // drags the 6 edges we never otherwise touch (DL/DR/FL/BL/BR/FR, which
    // must stay solved -- they're the already-solved F2L blocks) out of
    // place, and it swaps the front-facing center color, breaking the
    // green-front convention every other case keeps. Sandwiching it --
    // apply y2, do the construction, apply y2 again -- fixes both: anything
    // the sandwich touches but the construction doesn't (those 6 edges) is
    // returned to exactly where it started, since y2 undoes itself when
    // nothing happens in between. The LR/EO pattern *is* touched in between
    // (by the absolute ep/eo assignment), so it comes out correctly
    // mirrored instead of canceled. Center alignment must be assigned
    // *after* the sandwich closes, as a separate absolute step -- otherwise
    // the closing y2 would flip it back out just like it does for cp/ep.
    const useMirror = rand_choice([false, true]);

    let cube = new CubieCube();
    if (useMirror) cube = cube.apply("y2");
    cube = cube.apply(rand_choice(AUF_CHOICES));

    const targetSlots = subcaseDef.getTargetSlots();
    const lrPieces = rand_shuffle([LR_PIECE_A, LR_PIECE_B]);
    const remainingSlots = ALL_SLOTS.filter((s) => !targetSlots.includes(s));
    const remainingPieces = rand_shuffle([UF, UB, DF, DB]);

    const ep = [...cube.ep];
    ep[targetSlots[0]] = lrPieces[0];
    ep[targetSlots[1]] = lrPieces[1];
    remainingSlots.forEach((slot, i) => {
        ep[slot] = remainingPieces[i];
    });

    if ((getParity(cube.cp) + getParity(ep)) % 2 !== 0) {
        const [a, b] = [remainingSlots[0], remainingSlots[1]];
        [ep[a], ep[b]] = [ep[b], ep[a]];
    }

    const pattern = eoCaseDef.pattern;
    const eo = [...cube.eo];
    eo[UF] = pattern[0];
    eo[UL] = pattern[1];
    eo[UB] = pattern[2];
    eo[UR] = pattern[3];
    eo[DF] = pattern[4];
    eo[DB] = pattern[5];

    cube = new CubieCube({ cp: cube.cp, co: cube.co, ep, eo, tp: cube.tp });

    cube = cube.apply(rand_choice(AUF_CHOICES));
    if (useMirror) cube = cube.apply("y2");

    const tp = rand_choice([IDENTITY_CENTERS, M2_CENTERS]);
    cube = new CubieCube({ cp: cube.cp, co: cube.co, ep: cube.ep, eo: cube.eo, tp });

    return cube;
}

const SOLVER_NAME = "eolr-b"; // COMBINED center strategy, "barbie" (EOLRb) algorithm set
const SCRAMBLE_SOLVER_NAME = "lse-ab4c"; // deep (20-move) general LSE solver; plain "lse"'s table only covers depth 7

export type EnabledCombo = { eoCase: EOCaseId; subcase: string };

export function allCombos(): EnabledCombo[] {
    return EO_CASES.flatMap((c) => c.subcases.map((s) => ({ eoCase: c.id, subcase: s.id })));
}

export function generateCase(enabled: EnabledCombo[]): EOLRbCase {
    const pool = enabled.length > 0 ? enabled : allCombos();
    const { eoCase, subcase } = rand_choice(pool);
    const constructed = buildEOLRbCube(eoCase, subcase);

    const scrambleSolver = CachedSolver.get(SCRAMBLE_SOLVER_NAME);
    const solveBack = rand_choice(scrambleSolver.solve(constructed, 0, 20, 3));
    const scramble = (solveBack ?? new MoveSeq([])).inv().toString();

    // The displayed case is derived from the scramble itself, not from
    // `constructed` directly -- they'd otherwise be able to diverge. The
    // eolr-b/lse-ab4c solvers treat the 4 non-LR edges as interchangeable
    // (their exact order is a separate, later "4c" step, out of EOLR's
    // scope), so solve-then-invert can land on a different-but-equally-
    // valid arrangement of those 4 pieces than the one just constructed.
    // Rebuilding the case cube from the scramble guarantees, by
    // construction, that what's displayed is exactly what applying the
    // scramble produces -- not just "an equivalent-enough" cube.
    const cube = new CubieCube().apply(scramble);

    const solver = CachedSolver.get(SOLVER_NAME);
    const solutionSeqs = solver.solve(cube, 0, 20, 5);
    const solutions = solutionSeqs.map((s) => ({ alg: s.toString(), moveCount: s.moves.length }));
    const minMoves = Math.min(...solutions.map((s) => s.moveCount));

    return { cube, scramble, solutions, minMoves, eoCase, subcase };
}
