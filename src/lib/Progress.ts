// Per-combo mastery tracking, persisted to localStorage. Scoped per browser
// (not per person or per device) -- see conversation for why that's the
// right default for a static, backend-free trainer.

export type ProgressState = Record<string, boolean>;

const STORAGE_KEY = "eolrb-trainer-progress-v1";

export function loadProgress(): ProgressState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function saveProgress(state: ProgressState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // storage unavailable (private browsing, quota, etc.) -- progress
        // just won't persist across reloads; nothing else breaks.
    }
}
