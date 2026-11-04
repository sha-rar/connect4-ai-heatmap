/**
 * Shared rule tests. tests/fixtures/games.json holds complete games with the
 * legal moves and result after every ply. The TypeScript rules (used by the
 * UI) and the C++ engine (WebAssembly build here, native build in
 * engine/tests/test_rules.cpp) must both reproduce it exactly.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { Board, Player } from "@connect4/core";
import { COLS, applyMove, getStatus, legalMoves, makeEmptyBoard, otherPlayer } from "@connect4/core";

import createConnect4Module from "../../apps/web/src/engine/generated/connect4.js";
import type { WasmEngine } from "../../apps/web/src/engine/wasmEngine";
import { EngineInputError, createWasmEngine } from "../../apps/web/src/engine/wasmEngine";
import type { GameFixture } from "../fixtures/load";
import { loadGames, rowsToBoard } from "../fixtures/load";

const games = loadGames();
const GAME_OVER = 2; // c4_choose_move status

/** Each position of a game: the board before move i and who plays it. */
function* replay(game: GameFixture): Generator<{ ply: number; board: Board; player: Player; next: Board }> {
  let board = makeEmptyBoard();
  let player: Player = 1;
  for (let ply = 0; ply < game.moves.length; ply++) {
    const moved = applyMove(board, Number(game.moves[ply]), player);
    if (!moved) throw new Error(`${game.id}: move ${ply} is illegal`);
    yield { ply, board, player, next: moved.board };
    board = moved.board;
    player = otherPlayer(player);
  }
}

const digits = (cols: number[]) => cols.join("");

describe("games corpus", () => {
  it("covers every win direction, both winners and draws", () => {
    for (const d of ["horizontal", "vertical", "diagonal", "anti-diagonal"]) {
      expect(games.some((g) => g.direction === d)).toBe(true);
    }
    expect(games.some((g) => g.winner === 1)).toBe(true);
    expect(games.some((g) => g.winner === 2)).toBe(true);
    expect(games.some((g) => g.status === "draw")).toBe(true);
    expect(games.some((g) => g.legal.some((l) => l.length > 0 && l.length < COLS))).toBe(true);
  });
});

describe("TypeScript rules reproduce the games corpus", () => {
  it.each(games.map((g) => [g.id, g] as const))("%s", (_id, game) => {
    let last: Board = makeEmptyBoard();
    for (const { ply, player, next } of replay(game)) {
      expect(digits(legalMoves(next)), `legal moves after ply ${ply}`).toBe(game.legal[ply]);
      const status = getStatus(next, player);
      if (ply < game.moves.length - 1) {
        expect(status.state, `status after ply ${ply}`).toBe("playing");
      } else {
        expect(status).toEqual({ state: game.status, winner: game.winner });
      }
      last = next;
    }
    expect(last).toEqual(rowsToBoard(game.rows));
  });
});

describe("C++ engine (WebAssembly) reproduces the games corpus", () => {
  let engine: WasmEngine;
  beforeAll(async () => {
    engine = createWasmEngine(await createConnect4Module());
  });

  it.each(games.map((g) => [g.id, g] as const))("%s", (_id, game) => {
    const legalBefore = ["0123456", ...game.legal];
    for (const { ply, board, player } of replay(game)) {
      // Depth 1 scores every legal column, so the scored columns are the
      // engine's legal moves.
      const result = engine.chooseMove(board, player, { depth: 1, timeLimitMs: 0 });
      const scored = result.columnScores.flatMap((s, c) => (s === null ? [] : [c]));
      expect(digits(scored), `legal moves before ply ${ply}`).toBe(legalBefore[ply]);
    }
    // The final board is over (won or full), which the engine rejects.
    const final = rowsToBoard(game.rows) as Board;
    const toMove: Player = game.moves.length % 2 === 0 ? 1 : 2;
    let error: unknown;
    try {
      engine.chooseMove(final, toMove, { depth: 1, timeLimitMs: 0 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EngineInputError);
    expect((error as EngineInputError).status).toBe(GAME_OVER);
  });
});
