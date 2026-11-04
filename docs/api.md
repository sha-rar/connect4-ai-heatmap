# `chooseMove()` contract

Every AI engine (the C++/WASM engine the website uses, and the original TypeScript engine kept for benchmarks) must accept the same input and return the same output. The TypeScript types live in [`packages/core/src/engine.ts`](../packages/core/src/engine.ts).

## Board representation

- 6 rows × 7 columns, stored row-major as a flat array of length 42.
- Index of `(row, col)` is `row * 7 + col`. Row 0 is the **top** row, row 5 the bottom.
- Cell values: `0` empty, `1` player 1 (red), `2` player 2 (yellow).

## Input

| Field         | Type       | Required | Constraints | Default |
| ------------- | ---------- | -------- | ----------- | ------- |
| `board`       | `Cell[42]` | yes      | Valid, reachable position (see below) | — |
| `player`      | `1 \| 2`   | yes      | The player to move | — |
| `depth`       | integer    | no       | 1–12 plies | 6 |
| `timeLimitMs` | integer    | no       | 10–2000 ms | 250 |

Preconditions — callers must only request a move for a position that:

- obeys gravity (no empty cell below a disc),
- has piece counts consistent with `player` (player 1 moves when counts are equal; player 2 when player 1 has one more disc),
- is not terminal (no winner and at least one legal move).

Behaviour for positions that violate these preconditions is undefined.

## Output

| Field          | Type                    | Meaning |
| -------------- | ----------------------- | ------- |
| `bestCol`      | integer 0–6             | Column the engine plays. Always a legal move. |
| `bestScore`    | number                  | Score of `bestCol` from the mover's perspective. |
| `columnScores` | `(number \| null)[7]`   | Score per column from the mover's perspective. `null` = illegal (full) or not evaluated. |
| `nodes`        | integer ≥ 0             | Search nodes visited. |
| `ms`           | integer ≥ 0             | Wall-clock time spent. |
| `usedDepth`    | integer                 | Deepest fully completed search depth; all scores come from it. |
| `opening`      | boolean                 | `true` when the move came from the opening book. |

The website's `chooseMove()` wraps the result as `{ ok: true, ...result }`, or `{ ok: false, error }` on failure.

### Score scale

- Positive scores favour the mover, negative scores favour the opponent, `0` is balanced or a draw.
- `WIN_SCORE = 1_000_000`. A forced win in `p` plies scores `WIN_SCORE - p`; a forced loss scores `-WIN_SCORE + p`. An immediate win scores `WIN_SCORE`.
- Any score with `|score| >= WIN_SCORE - 42` (`MAX_PLY`) is a mate score. Use `isWinScore`, `isLossScore` and `pliesToMate` from `@connect4/core` instead of comparing raw numbers.
- All other scores are heuristic and only comparable within one result.

### Invariants

1. `columnScores.length === 7`.
2. `columnScores[c] === null` for every full column.
3. `bestCol` is legal for `board`.
4. When the move is not a shortcut (opening book or immediate tactic), `columnScores[bestCol] === bestScore` and no other column scores higher.

## Known gaps in the original TypeScript engine

These are documented so the C++ engine can be measured against them, not copied:

- **Shortcuts return sparse heatmaps.** Opening-book and immediate win/block moves return `null` for every column except `bestCol`, and report `nodes: 0`.
- **Blocks are scored as wins.** The block shortcut reports `WIN_SCORE` for the blocking column, even when the position is lost (see the `double-threat` fixture).
- **Time cut-offs leak partial scores.** When the time limit expires, `search()` returns a heuristic score mid-search, stores it in the transposition table as if complete, and later root columns stay `null`.
- **`usedDepth` is the requested depth,** not the deepest completed iteration.

The C++ engine must keep the input/output shape above, and should close these gaps (see Phase 2 and Phase 4 of the roadmap).

## C++ engine status

The native C++ engine ([engine/](../engine/README.md)) closes these gaps:

- It has no shortcuts. Every legal column is scored by a full search, and a forced block scores as the loss or draw it really is.
- Iterative deepening discards any iteration the time limit interrupts, so scores always come from a completed search.
- `usedDepth` is the deepest completed iteration. The requested depth is capped at the number of empty cells.
- `opening` is `true` when the answer comes from the opening book: every position with up to 3 discs, precomputed at depth 16. Book scores are depth-limited evaluations, not solved game values. A book answer has `nodes: 0`, `usedDepth: 16` and a full set of column scores. The book is used only when the requested depth is at most 16.
- `columnScores[bestCol] === bestScore` holds for every answer. `bestCol` is the highest-scored column, with ties going to the more central column, whether searched, time-limited or from the book, with one exception: on the empty board, a book answer always plays column 3, the known winning first move, even though its depth-limited score is below column 2's.

The website calls it through `chooseMove()` in [`apps/web/src/lib/api.ts`](../apps/web/src/lib/api.ts). That function posts the request to a Web Worker running the WebAssembly build, and never rejects: failures resolve as `{ ok: false, error }`, for example for an invalid position or a game that is already over. The worker's response also includes `timedOut: boolean`. There is no HTTP endpoint: the original Express server was removed, and the TypeScript engine in `apps/api/src/engine/` is called directly by the benchmarks and tests.
