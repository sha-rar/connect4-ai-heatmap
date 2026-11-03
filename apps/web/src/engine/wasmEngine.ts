import type { Board, ChooseMoveOptions, ChooseMoveResult, Player } from "@connect4/core";
import { COLS, ROWS } from "@connect4/core";

import type { Connect4Module } from "./generated/connect4.js";

/** Int32 slots in the result buffer; must match engine/wasm/bindings.cpp. */
export const RESULT_SIZE = 17;

const R = {
  status: 0,
  bestCol: 1,
  bestScore: 2,
  usedDepth: 3,
  ms: 4,
  opening: 5,
  timedOut: 6,
  nodesLow: 7,
  nodesHigh: 8,
  scoredMask: 9,
  columnScores: 10
} as const;

const STATUS_MESSAGES: Record<number, string> = {
  1: "invalid position: discs must obey gravity and match the player to move",
  2: "game is already over"
};

export class EngineInputError extends Error {
  constructor(readonly status: number) {
    super(STATUS_MESSAGES[status] ?? `engine error ${status}`);
    this.name = "EngineInputError";
  }
}

export type WasmChooseMoveResult = ChooseMoveResult & {
  /** True when the time limit stopped deepening before the requested depth. */
  timedOut: boolean;
};

export type WasmEngine = {
  chooseMove(board: Board, player: Player, options?: ChooseMoveOptions): WasmChooseMoveResult;
  /** Clear the engine's transposition table. */
  reset(): void;
};

/** Wrap an instantiated module with the chooseMove() contract. */
export function createWasmEngine(mod: Connect4Module): WasmEngine {
  const size = mod._c4_result_size();
  if (size !== RESULT_SIZE) {
    throw new Error(`WASM result layout mismatch: expected ${RESULT_SIZE} slots, got ${size}`);
  }

  // Buffers are allocated once and reused for every call.
  const cellsPtr = mod._malloc(ROWS * COLS * 4);
  const resultPtr = mod._malloc(RESULT_SIZE * 4);

  return {
    chooseMove(board, player, { depth = 6, timeLimitMs = 250 } = {}) {
      if (board.length !== ROWS * COLS) throw new EngineInputError(1);

      mod.HEAP32.set(board, cellsPtr >> 2);
      const status = mod._c4_choose_move(cellsPtr, player, Math.floor(depth), Math.floor(timeLimitMs), resultPtr);
      if (status !== 0) throw new EngineInputError(status);

      const base = resultPtr >> 2;
      const out = mod.HEAP32.slice(base, base + RESULT_SIZE);
      const mask = out[R.scoredMask];

      return {
        bestCol: out[R.bestCol],
        bestScore: out[R.bestScore],
        columnScores: Array.from({ length: COLS }, (_, c) => ((mask >> c) & 1 ? out[R.columnScores + c] : null)),
        nodes: (out[R.nodesLow] >>> 0) + (out[R.nodesHigh] >>> 0) * 2 ** 32,
        ms: out[R.ms],
        usedDepth: out[R.usedDepth],
        opening: out[R.opening] === 1,
        timedOut: out[R.timedOut] === 1
      };
    },
    reset() {
      mod._c4_reset();
    }
  };
}
