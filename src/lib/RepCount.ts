import { loadJSON, saveJSON } from "./Storage";

// How many cases the user has clicked "Next case" on this session,
// persisted to localStorage so an accidental refresh doesn't lose the count.
// Keyed per trainer page so e.g. EOLRb and 4c reps are tracked separately.
// "eolrb" keeps the original, pre-multi-page storage key so existing counts
// aren't lost.
function storageKey(page: string): string {
    return page === "eolrb" ? "eolrb-trainer-rep-count-v1" : `eolrb-trainer-rep-count-v1:${page}`;
}

export function loadRepCount(page: string): number {
    return loadJSON<number>(storageKey(page), 0);
}

export function saveRepCount(page: string, count: number): void {
    saveJSON(storageKey(page), count);
}
