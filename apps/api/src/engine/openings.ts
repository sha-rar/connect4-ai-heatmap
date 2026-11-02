import type { Board } from "@connect4/core";
import { COLS } from "@connect4/core";

const CENTER_COL = Math.floor(COLS / 2);

/**
 * Tiny opening book.
 * Connect 4 strongly favours taking the centre early.
 */
export function getOpeningMove(board: Board): number | null {
  const isEmpty = board.every((x) => x === 0);
  if (isEmpty) return CENTER_COL;

  return null;
}
