import { CubieCube, Move, MoveSeq } from "./CubeLib";
import { rand_choice } from "./Math";
import { CachedSolver } from "./CachedSolver";

// The Roux "4c" step: EO + LR insertion are already done (see EOLRbGenerator),
// leaving only the last 4 M-slice edges (UF/UB/DF/DB) to place via U/M moves.
//
// Unlike EOLRb, 4c isn't a family of randomly-constructed positions -- it
// reduces to exactly 17 fixed algorithmic cases (a finite, memorizable set),
// grouped into 4 categories. Case identity is therefore just "which of the
// 17 was picked", tracked directly -- no re-derivation-from-scramble dance
// needed the way EOLRb needs it for its interchangeable non-LR pieces.

export type FourCCategoryId = "3-mover" | "m2-ending" | "m2-starting" | "non-cycle";

export type FourCCaseDef = {
    id: string; // e.g. "3-mover-1"
    category: FourCCategoryId;
    index: number; // 1-based position within its category
    label: string; // e.g. "3-mover 1"
    solution: string; // the fixed, textbook solve for this case (M/M'/M2/U2 only)
};

export type FourCCategoryDef = {
    id: FourCCategoryId;
    label: string;
    cases: FourCCaseDef[];
};

// Solutions as given -- the canonical alg for each of the 17 fundamental 4c
// cases (corners solved, LR bar already placed; only U/U'/U2/M/M'/M2 turns
// needed for the remaining 4 edges + center alignment).
const CATEGORY_SOLUTIONS: Record<FourCCategoryId, string[]> = {
    "3-mover": ["M U2 M", "M U2 M'", "M' U2 M", "M' U2 M'"],
    "m2-ending": ["M U2 M U2 M2", "M U2 M' U2 M2", "M' U2 M U2 M2", "M' U2 M' U2 M2"],
    "m2-starting": ["M2 U2 M U2 M", "M2 U2 M U2 M'", "M2 U2 M' U2 M", "M2 U2 M' U2 M'"],
    "non-cycle": ["M2", "M2 U2 M2", "M' U2 M2 U2 M", "M' U2 M2 U2 M'", "M' U2 M2 U2 M' U2 M2"],
};

const CATEGORY_LABELS: Record<FourCCategoryId, string> = {
    "3-mover": "3-mover",
    "m2-ending": "M2-Ending",
    "m2-starting": "M2-Starting",
    "non-cycle": "Non-cycle",
};

const CATEGORY_ORDER: FourCCategoryId[] = ["3-mover", "m2-ending", "m2-starting", "non-cycle"];

export const FOUR_C_CATEGORIES: FourCCategoryDef[] = CATEGORY_ORDER.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    cases: CATEGORY_SOLUTIONS[id].map((solution, i) => ({
        id: `${id}-${i + 1}`,
        category: id,
        index: i + 1,
        label: `${CATEGORY_LABELS[id]} ${i + 1}`,
        solution,
    })),
}));

export const ALL_CASES: FourCCaseDef[] = FOUR_C_CATEGORIES.flatMap((c) => c.cases);
const CASE_BY_ID = new Map(ALL_CASES.map((c) => [c.id, c]));

export function allCaseIds(): string[] {
    return ALL_CASES.map((c) => c.id);
}

export type FourCSolution = {
    alg: string;
    moveCount: number;
};

export type FourCCase = {
    cube: CubieCube;
    scramble: string;
    solutions: FourCSolution[];
    minMoves: number;
    caseId: string;
};

const SOLVER_NAME = "lse"; // U/U'/U2/M/M'/M2-only solver; its one solved state is the literal identity cube, so it requires centers exactly realigned.

const AUF_CHOICES = ["U", "U'"];

/**
 * Builds the cube state that this case's *padded* solution solves, plus
 * that padded solution itself (needed so generateCase can recognize and
 * reject the trivial, literal-inverse scramble -- see below).
 *
 * The 17 given algs are each a fixed, exact solution for their case -- but
 * displaying "the scramble" as their literal inverse would let anyone who
 * can reverse a short alg in their head instantly read off the answer. So
 * instead: pick a random single AUF *before* the textbook solution (never
 * `""`/`U2`, per the "a random U/U'" spec), forming `auf1 + solution`. That
 * padded sequence is the thing we actually need a scramble for -- inverting
 * *it* still isn't shown directly (see generateCase), but it's the target
 * state the real scramble has to reach.
 */
function buildTarget(caseDef: FourCCaseDef): { target: CubieCube; paddedSolution: MoveSeq } {
    const auf1 = Move.all[rand_choice(AUF_CHOICES)];
    const solution = new MoveSeq(caseDef.solution);
    const paddedSolution = new MoveSeq([auf1, ...solution.moves]);
    const target = new CubieCube().apply(paddedSolution.inv());
    return { target, paddedSolution };
}

export function generateCase(enabledIds: string[]): FourCCase {
    const pool = enabledIds.length > 0 ? enabledIds.map((id) => CASE_BY_ID.get(id)!) : ALL_CASES;
    const caseDef = rand_choice(pool);
    const { target, paddedSolution } = buildTarget(caseDef);

    const solver = CachedSolver.get(SOLVER_NAME);

    // Find a fresh path back to solved for `target` via the general LSE
    // solver rather than reusing the padded solution's literal inverse --
    // this is what actually keeps the displayed scramble from being a
    // trivial, human-reversible mirror of the answer. The solver's minimal-
    // length solve for `target` is frequently just `paddedSolution` itself
    // (it *is* a valid, often-optimal solve for the state it defines), so a
    // plain rand_choice over a small candidate pool would keep landing on
    // it by chance. Ask for a wider pool of solutions (mixing in some
    // one-move-longer alternates once the optimal ones are exhausted),
    // explicitly drop anything that's textually identical to
    // `paddedSolution`, and only fall back to it if nothing else was found
    // at all.
    const paddedStr = paddedSolution.toString();
    const candidates = solver.solve(target, 0, 20, 12);
    const nonTrivial = candidates.filter((c) => c.toString() !== paddedStr);
    const solveBack = rand_choice(nonTrivial.length > 0 ? nonTrivial : candidates);
    const scramble = (solveBack ?? new MoveSeq([])).inv().toString();

    // Re-derive the displayed case from the scramble itself so what's shown
    // is exactly what applying the scramble produces (see EOLRbGenerator for
    // why this matters when a solver can land on more than one valid state).
    const cube = new CubieCube().apply(scramble);

    const solutionSeqs = solver.solve(cube, 0, 20, 5);
    const solutions = solutionSeqs.map((s) => ({ alg: s.toString(), moveCount: s.moves.length }));
    const minMoves = Math.min(...solutions.map((s) => s.moveCount));

    return { cube, scramble, solutions, minMoves, caseId: caseDef.id };
}
