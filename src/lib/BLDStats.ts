import { loadJSON, saveJSON } from "./Storage";

// Per-combo blindfolded attempt results for the EOLRb BLD trainer,
// persisted to localStorage. Only explicit Yes/No answers are recorded --
// a skipped case counts as never having been faced, so it isn't stored at
// all. A key absent from the map means "never attempted".
export type BLDCaseStats = { yes: number; no: number };
export type BLDStatsState = Record<string, BLDCaseStats>;

const STORAGE_KEY = "eolrb-trainer-bld-stats-v1";

export function loadBLDStats(): BLDStatsState {
    return loadJSON(STORAGE_KEY, {});
}

export function saveBLDStats(state: BLDStatsState): void {
    saveJSON(STORAGE_KEY, state);
}

// Adds (delta = 1) or takes back (delta = -1, for undo) one attempt.
export function recordAttempt(state: BLDStatsState, key: string, success: boolean, delta: 1 | -1 = 1): BLDStatsState {
    const prev = state[key] ?? { yes: 0, no: 0 };
    const updated = success ? { ...prev, yes: Math.max(0, prev.yes + delta) } : { ...prev, no: Math.max(0, prev.no + delta) };
    const next = { ...state };
    if (updated.yes + updated.no === 0) delete next[key];
    else next[key] = updated;
    return next;
}

// Sums any number of combos' stats, e.g. for an EO-case group or overall.
export function totalStats(state: BLDStatsState, keys: string[]): BLDCaseStats {
    return keys.reduce(
        (acc, k) => ({ yes: acc.yes + (state[k]?.yes ?? 0), no: acc.no + (state[k]?.no ?? 0) }),
        { yes: 0, no: 0 }
    );
}

// Rounded success percentage, or null when there are no attempts yet.
export function successPct(s: BLDCaseStats): number | null {
    const total = s.yes + s.no;
    return total === 0 ? null : Math.round((s.yes / total) * 100);
}

// Colour band for a success rate, so weak cases stand out at a glance.
export function rateTier(pct: number | null): "none" | "good" | "ok" | "bad" {
    if (pct === null) return "none";
    if (pct >= 80) return "good";
    if (pct >= 50) return "ok";
    return "bad";
}
