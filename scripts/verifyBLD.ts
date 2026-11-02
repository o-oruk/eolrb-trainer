import { CubieCube } from "../src/lib/CubeLib";
import { BLD_CASES, buildBLDCube, generateBLDCase, edgeCornerRelation, topLRRelations } from "../src/lib/EOLRbBLDCases";

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

const fourZero = BLD_CASES.find((x) => x.id === "4/0")!;
for (const s of fourZero.subcases) {
    for (let i = 0; i < 60; i++) check(s.accept(buildBLDCube("4/0", s.id)), `built ${s.id}`);
    for (let i = 0; i < 8; i++) {
        const k = generateBLDCase([{ eoCase: "4/0", subcase: s.id }]);
        const ok = s.accept(k.cube) && s.accept(new CubieCube().apply(k.scramble));
        check(ok, `scrambled ${s.id}: ${k.scramble} rels=${topLRRelations(k.cube)}`);
    }
    console.log("ok", s.id);
}
// Unrefined EO cases still generate.
for (const e of BLD_CASES.filter((x) => x.id !== "4/0")) {
    for (const s of e.subcases) generateBLDCase([{ eoCase: e.id, subcase: s.id }]);
}
console.log(failures ? `${failures} failures` : "all passed");
process.exit(failures ? 1 : 0);
