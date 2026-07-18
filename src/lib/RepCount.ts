import { loadJSON, saveJSON } from "./Storage";

// How many cases the user has clicked "Next case" on this session,
// persisted to localStorage so an accidental refresh doesn't lose the count.
const STORAGE_KEY = "eolrb-trainer-rep-count-v1";

export function loadRepCount(): number {
    return loadJSON<number>(STORAGE_KEY, 0);
}

export function saveRepCount(count: number): void {
    saveJSON(STORAGE_KEY, count);
}
