import type { Player } from "@connect4/core";

import type { Difficulty } from "../../features/game/types";
import { DifficultyPicker, SidePicker } from "../Controls/GameControls";

type Props = {
  aiPlayer: Player;
  difficulty: Difficulty;
  onAiPlayerChange: (aiPlayer: Player) => void;
  onDifficultyChange: (difficulty: Exclude<Difficulty, "custom">) => void;
  onPlayAi: () => void;
  onPlayLocal: () => void;
};

export function StartScreen(props: Props) {
  const { aiPlayer, difficulty, onAiPlayerChange, onDifficultyChange, onPlayAi, onPlayLocal } = props;
  return (
    <main className="start">
      <div className="start-card">
        <div className="logo" aria-hidden="true">
          <span className="disc p1" />
          <span className="disc p2" />
          <span className="disc p1" />
          <span className="disc p2" />
        </div>
        <h1>Connect 4</h1>
        <p className="tagline">
          Play against a C++ engine running in your browser, and see how it rates every move.
        </p>

        <div className="start-setup">
          <div className="field">
            <span className="field-label">You play as</span>
            <SidePicker aiPlayer={aiPlayer} onChange={onAiPlayerChange} />
          </div>
          <div className="field">
            <span className="field-label">Difficulty</span>
            <DifficultyPicker value={difficulty} onChange={onDifficultyChange} />
          </div>
        </div>

        <div className="start-actions">
          <button type="button" className="btn primary large" onClick={onPlayAi}>
            Play vs AI
          </button>
          <button type="button" className="btn secondary large" onClick={onPlayLocal}>
            Two players
          </button>
        </div>

        <div className="start-info">
          <section>
            <h2>How to play</h2>
            <p>
              Take turns dropping discs into the seven columns. Discs fall to the lowest free space. The first to line
              up four of their own, across, down or diagonally, wins. Red always goes first.
            </p>
          </section>
          <section>
            <h2>AI analysis</h2>
            <p>
              The engine searches ahead with minimax and alpha–beta pruning. After each move, the heatmap and analysis
              panel show its score for every column: forced wins, forced losses and how strong each position is.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
