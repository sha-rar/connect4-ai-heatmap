import { describe, expect, it } from "vitest";
import { makeEmptyBoard, applyMove, findDropRow, legalMoves, getCell } from "../src/board";
import { COLS, ROWS } from "../src/constants";

describe("board helpers", () => {
  it("makeEmptyBoard creates an empty 6x7 board", () => {
    const b = makeEmptyBoard();
    expect(b.length).toBe(ROWS * COLS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        expect(getCell(b, r, c)).toBe(0);
      }
    }
  });

  it("findDropRow returns bottom row for empty column", () => {
    const b = makeEmptyBoard();
    expect(findDropRow(b, 0)).toBe(ROWS - 1);
  });

  it("applyMove drops into the lowest available row", () => {
    let b = makeEmptyBoard();

    const first = applyMove(b, 0, 1);
    expect(first).not.toBeNull();
    b = first!.board;
    expect(getCell(b, ROWS - 1, 0)).toBe(1);

    const second = applyMove(b, 0, 2);
    expect(second).not.toBeNull();
    b = second!.board;
    expect(getCell(b, ROWS - 2, 0)).toBe(2);
  });

  it("applyMove returns null when column is full", () => {
    let b = makeEmptyBoard();

    for (let i = 0; i < ROWS; i++) {
      const res = applyMove(b, 0, (i % 2 === 0 ? 1 : 2) as 1 | 2);
      expect(res).not.toBeNull();
      b = res!.board;
    }

    const fail = applyMove(b, 0, 1);
    expect(fail).toBeNull();
  });

  it("legalMoves excludes full columns", () => {
    let b = makeEmptyBoard();

    // Fill column 0 completely
    for (let i = 0; i < ROWS; i++) {
      const res = applyMove(b, 0, 1);
      if (!res) throw new Error("Unexpected null move in test");
      b = res.board;
    }

    const moves = legalMoves(b);
    expect(moves.includes(0)).toBe(false);
    expect(moves.length).toBe(COLS - 1);
  });
});
