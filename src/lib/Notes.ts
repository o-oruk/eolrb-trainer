import { loadJSON, saveJSON } from "./Storage";

// Per-combo (eoCase::subcase) freeform notes, persisted to localStorage.
// Keyed per trainer page, same convention as Progress/RepCount, so e.g.
// EOLRb and 4c notes don't collide.
export type NotesState = Record<string, string>;

function storageKey(page: string): string {
    return `eolrb-trainer-notes-v1:${page}`;
}

export function loadNotes(page: string): NotesState {
    return loadJSON(storageKey(page), {});
}

export function saveNotes(page: string, notes: NotesState): void {
    saveJSON(storageKey(page), notes);
}
