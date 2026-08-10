import { CubieCube, FaceletCube } from "../src/lib/CubeLib";
import { Face } from "../src/lib/Defs";
import { colorSchemeFor } from "../src/lib/ColorScheme";
import * as fs from "fs";

const cube = new CubieCube().apply("M' U' M");
const facelets = FaceletCube.from_cubie(cube); // [u_face, d_face, f_face, b_face, l_face, r_face]
const hexScheme = colorSchemeFor("Y", "G"); // [U,D,F,B,L,R,X]
const faceToHex: Record<number, string> = {};
[Face.U, Face.D, Face.F, Face.B, Face.L, Face.R, Face.X].forEach((f, i) => { faceToHex[f] = hexScheme[i]; });

const NAMES = ["U", "D", "F", "B", "L", "R"];
const grid: Record<string, string[]> = {};
facelets.forEach((g, i) => { grid[NAMES[i]] = g.map((f) => faceToHex[f]); });
// grid["U"|"F"|"R"] is a 9-element row-major array.

// Geometry: shared vertex P0 = URF corner. Three edge vectors from P0 at
// true-isometric 120 degrees apart:
//   A -> toward UFL (shared by U and F faces)
//   B -> toward UBR (shared by U and R faces)
//   Cv -> toward DFR (shared by F and R faces)
const L = 38;
const P0 = { x: 50, y: 40 };
const A = { x: -Math.cos(Math.PI / 6) * L, y: -Math.sin(Math.PI / 6) * L };
const B = { x: Math.cos(Math.PI / 6) * L, y: -Math.sin(Math.PI / 6) * L };
const Cv = { x: 0, y: L };

function add(...pts: { x: number; y: number }[]) {
    return pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
}
function scale(p: { x: number; y: number }, s: number) {
    return { x: p.x * s, y: p.y * s };
}
function pt(p: { x: number; y: number }) {
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}

// U face: vertex(rowLine,colLine) = P0 + (1-colLine/3)*A + (1-rowLine/3)*B
function uVertex(rowLine: number, colLine: number) {
    return add(P0, scale(A, 1 - colLine / 3), scale(B, 1 - rowLine / 3));
}
// F face: vertex(rowLine,colLine) = P0 + (1-colLine/3)*A + (rowLine/3)*Cv
function fVertex(rowLine: number, colLine: number) {
    return add(P0, scale(A, 1 - colLine / 3), scale(Cv, rowLine / 3));
}
// R face: vertex(rowLine,colLine) = P0 + (colLine/3)*B + (rowLine/3)*Cv
function rVertex(rowLine: number, colLine: number) {
    return add(P0, scale(B, colLine / 3), scale(Cv, rowLine / 3));
}

function faceCells(vertexFn: (r: number, c: number) => { x: number; y: number }, colors: string[]) {
    let polys = "";
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const p1 = vertexFn(r, c);
            const p2 = vertexFn(r, c + 1);
            const p3 = vertexFn(r + 1, c + 1);
            const p4 = vertexFn(r + 1, c);
            const color = colors[r * 3 + c];
            polys += `<polygon points="${pt(p1)} ${pt(p2)} ${pt(p3)} ${pt(p4)}" fill="${color}" stroke="#1a1a1a" stroke-width="0.9" stroke-linejoin="round"/>\n    `;
        }
    }
    return polys;
}

const uPolys = faceCells(uVertex, grid["U"]);
const fPolys = faceCells(fVertex, grid["F"]);
const rPolys = faceCells(rVertex, grid["R"]);

// Outer silhouette hexagon (the 6 corners that are NOT the shared near
// vertex P0), drawn on top with no fill so it reads as one crisp cube
// outline instead of a cluster of individually-stroked stickers.
const ULB = add(A, B), UFL = A, UBR = B, DFR = Cv, DLF = add(A, Cv), DRB = add(B, Cv);
const outerHex = [ULB, UBR, DRB, DFR, DLF, UFL].map((v) => add(P0, v));
const outerPath = `M ${outerHex.map(pt).join(" L ")} Z`;

// Tight viewBox around the hexagon, with a small margin -- favicons are
// tiny, so unused canvas space just makes the cube look smaller.
const margin = 4;
const xs = outerHex.map((v) => v.x);
const ys = outerHex.map((v) => v.y);
const minX = Math.min(...xs) - margin, maxX = Math.max(...xs) + margin;
const minY = Math.min(...ys) - margin, maxY = Math.max(...ys) + margin;
const vbW = maxX - minX, vbH = maxY - minY;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}">
  <g>
    ${uPolys}
    ${fPolys}
    ${rPolys}
    <path d="${outerPath}" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round"/>
  </g>
</svg>
`;

fs.writeFileSync("public/favicon.svg", svg);
console.log(svg);
