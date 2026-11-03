import type { Board } from "@connect4/core";
import { isLegalMove, isLossScore, isWinScore, pliesToMate } from "@connect4/core";

/**
 * How a column is shown in the heatmap. See docs/heatmap.md.
 *
 * - illegal:   column is full; never playable
 * - win:       forced win for the mover
 * - loss:      forced loss for the mover
 * - heuristic: ordinary evaluation, shaded by relative strength
 * - unscored:  legal, but the engine returned no score
 */
export type ColumnKind = "illegal" | "win" | "loss" | "heuristic" | "unscored";

export type ColumnHeat = {
  kind: ColumnKind;
  score: number | null;
  /** 0..1 relative strength among heuristic columns; 0 for other kinds. */
  intensity: number;
  /** For win/loss: moves the winning side needs, counting the next move as 1. */
  movesToMate: number | null;
};

/** Convert plies-to-mate into moves made by the side that wins. */
function movesFromPlies(plies: number): number {
  return Math.max(1, Math.ceil(plies / 2));
}

export function classifyColumns(board: Board, scores: Array<number | null>): ColumnHeat[] {
  const heats: ColumnHeat[] = scores.map((score, col) => {
    if (!isLegalMove(board, col)) return { kind: "illegal", score: null, intensity: 0, movesToMate: null };
    if (score === null) return { kind: "unscored", score, intensity: 0, movesToMate: null };
    if (isWinScore(score)) return { kind: "win", score, intensity: 0, movesToMate: movesFromPlies(pliesToMate(score)) };
    if (isLossScore(score)) return { kind: "loss", score, intensity: 0, movesToMate: movesFromPlies(pliesToMate(score)) };
    return { kind: "heuristic", score, intensity: 0, movesToMate: null };
  });

  // Normalise heuristic columns only, so mate scores do not flatten the range.
  const values = heats.filter((h) => h.kind === "heuristic").map((h) => h.score as number);
  if (values.length > 0) {
    const min = Math.min(...values);
    const span = Math.max(...values) - min;
    for (const h of heats) {
      if (h.kind === "heuristic") h.intensity = span === 0 ? 0.5 : ((h.score as number) - min) / span;
    }
  }

  return heats;
}

/** Tooltip / accessible description for a column. `col` is zero-based. */
export function describeColumn(heat: ColumnHeat, col: number): string {
  const name = `Column ${col + 1}`;
  const plural = (n: number) => (n === 1 ? "move" : "moves");
  switch (heat.kind) {
    case "illegal":
      return `${name} is full`;
    case "win":
      return `${name}: forced win in ${heat.movesToMate} ${plural(heat.movesToMate!)}`;
    case "loss":
      return `${name}: forced loss in ${heat.movesToMate} ${plural(heat.movesToMate!)}`;
    case "heuristic":
      return `${name} score: ${heat.score!.toFixed(0)}`;
    case "unscored":
      return `Drop in column ${col + 1}`;
  }
}

/** Short badge drawn at the top of a column, or null for none. */
export function columnBadge(heat: ColumnHeat): string | null {
  switch (heat.kind) {
    case "illegal":
      return "Full";
    case "win":
      return `W${heat.movesToMate}`;
    case "loss":
      return `L${heat.movesToMate}`;
    default:
      return null;
  }
}
