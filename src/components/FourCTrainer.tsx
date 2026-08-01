import { useEffect, useMemo, useState } from "react";
import { generate4cCase, type FourCCase } from "../lib/FourCGenerator";
import { loadRepCount, saveRepCount } from "../lib/RepCount";
import { loadSettings, saveSettings, type Settings } from "../lib/Settings";
import { colorSchemeFor, validFrontsFor, COLOR_LETTERS, COLOR_NAMES, type ColorLetter } from "../lib/ColorScheme";
import { FaceletCube } from "../lib/CubeLib";
import { Face } from "../lib/Defs";
import CubeSim from "./CubeSim";
import "../App.css";

// Same hidden-face hint convention as the EOLRb trainer -- this is the next
// step in the same LSE sequence.
const HINT_FACES = [Face.L, Face.B, Face.D];
const HINT_DISTANCE = 3;

const PAGE_ID = "4c";

function FourCTrainer() {
  const [current, setCurrent] = useState<FourCCase | null>(() => generate4cCase());
  const [revealed, setRevealed] = useState(false);
  const [prefs, setPrefs] = useState<Settings>(() => loadSettings());
  const [repCount, setRepCount] = useState<number>(() => loadRepCount(PAGE_ID));

  const facelet = useMemo(() => (current ? FaceletCube.from_cubie(current.cube) : null), [current]);
  const colorScheme = useMemo(
    () => colorSchemeFor(prefs.topColor, prefs.frontColor),
    [prefs.topColor, prefs.frontColor]
  );

  useEffect(() => {
    saveSettings(prefs);
  }, [prefs]);

  useEffect(() => {
    saveRepCount(PAGE_ID, repCount);
  }, [repCount]);

  const next = () => {
    setCurrent(generate4cCase());
    setRevealed(false);
  };

  const nextRep = () => {
    next();
    setRepCount((c) => c + 1);
  };

  const resetRepCount = () => setRepCount(0);

  const toggleShowMoveCount = () => {
    setPrefs((p) => ({ ...p, showMoveCount: !p.showMoveCount }));
  };

  const toggleShowCube = () => {
    setPrefs((p) => ({ ...p, showCube: !p.showCube }));
  };

  // Same Space/H shortcuts as EOLRb; no modals here so C/P/Escape don't apply.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.code === "Space") {
        if (e.repeat) return;
        e.preventDefault();
        if (!current) return;
        if (revealed) nextRep();
        else setRevealed(true);
        return;
      }

      if (e.code === "KeyH") {
        toggleShowCube();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, current]);

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

  return (
    <div id="page">
      <header>
        <h1>4c Trainer</h1>
        <p className="subtitle">Roux last-six-edges: 4c with misoriented centers</p>
        <div className="header-actions">
          <button className="settings-toggle" onClick={toggleShowCube}>
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
          space: reveal / next case &nbsp;·&nbsp; h: hide cube
        </p>
      </header>

      <main>
        {prefs.showCube && facelet && (
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
          {current && (
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

              <div className="controls">
                {!revealed ? (
                  <button className="primary" onClick={() => setRevealed(true)}>
                    Reveal solutions
                  </button>
                ) : (
                  <button className="primary" onClick={nextRep}>
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
          )}
        </div>
      </main>
    </div>
  );
}

export default FourCTrainer;
