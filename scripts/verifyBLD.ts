import { CubieCube } from "../src/lib/CubeLib";
import { buildEOLRbCube } from "../src/lib/EOLRbGenerator";
import { BLD_CASES, bldParents, buildBLDCube, generateBLDCase, edgeCornerRelation, topLRRelations } from "../src/lib/EOLRbBLDCases";

// Checks the BLD trainer's corner-relative subcases: the classifier's
// conventions, and that every subcase is generated and survives the
// scramble round-trip. Run with: npx tsx scripts/verifyBLD.ts

const UF = 0, UL = 1, UB = 2, UR = 3;
let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.log("FAIL", msg); } };
const withEp = (ep: number[]) => new CubieCube({ ...new CubieCube(), ep });

// Convention: cp/ep are slot -> piece, and a U turn moves both together.
const u = new CubieCube().apply("U");
check(u.ep[UF] === UR && u.cp[0] === 3, `cp/ep slot->piece convention (ep[UF]=${u.ep[UF]}, cp[UFL]=${u.cp[0]})`);

// Solved: each LR edge between its own colored corners, under any AUF.
for (const auf of ["", "U", "U2", "U'"]) {
    const c = new CubieCube().apply(auf);
    check(topLRRelations(c).every((r) => r === "matching"), `solved+${auf} is matching: ${topLRRelations(c)}`);
}
// LR edges swapped -> both between opposite colored corners.
const sw = withEp([0, 3, 2, 1, 4, 5, 6, 7, 8, 9, 10, 11]);
check(topLRRelations(sw).every((r) => r === "opposite"), `swapped LR is opposite: ${topLRRelations(sw)}`);
// LR edges at UF/UB -> between mixed (adjacent) colored corners.
const fb = withEp([1, 0, 3, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
check(edgeCornerRelation(fb, UF) === "adjacent" && edgeCornerRelation(fb, UB) === "adjacent", "LR at UF/UB adjacent");
check(edgeCornerRelation(new CubieCube(), UL) === "matching", "solved UL matching");

const REFINED = ["4/0", "0/2", "2o/0", "2a/0", "2a/2", "2o/2", "1/1"] as const;
for (const id of REFINED) {
    const def = BLD_CASES.find((x) => x.id === id)!;
    for (const s of def.subcases) {
        for (let i = 0; i < 60; i++) check(s.accept(buildBLDCube(id, s.id)), `built ${id} ${s.id}`);
        for (let i = 0; i < 8; i++) {
            const k = generateBLDCase([{ eoCase: id, subcase: s.id }]);
            const ok = s.accept(k.cube) && s.accept(new CubieCube().apply(k.scramble));
            check(ok, `scrambled ${id} ${s.id}: ${k.scramble} rels=${topLRRelations(k.cube)}`);
        }
        console.log("ok", id, s.id);
    }
}
// Each sighted parent's refinements partition it: every built parent cube is
// accepted by exactly one refinement.
for (const id of REFINED) {
    for (const p of bldParents(BLD_CASES.find((x) => x.id === id)!)) {
        for (let i = 0; i < 300; i++) {
            const cube = buildEOLRbCube(id, p.parent);
            const n = p.subcases.filter((s) => s.accept(cube)).length;
            check(n === 1, `${id} ${p.parent}: ${n} refinements accept a cube`);
        }
    }
}
// Unrefined EO cases still generate.
for (const e of BLD_CASES.filter((x) => !(REFINED as readonly string[]).includes(x.id))) {
    for (const s of e.subcases) generateBLDCase([{ eoCase: e.id, subcase: s.id }]);
}
console.log(failures ? `${failures} failures` : "all passed");
process.exit(failures ? 1 : 0);
