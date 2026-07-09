import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  generateCase,
  EO_CASES,
  allCombos,
  type EOLRbCase,
  type EOCaseId,
  type EnabledCombo,
} from "./lib/EOLRbGenerator";
import { loadProgress, saveProgress, nextMasteryLevel, type ProgressState, type MasteryLevel } from "./lib/Progress";
import { loadSelection, saveSelection } from "./lib/Selection";
import { loadSettings, saveSettings, type Settings } from "./lib/Settings";
import { CubieCube, FaceletCube } from "./lib/CubeLib";
import { Face } from "./lib/Defs";
import CubeSim from "./components/CubeSim";
import "./App.css";

// Onionhoney reveals the hidden L/B/D faces as floating "hint" stickers in
// EOLR/4c mode, with hintDistance=3 (vs. 7 for other modes).
const HINT_FACES = [Face.L, Face.B, Face.D];
const HINT_DISTANCE = 3;

// White-up / Green-front (WCA standard), in U,D,F,B,L,R,X order.
const COLOR_SCHEME = ["#ffffff", "#ffff00", "#00b500", "#0000ff", "#ff8800", "#ff0000", "#bfbfbf"];
const SOLVED_FACELET = FaceletCube.from_cubie(new CubieCube());

function comboKey(c: EnabledCombo): string {
  return `${c.eoCase}::${c.subcase}`;
}

const ALL_COMBOS = allCombos();
const ALL_KEYS = ALL_COMBOS.map(comboKey);

function combosForKeys(keys: Set<string>): EnabledCombo[] {
  return ALL_COMBOS.filter((c) => keys.has(comboKey(c)));
}

// First visit (nothing saved yet) defaults to everything selected. A saved
// selection -- even an empty one -- is honored exactly, since "nothing
// selected" is now a deliberate, supported state.
function restoreEnabled(): Set<string> {
  const saved = loadSelection();
  if (saved === null) return new Set(ALL_KEYS);
  return new Set(saved.filter((k) => ALL_KEYS.includes(k)));
}

function caseForEnabled(keys: Set<string>): EOLRbCase | null {
  return keys.size > 0 ? generateCase(combosForKeys(keys)) : null;
}

function progressMessage(percent: number): string {
  if (percent >= 100) return "Every case mastered!";
  if (percent >= 75) return "Almost there — keep going!";
  if (percent >= 50) return "Halfway there!";
  if (percent >= 25) return "Good momentum!";
  if (percent > 0) return "Nice start!";
  return "Ready when you are.";
}

function levelLabel(level: MasteryLevel | undefined): string {
  if (level === "mastered") return "Learned";
  if (level === "learning") return "Still learning";
  return "Mark progress";
}

function App() {
  const [enabled, setEnabled] = useState<Set<string>>(() => restoreEnabled());
  const [current, setCurrent] = useState<EOLRbCase | null>(() => caseForEnabled(restoreEnabled()));
  const [revealed, setRevealed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [prefs, setPrefs] = useState<Settings>(() => loadSettings());

  const facelet = useMemo(() => (current ? FaceletCube.from_cubie(current.cube) : SOLVED_FACELET), [current]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    saveSelection(Array.from(enabled));
  }, [enabled]);

  useEffect(() => {
    saveSettings(prefs);
  }, [prefs]);

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
    setCurrent(caseForEnabled(keys));
    setRevealed(false);
  };

  const toggleCombo = (key: string) => {
    const nextEnabled = new Set(enabled);
    if (nextEnabled.has(key)) {
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
    } else {
      keys.forEach((k) => nextEnabled.add(k));
    }
    setEnabled(nextEnabled);
    next(nextEnabled);
  };

  const cycleMastery = (key: string) => {
    setProgress((prev) => {
      const level = nextMasteryLevel(prev[key]);
      const updated = { ...prev };
      if (level) updated[key] = level;
      else delete updated[key];
      return updated;
    });
  };

  const resetProgress = () => {
    if (!window.confirm("Clear all mastery progress? This can't be undone.")) return;
    setProgress({});
  };

  const toggleShowMoveCount = () => {
    setPrefs((p) => ({ ...p, showMoveCount: !p.showMoveCount }));
  };

  const currentKey = current ? comboKey({ eoCase: current.eoCase, subcase: current.subcase }) : null;
  const currentLevel = currentKey ? progress[currentKey] : undefined;
  const masteredCount = ALL_KEYS.filter((k) => progress[k] === "mastered").length;
  const learningCount = ALL_KEYS.filter((k) => progress[k] === "learning").length;
  const masteredPct = Math.round((masteredCount / ALL_KEYS.length) * 100);
  const learningPct = Math.round((learningCount / ALL_KEYS.length) * 100);

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
            <span className="progress-pill-dot" style={{ "--pct-m": `${masteredPct}%`, "--pct-l": `${masteredPct + learningPct}%` } as CSSProperties} />
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
          {current ? (
            <>
              <div className="card">
                <div className="card-label">Scramble</div>
                <div className="scramble">{current.scramble}</div>
              </div>

              <div className="stat-row">
                <label className="stat-toggle">
                  <input
                    type="checkbox"
                    checked={prefs.showMoveCount}
                    onChange={toggleShowMoveCount}
                  />
                  <span className="stat-label">Minimum moves</span>
                </label>
                {prefs.showMoveCount ? (
                  <span className="stat-value">{current.minMoves}</span>
                ) : (
                  <span className="stat-value stat-value-hidden">hidden</span>
                )}
              </div>

              <button
                type="button"
                className={`mastery-toggle level-${currentLevel ?? "none"}`}
                onClick={() => cycleMastery(currentKey!)}
              >
                <span className="mastery-check">
                  {currentLevel === "mastered" ? "✓" : currentLevel === "learning" ? "~" : ""}
                </span>
                <span>{levelLabel(currentLevel)}</span>
              </button>

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
            </>
          ) : (
            <div className="card empty-state">
              <div className="card-label">No cases selected</div>
              <p>Pick at least one case to start training.</p>
              <button className="primary" onClick={() => setSettingsOpen(true)}>
                Choose cases
              </button>
            </div>
          )}
        </div>
      </main>

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
                        const level = progress[key];
                        return (
                          <label
                            key={key}
                            className={`toggle-chip ${enabled.has(key) ? "on" : ""} ${level ? `level-${level}` : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled.has(key)}
                              onChange={() => toggleCombo(key)}
                            />
                            {level && (
                              <span className="toggle-chip-badge">
                                {level === "mastered" ? "✓" : "~"}
                              </span>
                            )}
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
              <div className={`overall-progress ${masteredPct >= 100 ? "complete" : ""}`}>
                <div className="overall-progress-top">
                  <span className="overall-progress-count">{masteredCount}/{ALL_KEYS.length} learned</span>
                  <span className="overall-progress-pct">{masteredPct}%</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill mastered" style={{ width: `${masteredPct}%` }} />
                  <div className="progress-bar-fill learning" style={{ width: `${learningPct}%` }} />
                </div>
                {learningCount > 0 && (
                  <div className="overall-progress-sub">{learningCount} still in progress</div>
                )}
                <div className="overall-progress-message">{progressMessage(masteredPct)}</div>
              </div>

              {EO_CASES.map((c) => {
                const keys = c.subcases.map((s) => comboKey({ eoCase: c.id, subcase: s.id }));
                const caseMastered = keys.filter((k) => progress[k] === "mastered").length;
                const caseLearning = keys.filter((k) => progress[k] === "learning").length;
                const caseMasteredPct = Math.round((caseMastered / keys.length) * 100);
                const caseLearningPct = Math.round((caseLearning / keys.length) * 100);
                return (
                  <div key={c.id} className="eo-case-group">
                    <div className="eo-case-header progress-header">
                      <span>{c.label}</span>
                      <span className={`case-count ${caseMasteredPct >= 100 ? "done" : ""}`}>
                        {caseMastered}/{keys.length} {caseMasteredPct >= 100 && "✓"}
                      </span>
                    </div>
                    <div className="mini-bar-track">
                      <div className="mini-bar-fill mastered" style={{ width: `${caseMasteredPct}%` }} />
                      <div className="mini-bar-fill learning" style={{ width: `${caseLearningPct}%` }} />
                    </div>
                    <div className="checklist">
                      {c.subcases.map((s) => {
                        const key = comboKey({ eoCase: c.id, subcase: s.id });
                        const level = progress[key];
                        return (
                          <button
                            type="button"
                            key={key}
                            className={`checklist-item ${level ? `level-${level}` : ""}`}
                            onClick={() => cycleMastery(key)}
                          >
                            <span className="checklist-check">
                              {level === "mastered" ? "✓" : level === "learning" ? "~" : ""}
                            </span>
                            <span className="checklist-label">{s.label}</span>
                            <span className="chip-detail">{s.detail}</span>
                          </button>
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
