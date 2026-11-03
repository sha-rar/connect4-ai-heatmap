import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Kept free of workspace imports so it can be loaded from any package.

export type FixtureCell = 0 | 1 | 2;
export type FixturePlayer = 1 | 2;

export type PositionFixture = {
  id: string;
  description: string;
  rows: string[];
  toMove: FixturePlayer;
  legalMoves: number[];
  bestMoves?: number[];
  outcome?: "win" | "loss" | "draw";
  tags: string[];
};

export type WinFixture = {
  id: string;
  rows: string[];
  winner: 0 | FixturePlayer;
  status: "playing" | "won" | "draw";
};

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

function readPositions<T>(file: string): T[] {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
  return raw.positions as T[];
}

export function loadPositions(): PositionFixture[] {
  return readPositions<PositionFixture>("positions.json");
}

export function loadWins(): WinFixture[] {
  return readPositions<WinFixture>("wins.json");
}

/** Convert top-to-bottom row strings into a flat row-major board. */
export function rowsToBoard(rows: string[]): FixtureCell[] {
  const board: FixtureCell[] = [];
  for (const row of rows) {
    for (const ch of row) {
      if (ch === ".") board.push(0);
      else if (ch === "1") board.push(1);
      else if (ch === "2") board.push(2);
      else throw new Error(`Invalid fixture cell "${ch}"`);
    }
  }
  return board;
}
