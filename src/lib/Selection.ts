import { loadJSON, saveJSON } from "./Storage";

// Which EO-case/subcase combos are currently enabled for training,
// persisted to localStorage so a refresh doesn't silently reset back to
// "everything selected". `null` means "never saved" (first visit) --
// distinct from an empty array, which is a deliberate "nothing selected"
// state the caller should honor as-is.
const STORAGE_KEY = "eolrb-trainer-selection-v1";

export function loadSelection(): string[] | null {
    return loadJSON<string[] | null>(STORAGE_KEY, null);
}

export function saveSelection(keys: string[]): void {
    saveJSON(STORAGE_KEY, keys);
}
