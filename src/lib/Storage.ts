// Generic, failure-safe localStorage JSON persistence (private browsing,
// quota limits, etc. degrade to "just don't persist" rather than throwing).

export function loadJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

export function saveJSON(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // storage unavailable -- nothing else breaks, it just won't persist.
    }
}
