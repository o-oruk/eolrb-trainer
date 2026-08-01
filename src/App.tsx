import { useEffect, useState } from "react";
import { loadJSON, saveJSON } from "./lib/Storage";
import EOLRbTrainer from "./components/EOLRbTrainer";
import FourCTrainer from "./components/FourCTrainer";
import "./App.css";

type Page = "eolrb" | "4c";

const STORAGE_KEY = "trainer-active-page-v1";

function App() {
  const [page, setPage] = useState<Page>(() => loadJSON<Page>(STORAGE_KEY, "eolrb"));

  useEffect(() => {
    saveJSON(STORAGE_KEY, page);
  }, [page]);

  return (
    <>
      <div className="page-tabs">
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
      </div>
      {page === "eolrb" ? <EOLRbTrainer /> : <FourCTrainer />}
    </>
  );
}

export default App;
