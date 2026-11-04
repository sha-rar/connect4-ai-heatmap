import { describe, expect, it } from "vitest";
import { makeEmptyBoard, applyMove } from "../src/board";
import { checkWin, winningCells } from "../src/rules";
import type { Board, Player } from "../src/constants";

function dropMany(board: Board, cols: number[], player: Player): Board {
  let b = board;
  for (const c of cols) {
    const res = applyMove(b, c, player);
    if (!res) throw new Error(`Illegal move in test: col ${c}`);
    b = res.board;
  }
  return b;
}

describe("checkWin", () => {
  it("detects horizontal win", () => {
    let b = makeEmptyBoard();
    b = dropMany(b, [0, 1, 2, 3], 1);
    expect(checkWin(b, 1)).toBe(true);
    expect(checkWin(b, 2)).toBe(false);
  });

  it("detects vertical win", () => {
    let b = makeEmptyBoard();
    b = dropMany(b, [4, 4, 4, 4], 2);
    expect(checkWin(b, 2)).toBe(true);
    expect(checkWin(b, 1)).toBe(false);
  });

  it("detects diagonal down-right win", () => {
    // Build diagonal for Player 1: (5,0) (4,1) (3,2) (2,3)
    // This requires stacking filler pieces under each target spot.

    let b = makeEmptyBoard();

    // Column 0: P1 at row 5
    b = dropMany(b, [0], 1);

    // Column 1: one filler (P2), then P1 at row 4
    b = dropMany(b, [1], 2);
    b = dropMany(b, [1], 1);

    // Column 2: two fillers, then P1 at row 3
    b = dropMany(b, [2, 2], 2);
    b = dropMany(b, [2], 1);

    // Column 3: three fillers, then P1 at row 2
    b = dropMany(b, [3, 3, 3], 2);
    b = dropMany(b, [3], 1);

    expect(checkWin(b, 1)).toBe(true);
  });

  it("detects diagonal up-right win", () => {
    // Build diagonal for Player 2: (2,0) (3,1) (4,2) (5,3)
    // This requires stacking fillers to raise pieces appropriately.

    let b = makeEmptyBoard();

    // Column 0: fill 3 pieces so P2 lands at row 2
    b = dropMany(b, [0, 0], 1); // fillers
    b = dropMany(b, [0], 2); // P2 at row 3
    b = dropMany(b, [0], 2); // P2 at row 2 (needs one more filler first? We'll do it properly below)

    // The above is messy; build cleanly using explicit sequences:

    b = makeEmptyBoard();

    // col0: three fillers (P1), then P2 => P2 at row 2
    b = dropMany(b, [0, 0, 0], 1);
    b = dropMany(b, [0], 2);

    // col1: two fillers, then P2 => row 3
    b = dropMany(b, [1, 1], 1);
    b = dropMany(b, [1], 2);

    // col2: one filler, then P2 => row 4
    b = dropMany(b, [2], 1);
    b = dropMany(b, [2], 2);

    // col3: no filler, P2 => row 5
    b = dropMany(b, [3], 2);

    expect(checkWin(b, 2)).toBe(true);
  });

  it("returns false when no win", () => {
    let b = makeEmptyBoard();
    b = dropMany(b, [0, 1, 2], 1);
    expect(checkWin(b, 1)).toBe(false);
    expect(checkWin(b, 2)).toBe(false);
  });
});

describe("winningCells", () => {
  it("is empty when the player has not won", () => {
    const b = dropMany(makeEmptyBoard(), [0, 1, 2], 1);
    expect(winningCells(b, 1)).toEqual([]);
    expect(winningCells(makeEmptyBoard(), 2)).toEqual([]);
  });

  it("returns the four discs of a horizontal line", () => {
    const b = dropMany(makeEmptyBoard(), [1, 2, 3, 4], 1);
    expect(winningCells(b, 1)).toEqual([36, 37, 38, 39]);
    expect(winningCells(b, 2)).toEqual([]);
  });

  it("returns a vertical line", () => {
    const b = dropMany(makeEmptyBoard(), [6, 6, 6, 6], 2);
    expect(winningCells(b, 2)).toEqual([20, 27, 34, 41]);
  });

  it("includes every disc of a line longer than four", () => {
    const b = dropMany(makeEmptyBoard(), [0, 1, 2, 3, 4], 1);
    expect(winningCells(b, 1)).toEqual([35, 36, 37, 38, 39]);
  });
});
