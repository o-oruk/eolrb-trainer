import { loadJSON, saveJSON } from "./Storage";

// Per-combo mastery tracking, persisted to localStorage. Scoped per browser
// (not per person or per device) -- see conversation for why that's the
// right default for a static, backend-free trainer.
//
// Tri-state: a key absent from the map means "not started". "learning"
// (yellow) is for cases you're still shaky on; "mastered" (green) is for
// ones you've got down; "flagged" (red) marks cases you find particularly
// challenging.
export type MasteryLevel = "learning" | "mastered" | "flagged";
export type ProgressState = Record<string, MasteryLevel>;

// v2: values changed from boolean to MasteryLevel strings when the
// learning/in-progress state was added -- bumped to avoid misreading old
// `true` values as a mastery level.
//
// Keyed per trainer page so e.g. EOLRb and 4c progress are tracked
// separately. "eolrb" keeps the original, pre-multi-page storage key so
// existing progress isn't lost.
function storageKey(namespace: string): string {
    return namespace === "eolrb" ? "eolrb-trainer-progress-v2" : `eolrb-trainer-progress-v2:${namespace}`;
}

export function loadProgress(namespace: string = "eolrb"): ProgressState {
    return loadJSON(storageKey(namespace), {});
}

export function saveProgress(state: ProgressState, namespace: string = "eolrb"): void {
    saveJSON(storageKey(namespace), state);
}

// none -> learning -> mastered -> flagged -> none
export function nextMasteryLevel(current: MasteryLevel | undefined): MasteryLevel | undefined {
    if (current === "flagged") return undefined;
    if (current === "mastered") return "flagged";
    if (current === "learning") return "mastered";
    return "learning";
}

export function masteryLabel(level: MasteryLevel | undefined): string {
    if (level === "mastered") return "Learned";
    if (level === "learning") return "Still learning";
    if (level === "flagged") return "Flagged";
    return "Mark progress";
}

export function masterySymbol(level: MasteryLevel | undefined): string {
    if (level === "mastered") return "✓";
    if (level === "learning") return "~";
    if (level === "flagged") return "!";
    return "";
}
