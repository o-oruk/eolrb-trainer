import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { loadJSON, saveJSON } from "./lib/Storage";
import { exportBackup, importBackup } from "./lib/Backup";
import EOLRbTrainer from "./components/EOLRbTrainer";
import EOLRbBLDTrainer from "./components/EOLRbBLDTrainer";
import FourCTrainer from "./components/FourCTrainer";
import { generateCase as generate4cCase } from "./lib/FourCGenerator";
import { generateCase as generateMc4cCase } from "./lib/MC4CGenerator";
import "./App.css";

type Page = "eolrb" | "bld" | "4c" | "mc4c";

const STORAGE_KEY = "trainer-active-page-v1";

function App() {
  const [page, setPage] = useState<Page>(() => loadJSON<Page>(STORAGE_KEY, "eolrb"));

  useEffect(() => {
    saveJSON(STORAGE_KEY, page);
  }, [page]);

  const importInput = useRef<HTMLInputElement>(null);

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.confirm("Importing replaces all of your current trainer data (progress, stats, notes, settings) with the file's. Continue?")) return;
    try {
      await importBackup(file);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Import failed.");
      return;
    }
    // Every trainer reads its state from storage on mount, so a reload is the
    // simplest way to make the imported data show up everywhere.
    window.location.reload();
  };

  // Rendered by whichever trainer is active, inline in its own
  // header-actions row (with a divider) instead of as a separate row of its
  // own -- see conversation: the page switcher, the title, and the
  // settings/progress/cube/reps pills used to each claim a full row.
  const pageTabs = (
    <div className="tab-group">
      <button
        type="button"
        className={`page-tab ${page === "eolrb" ? "active" : ""}`}
        onClick={() => setPage("eolrb")}
      >
        EOLRb
      </button>
      <button
        type="button"
        className={`page-tab ${page === "bld" ? "active" : ""}`}
        onClick={() => setPage("bld")}
      >
        EOLRb BLD
      </button>
      <button
        type="button"
        className={`page-tab ${page === "4c" ? "active" : ""}`}
        onClick={() => setPage("4c")}
      >
        4c
      </button>
      <button
        type="button"
        className={`page-tab ${page === "mc4c" ? "active" : ""}`}
        onClick={() => setPage("mc4c")}
      >
        MC-4c
      </button>
    </div>
  );

  // Fixed in the page corner (not in the header row) so it never changes the
  // row's shape -- the row must look identical on every trainer page.
  const dataActions = (
    <div className="data-actions">
      <button type="button" className="data-btn" onClick={exportBackup} title="Download all progress, stats, notes and settings as a file">
        Export data
      </button>
      <button type="button" className="data-btn" onClick={() => importInput.current?.click()} title="Load a previously exported data file">
        Import data
      </button>
      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
    </div>
  );

  return (
    <>
      {dataActions}
      {page === "eolrb" && <EOLRbTrainer pageTabs={pageTabs} />}
      {page === "bld" && <EOLRbBLDTrainer pageTabs={pageTabs} />}
      {page === "4c" && (
        <FourCTrainer
          generateCase={generate4cCase}
          pageId="4c"
          namespace="4c"
          title="4c Trainer"
          subtitle="Roux last-six-edges: the 17 fundamental 4c cases"
          pageTabs={pageTabs}
        />
      )}
      {page === "mc4c" && (
        <FourCTrainer
          generateCase={generateMc4cCase}
          pageId="mc4c"
          namespace="mc4c"
          title="MC-4c Trainer"
          subtitle="Roux last-six-edges: 4c with a corrective trailing M/M' turn"
          pageTabs={pageTabs}
        />
      )}
    </>
  );
}

export default App;
