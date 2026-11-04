import { useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import type { Board as BoardCells, Player } from "@connect4/core";
import { COLS, ROWS, findDropRow, getCell, idx } from "@connect4/core";

import type { ColumnHeat } from "../../lib/heatmap";
import { columnBadge, describeColumn, shortBadge } from "../../lib/heatmap";

type Props = {
  board: BoardCells;
  /** Column of the most recent move, animated as a falling disc. */
  lastMove: { row: number; col: number; key: number } | null;
  winCells: number[];
  heat: ColumnHeat[];
  showHeat: boolean;
  /** Disc shown above the hovered column, or null when the user cannot drop. */
  previewPlayer: Player | null;
  onDrop: (col: number) => void;
};

/** Overlay tint for a column in the heatmap view (see docs/heatmap.md). */
function heatStyle(h: ColumnHeat): CSSProperties | undefined {
  switch (h.kind) {
    case "win":
      return { background: "rgba(52, 211, 153, 0.55)", boxShadow: "inset 0 0 0 2px rgba(52, 211, 153, 0.9)" };
    case "loss":
      return { background: "rgba(127, 29, 29, 0.6)", boxShadow: "inset 0 0 0 2px rgba(248, 113, 113, 0.9)" };
    case "heuristic":
      return { background: `rgba(255, 255, 255, ${0.04 + h.intensity * 0.36})` };
    case "illegal":
      return {
        background: "repeating-linear-gradient(135deg, rgba(2, 6, 23, 0.35) 0 6px, transparent 6px 12px)"
      };
    default:
      return undefined;
  }
}

export function Board({ board, lastMove, winCells, heat, showHeat, previewPlayer, onDrop }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const won = winCells.length > 0;
  const winSet = new Set(winCells);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, col: number) {
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[(col + step + COLS) % COLS]?.focus();
  }

  const canPreview = previewPlayer !== null && hovered !== null && findDropRow(board, hovered) !== -1;

  return (
    <div className="board-frame" onMouseLeave={() => setHovered(null)}>
      <div className="board-preview" aria-hidden="true">
        {Array.from({ length: COLS }, (_, c) => (
          <div key={c} className="preview-slot">
            {canPreview && hovered === c ? <div className={`disc p${previewPlayer} ghost`} /> : null}
          </div>
        ))}
      </div>

      <div className={`board${won ? " board-won" : ""}`} data-testid="board">
        {/* Heat tints sit on the board surface, behind the holes and discs. */}
        {showHeat ? (
          <div className="board-heat" aria-hidden="true">
            {heat.map((h, c) => (
              <div key={c} className="heat-column" style={heatStyle(h)} />
            ))}
          </div>
        ) : null}
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const cell = getCell(board, r, c);
            const isLast = lastMove !== null && lastMove.row === r && lastMove.col === c;
            const classes = ["disc", `p${cell}`];
            if (isLast) classes.push("drop");
            if (winSet.has(idx(r, c))) classes.push("win");
            return (
              <div
                key={`${r}-${c}`}
                className={`slot${hovered === c && previewPlayer ? " slot-hover" : ""}`}
                data-testid={`cell-${r}-${c}`}
                data-player={cell}
              >
                {cell !== 0 ? (
                  <div
                    key={isLast ? lastMove!.key : "still"}
                    className={classes.join(" ")}
                    style={isLast ? ({ "--fall": r + 1 } as CSSProperties) : undefined}
                  />
                ) : null}
              </div>
            );
          })
        )}

        <div className="board-columns">
          {heat.map((h, c) => {
            const label = showHeat ? describeColumn(h, c) : h.kind === "illegal" ? `Column ${c + 1} is full` : `Drop in column ${c + 1}`;
            return (
              <button
                key={c}
                type="button"
                className={`column${showHeat && h.chosen ? " column-chosen" : ""}`}
                disabled={h.kind === "illegal"}
                aria-label={label}
                title={label}
                data-testid={`column-${c}`}
                onClick={() => onDrop(c)}
                onMouseEnter={() => setHovered(c)}
                onFocus={() => setHovered(c)}
                onBlur={() => setHovered(null)}
                onKeyDown={(e) => onKeyDown(e, c)}
              />
            );
          })}
        </div>
      </div>

      {showHeat ? (
        <div className="heat-strip" data-testid="heat-strip">
          {heat.map((h, c) => {
            const badge = columnBadge(h);
            return (
              <div key={c} className={`heat-badge kind-${h.kind}${h.chosen ? " chosen" : ""}`} title={describeColumn(h, c)}>
                {badge ? (
                  <>
                    <span className="long">{badge}</span>
                    <span className="short">{shortBadge(h)}</span>
                  </>
                ) : h.kind === "heuristic" ? (
                  <span>{h.score! > 0 ? `+${Math.round(h.score!)}` : Math.round(h.score!)}</span>
                ) : null}
                {h.chosen ? <span className="chosen-mark">AI</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
