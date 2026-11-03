import { describe, expect, it } from "vitest";

import type { Board } from "@connect4/core";
import { COLS, ROWS, checkWin, getCell, getStatus, legalMoves } from "@connect4/core";

import { loadPositions, loadWins, rowsToBoard } from "../fixtures/load";

const positions = loadPositions();
const wins = loadWins();

function countDiscs(board: Board) {
  return {
    p1: board.filter((c) => c === 1).length,
    p2: board.filter((c) => c === 2).length
  };
}

function obeysGravity(board: Board): boolean {
  for (let c = 0; c < COLS; c++) {
    let seenDisc = false;
    for (let r = 0; r < ROWS; r++) {
      const filled = getCell(board, r, c) !== 0;
      if (seenDisc && !filled) return false;
      seenDisc ||= filled;
    }
  }
  return true;
}

describe("fixture validity", () => {
  it.each([...positions, ...wins].map((p) => [p.id, p.rows] as const))(
    "%s has a 6x7 board that obeys gravity",
    (_id, rows) => {
      expect(rows).toHaveLength(ROWS);
      for (const row of rows) expect(row).toHaveLength(COLS);
      expect(obeysGravity(rowsToBoard(rows) as Board)).toBe(true);
    }
  );

  it.each(positions.map((p) => [p.id, p] as const))(
    "%s is non-terminal with disc counts matching the player to move",
    (_id, p) => {
      const board = rowsToBoard(p.rows) as Board;
      const { p1, p2 } = countDiscs(board);
      expect(p1 - p2).toBe(p.toMove === 1 ? 0 : 1);
      expect(getStatus(board, p.toMove).state).toBe("playing");
    }
  );

  it.each(wins.filter((w) => w.winner !== 0).map((w) => [w.id, w] as const))(
    "%s has disc counts consistent with the winner moving last",
    (_id, w) => {
      const { p1, p2 } = countDiscs(rowsToBoard(w.rows) as Board);
      expect(p1 - p2).toBe(w.winner === 1 ? 1 : 0);
    }
  );
});

describe("legalMoves against fixtures", () => {
  it.each(positions.map((p) => [p.id, p] as const))("%s", (_id, p) => {
    expect(legalMoves(rowsToBoard(p.rows) as Board)).toEqual(p.legalMoves);
  });
});

describe("win detection against fixtures", () => {
  it.each(wins.map((w) => [w.id, w] as const))("%s", (_id, w) => {
    const board = rowsToBoard(w.rows) as Board;
    expect(checkWin(board, 1)).toBe(w.winner === 1);
    expect(checkWin(board, 2)).toBe(w.winner === 2);
    expect(getStatus(board, 1)).toEqual({ state: w.status, winner: w.winner });
  });
});
