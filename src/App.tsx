import { useEffect, useState } from "react";
import { loadJSON, saveJSON } from "./lib/Storage";
import EOLRbTrainer from "./components/EOLRbTrainer";
import FourCTrainer from "./components/FourCTrainer";
import { generateCase as generate4cCase } from "./lib/FourCGenerator";
import { generateCase as generateMc4cCase } from "./lib/MC4CGenerator";
import "./App.css";

type Page = "eolrb" | "4c" | "mc4c";

const STORAGE_KEY = "trainer-active-page-v1";

function App() {
  const [page, setPage] = useState<Page>(() => loadJSON<Page>(STORAGE_KEY, "eolrb"));

  useEffect(() => {
    saveJSON(STORAGE_KEY, page);
  }, [page]);

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

  return (
    <>
      {page === "eolrb" && <EOLRbTrainer pageTabs={pageTabs} />}
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
