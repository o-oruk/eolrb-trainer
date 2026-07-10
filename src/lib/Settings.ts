import { loadJSON, saveJSON } from "./Storage";
import type { ColorLetter } from "./ColorScheme";

// General trainer preferences, persisted to localStorage.
export type Settings = {
    showMoveCount: boolean;
    showCube: boolean;
    topColor: ColorLetter;
    frontColor: ColorLetter;
};

const STORAGE_KEY = "eolrb-trainer-settings-v1";

const DEFAULT_SETTINGS: Settings = {
    showMoveCount: true,
    showCube: true,
    topColor: "W",
    frontColor: "G",
};

export function loadSettings(): Settings {
    return { ...DEFAULT_SETTINGS, ...loadJSON<Partial<Settings>>(STORAGE_KEY, {}) };
}

export function saveSettings(settings: Settings): void {
    saveJSON(STORAGE_KEY, settings);
}
