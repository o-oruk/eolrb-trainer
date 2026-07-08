import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  generateCase,
  EO_CASES,
  allCombos,
  type EOLRbCase,
  type EOCaseId,
  type EnabledCombo,
} from "./lib/EOLRbGenerator";
import { loadProgress, saveProgress, type ProgressState } from "./lib/Progress";
import { FaceletCube } from "./lib/CubeLib";
import { Face } from "./lib/Defs";
import CubeSim from "./components/CubeSim";
import "./App.css";

// Onionhoney reveals the hidden L/B/D faces as floating "hint" stickers in
// EOLR/4c mode, with hintDistance=3 (vs. 7 for other modes).
const HINT_FACES = [Face.L, Face.B, Face.D];
const HINT_DISTANCE = 3;

// White-up / Green-front (WCA standard), in U,D,F,B,L,R,X order.
const COLOR_SCHEME = ["#ffffff", "#ffff00", "#00b500", "#0000ff", "#ff8800", "#ff0000", "#bfbfbf"];

function comboKey(c: EnabledCombo): string {
  return `${c.eoCase}::${c.subcase}`;
}

const ALL_COMBOS = allCombos();
const ALL_KEYS = ALL_COMBOS.map(comboKey);

function combosForKeys(keys: Set<string>): EnabledCombo[] {
  return ALL_COMBOS.filter((c) => keys.has(comboKey(c)));
}

function progressMessage(percent: number): string {
  if (percent >= 100) return "Every case mastered!";
  if (percent >= 75) return "Almost there — keep going!";
  if (percent >= 50) return "Halfway there!";
  if (percent >= 25) return "Good momentum!";
  if (percent > 0) return "Nice start!";
  return "Ready when you are.";
}

function App() {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(ALL_KEYS));
  const [current, setCurrent] = useState<EOLRbCase>(() => generateCase(ALL_COMBOS));
  const [revealed, setRevealed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());

  const facelet = useMemo(() => FaceletCube.from_cubie(current.cube), [current]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    if (!settingsOpen && !progressOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSettingsOpen(false);
      setProgressOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, progressOpen]);

  const next = (keys: Set<string> = enabled) => {
    setCurrent(generateCase(combosForKeys(keys)));
    setRevealed(false);
  };

  const toggleCombo = (key: string) => {
    const nextEnabled = new Set(enabled);
    if (nextEnabled.has(key)) {
      if (nextEnabled.size === 1) return; // keep at least one selected
      nextEnabled.delete(key);
    } else {
      nextEnabled.add(key);
    }
    setEnabled(nextEnabled);
    next(nextEnabled);
  };

  const toggleEOCase = (eoCase: EOCaseId) => {
    const def = EO_CASES.find((c) => c.id === eoCase)!;
    const keys = def.subcases.map((s) => comboKey({ eoCase, subcase: s.id }));
    const allOn = keys.every((k) => enabled.has(k));
    const nextEnabled = new Set(enabled);
    if (allOn) {
      keys.forEach((k) => nextEnabled.delete(k));
      if (nextEnabled.size === 0) return; // keep at least one selected
    } else {
      keys.forEach((k) => nextEnabled.add(k));
    }
    setEnabled(nextEnabled);
    next(nextEnabled);
  };

  const toggleMastered = (key: string) => {
    setProgress((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetProgress = () => {
    if (!window.confirm("Clear all mastery progress? This can't be undone.")) return;
    setProgress({});
  };

  const currentKey = comboKey({ eoCase: current.eoCase, subcase: current.subcase });
  const currentMastered = !!progress[currentKey];
  const masteredCount = ALL_KEYS.filter((k) => progress[k]).length;
  const percent = Math.round((masteredCount / ALL_KEYS.length) * 100);

  return (
    <div id="page">
      <header>
        <h1>EOLRb Trainer</h1>
        <p className="subtitle">Roux last-six-edges: EO + LR insertion</p>
        <div className="header-actions">
          <button className="settings-toggle" onClick={() => setSettingsOpen(true)}>
            Cases: {enabled.size}/{ALL_KEYS.length} selected
            <span className="chevron">&#9662;</span>
          </button>
          <button className="settings-toggle progress-pill" onClick={() => setProgressOpen(true)}>
            <span className="progress-pill-dot" style={{ "--pct": `${percent}%` } as CSSProperties} />
            Progress: {masteredCount}/{ALL_KEYS.length}
            <span className="chevron">&#9662;</span>
          </button>
        </div>
      </header>

      <main>
        <div className="cube-panel">
          <CubeSim
            width={300}
            height={300}
            cube={facelet}
            colorScheme={COLOR_SCHEME}
            theme="dark"
            facesToReveal={HINT_FACES}
            hintDistance={HINT_DISTANCE}
          />
        </div>

        <div className="info-panel">
          <div className="card">
            <div className="card-label">Scramble</div>
            <div className="scramble">{current.scramble}</div>
          </div>

          <div className="stat-row">
            <span className="stat-label">Minimum moves</span>
            <span className="stat-value">{current.minMoves}</span>
          </div>

          <label className={`mastery-toggle ${currentMastered ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={currentMastered}
              onChange={() => toggleMastered(currentKey)}
            />
            <span className="mastery-check">&#10003;</span>
            <span>{currentMastered ? "Learned" : "Mark this case as learned"}</span>
          </label>

          <div className="controls">
            {!revealed ? (
              <button className="primary" onClick={() => setRevealed(true)}>
                Reveal solutions
              </button>
            ) : (
              <button className="primary" onClick={() => next()}>
                Next case
              </button>
            )}
          </div>

          {revealed && (
            <div className="card solutions">
              <div className="card-label">Solutions</div>
              <ol>
                {current.solutions.map((sol, i) => (
                  <li key={i}>
                    <span className="move-count">({sol.moveCount})</span> {sol.alg}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </main>

      <footer>
        Start position: both blocks, all corners, and the middle-layer centers
        solved (or one M2 away). Apply the scramble from there.
      </footer>

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cases to train</h2>
              <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="modal-body">
              {EO_CASES.map((c) => {
                const keys = c.subcases.map((s) => comboKey({ eoCase: c.id, subcase: s.id }));
                const allOn = keys.every((k) => enabled.has(k));
                const anyOn = keys.some((k) => enabled.has(k));
                return (
                  <div key={c.id} className="eo-case-group">
                    <label className={`eo-case-header ${allOn ? "on" : anyOn ? "partial" : ""}`}>
                      <input type="checkbox" checked={allOn} onChange={() => toggleEOCase(c.id)} />
                      <span>{c.label}</span>
                    </label>
                    <div className="toggle-row">
                      {c.subcases.map((s) => {
                        const key = comboKey({ eoCase: c.id, subcase: s.id });
                        return (
                          <label key={key} className={`toggle-chip ${enabled.has(key) ? "on" : ""}`}>
                            <input
                              type="checkbox"
                              checked={enabled.has(key)}
                              onChange={() => toggleCombo(key)}
                            />
                            <span className="chip-label">{s.label}</span>
                            <span className="chip-detail">{s.detail}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <button className="primary" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {progressOpen && (
        <div className="modal-backdrop" onClick={() => setProgressOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Your progress</h2>
              <button className="modal-close" onClick={() => setProgressOpen(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className={`overall-progress ${percent >= 100 ? "complete" : ""}`}>
                <div className="overall-progress-top">
                  <span className="overall-progress-count">{masteredCount}/{ALL_KEYS.length}</span>
                  <span className="overall-progress-pct">{percent}%</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
                </div>
                <div className="overall-progress-message">{progressMessage(percent)}</div>
              </div>

              {EO_CASES.map((c) => {
                const keys = c.subcases.map((s) => comboKey({ eoCase: c.id, subcase: s.id }));
                const caseMastered = keys.filter((k) => progress[k]).length;
                const casePercent = Math.round((caseMastered / keys.length) * 100);
                return (
                  <div key={c.id} className="eo-case-group">
                    <div className="eo-case-header progress-header">
                      <span>{c.label}</span>
                      <span className={`case-count ${casePercent >= 100 ? "done" : ""}`}>
                        {caseMastered}/{keys.length} {casePercent >= 100 && "✓"}
                      </span>
                    </div>
                    <div className="mini-bar-track">
                      <div className="mini-bar-fill" style={{ width: `${casePercent}%` }} />
                    </div>
                    <div className="checklist">
                      {c.subcases.map((s) => {
                        const key = comboKey({ eoCase: c.id, subcase: s.id });
                        const mastered = !!progress[key];
                        return (
                          <label key={key} className={`checklist-item ${mastered ? "on" : ""}`}>
                            <input
                              type="checkbox"
                              checked={mastered}
                              onChange={() => toggleMastered(key)}
                            />
                            <span className="checklist-check">&#10003;</span>
                            <span className="checklist-label">{s.label}</span>
                            <span className="chip-detail">{s.detail}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer progress-footer">
              <button className="text-button" onClick={resetProgress}>
                Reset progress
              </button>
              <button className="primary" onClick={() => setProgressOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
