import type { Player } from "@connect4/core";

/** "ai": one human against the engine. "local": two people on one device. */
export type GameMode = "ai" | "local";

export type Difficulty = "easy" | "medium" | "hard" | "expert" | "custom";

export type SearchSettings = { depth: number; timeLimitMs: number };

export const DIFFICULTIES: Array<{ id: Exclude<Difficulty, "custom">; label: string; hint: string } & SearchSettings> = [
  { id: "easy", label: "Easy", hint: "Looks 2 moves ahead", depth: 2, timeLimitMs: 100 },
  { id: "medium", label: "Medium", hint: "Looks 5 moves ahead", depth: 5, timeLimitMs: 250 },
  { id: "hard", label: "Hard", hint: "Looks 8 moves ahead", depth: 8, timeLimitMs: 500 },
  { id: "expert", label: "Expert", hint: "Looks up to 12 moves ahead", depth: 12, timeLimitMs: 1000 }
];

/** Search depths offered under Advanced settings. */
export const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
export const TIME_OPTIONS = [100, 250, 500, 1000, 2000];

export type Settings = SearchSettings & {
  difficulty: Difficulty;
  /** The side the engine plays in "ai" mode. */
  aiPlayer: Player;
  /** Tint the board columns with the analysis. */
  heatmap: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "medium",
  depth: 5,
  timeLimitMs: 250,
  aiPlayer: 2,
  heatmap: true
};

/** Search settings for a preset, or the custom values. */
export function searchFor(settings: Settings): SearchSettings {
  const preset = DIFFICULTIES.find((d) => d.id === settings.difficulty);
  return preset ? { depth: preset.depth, timeLimitMs: preset.timeLimitMs } : settings;
}

export const PLAYER_NAMES: Record<Player, string> = { 1: "Red", 2: "Yellow" };

/** Engine output for one position, kept while it describes the board shown. */
export type Analysis = {
  /** Number of moves on the board when the engine was asked. */
  ply: number;
  /** Side the scores are for (the side to move at `ply`). */
  forPlayer: Player;
  /** True when the engine also played its best move. */
  played: boolean;
  bestCol: number;
  columnScores: Array<number | null>;
  usedDepth: number;
  requestedDepth: number;
  timeLimitMs: number;
  ms: number;
  nodes: number;
  opening: boolean;
  timedOut: boolean;
};
