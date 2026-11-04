# How the engine chooses a move

This page explains how the C++ engine ([`engine/`](../engine/README.md)) turns a board into a move and a score for every column. It follows one call to `Engine::chooseMove()` from start to finish. The [`chooseMove()` contract](api.md) defines the inputs and outputs, and [heatmap.md](heatmap.md) covers how the UI displays the scores.

In outline:

1. If the opening book covers the position, answer from the book instantly.
2. Otherwise run iterative deepening: search every column to depth 1, then 2, then 3, until the requested depth or the time limit.
3. Each iteration scores every legal column with negamax and alpha–beta pruning, helped by a transposition table, move ordering and tactical pruning.
4. Keep the scores from the deepest iteration that finished, and play the highest-scoring column.

The code is in [`search.cpp`](../engine/src/search.cpp) (about 260 lines), with the board in [`position.hpp`](../engine/include/connect4/position.hpp), the evaluation in [`evaluate.cpp`](../engine/src/evaluate.cpp) and the table in [`tt.cpp`](../engine/src/tt.cpp).

## Board representation

A position is two 64-bit integers:

- `current`: the discs of the player to move.
- `mask`: every disc on the board.

The other player's discs are `current ^ mask`. Each column takes 7 bits: 6 for its cells, bottom to top, and one spare bit on top. The bit numbers are:

```
 6 13 20 27 34 41 48   spare (always empty)
 5 12 19 26 33 40 47   top row
 4 11 18 25 32 39 46
 3 10 17 24 31 38 45
 2  9 16 23 30 37 44
 1  8 15 22 29 36 43
 0  7 14 21 28 35 42   bottom row
```

This layout makes the common operations a few instructions each:

- **Playing a move.** Adding the column's bottom bit to `mask` carries up through the occupied cells and lands on the first empty one, so `mask |= mask + bottom(col)` drops a disc. Swapping `current` to the other player is `current ^= mask`, done just before.
- **Four in a row.** Shifting the board by 1 lines up vertical neighbours, by 7 horizontal neighbours, and by 6 and 8 the two diagonals. For each direction, `pairs = b & (b >> s)` followed by `pairs & (pairs >> 2s)` is non-zero exactly when four discs line up. The spare bit stops a line wrapping from the top of one column to the bottom of the next.
- **Winning cells.** The same shifts find every empty cell that would complete a line for a player, including cells that can't be played yet. The search uses these for move ordering and tactics.
- **A unique key.** `current + mask` identifies the position in 49 bits. The transposition table and the opening book both use it.

## Scores

All scores are from the point of view of the player to move. Positive is good for them, and 0 is balanced or a draw.

- **Forced results** use `WIN_SCORE = 1,000,000`. A win `p` plies from the root scores `WIN_SCORE - p`, and a loss scores `-WIN_SCORE + p`, so faster wins and slower losses score higher. An immediate win at the root scores exactly `WIN_SCORE`.
- **Everything else** is a heuristic evaluation, far smaller than any forced result.

The UI turns forced scores into "Win in n" and "Loss in n", as described in [heatmap.md](heatmap.md#moves-to-mate).

## Evaluation

When the search reaches its depth limit without the game ending, it estimates the position with a static evaluation. The engine looks at all 69 groups of four cells that could form a line (24 horizontal, 21 vertical and 24 diagonal) and scores each group:

| Group contains | Score |
| -------------- | ----- |
| 3 of the AI's discs and 1 empty cell | +120 |
| 2 of the AI's discs and 2 empty cells | +12 |
| 3 of the opponent's discs and 1 empty cell | −140 |
| 2 of the opponent's discs and 2 empty cells | −14 |

It then adds 8 for each of the AI's discs in the centre column, and a completed line scores `±WIN_SCORE`.

The opponent's threats weigh more than the AI's own, and only the AI gets the centre bonus. That makes the evaluation **asymmetric**: it always scores from the side of the player the search started for (the *root player*), and the search flips the sign at the opponent's turns. The weights match the original TypeScript engine exactly, and a test checks the two agree on 215 positions.

## Search

### Negamax with alpha–beta pruning

Negamax is minimax written once for both players: a position's value is the best of the *negated* values of its children, because what is good for one player is bad for the other.

Alpha–beta pruning skips moves that can't change the result. The search carries a window `[alpha, beta]`: `alpha` is the score the player to move is already guaranteed, and `beta` is the most the opponent will allow. As soon as one move reaches `beta`, the opponent would never let the game get here, so the remaining moves are skipped. This gives the same answer as plain minimax while visiting far fewer positions, especially when the best move is tried first.

At every node the search, in order:

1. counts the node, and checks the clock every 1,024 nodes;
2. returns 0 if the board is full (a draw);
3. returns the evaluation if the depth limit is reached;
4. returns a win next move (`WIN_SCORE - (ply + 1)`) if the player to move can complete a line;
5. applies the tactical rules below;
6. consults the transposition table;
7. searches the remaining moves in order, best-looking first, and stores the result.

### Tactical pruning

When at least two plies of depth remain, four rules remove moves the search would only have proved to be losing:

- **Two threats.** If the opponent can complete a line in two playable cells, one block can't stop both, so the position is scored as a loss on the opponent's next move.
- **Forced block.** If the opponent threatens exactly one playable cell, that cell is the only move searched.
- **Don't play underneath.** A move directly below an opponent's winning cell lets them win on top, so it is skipped. If no moves remain, the position is a loss.
- **Cap beta.** With no immediate win, the best result left is a win on the move after next, `WIN_SCORE - (ply + 3)`. Lowering `beta` to that value lets more moves be cut off.

Each rule only removes moves whose exact value is a loss on the opponent's very next move, and that loss falls inside the search depth. The scores therefore stay exactly what plain minimax would return. The tests check this on more than 200 tactical positions.

### Move ordering

Alpha–beta prunes the most when good moves come first. Moves are tried in this order:

1. the best move stored in the transposition table for this position, from earlier in the search or from a shallower iteration;
2. moves that create the most winning cells for the player making them;
3. centre columns before edge columns (3, 2, 4, 1, 5, 0, 6) to break ties.

Ordering only changes speed, never the scores.

### Transposition table

Many move orders reach the same position, so the engine caches results. The table holds 2^20 entries of 16 bytes (16 MiB). Each entry stores the position key, the score, the depth it was searched to, whether the score is exact or only a bound, and the best move.

- **Bounds.** A cut-off means the score is only a lower bound, and a node where nothing beat `alpha` gives an upper bound. On a later visit at the same or lower depth, an exact score is returned at once, and a bound narrows the window.
- **Placement.** The key is hashed (Fibonacci hashing) to a bucket of two entries. A new result replaces an entry from an earlier search first, otherwise the shallower of the two. A result for a position already stored only overwrites it if it is at least as deep.
- **Generations.** Every `chooseMove()` call starts a new generation, and only entries from the current generation are used. Stored scores depend on who the root player is (because the evaluation is asymmetric) and on the distance from the root (for forced results). Both are fixed within one call, so cached results are always exactly right.

## Iterative deepening and the time limit

Rather than searching straight to the requested depth, the engine searches to depth 1, then 2, and so on. Each iteration is cheap compared with the next, and it fills the transposition table with best moves that make the next iteration's ordering much better.

At the root, every legal column is searched with a full window, so each gets an exact score rather than a bound. The heatmap needs this.

The time limit works as follows:

- Depth 1 always runs to completion, so there is always a legal move to play, even if that overruns a tiny time limit.
- Before each later iteration, and every 1,024 nodes during it, the engine checks the clock.
- If time runs out partway through an iteration, that iteration is **discarded**: none of its scores are used, and nothing more is written to the table.

The result reports `usedDepth`, the deepest iteration that finished, and every column score comes from that iteration. The requested depth is capped at the number of empty cells, since searching past the end of the game changes nothing.

## Choosing the move

`bestCol` is the column with the highest score, with ties going to the more central column. Because the move and the heatmap come from the same set of scores, the column the AI plays is always the top column in the analysis panel. The one exception is the empty-board rule below.

## Opening book

Early positions are slow to search deeply and come up in every game, so they are precomputed. [`src/book_data.inc`](../engine/src/book_data.inc) holds all seven column scores for every position with up to 3 discs, searched to depth 16 by the engine itself. A position and its mirror image share one entry, which leaves 151 entries.

The book is used when it covers the requested depth: any request for depth 16 or less. The answer then has `opening: true`, `nodes: 0` and `usedDepth: 16`, and a full heatmap.

Book scores are depth-limited evaluations, not solved game values. This matters on the empty board: at depth 16 the evaluation rates column 2 slightly above the centre, but the first player's only winning first move is the centre (Allis, 1988). A book answer for the empty board therefore always plays column 3, and still reports the book's scores unchanged.

## Compared with the original TypeScript engine

The C++ engine started as a port of the TypeScript engine in [`apps/api/src/engine/`](../apps/api/src/engine), which is kept as a reference for benchmarks and tests. Its evaluation is identical, but the search differs:

- Results never include scores from a search the time limit interrupted.
- Every legal column always gets a score. The TypeScript engine's win, block and opening shortcuts left most columns empty and scored a forced block as a win.
- `usedDepth` is the depth actually completed, not the depth requested.
- The board is two integers instead of an array, and the table uses numeric keys instead of strings.

At depth 12 the native build is 30–95 times faster on the benchmark positions. See [benchmarks.md](benchmarks.md) for the measurements, and [api.md](api.md#known-gaps-in-the-original-typescript-engine) for the original engine's gaps in detail.
