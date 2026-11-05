import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { type EOLRbCase, type EOCaseId } from "../lib/EOLRbGenerator";
import {
  BLD_CASES,
  BLD_KEYS as ALL_KEYS,
  bldKey as comboKey,
  bldCaseLabel as caseLabel,
  restoreBLDEnabled as restoreEnabled,
  bldCaseForEnabled as caseForEnabled,
  bldParents,
} from "../lib/EOLRbBLDCases";
import { loadRepCount, saveRepCount } from "../lib/RepCount";
import { loadProgress, saveProgress, nextMasteryLevel, masteryLabel, masterySymbol, isLearned, type ProgressState } from "../lib/Progress";
import { saveSelection } from "../lib/Selection";
import { loadSettings, saveSettings, type Settings } from "../lib/Settings";
import { colorSchemeFor, validFrontsFor, COLOR_LETTERS, COLOR_NAMES, type ColorLetter } from "../lib/ColorScheme";
import { CubieCube, FaceletCube } from "../lib/CubeLib";
import { Face } from "../lib/Defs";
import CubeSim from "./CubeSim";
import "../App.css";

// Same hidden-face hint convention as the sighted EOLRb trainer.
const HINT_FACES = [Face.L, Face.B, Face.D];
const HINT_DISTANCE = 3;

const SOLVED_FACELET = FaceletCube.from_cubie(new CubieCube());

// Selection is tracked separately from the sighted EOLRb page, so e.g. you
// can drill everything sighted but only a few cases blind.
const NAMESPACE = "bld";

type EOLRbBLDTrainerProps = {
  pageTabs: ReactNode;
};

function EOLRbBLDTrainer({ pageTabs }: EOLRbBLDTrainerProps) {
  const [enabled, setEnabled] = useState<Set<string>>(() => restoreEnabled(NAMESPACE));
  const [current, setCurrent] = useState<EOLRbCase | null>(() => caseForEnabled(restoreEnabled(NAMESPACE)));
  const [revealed, setRevealed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repCount, setRepCount] = useState<number>(() => loadRepCount(NAMESPACE));
  const [prefs, setPrefs] = useState<Settings>(() => loadSettings());
  // How well each BLD case is learned -- same four levels as the sighted
  // EOLRb trainer, tracked separately.
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress(NAMESPACE));
  // Where the case picker is drilled to: all EO cases -> one EO case's
  // sighted subcases -> one sighted subcase's BLD refinements.
  const [nav, setNav] = useState<PickerNav>({});

  const facelet = useMemo(() => (current ? FaceletCube.from_cubie(current.cube) : SOLVED_FACELET), [current]);
  const colorScheme = useMemo(
    () => colorSchemeFor(prefs.topColor, prefs.frontColor),
    [prefs.topColor, prefs.frontColor]
  );

  useEffect(() => {
    saveRepCount(NAMESPACE, repCount);
  }, [repCount]);

  useEffect(() => {
    saveSelection(Array.from(enabled), NAMESPACE);
  }, [enabled]);

  useEffect(() => {
    saveSettings(prefs);
  }, [prefs]);

  useEffect(() => {
    saveProgress(progress, NAMESPACE);
  }, [progress]);

  const cycleMastery = (key: string) => {
    setProgress((prev) => {
      const level = nextMasteryLevel(prev[key]);
      const updated = { ...prev };
      if (level) updated[key] = level;
      else delete updated[key];
      return updated;
    });
  };

  const currentKey = current ? comboKey({ eoCase: current.eoCase, subcase: current.subcase }) : null;
  const currentLabel = current ? caseLabel(current.eoCase, current.subcase) : null;
  const currentLevel = currentKey ? progress[currentKey] : undefined;

  const next = (keys: Set<string> = enabled) => {
    setCurrent(caseForEnabled(keys));
    setRevealed(false);
  };

  const nextRep = () => {
    next();
    setRepCount((c) => c + 1);
  };

  const resetRepCount = () => setRepCount(0);

  // Turns a set of cases all on, or all off if they already are.
  const toggleKeys = (keys: string[]) => {
    const allOn = keys.every((k) => enabled.has(k));
    const nextEnabled = new Set(enabled);
    if (allOn) keys.forEach((k) => nextEnabled.delete(k));
    else keys.forEach((k) => nextEnabled.add(k));
    setEnabled(nextEnabled);
    next(nextEnabled);
  };

  const toggleShowMoveCount = () => {
    setPrefs((p) => ({ ...p, showMoveCount: !p.showMoveCount }));
  };

  const toggleShowCube = () => {
    setPrefs((p) => ({ ...p, showCube: !p.showCube }));
  };

  const setTopColor = (top: ColorLetter) => {
    setPrefs((p) => {
      const validFronts = validFrontsFor(top);
      const frontColor = validFronts.includes(p.frontColor) ? p.frontColor : validFronts[0];
      return { ...p, topColor: top, frontColor };
    });
  };

  const setFrontColor = (frontColor: ColorLetter) => {
    setPrefs((p) => ({ ...p, frontColor }));
  };

  // Keyboard: space reveals the solutions, then moves to the next case. C
  // opens case selection (re-pressing closes), H toggles the cube, Escape
  // steps back in / closes the picker. Ignored while typing in a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen && nav.eoCase) {
          setNav(nav.parent ? { eoCase: nav.eoCase } : {});
          return;
        }
        setSettingsOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const modalOpen = settingsOpen;

      if (e.code === "Space") {
        if (e.repeat) return;
        e.preventDefault();
        if (modalOpen || !current) return;
        if (revealed) nextRep();
        else setRevealed(true);
        return;
      }

      if (e.code === "KeyC") {
        setSettingsOpen((v) => !v);
        return;
      }

      if (e.code === "KeyH") {
        toggleShowCube();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const countLevel = (level: string) => ALL_KEYS.filter((k) => progress[k] === level).length;
  const masteredCount = countLevel("mastered");
  const learnedCount = ALL_KEYS.filter((k) => isLearned(progress[k])).length;
  const masteredPct = Math.round((masteredCount / ALL_KEYS.length) * 100);
  const learningPct = Math.round((countLevel("learning") / ALL_KEYS.length) * 100);
  const flaggedPct = Math.round((countLevel("flagged") / ALL_KEYS.length) * 100);

  return (
    <div id="page">
      <header>
        <h1>EOLRb BLD Trainer</h1>
        <p className="subtitle">Roux last-six-edges: EO + LR, solved blindfolded</p>
        <div className="header-actions">
          {pageTabs}
          <div className="tab-divider" />
          <button className="settings-toggle pill-cases" onClick={() => setSettingsOpen(true)}>
            Cases: {enabled.size}/{ALL_KEYS.length} selected
            <span className="chevron">&#9662;</span>
          </button>
          <button
            className="settings-toggle progress-pill"
            onClick={() => {
              setNav({});
              setSettingsOpen(true);
            }}
            title={`${learnedCount} learned (${masteredCount} mastered) -- mark cases in the case picker`}
          >
            <span
              className="progress-pill-dot"
              style={
                {
                  "--pct-m": `${masteredPct}%`,
                  "--pct-l": `${masteredPct + learningPct}%`,
                  "--pct-f": `${masteredPct + learningPct + flaggedPct}%`,
                } as CSSProperties
              }
            />
            Learned: {learnedCount}/{ALL_KEYS.length}
            <span className="chevron">&#9662;</span>
          </button>
          <button className="settings-toggle pill-cube" onClick={toggleShowCube}>
            {prefs.showCube ? "Hide cube" : "Show cube"}
          </button>
          <div className="rep-counter">
            <span className="settings-toggle rep-pill">
              Reps: <span className="rep-count-value">{repCount}</span>
            </span>
            <button className="rep-reset" onClick={resetRepCount} aria-label="Reset rep counter" title="Reset rep counter">
              &#8635;
            </button>
          </div>
        </div>
        <p className="keybind-hint">
          space: reveal / next case &nbsp;·&nbsp; c: cases &nbsp;·&nbsp; h: hide cube
        </p>
      </header>

      <main>
        {prefs.showCube && (
          <div className="cube-panel-wrap">
            <div className="cube-panel">
              <CubeSim
                width={300}
                height={300}
                cube={facelet}
                colorScheme={colorScheme}
                theme="dark"
                facesToReveal={HINT_FACES}
                hintDistance={HINT_DISTANCE}
              />
            </div>
            <div className="orientation-picker">
              <label>
                Top
                <select value={prefs.topColor} onChange={(e) => setTopColor(e.target.value as ColorLetter)}>
                  {COLOR_LETTERS.map((c) => (
                    <option key={c} value={c}>{COLOR_NAMES[c]}</option>
                  ))}
                </select>
              </label>
              <label>
                Front
                <select value={prefs.frontColor} onChange={(e) => setFrontColor(e.target.value as ColorLetter)}>
                  {validFrontsFor(prefs.topColor).map((c) => (
                    <option key={c} value={c}>{COLOR_NAMES[c]}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="info-panel">
          {current ? (
            <>
              <div className="card">
                <div className="card-label">Case</div>
                <div className="case-name">{currentLabel}</div>
              </div>

              <div className="card">
                <div className="card-label">Scramble</div>
                <div className="scramble">{current.scramble}</div>
              </div>

              <div className="stat-row">
                <label className="stat-toggle">
                  <input type="checkbox" checked={prefs.showMoveCount} onChange={toggleShowMoveCount} />
                  <span className="stat-label">Minimum moves</span>
                </label>
                {prefs.showMoveCount ? (
                  <span className="stat-value">{current.minMoves}</span>
                ) : (
                  <span className="stat-value stat-value-hidden">hidden</span>
                )}
              </div>
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

        {current && (
          <div className="solutions-panel">
            <div className="card-label">Solutions</div>
            {revealed ? (
              <>
                <ol>
                  {current.solutions.map((sol, i) => (
                    <li key={i}>
                      <span className="move-count">({sol.moveCount})</span> {sol.alg}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="solutions-placeholder">
                Hidden while you solve blind. Press space to reveal; press it again for the next case.
              </p>
            )}
          </div>
        )}
      </main>

      {current && (
        <div className="action-row bld-action-row">
          <button
            type="button"
            className={`mastery-toggle level-${currentLevel ?? "none"}`}
            onClick={() => cycleMastery(currentKey!)}
          >
            <span className="mastery-check">{masterySymbol(currentLevel)}</span>
            <span>{masteryLabel(currentLevel)}</span>
          </button>
          {!revealed ? (
            <button className="primary action-primary" onClick={() => setRevealed(true)}>
              Reveal solutions
            </button>
          ) : (
            <button className="primary action-primary" onClick={nextRep}>
              Next case
            </button>
          )}
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cases to train blind</h2>
              <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <CasePicker
              nav={nav}
              setNav={setNav}
              enabled={enabled}
              progress={progress}
              cycleMastery={cycleMastery}
              toggleKeys={toggleKeys}
            />
            <div className="modal-footer">
              <button className="primary" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

type PickerNav = { eoCase?: EOCaseId; parent?: string };

type PickerRow = {
  id: string;
  label: string;
  keys: string[];
  // Drilling target; absent = a leaf row, where clicking toggles instead.
  drill?: PickerNav;
};

// Three-level drill-down: EO cases -> sighted subcases -> BLD refinements.
// Each row has a tri-state check (toggles everything under it) and, unless
// it's a leaf, opens the next level when clicked.
function CasePicker({
  nav,
  setNav,
  enabled,
  progress,
  cycleMastery,
  toggleKeys,
}: {
  nav: PickerNav;
  setNav: (n: PickerNav) => void;
  enabled: Set<string>;
  progress: ProgressState;
  cycleMastery: (key: string) => void;
  toggleKeys: (keys: string[]) => void;
}) {
  const eoDef = nav.eoCase ? BLD_CASES.find((c) => c.id === nav.eoCase) : undefined;
  const parents = eoDef ? bldParents(eoDef) : [];
  const parentDef = nav.parent ? parents.find((p) => p.parent === nav.parent) : undefined;

  const keysOf = (eoCase: EOCaseId, subcases: { id: string }[]) =>
    subcases.map((s) => comboKey({ eoCase, subcase: s.id }));

  let rows: PickerRow[];
  if (eoDef && parentDef) {
    rows = parentDef.subcases.map((s) => ({ id: s.id, label: s.label, keys: keysOf(eoDef.id, [s]) }));
  } else if (eoDef) {
    rows = parents.map((p) => ({
      id: p.parent,
      label: p.label,
      keys: keysOf(eoDef.id, p.subcases),
      drill: p.subcases.length > 1 ? { eoCase: eoDef.id, parent: p.parent } : undefined,
    }));
  } else {
    rows = BLD_CASES.map((c) => ({ id: c.id, label: c.label, keys: keysOf(c.id, c.subcases), drill: { eoCase: c.id } }));
  }

  const levelKeys = rows.flatMap((r) => r.keys);
  const levelOn = levelKeys.filter((k) => enabled.has(k)).length;
  const levelAll = levelOn === levelKeys.length;
  const learnedIn = (keys: string[]) => keys.filter((k) => isLearned(progress[k])).length;
  const allMastered = (keys: string[]) => keys.every((k) => progress[k] === "mastered");

  const crumbs: { label: string; to: PickerNav }[] = [{ label: "All cases", to: {} }];
  if (eoDef) crumbs.push({ label: eoDef.label, to: { eoCase: eoDef.id } });
  if (eoDef && parentDef) crumbs.push({ label: parentDef.label, to: { eoCase: eoDef.id, parent: parentDef.parent } });

  return (
    <div className="modal-body picker-body">
      <div className="picker-toolbar">
        {crumbs.length > 1 && (
          <button
            type="button"
            className="picker-back"
            onClick={() => setNav(crumbs[crumbs.length - 2].to)}
            aria-label="Back"
            title="Back (Esc)"
          >
            &#8249;
          </button>
        )}
        <nav className="picker-crumbs" aria-label="Case level">
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="picker-crumb-sep">&#8250;</span>}
              {i === crumbs.length - 1 ? (
                <span className="picker-crumb current">{c.label}</span>
              ) : (
                <button type="button" className="picker-crumb" onClick={() => setNav(c.to)}>
                  {c.label}
                </button>
              )}
            </Fragment>
          ))}
        </nav>
        <span className="picker-total">
          {learnedIn(levelKeys)}/{levelKeys.length} learned
        </span>
        <button type="button" className="text-button picker-all" onClick={() => toggleKeys(levelKeys)}>
          {levelAll ? "Select none" : "Select all"}
        </button>
      </div>

      <ul className="picker-list">
        {rows.map((r) => {
          const on = r.keys.filter((k) => enabled.has(k)).length;
          const state = on === 0 ? "off" : on === r.keys.length ? "on" : "partial";
          const onRow = () => (r.drill ? setNav(r.drill) : toggleKeys(r.keys));
          // A single case (no deeper level) gets its own learned marker;
          // groups show how many cases inside are learned.
          const leafKey = !r.drill && r.keys.length === 1 ? r.keys[0] : null;
          const level = leafKey ? progress[leafKey] : undefined;
          return (
            <li key={r.id} className={`picker-row ${state} ${level ? `level-${level}` : ""}`}>
              <button
                type="button"
                className={`picker-check ${state}`}
                role="checkbox"
                aria-checked={state === "partial" ? "mixed" : state === "on"}
                aria-label={`Train ${r.label}`}
                onClick={() => toggleKeys(r.keys)}
              >
                {state === "on" ? "✓" : state === "partial" ? "–" : ""}
              </button>
              <button type="button" className="picker-main" onClick={onRow}>
                <span className="picker-label">{r.label}</span>
                <span className="picker-meta">
                  {r.keys.length > 1 && (
                    <span className={`picker-count ${allMastered(r.keys) ? "all-learned" : ""}`}>
                      {learnedIn(r.keys)}/{r.keys.length} learned
                    </span>
                  )}
                </span>
                {r.drill && <span className="picker-chevron" aria-hidden="true">&#8250;</span>}
              </button>
              {leafKey && (
                <button
                  type="button"
                  className={`mastery-toggle picker-mastery level-${level ?? "none"}`}
                  onClick={() => cycleMastery(leafKey)}
                  title="Click to cycle: still learning → mastered → flagged → none"
                >
                  <span className="mastery-check">{masterySymbol(level)}</span>
                  <span>{level ? masteryLabel(level) : "Not learned"}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default EOLRbBLDTrainer;
