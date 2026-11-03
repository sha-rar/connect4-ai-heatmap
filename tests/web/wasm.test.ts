import { beforeAll, describe, expect, it } from "vitest";

import type { Board } from "@connect4/core";
import { COLS, isLegalMove, isLossScore, isWinScore } from "@connect4/core";

import createConnect4Module from "../../apps/web/src/engine/generated/connect4.js";
import type { WasmEngine } from "../../apps/web/src/engine/wasmEngine";
import { EngineInputError, createWasmEngine } from "../../apps/web/src/engine/wasmEngine";
import { loadPositions, loadWins, rowsToBoard } from "../fixtures/load";

// No time limit, so results do not depend on machine speed.
const EXACT = { depth: 6, timeLimitMs: 0 };

const positions = loadPositions();
let engine: WasmEngine;

beforeAll(async () => {
  engine = createWasmEngine(await createConnect4Module());
});

const board = (rows: string[]) => rowsToBoard(rows) as Board;

describe("WASM engine contract", () => {
  it.each(positions.map((p) => [p.id, p] as const))("%s", (_id, p) => {
    const b = board(p.rows);
    const result = engine.chooseMove(b, p.toMove, EXACT);

    expect(isLegalMove(b, result.bestCol)).toBe(true);
    expect(result.columnScores).toHaveLength(COLS);
    for (let c = 0; c < COLS; c++) {
      // Every legal column is scored; only full columns are null.
      expect(result.columnScores[c] === null).toBe(!isLegalMove(b, c));
    }
    expect(result.columnScores[result.bestCol]).toBe(result.bestScore);
    expect(Math.max(...result.columnScores.filter((s): s is number => s !== null))).toBe(result.bestScore);
    expect(result.timedOut).toBe(false);
    if (result.opening) {
      // Opening book: a precomputed search at least as deep as requested.
      expect(result.usedDepth).toBeGreaterThanOrEqual(EXACT.depth);
      expect(result.nodes).toBe(0);
    } else {
      expect(result.usedDepth).toBe(Math.min(EXACT.depth, emptyCells(b)));
      expect(result.nodes).toBeGreaterThan(0);
    }
    expect(result.opening).toBe(p.tags.includes("opening"));
  });
});

describe("WASM engine picks expected moves and outcomes", () => {
  const searched = positions.filter((p) => p.bestMoves && !p.tags.includes("opening"));
  it.each(searched.map((p) => [p.id, p] as const))("%s best move", (_id, p) => {
    expect(p.bestMoves).toContain(engine.chooseMove(board(p.rows), p.toMove, EXACT).bestCol);
  });

  // Known gap (engine/README.md): the opening book holds depth-16 heuristic
  // scores, which prefer column 2 on the empty board, while perfect play opens
  // in the centre. Remove `.fails` once the book uses solved values.
  it.fails("empty board opens in the centre", () => {
    const empty = positions.find((p) => p.id === "empty")!;
    expect(empty.bestMoves).toContain(engine.chooseMove(board(empty.rows), 1, EXACT).bestCol);
  });

  it.each(positions.filter((p) => p.outcome).map((p) => [p.id, p] as const))("%s outcome", (_id, p) => {
    const result = engine.chooseMove(board(p.rows), p.toMove, EXACT);
    if (p.outcome === "win") expect(isWinScore(result.bestScore)).toBe(true);
    if (p.outcome === "draw") expect(result.bestScore).toBe(0);
    if (p.outcome === "loss") {
      // The gap the TypeScript engine has (forced blocks scored as wins) is closed.
      for (const s of result.columnScores) if (s !== null) expect(isLossScore(s)).toBe(true);
    }
  });
});

describe("WASM engine time limit", () => {
  it("returns a complete shallower search when time runs out", () => {
    const p = positions.find((x) => x.id === "midgame-10")!;
    const limited = engine.chooseMove(board(p.rows), p.toMove, { depth: 42, timeLimitMs: 20 });
    expect(limited.timedOut).toBe(true);
    expect(limited.usedDepth).toBeGreaterThanOrEqual(1);

    const exact = engine.chooseMove(board(p.rows), p.toMove, { depth: limited.usedDepth, timeLimitMs: 0 });
    expect(limited.columnScores).toEqual(exact.columnScores);
    expect(limited.bestCol).toBe(exact.bestCol);
  });
});

describe("WASM engine input errors", () => {
  it("rejects a board with the wrong player to move", () => {
    const empty = board(positions[0].rows);
    expect(() => engine.chooseMove(empty, 2)).toThrow(EngineInputError);
  });

  it.each(loadWins().filter((w) => w.status !== "playing").map((w) => [w.id, w] as const))(
    "rejects finished game %s",
    (_id, w) => {
      const b = board(w.rows);
      const ones = b.filter((c) => c === 1).length;
      const twos = b.filter((c) => c === 2).length;
      expect(() => engine.chooseMove(b, ones === twos ? 1 : 2)).toThrow(/already over/);
    }
  );
});

/** Empty cells; the engine caps the search depth at the end of the game. */
function emptyCells(b: Board): number {
  return b.filter((c) => c === 0).length;
}
