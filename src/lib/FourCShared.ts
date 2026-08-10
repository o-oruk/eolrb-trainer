import { CubieCube, MoveSeq } from "./CubeLib";
import { rand_choice } from "./Math";
import { CachedSolver } from "./CachedSolver";

// Shared between FourCGenerator (plain 4c) and MC4CGenerator (4c with a
// corrective trailing M/M') -- both reduce to "given a target cube state
// and the padded solution that was used to define it, find a scramble that
// (a) actually produces that state and (b) isn't just the padded solution's
// literal inverse."

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

export const SOLVER_NAME = "lse"; // U/U'/U2/M/M'/M2-only solver; its one solved state is the literal identity cube, so it requires centers exactly realigned.

/**
 * Finds a scramble that reaches `target`, without it being the literal
 * inverse of `paddedSolution`.
 *
 * The solver's minimal-length solve-back for `target` is frequently just
 * `paddedSolution` itself -- it's a valid, often-optimal solve for the
 * state it defines. A plain rand_choice over a small candidate pool would
 * keep landing on it by chance. So: ask for a wider pool of solutions
 * (mixing in some one-move-longer alternates once the optimal ones are
 * exhausted), explicitly drop anything textually identical to
 * `paddedSolution`, and only fall back to it if nothing else was found at
 * all.
 */
export function scrambleForTarget(target: CubieCube, paddedSolution: MoveSeq): string {
    const solver = CachedSolver.get(SOLVER_NAME);
    const paddedStr = paddedSolution.toString();
    const candidates = solver.solve(target, 0, 20, 12);
    const nonTrivial = candidates.filter((c) => c.toString() !== paddedStr);
    const solveBack = rand_choice(nonTrivial.length > 0 ? nonTrivial : candidates);
    return (solveBack ?? new MoveSeq([])).inv().toString();
}

/**
 * Re-derives the displayed case from the scramble itself (rather than from
 * whatever internal state built it) so what's shown is exactly what
 * applying the scramble produces -- see EOLRbGenerator for why this matters
 * when a solver can land on more than one valid state -- and computes a
 * fresh, genuinely optimal set of solutions for that exact cube.
 */
export function finalizeCase(caseId: string, scramble: string): FourCCase {
    const solver = CachedSolver.get(SOLVER_NAME);
    const cube = new CubieCube().apply(scramble);
    const solutionSeqs = solver.solve(cube, 0, 20, 5);
    const solutions = solutionSeqs.map((s) => ({ alg: s.toString(), moveCount: s.moves.length }));
    const minMoves = Math.min(...solutions.map((s) => s.moveCount));
    return { cube, scramble, solutions, minMoves, caseId };
}
