// Whole-trainer backup: export every persisted key (progress, BLD stats,
// notes, selections, rep counts, settings...) to a JSON file, and import such
// a file on another machine to get an exact replica.
//
// Matched by key prefix rather than an explicit list so new persisted state
// is picked up automatically. The site shares its localStorage origin with
// any other GitHub Pages project on the same account, so only our own keys
// are touched.
const KEY_PREFIXES = ["eolrb-trainer-", "trainer-active-page-"];
const FORMAT = "eolrb-trainer-backup";
const VERSION = 1;

type Backup = {
    format: typeof FORMAT;
    version: number;
    exportedAt: string;
    data: Record<string, string>;
};

function isTrainerKey(key: string): boolean {
    return KEY_PREFIXES.some((p) => key.startsWith(p));
}

function trainerKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && isTrainerKey(key)) keys.push(key);
    }
    return keys;
}

export function exportBackup(): void {
    const data: Record<string, string> = {};
    for (const key of trainerKeys()) {
        const value = localStorage.getItem(key);
        if (value !== null) data[key] = value;
    }
    const backup: Backup = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eolrb-trainer-backup-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Replaces all current trainer data with the file's contents. Throws with a
// user-facing message if the file isn't a trainer backup.
export async function importBackup(file: File): Promise<void> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(await file.text());
    } catch {
        throw new Error("That file isn't valid JSON.");
    }
    const backup = parsed as Partial<Backup>;
    if (backup?.format !== FORMAT || typeof backup.data !== "object" || backup.data === null) {
        throw new Error("That file isn't an EOLRb trainer backup.");
    }
    const entries = Object.entries(backup.data).filter(
        ([k, v]) => isTrainerKey(k) && typeof v === "string",
    );

    for (const key of trainerKeys()) localStorage.removeItem(key);
    for (const [key, value] of entries) localStorage.setItem(key, value);
}
