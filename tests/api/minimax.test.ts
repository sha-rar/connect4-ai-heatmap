import { describe, expect, it } from "vitest";

import type { Board } from "@connect4/core";
import { COLS, isLegalMove, isLossScore, isWinScore } from "@connect4/core";

import { chooseMove } from "../../apps/api/src/engine/minimax";
import { loadPositions, rowsToBoard } from "../fixtures/load";

// Generous limits so results do not depend on machine speed.
const OPTS = { depth: 6, timeLimitMs: 2000 };

const positions = loadPositions();

describe("chooseMove contract", () => {
  it.each(positions.map((p) => [p.id, p] as const))("%s", (_id, p) => {
    const board = rowsToBoard(p.rows) as Board;
    const result = chooseMove(board, p.toMove, OPTS);

    expect(isLegalMove(board, result.bestCol)).toBe(true);
    expect(result.columnScores).toHaveLength(COLS);
    for (let c = 0; c < COLS; c++) {
      if (!isLegalMove(board, c)) expect(result.columnScores[c]).toBeNull();
    }
    expect(result.nodes).toBeGreaterThanOrEqual(0);
    expect(result.ms).toBeGreaterThanOrEqual(0);
    expect(result.usedDepth).toBe(OPTS.depth);
    expect(result.opening).toBe(p.tags.includes("opening"));
  });
});

describe("chooseMove picks an expected move", () => {
  const withAnswers = positions.filter((p) => p.bestMoves);

  it.each(withAnswers.map((p) => [p.id, p] as const))("%s", (_id, p) => {
    const result = chooseMove(rowsToBoard(p.rows) as Board, p.toMove, OPTS);
    expect(p.bestMoves).toContain(result.bestCol);
  });
});

describe("chooseMove scores known outcomes", () => {
  const winning = positions.filter((p) => p.outcome === "win");
  const lost = positions.filter((p) => p.outcome === "loss");
  const drawn = positions.filter((p) => p.outcome === "draw");

  it.each(winning.map((p) => [p.id, p] as const))("%s is scored as a win", (_id, p) => {
    const result = chooseMove(rowsToBoard(p.rows) as Board, p.toMove, OPTS);
    expect(isWinScore(result.bestScore)).toBe(true);
  });

  // Known gap (docs/api.md): the block shortcut scores a forced block as WIN_SCORE.
  // Remove `.fails` once an engine reports the real score.
  it.fails.each(lost.map((p) => [p.id, p] as const))("%s has no winning column", (_id, p) => {
    const result = chooseMove(rowsToBoard(p.rows) as Board, p.toMove, OPTS);
    for (const s of result.columnScores) {
      if (s !== null) expect(isWinScore(s)).toBe(false);
    }
  });

  it.each(drawn.map((p) => [p.id, p] as const))("%s is scored as a draw", (_id, p) => {
    const result = chooseMove(rowsToBoard(p.rows) as Board, p.toMove, OPTS);
    expect(result.bestScore).toBe(0);
    expect(isWinScore(result.bestScore) || isLossScore(result.bestScore)).toBe(false);
  });
});
