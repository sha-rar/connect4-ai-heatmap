import type { ColumnHeat } from "../../lib/heatmap";

/** Horizontal strength bar for one column in the analysis panel. */
export function EvalBar({ heat }: { heat: ColumnHeat }) {
  // Wins fill the bar, losses barely show, evaluations scale between them.
  const fill =
    heat.kind === "win"
      ? 1 - (heat.movesToMate! - 1) * 0.03
      : heat.kind === "loss"
        ? 0.04 + Math.min(heat.movesToMate!, 10) * 0.01
        : 0.15 + heat.intensity * 0.65;
  return (
    <div className={`eval-bar kind-${heat.kind}`} aria-hidden="true">
      <div className="eval-fill" style={{ width: `${Math.round(Math.max(0.04, Math.min(1, fill)) * 100)}%` }} />
    </div>
  );
}
