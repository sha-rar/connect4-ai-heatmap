import type { GameStatus, Player } from "@connect4/core";

import type { GameMode } from "../../features/game/types";
import { PLAYER_NAMES } from "../../features/game/types";

type Props = {
  mode: GameMode;
  status: GameStatus;
  toMove: Player;
  aiPlayer: Player;
  thinking: boolean;
  error: string | null;
  onRetry: () => void;
  onPlayAgain: () => void;
};

/** Large turn indicator above the board; becomes the result card when the game ends. */
export function StatusBanner({ mode, status, toMove, aiPlayer, thinking, error, onRetry, onPlayAgain }: Props) {
  if (status.state !== "playing") {
    const winner = status.state === "won" ? status.winner : null;
    const text =
      winner === null
        ? "It's a draw"
        : mode === "ai"
          ? winner === aiPlayer
            ? "The AI wins"
            : "You win!"
          : `${PLAYER_NAMES[winner]} wins!`;
    const tone = winner === null ? "draw" : mode === "ai" && winner === aiPlayer ? "lose" : "win";
    return (
      <div className={`status-banner result ${tone}`} role="status">
        {winner ? <span className={`disc-icon p${winner}`} aria-hidden="true" /> : null}
        <div className="status-text">
          <strong data-testid="status">{text}</strong>
          <span>{winner ? "Four in a row. The winning discs are highlighted." : "The board is full with no four in a row."}</span>
        </div>
        <button type="button" className="btn primary" onClick={onPlayAgain}>
          Play again
        </button>
      </div>
    );
  }

  const aiTurn = mode === "ai" && toMove === aiPlayer;
  const text = mode === "ai" ? (aiTurn ? "AI is thinking…" : "Your turn") : `${PLAYER_NAMES[toMove]}'s turn`;
  return (
    <div className="status-banner" role="status">
      <span className={`disc-icon p${toMove}${aiTurn && thinking ? " thinking" : ""}`} aria-hidden="true" />
      <div className="status-text">
        <strong data-testid="status">{text}</strong>
        <span>
          {error ? (
            <span className="error" role="alert">
              Engine error: {error}{" "}
              <button type="button" className="link" onClick={onRetry}>
                Try again
              </button>
            </span>
          ) : mode === "ai" ? (
            `You are ${PLAYER_NAMES[aiPlayer === 1 ? 2 : 1]}. Click a column to drop a disc.`
          ) : (
            `${PLAYER_NAMES[toMove]} to move. Click a column to drop a disc.`
          )}
        </span>
      </div>
    </div>
  );
}
