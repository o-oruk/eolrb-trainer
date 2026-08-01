import { CubieCube, MoveSeq, CubeUtil, Mask } from "./CubeLib";
import { rand_choice } from "./Math";
import { CachedSolver } from "./CachedSolver";

// The Roux "4c" step: EO + LR insertion are already done (see EOLRbGenerator),
// leaving only the last 4 M-slice edges (UF/UB/DF/DB) to place via U/M moves.
// `lse_4c_mask` already encodes exactly that: corners solved, every edge but
// UF/UB/DF/DB solved, all EO solved.

export type FourCSolution = {
    alg: string;
    moveCount: number;
};

export type FourCCase = {
    cube: CubieCube;
    scramble: string;
    solutions: FourCSolution[];
    minMoves: number;
};

const SOLVER_NAME = "lse"; // U/U'/U2/M/M'/M2-only solver; its one solved state is the literal identity cube, so it requires centers exactly realigned.

// A single M or M' turn permutes the 4 free edges further and rotates the
// U/D/F/B centers by a quarter turn -- guaranteeing an odd number of M turns
// is needed to solve, i.e. always a "misaligned centers" case. (Mirrors
// onionhoney's original 4c generator's "Misaligned" branch.)
function build4cCube(): CubieCube {
    const cube = CubeUtil.get_random_with_mask(Mask.lse_4c_mask);
    return cube.apply(rand_choice(["M", "M'"]));
}

export function generate4cCase(): FourCCase {
    const solver = CachedSolver.get(SOLVER_NAME);
    const constructed = build4cCube();

    const solveBack = rand_choice(solver.solve(constructed, 0, 20, 3));
    const scramble = (solveBack ?? new MoveSeq([])).inv().toString();

    // Re-derive the displayed case from the scramble itself so what's shown
    // is exactly what applying the scramble produces (see EOLRbGenerator for
    // why this matters when a solver can land on more than one valid state).
    const cube = new CubieCube().apply(scramble);

    const solutionSeqs = solver.solve(cube, 0, 20, 5);
    const solutions = solutionSeqs.map((s) => ({ alg: s.toString(), moveCount: s.moves.length }));
    const minMoves = Math.min(...solutions.map((s) => s.moveCount));

    return { cube, scramble, solutions, minMoves };
}
