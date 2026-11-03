import { describe, expect, it } from "vitest";

import type { Board } from "@connect4/core";
import { WIN_SCORE, makeEmptyBoard } from "@connect4/core";

import { classifyColumns, columnBadge, describeColumn } from "../../apps/web/src/lib/heatmap";
import { loadPositions, rowsToBoard } from "../fixtures/load";

const fullColumns = rowsToBoard(loadPositions().find((p) => p.id === "full-columns")!.rows) as Board;

describe("classifyColumns", () => {
  it("marks full columns illegal even when a score is present", () => {
    const heats = classifyColumns(fullColumns, [5, 5, 1, 2, 3, 4, 5]);
    expect(heats.map((h) => h.kind)).toEqual([
      "illegal",
      "illegal",
      "heuristic",
      "heuristic",
      "heuristic",
      "heuristic",
      "illegal"
    ]);
    expect(heats[0].score).toBeNull();
  });

  it("classifies mate scores as wins and losses", () => {
    const heats = classifyColumns(makeEmptyBoard(), [
      WIN_SCORE,
      WIN_SCORE - 3,
      -WIN_SCORE + 2,
      -WIN_SCORE + 4,
      0,
      null,
      10
    ]);
    expect(heats.map((h) => h.kind)).toEqual(["win", "win", "loss", "loss", "heuristic", "unscored", "heuristic"]);
    expect(heats.map((h) => h.movesToMate)).toEqual([1, 2, 1, 2, null, null, null]);
  });

  it("normalises only heuristic scores", () => {
    const heats = classifyColumns(makeEmptyBoard(), [WIN_SCORE, -20, 0, 20, -WIN_SCORE + 2, null, 10]);
    expect(heats.map((h) => h.intensity)).toEqual([0, 0, 0.5, 1, 0, 0, 0.75]);
  });

  it("uses mid intensity when all heuristic scores are equal", () => {
    const heats = classifyColumns(makeEmptyBoard(), [7, 7, null, null, null, null, null]);
    expect(heats[0].intensity).toBe(0.5);
    expect(heats[1].intensity).toBe(0.5);
  });
});

describe("column labels", () => {
  const [illegal] = classifyColumns(fullColumns, Array(7).fill(null));
  const [win, loss, heuristic, unscored] = classifyColumns(makeEmptyBoard(), [
    WIN_SCORE - 3,
    -WIN_SCORE + 2,
    42,
    null,
    null,
    null,
    null
  ]);

  it("describes each kind", () => {
    expect(describeColumn(illegal, 0)).toBe("Column 1 is full");
    expect(describeColumn(win, 0)).toBe("Column 1: forced win in 2 moves");
    expect(describeColumn(loss, 1)).toBe("Column 2: forced loss in 1 move");
    expect(describeColumn(heuristic, 2)).toBe("Column 3 score: 42");
    expect(describeColumn(unscored, 3)).toBe("Drop in column 4");
  });

  it("badges only illegal and mate columns", () => {
    expect([illegal, win, loss, heuristic, unscored].map(columnBadge)).toEqual(["Full", "W2", "L1", null, null]);
  });
});
