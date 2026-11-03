/**
 * Baseline benchmark for the TypeScript engine.
 *
 * Usage: pnpm --filter @connect4/api bench [--max-depth N] [--runs N]
 *
 * Runs every fixture tagged "benchmark" and prints Markdown tables of
 * node count and time per depth, plus the deepest search that completes
 * within common time budgets.
 */
import type { Board, ChooseMoveResult, Player } from "@connect4/core";
import { legalMoves } from "@connect4/core";

import { chooseMove } from "../src/engine/minimax";
import { loadPositions, rowsToBoard } from "../../../tests/fixtures/load";

// Effectively unlimited, so fixed-depth runs always complete.
const NO_LIMIT_MS = 600_000;
// Stop deepening a position once one depth takes longer than this.
const DEPTH_CUTOFF_MS = 5_000;
const BUDGETS_MS = [100, 250, 1000];
const DEFAULT_DEPTH = 6;
const DEFAULT_TIME_MS = 250;

function argValue(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const maxDepth = argValue("--max-depth", 12);
const runs = argValue("--runs", 3);

type Sample = { depth: number; nodes: number; ms: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function timed(board: Board, player: Player, depth: number, timeLimitMs: number) {
  const results: ChooseMoveResult[] = [];
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    results.push(chooseMove(board, player, { depth, timeLimitMs }));
    times.push(performance.now() - t0);
  }
  return { result: results[0], ms: median(times) };
}

function deepestWithin(samples: Sample[], budget: number): string {
  const ok = samples.filter((s) => s.ms <= budget);
  if (ok.length === 0) return "–";
  const deepest = ok[ok.length - 1];
  // If even the deepest measured depth fits, the real limit may be higher.
  return deepest === samples[samples.length - 1] ? `≥${deepest.depth}` : `${deepest.depth}`;
}

const positions = loadPositions().filter((p) => p.tags.includes("benchmark"));

console.log(`# TypeScript engine benchmark\n`);
console.log(`Node ${process.version}, ${process.platform}/${process.arch}, median of ${runs} runs.\n`);

const perPosition = new Map<string, Sample[]>();

console.log(`## Fixed depth (no time limit)\n`);
console.log(`| Position | Depth | Nodes | Time (ms) | Nodes/ms |`);
console.log(`| -------- | ----: | ----: | --------: | -------: |`);

for (const p of positions) {
  const board = rowsToBoard(p.rows) as Board;
  const samples: Sample[] = [];

  for (let depth = 1; depth <= maxDepth; depth++) {
    const { result, ms } = timed(board, p.toMove, depth, NO_LIMIT_MS);
    samples.push({ depth, nodes: result.nodes, ms });
    const rate = ms > 0 ? Math.round(result.nodes / ms) : 0;
    console.log(`| ${p.id} | ${depth} | ${result.nodes} | ${ms.toFixed(1)} | ${rate} |`);
    if (ms > DEPTH_CUTOFF_MS) break;
  }

  perPosition.set(p.id, samples);
}

console.log(`\n## Deepest complete search within a time budget\n`);
console.log(`| Position | ${BUDGETS_MS.map((b) => `${b} ms`).join(" | ")} |`);
console.log(`| -------- | ${BUDGETS_MS.map(() => "-----:").join(" | ")} |`);
for (const p of positions) {
  const samples = perPosition.get(p.id)!;
  console.log(`| ${p.id} | ${BUDGETS_MS.map((b) => deepestWithin(samples, b)).join(" | ")} |`);
}

console.log(`\n## Default settings (depth ${DEFAULT_DEPTH}, ${DEFAULT_TIME_MS} ms)\n`);
console.log(`| Position | Best col | Nodes | Time (ms) | Hit time limit | Columns scored |`);
console.log(`| -------- | -------: | ----: | --------: | :------------: | -------------: |`);
for (const p of positions) {
  const board = rowsToBoard(p.rows) as Board;
  const { result, ms } = timed(board, p.toMove, DEFAULT_DEPTH, DEFAULT_TIME_MS);
  const scored = result.columnScores.filter((s) => s !== null).length;
  const hit = ms >= DEFAULT_TIME_MS ? "yes" : "no";
  console.log(
    `| ${p.id} | ${result.bestCol} | ${result.nodes} | ${ms.toFixed(1)} | ${hit} | ${scored}/${legalMoves(board).length} |`
  );
}
