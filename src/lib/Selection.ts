import { loadJSON, saveJSON } from "./Storage";

// Which case combos are currently enabled for training, persisted to
// localStorage so a refresh doesn't silently reset back to "everything
// selected". `null` means "never saved" (first visit) -- distinct from an
// empty array, which is a deliberate "nothing selected" state the caller
// should honor as-is.
//
// Keyed per trainer page so e.g. EOLRb and 4c selections are tracked
// separately. "eolrb" keeps the original, pre-multi-page storage key so
// existing selections aren't lost.
function storageKey(namespace: string): string {
    return namespace === "eolrb" ? "eolrb-trainer-selection-v1" : `eolrb-trainer-selection-v1:${namespace}`;
}

export function loadSelection(namespace: string = "eolrb"): string[] | null {
    return loadJSON<string[] | null>(storageKey(namespace), null);
}

export function saveSelection(keys: string[], namespace: string = "eolrb"): void {
    saveJSON(storageKey(namespace), keys);
}
