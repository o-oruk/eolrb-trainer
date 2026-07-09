import { loadJSON, saveJSON } from "./Storage";

// Per-combo mastery tracking, persisted to localStorage. Scoped per browser
// (not per person or per device) -- see conversation for why that's the
// right default for a static, backend-free trainer.
//
// Tri-state: a key absent from the map means "not started". "learning"
// (yellow) is for cases you're still shaky on; "mastered" (green) is for
// ones you've got down.
export type MasteryLevel = "learning" | "mastered";
export type ProgressState = Record<string, MasteryLevel>;

// v2: values changed from boolean to MasteryLevel strings when the
// learning/in-progress state was added -- bumped to avoid misreading old
// `true` values as a mastery level.
const STORAGE_KEY = "eolrb-trainer-progress-v2";

export function loadProgress(): ProgressState {
    return loadJSON(STORAGE_KEY, {});
}

export function saveProgress(state: ProgressState): void {
    saveJSON(STORAGE_KEY, state);
}

// none -> learning -> mastered -> none
export function nextMasteryLevel(current: MasteryLevel | undefined): MasteryLevel | undefined {
    if (current === "mastered") return undefined;
    if (current === "learning") return "mastered";
    return "learning";
}
