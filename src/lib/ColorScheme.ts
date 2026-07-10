// All 24 valid WCA-consistent orientations of a standard cube's color
// scheme (White opposite Yellow, Green opposite Blue, Orange opposite Red,
// with the correct handedness -- White-Green-Red-Blue-Orange in that
// rotational order around White). Each string is in U,D,F,B,L,R letter
// order. Not worth re-deriving by hand: copied from onionhoney's own
// ColorScheme.valid_schemes, which already enumerates exactly these 24.
const VALID_SCHEMES = [
    "WYGBOR", "WYBGRO", "WYROGB", "WYORBG",
    "YWGBRO", "YWBGOR", "YWROBG", "YWORGB",
    "GBWYRO", "GBYWOR", "GBROYW", "GBORWY",
    "BGWYOR", "BGYWRO", "BGROWY", "BGORYW",
    "ORWYGB", "ORYWBG", "ORGBYW", "ORBGWY",
    "ROWYBG", "ROYWGB", "ROGBWY", "ROBGYW",
];

const HEX: Record<string, string> = {
    W: "#ffffff",
    Y: "#ffff00",
    G: "#00b500",
    B: "#0000ff",
    O: "#ff8800",
    R: "#ff0000",
};

const OPPOSITE: Record<string, string> = { W: "Y", Y: "W", G: "B", B: "G", O: "R", R: "O" };

export const COLOR_LETTERS = ["W", "Y", "G", "B", "O", "R"] as const;
export type ColorLetter = (typeof COLOR_LETTERS)[number];

export const COLOR_NAMES: Record<ColorLetter, string> = {
    W: "White",
    Y: "Yellow",
    G: "Green",
    B: "Blue",
    O: "Orange",
    R: "Red",
};

// The 4 colors that can legally sit on the front face given a top color
// (excludes the top color itself and its opposite, which share top's axis).
export function validFrontsFor(top: ColorLetter): ColorLetter[] {
    return COLOR_LETTERS.filter((c) => c !== top && c !== OPPOSITE[top]) as ColorLetter[];
}

// The [U, D, F, B, L, R, X] hex color array CubeSim expects, for the given
// top/front pair. Falls back to White-top/Green-front if the pair is
// somehow invalid (same axis) rather than rendering something broken.
export function colorSchemeFor(top: ColorLetter, front: ColorLetter): string[] {
    const scheme = VALID_SCHEMES.find((s) => s[0] === top && s[2] === front) ?? "WYGBOR";
    return [...scheme].map((letter) => HEX[letter]).concat("#bfbfbf");
}
