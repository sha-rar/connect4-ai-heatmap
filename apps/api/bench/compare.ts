/**
 * Compares the TypeScript engine with the C++ engine (WebAssembly build) on
 * identical positions and time limits, then plays them against each other.
 *
 * Usage: pnpm --filter @connect4/api compare [--games-ms 100,250]
 */
import type { Board, Player } from "@connect4/core";
import { COLS, applyMove, checkWin, legalMoves, makeEmptyBoard, otherPlayer } from "@connect4/core";

import { chooseMove as chooseMoveTs } from "../src/engine/minimax";
import createConnect4Module from "../../web/src/engine/generated/connect4.js";
import { createWasmEngine } from "../../web/src/engine/wasmEngine";
import { loadPositions, rowsToBoard } from "../../../tests/fixtures/load";

const DEPTH = 12; // deepest setting the app offers
const BUDGETS_MS = [100, 250, 1000];

function argList(name: string, fallback: number[]): number[] {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1].split(",").map(Number);
}
const gameBudgets = argList("--games-ms", [100, 250]);

const wasm = createWasmEngine(await createConnect4Module());

type Engine = "TypeScript" | "C++";

function choose(engine: Engine, board: Board, player: Player, timeLimitMs: number, depth = DEPTH) {
  return engine === "TypeScript"
    ? { ...chooseMoveTs(board, player, { depth, timeLimitMs }), timedOut: undefined as boolean | undefined }
    : wasm.chooseMove(board, player, { depth, timeLimitMs });
}

const positions = loadPositions().filter((p) => p.tags.includes("benchmark"));

console.log(`# Engine comparison\n`);
console.log(`Node ${process.version}, ${process.platform}/${process.arch}. C++ engine is the WebAssembly build.\n`);

console.log(`## Same positions, same limits (depth ${DEPTH})\n`);
console.log(
  `"Complete" means the scores come from a finished depth-${DEPTH} search. The TypeScript engine reports the ` +
    `requested depth even when cut off, so it counts as complete only if it finished inside the limit.\n`
);
console.log(`| Position | Limit | Engine | Time (ms) | Nodes | Depth | Complete | Best col | Columns scored |`);
console.log(`| -------- | ----: | ------ | --------: | ----: | ----: | :------: | -------: | -------------: |`);
for (const p of positions) {
  const board = rowsToBoard(p.rows) as Board;
  const legal = legalMoves(board).length;
  for (const budget of BUDGETS_MS) {
    for (const engine of ["TypeScript", "C++"] as Engine[]) {
      const t0 = performance.now();
      const r = choose(engine, board, p.toMove, budget);
      const ms = performance.now() - t0;
      const scored = r.columnScores.filter((s) => s !== null).length;
      const complete = engine === "C++" ? !r.timedOut : ms < budget && scored === legal;
      console.log(
        `| ${p.id} | ${budget} | ${engine} | ${ms.toFixed(0)} | ${r.nodes} | ${r.usedDepth} | ` +
          `${complete ? "yes" : "no"} | ${r.bestCol} | ${scored}/${legal} |`
      );
    }
  }
}

console.log(`\n## Deepest C++ search within the same limits\n`);
console.log(`Depth not capped at ${DEPTH}; shows how far iterative deepening gets.\n`);
console.log(`| Position | ${BUDGETS_MS.map((b) => `${b} ms`).join(" | ")} |`);
console.log(`| -------- | ${BUDGETS_MS.map(() => "-----:").join(" | ")} |`);
for (const p of positions) {
  const board = rowsToBoard(p.rows) as Board;
  const cells = BUDGETS_MS.map((b) => {
    const r = wasm.chooseMove(board, p.toMove, { depth: 42, timeLimitMs: b });
    return r.timedOut ? String(r.usedDepth) : `solved ${r.usedDepth}`;
  });
  console.log(`| ${p.id} | ${cells.join(" | ")} |`);
}

type Outcome = { winner: Engine | "draw"; plies: number };

function playGame(first: Engine, openingCol: number, timeLimitMs: number): Outcome {
  let board = makeEmptyBoard();
  let player: Player = 1;
  const engineFor = (p: Player): Engine => (p === 1 ? first : first === "C++" ? "TypeScript" : "C++");

  for (let ply = 0; ; ply++) {
    if (legalMoves(board).length === 0) return { winner: "draw", plies: ply };
    const col = ply === 0 ? openingCol : choose(engineFor(player), board, player, timeLimitMs).bestCol;
    board = applyMove(board, col, player)!.board;
    if (checkWin(board, player)) return { winner: engineFor(player), plies: ply + 1 };
    player = otherPlayer(player);
  }
}

console.log(`\n## Head-to-head games\n`);
console.log(
  `Each opening column is played twice, once with each engine moving first; the first move is forced, then both ` +
    `engines search with depth ${DEPTH} and the same time limit per move.\n`
);
console.log(`| Limit per move | Games | C++ wins | Draws | TypeScript wins |`);
console.log(`| -------------: | ----: | -------: | ----: | --------------: |`);
for (const budget of gameBudgets) {
  const tally = { "C++": 0, draw: 0, TypeScript: 0 };
  for (let col = 0; col < COLS; col++) {
    for (const first of ["C++", "TypeScript"] as Engine[]) {
      tally[playGame(first, col, budget).winner]++;
    }
  }
  console.log(`| ${budget} ms | ${COLS * 2} | ${tally["C++"]} | ${tally.draw} | ${tally.TypeScript} |`);
}
