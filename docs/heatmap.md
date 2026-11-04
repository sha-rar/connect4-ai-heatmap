# Heatmap display rules

The engine's per-column scores (`columnScores` from [`chooseMove()`](api.md)) are shown in two places:

- **Heatmap view** on the board: each column's surface is tinted behind the discs, and a strip under the board shows a badge per column.
- **Analysis panel** beside the board (below it on small screens): the legal columns ranked best first, each with its verdict, a strength bar and a one-line explanation, plus engine statistics (depth reached, time, positions searched) in a collapsible section.

The **Standard / Heatmap** switch in the analysis panel turns the board tints and badges off or on; the panel keeps listing the scores either way. The choice is remembered in the browser.

Classification lives in [`apps/web/src/lib/heatmap.ts`](../apps/web/src/lib/heatmap.ts) and is engine-independent, so the C++ engine only has to return scores on the agreed scale.

Scores are always from the perspective of the side the engine analysed: the AI before its move, or the player to move when they ask for a hint ("Hint: analyse my move", or "Analyse position" in two-player mode).

## Column kinds

Rules are applied in this order; the first match wins.

| Kind        | Condition | Board tint | Badge (narrow screens) | Panel verdict | Tooltip |
| ----------- | --------- | ---------- | ---------------------- | ------------- | ------- |
| `illegal`   | Column is full on the **current** board (ignores any score) | Dark diagonal hatching; button disabled | `Full` | not listed | `Column N is full` |
| `unscored`  | Legal, score is `null` | None | — | not listed | `Drop in column N` |
| `win`       | `isWinScore(score)` (`score >= WIN_SCORE - 42`) | Green | `Win in n` (`Wn`) | `Win in n` | `Column N: forced win in n moves` |
| `loss`      | `isLossScore(score)` (`score <= -WIN_SCORE + 42`) | Dark red | `Loss in n` (`Ln`) | `Loss in n` | `Column N: forced loss in n moves` |
| `heuristic` | Any other number | White, opacity scaled by relative strength | the score, e.g. `+35` | the score | `Column N score: S` |

The analysis panel ranks columns by score: wins (fastest first), then evaluations, then losses (slowest first), with ties going to the more central column.

### Moves to mate

`n` counts the moves made by the side that wins, with the column's own move counting as move 1 for a win:

- `pliesToMate(score)` gives the plies from the root, `0` for an immediate win.
- `n = max(1, ceil(plies / 2))`. So `WIN_SCORE` and `WIN_SCORE - 1` show "Win in 1", `WIN_SCORE - 3` shows "Win in 2", `-WIN_SCORE + 2` shows "Loss in 1" (the opponent wins on their next move).

### Heuristic shading

- Intensity is `(score - min) / (max - min)` over **heuristic columns only**, so a single mate score does not flatten the other columns to the same shade.
- If every heuristic column has the same score, they all use intensity `0.5`.
- Tint opacity is `0.04 + 0.36 × intensity`. Tints sit on the blue board surface, behind the holes and discs, so discs keep their colours.
- A draw (score `0`) is not distinguished from an evaluation of `0`; it is shaded as a heuristic column.

## Chosen column

The column the AI played gets a white outline, an `AI` label under its badge, an "AI's move" tag in the analysis panel, and a tooltip ending with "(AI's move)". A hint marks its top column "Suggested" instead. For the C++ engine, this column holds the highest score in the heatmap, except on the empty board: there the AI plays the centre by rule, while the shading shows the opening book's depth-limited scores, which rate column 2 higher. The marker stays even if the move filled the column.

## Lifecycle

- The analysis describes the current position, or the position the AI just played from. It disappears once another move is made, and after Undo or New game.
- `illegal` is always derived from the current board, so a column filled by the AI's own move shows as `Full` immediately.

## Engine differences

The website uses the C++ engine (WebAssembly), which scores every legal column on every move, including opening-book moves, and never shows partial results.

### Known limitations of the TypeScript engine

The display rules are correct for a complete search, but the TypeScript engine does not always provide one (see [api.md](api.md#known-gaps-in-the-current-typescript-engine)):

- Opening-book and win/block shortcuts leave other columns `unscored`.
- A forced block is reported as `WIN_SCORE`, so it shows as "Win in 1" even in a lost position.
- Columns searched after the time limit expires are `unscored` or carry partial scores.
