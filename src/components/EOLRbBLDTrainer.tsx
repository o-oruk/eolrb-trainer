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
import {
  loadBLDStats,
  saveBLDStats,
  recordAttempt,
  totalStats,
  successPct,
  rateTier,
  type BLDCaseStats,
  type BLDStatsState,
} from "../lib/BLDStats";
import { loadJSON, saveJSON } from "../lib/Storage";
import { loadProgress, saveProgress, nextMasteryLevel, masteryLabel, masterySymbol, type ProgressState } from "../lib/Progress";
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

// Running yes/no tally since the last reset -- the BLD page's equivalent of
// the other pages' rep counter.
const SESSION_KEY = "eolrb-trainer-bld-session-v1";

type LastAttempt = { key: string; label: string; success: boolean };

function pctText(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

// Success/fail split bar: green for yes, red for no, empty track when the
// case hasn't been attempted.
function RateBar({ stats, className }: { stats: BLDCaseStats; className: string }) {
  const total = stats.yes + stats.no;
  const yesPct = total ? (stats.yes / total) * 100 : 0;
  const noPct = total ? (stats.no / total) * 100 : 0;
  return (
    <div className={className}>
      <div className="bld-bar-fill yes" style={{ width: `${yesPct}%` }} />
      <div className="bld-bar-fill no" style={{ width: `${noPct}%` }} />
    </div>
  );
}

type EOLRbBLDTrainerProps = {
  pageTabs: ReactNode;
};

function EOLRbBLDTrainer({ pageTabs }: EOLRbBLDTrainerProps) {
  const [enabled, setEnabled] = useState<Set<string>>(() => restoreEnabled(NAMESPACE));
  const [current, setCurrent] = useState<EOLRbCase | null>(() => caseForEnabled(restoreEnabled(NAMESPACE)));
  const [revealed, setRevealed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<BLDStatsState>(() => loadBLDStats());
  const [session, setSession] = useState<BLDCaseStats>(() => loadJSON(SESSION_KEY, { yes: 0, no: 0 }));
  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);
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
    saveBLDStats(stats);
  }, [stats]);

  useEffect(() => {
    saveJSON(SESSION_KEY, session);
  }, [session]);

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

  const next = (keys: Set<string> = enabled) => {
    setCurrent(caseForEnabled(keys));
    setRevealed(false);
  };

  // Yes/No log an attempt and move straight on, without revealing.
  const answer = (success: boolean) => {
    if (!currentKey || !currentLabel) return;
    setStats((s) => recordAttempt(s, currentKey, success));
    setSession((s) => (success ? { ...s, yes: s.yes + 1 } : { ...s, no: s.no + 1 }));
    setLastAttempt({ key: currentKey, label: currentLabel, success });
    next();
  };

  // Skipping doesn't count as having faced the case -- nothing is recorded.
  const skip = () => next();

  const undoLast = () => {
    if (!lastAttempt) return;
    const { key, success } = lastAttempt;
    setStats((s) => recordAttempt(s, key, success, -1));
    setSession((s) => (success ? { ...s, yes: Math.max(0, s.yes - 1) } : { ...s, no: Math.max(0, s.no - 1) }));
    setLastAttempt(null);
  };

  const resetSession = () => setSession({ yes: 0, no: 0 });

  const resetStats = () => {
    if (!window.confirm("Clear all blindfolded stats for every case (and the session tally)? This can't be undone.")) return;
    setStats({});
    setSession({ yes: 0, no: 0 });
    setLastAttempt(null);
  };

  // Wipes one case's record back to "never attempted". The session tally is
  // left alone -- it's a running count, not tied to specific cases.
  const clearCaseStats = (key: string, label: string) => {
    if (!window.confirm(`Clear blindfolded stats for "${label}"? This can't be undone.`)) return;
    setStats((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
    if (lastAttempt?.key === key) setLastAttempt(null);
  };

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

  // Keyboard: Y/N log success/failure and advance, S skips. Space reveals
  // the solutions; pressing it again once they're showing skips the case.
  // C/A open case selection/stats (re-pressing closes), H toggles the cube,
  // Escape closes any modal. Ignored while typing in a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen && nav.eoCase) {
          setNav(nav.parent ? { eoCase: nav.eoCase } : {});
          return;
        }
        setSettingsOpen(false);
        setStatsOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const modalOpen = settingsOpen || statsOpen;

      if (e.code === "Space") {
        if (e.repeat) return;
        e.preventDefault();
        if (modalOpen || !current) return;
        if (revealed) skip();
        else setRevealed(true);
        return;
      }

      if (e.code === "KeyY" || e.code === "KeyN" || e.code === "KeyS") {
        if (e.repeat || modalOpen || !current) return;
        if (e.code === "KeyS") skip();
        else answer(e.code === "KeyY");
        return;
      }

      if (e.code === "KeyC") {
        setSettingsOpen((v) => !v);
        setStatsOpen(false);
        return;
      }

      if (e.code === "KeyA") {
        setStatsOpen((v) => !v);
        setSettingsOpen(false);
        return;
      }

      if (e.code === "KeyH") {
        toggleShowCube();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const overall = totalStats(stats, ALL_KEYS);
  const overallPct = successPct(overall);
  const overallAttempts = overall.yes + overall.no;
  const triedCount = ALL_KEYS.filter((k) => stats[k]).length;
  const sessionPct = successPct(session);
  const countLevel = (level: string) => ALL_KEYS.filter((k) => progress[k] === level).length;
  const masteredCount = countLevel("mastered");
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
          <button
            className="settings-toggle pill-cases bld-cases-pill"
            onClick={() => setSettingsOpen(true)}
            title={`${enabled.size} of ${ALL_KEYS.length} cases selected for training`}
          >
            Cases: {enabled.size}/{ALL_KEYS.length}
            <span className="chevron">&#9662;</span>
          </button>
          <button
            className="settings-toggle progress-pill"
            onClick={() => {
              setNav({});
              setSettingsOpen(true);
            }}
            title="Mark learned cases in the case picker"
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
            Progress: {masteredCount}/{ALL_KEYS.length}
            <span className="chevron">&#9662;</span>
          </button>
          <button className="settings-toggle progress-pill bld-stats-pill" onClick={() => setStatsOpen(true)}>
            <span
              className="progress-pill-dot"
              style={
                {
                  "--pct-m": `${overallAttempts ? (overall.yes / overallAttempts) * 100 : 0}%`,
                  "--pct-l": `${overallAttempts ? (overall.yes / overallAttempts) * 100 : 0}%`,
                  "--pct-f": `${overallAttempts ? 100 : 0}%`,
                } as CSSProperties
              }
            />
            Stats: {pctText(overallPct)}
            <span className="chevron">&#9662;</span>
          </button>
          <button className="settings-toggle pill-cube" onClick={toggleShowCube}>
            {prefs.showCube ? "Hide cube" : "Show cube"}
          </button>
          <div className="rep-counter">
            <span className="settings-toggle rep-pill bld-session-pill">
              Session:
              <span className="bld-session-yes">{session.yes}✓</span>
              <span className="bld-session-no">{session.no}✗</span>
              {sessionPct !== null && <span className="rep-count-value">{sessionPct}%</span>}
            </span>
            <button className="rep-reset" onClick={resetSession} aria-label="Reset session tally" title="Reset session tally">
              &#8635;
            </button>
          </div>
        </div>
        <p className="keybind-hint">
          y: success &nbsp;·&nbsp; n: fail &nbsp;·&nbsp; s: skip &nbsp;·&nbsp; space: reveal, again to skip &nbsp;·&nbsp; c:
          cases &nbsp;·&nbsp; a: stats &nbsp;·&nbsp; h: hide cube
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
                {currentKey && <CaseRecord stats={stats[currentKey]} />}
                {currentKey && (
                  <button
                    type="button"
                    className={`mastery-toggle bld-case-mastery level-${progress[currentKey] ?? "none"}`}
                    onClick={() => cycleMastery(currentKey)}
                  >
                    <span className="mastery-check">{masterySymbol(progress[currentKey])}</span>
                    <span>{masteryLabel(progress[currentKey])}</span>
                  </button>
                )}
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
                <p className="solutions-placeholder">Space again to skip this case.</p>
              </>
            ) : (
              <p className="solutions-placeholder">
                Hidden while you solve blind. Press space to peek; pressing it again skips the case.
              </p>
            )}
          </div>
        )}
      </main>

      {current && (
        <div className="bld-answer-row">
          <div className="bld-answer-card">
            <span className="bld-answer-prompt">Success?</span>
            <div className="bld-answer-buttons">
              <button type="button" className="bld-answer yes" onClick={() => answer(true)}>
                Yes <kbd>Y</kbd>
              </button>
              <button type="button" className="bld-answer no" onClick={() => answer(false)}>
                No <kbd>N</kbd>
              </button>
              <button type="button" className="bld-answer skip" onClick={skip}>
                Skip <kbd>S</kbd>
              </button>
            </div>
          </div>
          <div className={`bld-last ${lastAttempt ? (lastAttempt.success ? "yes" : "no") : ""}`}>
            {lastAttempt ? (
              <>
                <span className="bld-last-mark">{lastAttempt.success ? "✓" : "✗"}</span>
                <span className="bld-last-label">
                  Logged {lastAttempt.success ? "success" : "fail"}: {lastAttempt.label}
                </span>
                <button type="button" className="text-button" onClick={undoLast}>
                  Undo
                </button>
              </>
            ) : (
              <span className="bld-last-label">Scramble your cube, put the blindfold on, and solve.</span>
            )}
          </div>
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
              stats={stats}
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

      {statsOpen && (
        <div className="modal-backdrop" onClick={() => setStatsOpen(false)}>
          <div className="modal-panel bld-stats-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Blindfolded stats</h2>
              <button className="modal-close" onClick={() => setStatsOpen(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="bld-summary">
                <div className="bld-summary-tile">
                  <span className="bld-summary-value">{overallAttempts}</span>
                  <span className="bld-summary-label">Attempts</span>
                </div>
                <div className="bld-summary-tile yes">
                  <span className="bld-summary-value">{overall.yes}</span>
                  <span className="bld-summary-label">Success</span>
                </div>
                <div className="bld-summary-tile no">
                  <span className="bld-summary-value">{overall.no}</span>
                  <span className="bld-summary-label">Fail</span>
                </div>
                <div className={`bld-summary-tile rate bld-rate-${rateTier(overallPct)}`}>
                  <span className="bld-summary-value">{pctText(overallPct)}</span>
                  <span className="bld-summary-label">Success rate</span>
                </div>
              </div>
              <div className="bld-summary-sub">
                <RateBar stats={overall} className="progress-bar-track" />
                <span>
                  {triedCount}/{ALL_KEYS.length} cases attempted
                </span>
              </div>

              {BLD_CASES.map((c) => {
                const keys = c.subcases.map((s) => comboKey({ eoCase: c.id, subcase: s.id }));
                const group = totalStats(stats, keys);
                const groupPct = successPct(group);
                return (
                  <div key={c.id} className="eo-case-group">
                    <div className="eo-case-header progress-header">
                      <span>{c.label}</span>
                      <span className={`case-count bld-rate-${rateTier(groupPct)}`}>
                        {group.yes + group.no > 0 ? `${group.yes}/${group.yes + group.no} · ${groupPct}%` : "—"}
                      </span>
                    </div>
                    <div className="bld-table" role="table">
                      <div className="bld-row bld-row-head" role="row">
                        <span role="columnheader">Case</span>
                        <span role="columnheader">Tries</span>
                        <span role="columnheader">Yes</span>
                        <span role="columnheader">No</span>
                        <span role="columnheader">Success</span>
                        <span role="columnheader" aria-label="Clear" />
                      </div>
                      {c.subcases.map((s, si) => {
                        const key = comboKey({ eoCase: c.id, subcase: s.id });
                        const st = stats[key];
                        const startsGroup = s.group && s.group !== c.subcases[si - 1]?.group;
                        const pct = st ? successPct(st) : null;
                        return (
                          <Fragment key={key}>
                            {startsGroup && (
                              <div className="bld-row bld-group-row" role="row">
                                <span role="cell">{s.group}</span>
                              </div>
                            )}
                            <div className={`bld-row ${st ? "" : "untried"} ${s.group ? "grouped" : ""}`} role="row">
                              <span className="bld-case" role="cell">{s.label}</span>
                              <span className="bld-num" role="cell">{st ? st.yes + st.no : "—"}</span>
                              <span className="bld-num yes" role="cell">{st ? st.yes : "—"}</span>
                              <span className="bld-num no" role="cell">{st ? st.no : "—"}</span>
                              <span className="bld-rate-cell" role="cell">
                                <span className={`bld-rate-text bld-rate-${rateTier(pct)}`}>{pctText(pct)}</span>
                                <RateBar stats={st ?? { yes: 0, no: 0 }} className="mini-bar-track bld-mini-bar" />
                              </span>
                              <span role="cell">
                                {st && (
                                  <button
                                    type="button"
                                    className="bld-row-clear"
                                    onClick={() => clearCaseStats(key, caseLabel(c.id, s.id))}
                                    aria-label={`Clear stats for ${s.label}`}
                                    title="Clear this case's stats"
                                  >
                                    &times;
                                  </button>
                                )}
                              </span>
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer progress-footer">
              <button type="button" className="bld-clear-button" onClick={resetStats} disabled={overallAttempts === 0}>
                Clear all stats
              </button>
              <button className="primary" onClick={() => setStatsOpen(false)}>
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
  stats,
  progress,
  cycleMastery,
  toggleKeys,
}: {
  nav: PickerNav;
  setNav: (n: PickerNav) => void;
  enabled: Set<string>;
  stats: BLDStatsState;
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
  const learnedIn = (keys: string[]) => keys.filter((k) => progress[k] === "mastered").length;

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
          const total = totalStats(stats, r.keys);
          const pct = successPct(total);
          const attempts = total.yes + total.no;
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
                    <span className={`picker-count ${learnedIn(r.keys) === r.keys.length ? "all-learned" : ""}`}>
                      {learnedIn(r.keys)}/{r.keys.length} learned
                    </span>
                  )}
                  <span className={`picker-rate bld-rate-${rateTier(pct)}`}>
                    {attempts ? `${pct}% · ${attempts} tries` : "not tried"}
                  </span>
                </span>
                {r.drill && <span className="picker-chevron" aria-hidden="true">&#8250;</span>}
              </button>
              {leafKey && (
                <button
                  type="button"
                  className={`mastery-toggle picker-mastery level-${level ?? "none"}`}
                  onClick={() => cycleMastery(leafKey)}
                  title="Click to cycle: still learning → learned → flagged → none"
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

// Compact "your record on this case" line under the case name.
function CaseRecord({ stats }: { stats: BLDCaseStats | undefined }) {
  if (!stats) return <div className="bld-case-record untried">First blind attempt at this case</div>;
  const pct = successPct(stats);
  return (
    <div className="bld-case-record">
      <span className="yes">{stats.yes}✓</span>
      <span className="no">{stats.no}✗</span>
      <span className={`bld-rate-${rateTier(pct)}`}>{pctText(pct)} blind</span>
    </div>
  );
}

export default EOLRbBLDTrainer;
