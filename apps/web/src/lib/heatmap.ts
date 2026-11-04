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
  /** True for the column the AI played; it always has the best score. */
  chosen: boolean;
};

/** Convert plies-to-mate into moves made by the side that wins. */
function movesFromPlies(plies: number): number {
  return Math.max(1, Math.ceil(plies / 2));
}

export function classifyColumns(
  board: Board,
  scores: Array<number | null>,
  chosenCol: number | null = null
): ColumnHeat[] {
  const heats: ColumnHeat[] = scores.map((score, col) => {
    const base = { score, intensity: 0, movesToMate: null, chosen: col === chosenCol };
    if (!isLegalMove(board, col)) return { ...base, kind: "illegal", score: null };
    if (score === null) return { ...base, kind: "unscored" };
    if (isWinScore(score)) return { ...base, kind: "win", movesToMate: movesFromPlies(pliesToMate(score)) };
    if (isLossScore(score)) return { ...base, kind: "loss", movesToMate: movesFromPlies(pliesToMate(score)) };
    return { ...base, kind: "heuristic" };
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
  const text = describeKind(heat, col);
  return heat.chosen ? `${text} (AI's move)` : text;
}

function describeKind(heat: ColumnHeat, col: number): string {
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

/** Badge shown under a column in the heatmap view, or null for none. */
export function columnBadge(heat: ColumnHeat): string | null {
  switch (heat.kind) {
    case "illegal":
      return "Full";
    case "win":
      return `Win in ${heat.movesToMate}`;
    case "loss":
      return `Loss in ${heat.movesToMate}`;
    default:
      return null;
  }
}

/** Compact badge for narrow screens: "W2", "L1", "Full". */
export function shortBadge(heat: ColumnHeat): string | null {
  switch (heat.kind) {
    case "win":
      return `W${heat.movesToMate}`;
    case "loss":
      return `L${heat.movesToMate}`;
    default:
      return columnBadge(heat);
  }
}

/** Headline value for a column in the analysis panel. */
export function verdictLabel(heat: ColumnHeat): string {
  switch (heat.kind) {
    case "illegal":
      return "Full";
    case "unscored":
      return "Not scored";
    case "heuristic": {
      const score = Math.round(heat.score!);
      return score > 0 ? `+${score}` : String(score);
    }
    default:
      return columnBadge(heat)!;
  }
}

/** One-sentence explanation of a column for the analysis panel. */
export function explainColumn(heat: ColumnHeat, isBest: boolean): string {
  const plural = (n: number) => (n === 1 ? "move" : "moves");
  switch (heat.kind) {
    case "illegal":
      return "The column is full.";
    case "unscored":
      return "The engine did not evaluate this column.";
    case "win":
      return `Forces a win in ${heat.movesToMate} ${plural(heat.movesToMate!)}, whatever the opponent does.`;
    case "loss":
      return `The opponent can force a win in ${heat.movesToMate} ${plural(heat.movesToMate!)}.`;
    case "heuristic":
      return isBest
        ? "No forced result within the search; the strongest position by the evaluation."
        : "No forced result within the search; scored by open lines and centre control.";
  }
}

/**
 * Legal columns ordered best first: wins (fastest first), then evaluations,
 * then losses (slowest first). Ties keep the more central column first.
 */
export function rankColumns(heats: ColumnHeat[]): number[] {
  const centre = (heats.length - 1) / 2;
  return heats
    .map((h, col) => ({ h, col }))
    .filter(({ h }) => h.kind !== "illegal" && h.score !== null)
    .sort((a, b) => b.h.score! - a.h.score! || Math.abs(a.col - centre) - Math.abs(b.col - centre))
    .map(({ col }) => col);
}
