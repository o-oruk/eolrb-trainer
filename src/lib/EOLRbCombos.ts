import { generateCase, EO_CASES, allCombos, type EOLRbCase, type EOCaseId, type EnabledCombo } from "./EOLRbGenerator";
import { loadSelection } from "./Selection";

// Combo (EO case + LR subcase) helpers shared by the EOLRb and EOLRb BLD
// trainers, which drill the same case set.

export function comboKey(c: EnabledCombo): string {
    return `${c.eoCase}::${c.subcase}`;
}

export const ALL_COMBOS = allCombos();
export const ALL_KEYS = ALL_COMBOS.map(comboKey);
const EO_CASE_BY_ID = new Map(EO_CASES.map((c) => [c.id, c]));

// Human-readable name for a case, e.g. "4/0 · Both on top, opposite".
export function caseLabel(eoCase: EOCaseId, subcase: string): string {
    const def = EO_CASE_BY_ID.get(eoCase);
    const sub = def?.subcases.find((s) => s.id === subcase);
    return sub ? `${def!.label} · ${sub.label}` : eoCase;
}

function combosForKeys(keys: Set<string>): EnabledCombo[] {
    return ALL_COMBOS.filter((c) => keys.has(comboKey(c)));
}

// First visit (nothing saved yet) defaults to everything selected. A saved
// selection -- even an empty one -- is honored exactly, since "nothing
// selected" is a deliberate, supported state.
export function restoreEnabled(namespace: string = "eolrb"): Set<string> {
    const saved = loadSelection(namespace);
    if (saved === null) return new Set(ALL_KEYS);
    return new Set(saved.filter((k) => ALL_KEYS.includes(k)));
}

export function caseForEnabled(keys: Set<string>): EOLRbCase | null {
    return keys.size > 0 ? generateCase(combosForKeys(keys)) : null;
}
