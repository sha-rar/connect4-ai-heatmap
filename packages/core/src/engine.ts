import type { Board, Player } from "./constants";
import { ROWS, COLS } from "./constants";

/**
 * Contract shared by every AI engine implementation (TypeScript today,
 * C++/WASM later). See docs/api.md for the full specification.
 */

/** Score for a won position. Mate scores are WIN_SCORE minus the ply count. */
export const WIN_SCORE = 1_000_000;

/** Maximum number of plies in a game; bounds the mate-score range. */
export const MAX_PLY = ROWS * COLS;

export type ChooseMoveOptions = {
  /** Maximum search depth in plies (1–12). Default 6. */
  depth?: number;
  /** Soft time budget in milliseconds (10–2000). Default 250. */
  timeLimitMs?: number;
};

export type ChooseMoveRequest = ChooseMoveOptions & {
  /** Row-major board, row 0 at the top, length ROWS * COLS. */
  board: Board;
  /** Player to move. */
  player: Player;
};

export type ChooseMoveResult = {
  /** Column the engine plays; always a legal move. */
  bestCol: number;
  /** Score of bestCol from the mover's perspective. */
  bestScore: number;
  /** Per-column scores (length COLS); null for illegal or unevaluated columns. */
  columnScores: Array<number | null>;
  /** Number of search nodes visited. */
  nodes: number;
  /** Wall-clock time spent, in milliseconds. */
  ms: number;
  /** Depth the search was configured with. */
  usedDepth: number;
  /** True when the move came from the opening book. */
  opening: boolean;
};

/** True when a score represents a forced win for the mover. */
export function isWinScore(score: number): boolean {
  return score >= WIN_SCORE - MAX_PLY;
}

/** True when a score represents a forced loss for the mover. */
export function isLossScore(score: number): boolean {
  return score <= -WIN_SCORE + MAX_PLY;
}

/** Plies until the game ends for a mate score, e.g. 0 for an immediate win. */
export function pliesToMate(score: number): number {
  return WIN_SCORE - Math.abs(score);
}
