# Heatmap display rules

The heatmap overlays one tile per column, driven by `columnScores` from [`chooseMove()`](api.md). Classification lives in [`apps/web/src/lib/heatmap.ts`](../apps/web/src/lib/heatmap.ts) and is engine-independent, so the C++ engine only has to return scores on the agreed scale.

Scores are always from the perspective of the player the AI moved for.

## Column kinds

Rules are applied in this order; the first match wins.

| Kind        | Condition | Display | Badge | Tooltip |
| ----------- | --------- | ------- | ----- | ------- |
| `illegal`   | Column is full on the **current** board (ignores any score) | Dark diagonal hatching, `not-allowed` cursor, button disabled | `Full` | `Column N is full` |
| `unscored`  | Legal, score is `null` | No tint | — | `Drop in column N` |
| `win`       | `isWinScore(score)` (`score >= WIN_SCORE - 42`) | Green tint and outline | `Wn` | `Column N: forced win in n moves` |
| `loss`      | `isLossScore(score)` (`score <= -WIN_SCORE + 42`) | Red tint and outline | `Ln` | `Column N: forced loss in n moves` |
| `heuristic` | Any other number | Blue tint, opacity scaled by relative strength | — | `Column N score: S` |

### Moves to mate

`n` counts the moves made by the side that wins, with the column's own move counting as move 1 for a win:

- `pliesToMate(score)` gives the plies from the root, `0` for an immediate win.
- `n = max(1, ceil(plies / 2))`. So `WIN_SCORE` and `WIN_SCORE - 1` show `W1`, `WIN_SCORE - 3` shows `W2`, `-WIN_SCORE + 2` shows `L1` (the opponent wins on their next move).

### Heuristic shading

- Intensity is `(score - min) / (max - min)` over **heuristic columns only**, so a single mate score does not flatten the other columns to the same shade.
- If every heuristic column has the same score, they all use intensity `0.5`.
- Tint opacity is `0.06 + 0.22 × intensity`; outline opacity is `0.55 × intensity`.
- A draw (score `0`) is not distinguished from an evaluation of `0`; it is shaded as a heuristic column.

## Lifecycle

- The heatmap is cleared when the human moves, and redrawn when the AI returns a result.
- `illegal` is always derived from the current board, so a column filled by the AI's own move shows as `Full` immediately.

## Known limitations of the TypeScript engine

The display rules are correct for a complete search, but the current engine does not always provide one (see [api.md](api.md#known-gaps-in-the-current-typescript-engine)):

- Opening-book and win/block shortcuts leave other columns `unscored`.
- A forced block is reported as `WIN_SCORE`, so it shows as `W1` even in a lost position.
- Columns searched after the time limit expires are `unscored` or carry partial scores.
