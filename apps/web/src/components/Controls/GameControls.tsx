import type { Player } from "@connect4/core";

import type { Difficulty, GameMode, Settings } from "../../features/game/types";
import { DEPTH_OPTIONS, DIFFICULTIES, PLAYER_NAMES, TIME_OPTIONS, searchFor } from "../../features/game/types";

type Props = {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  canUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
};

/** Difficulty buttons, shared by the start screen and the game screen. */
export function DifficultyPicker({
  value,
  onChange
}: {
  value: Difficulty;
  onChange: (difficulty: Exclude<Difficulty, "custom">) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="Difficulty">
      {DIFFICULTIES.map((d) => (
        <button key={d.id} type="button" aria-pressed={value === d.id} title={d.hint} onClick={() => onChange(d.id)}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

/** "You play as" buttons: the human takes the side the AI does not. */
export function SidePicker({ aiPlayer, onChange }: { aiPlayer: Player; onChange: (aiPlayer: Player) => void }) {
  return (
    <div className="segmented" role="group" aria-label="You play as">
      {([1, 2] as Player[]).map((human) => (
        <button
          key={human}
          type="button"
          aria-pressed={aiPlayer !== human}
          onClick={() => onChange(human === 1 ? 2 : 1)}
        >
          <span className={`chip-dot p${human}`} aria-hidden="true" />
          {PLAYER_NAMES[human]} <span className="muted">({human === 1 ? "first" : "second"})</span>
        </button>
      ))}
    </div>
  );
}

export function GameControls({ mode, onModeChange, settings, onSettingsChange, canUndo, onUndo, onNewGame }: Props) {
  const search = searchFor(settings);
  const preset = DIFFICULTIES.find((d) => d.id === settings.difficulty);

  return (
    <section className="panel controls" aria-label="Game controls">
      <div className="control-row">
        <button type="button" className="btn primary" onClick={onNewGame}>
          New game
        </button>
        <button type="button" className="btn secondary" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <label className="switch">
          <input
            type="checkbox"
            checked={mode === "ai"}
            onChange={(e) => onModeChange(e.target.checked ? "ai" : "local")}
          />
          <span className="switch-track" aria-hidden="true" />
          AI opponent
        </label>
      </div>

      {mode === "ai" ? (
        <div className="setup">
          <div className="field">
            <span className="field-label">You play as</span>
            <SidePicker aiPlayer={settings.aiPlayer} onChange={(aiPlayer) => onSettingsChange({ aiPlayer })} />
          </div>
          <div className="field">
            <span className="field-label">Difficulty</span>
            <DifficultyPicker
              value={settings.difficulty}
              onChange={(difficulty) => onSettingsChange({ difficulty })}
            />
            <span className="field-hint">
              {preset ? preset.hint : `Custom: depth ${search.depth}, ${search.timeLimitMs} ms`}
            </span>
          </div>
        </div>
      ) : (
        <p className="field-hint">Two players on this device: take turns dropping discs. Red goes first.</p>
      )}

      <details className="advanced">
        <summary>Advanced settings</summary>
        <p className="field-hint">
          How far ahead the engine searches, and how long it may think per move. Changing these switches difficulty to
          Custom.
        </p>
        <div className="advanced-grid">
          <label>
            Max depth
            <select
              aria-label="Max depth"
              value={search.depth}
              onChange={(e) =>
                onSettingsChange({ difficulty: "custom", depth: Number(e.target.value), timeLimitMs: search.timeLimitMs })
              }
            >
              {DEPTH_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} moves
                </option>
              ))}
            </select>
          </label>
          <label>
            Time limit
            <select
              aria-label="Time limit"
              value={search.timeLimitMs}
              onChange={(e) =>
                onSettingsChange({ difficulty: "custom", depth: search.depth, timeLimitMs: Number(e.target.value) })
              }
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} ms
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
