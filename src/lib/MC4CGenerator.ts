import { CubieCube, Move, MoveSeq } from "./CubeLib";
import { rand_choice } from "./Math";
import { ALL_CASES, type FourCCaseDef } from "./FourCGenerator";
import { scrambleForTarget, finalizeCase, type FourCCase } from "./FourCShared";

// MC-4c: the same 17 fundamental 4c cases (see FourCGenerator), but padded
// differently for scramble generation -- a random U/U' before the solution
// *and* a random M/M' tacked onto the end, standing in for a corrective
// center turn. Every one of the 17 given solutions already ends in an
// M-family move (M, M', or M2), so the trailing M/M' always collides with
// it; `.collapse()` folds that pair down via the usual quarter-turn
// arithmetic (e.g. M2 then M collapses to M', M then M' cancels outright).

export { FOUR_C_CATEGORIES, ALL_CASES, allCaseIds } from "./FourCGenerator";
export type { FourCCaseDef, FourCCategoryDef, FourCCategoryId, FourCCase, FourCSolution } from "./FourCGenerator";

const CASE_BY_ID = new Map(ALL_CASES.map((c) => [c.id, c]));

const AUF_CHOICES = ["U", "U'"];
const M_END_CHOICES = ["M", "M'"];

/**
 * Builds the cube state that this case's *padded* solution solves, plus
 * that padded solution itself -- same purpose as FourCGenerator's
 * buildTarget, but the padding is `auf1 + solution + mEnd`, collapsed so
 * the trailing M/M' merges with the solution's own last M-family move
 * instead of sitting there as a separate, always-cancelable turn.
 */
function buildTarget(caseDef: FourCCaseDef): { target: CubieCube; paddedSolution: MoveSeq } {
    const auf1 = Move.all[rand_choice(AUF_CHOICES)];
    const mEnd = Move.all[rand_choice(M_END_CHOICES)];
    const solution = new MoveSeq(caseDef.solution);
    const paddedSolution = new MoveSeq([auf1, ...solution.moves, mEnd]).collapse();
    const target = new CubieCube().apply(paddedSolution.inv());
    return { target, paddedSolution };
}

export function generateCase(enabledIds: string[]): FourCCase {
    const pool = enabledIds.length > 0 ? enabledIds.map((id) => CASE_BY_ID.get(id)!) : ALL_CASES;
    const caseDef = rand_choice(pool);
    const { target, paddedSolution } = buildTarget(caseDef);
    const scramble = scrambleForTarget(target, paddedSolution);
    return finalizeCase(caseDef.id, scramble);
}
