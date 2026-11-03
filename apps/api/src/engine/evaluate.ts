import type { Board, Cell, Player } from "@connect4/core";
import { COLS, ROWS, otherPlayer } from "@connect4/core";
import { checkWin } from "@connect4/core";
import { getCell } from "@connect4/core";
import { WIN_SCORE } from "@connect4/core";

export { WIN_SCORE };

function scoreWindow(window: Cell[], root: Player): number {
  const opp = otherPlayer(root);

  let rootCount = 0;
  let oppCount = 0;
  let emptyCount = 0;

  for (const c of window) {
    if (c === root) rootCount++;
    else if (c === opp) oppCount++;
    else emptyCount++;
  }

  // Terminal-ish patterns
  if (rootCount === 4) return WIN_SCORE;
  if (oppCount === 4) return -WIN_SCORE;

  // Heuristics
  // Prefer creating threats; strongly prefer blocking opponent threats
  let score = 0;

  if (rootCount === 3 && emptyCount === 1) score += 120;
  if (rootCount === 2 && emptyCount === 2) score += 12;

  if (oppCount === 3 && emptyCount === 1) score -= 140;
  if (oppCount === 2 && emptyCount === 2) score -= 14;

  return score;
}

/**
 * Evaluate from the perspective of `rootPlayer`.
 * Positive = good for rootPlayer, negative = good for opponent.
 */
export function evaluateBoard(board: Board, rootPlayer: Player): number {
  // Hard terminal checks (fast exit)
  if (checkWin(board, rootPlayer)) return WIN_SCORE;
  if (checkWin(board, otherPlayer(rootPlayer))) return -WIN_SCORE;

  let score = 0;

  // Centre column preference
  const centreCol = Math.floor(COLS / 2);
  let centreCount = 0;
  for (let r = 0; r < ROWS; r++) {
    if (getCell(board, r, centreCol) === rootPlayer) centreCount++;
  }
  score += centreCount * 8;

  // Horizontal windows
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w: Cell[] = [
        getCell(board, r, c),
        getCell(board, r, c + 1),
        getCell(board, r, c + 2),
        getCell(board, r, c + 3)
      ];
      score += scoreWindow(w, rootPlayer);
    }
  }

  // Vertical windows
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const w: Cell[] = [
        getCell(board, r, c),
        getCell(board, r + 1, c),
        getCell(board, r + 2, c),
        getCell(board, r + 3, c)
      ];
      score += scoreWindow(w, rootPlayer);
    }
  }

  // Diagonal down-right
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w: Cell[] = [
        getCell(board, r, c),
        getCell(board, r + 1, c + 1),
        getCell(board, r + 2, c + 2),
        getCell(board, r + 3, c + 3)
      ];
      score += scoreWindow(w, rootPlayer);
    }
  }

  // Diagonal up-right
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w: Cell[] = [
        getCell(board, r, c),
        getCell(board, r - 1, c + 1),
        getCell(board, r - 2, c + 2),
        getCell(board, r - 3, c + 3)
      ];
      score += scoreWindow(w, rootPlayer);
    }
  }

  return score;
}
