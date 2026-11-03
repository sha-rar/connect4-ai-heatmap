# Benchmarks

Baseline for the TypeScript engine (`apps/api/src/engine`), recorded before the C++ engine replaces it. The C++/WASM engine should be measured on the same positions and budgets (roadmap Phase 4).

## How to run

```sh
pnpm --filter @connect4/api bench            # depths 1–12, median of 3 runs
pnpm --filter @connect4/api bench --max-depth 8 --runs 5
```

Positions are the fixtures tagged `benchmark` in [`tests/fixtures/positions.json`](../tests/fixtures/positions.json): quiet mid-game positions with no immediate win or block, so the opening-book and tactic shortcuts never trigger.

## Summary (2026-11-03)

- **Throughput:** roughly 150–260 nodes/ms (≈0.2M nodes/s), likely limited by the string-keyed transposition table and array-copying move application.
- **Depth within the default 250 ms:** 7–9 plies in early mid-game positions, 12+ only late in the game.
- **App depth range 4–8 is close to the limit.** Depth 8 on `midgame-14` takes ~270 ms, so with the default 250 ms limit the search is cut off and returns partial heuristic scores (see the known gaps in [api.md](api.md)).
- **Default settings (depth 6) finish in 10–50 ms** and score every legal column.

## Baseline results

Node v24.11.1, win32/x64, median of 3 runs.

### Fixed depth (no time limit)

| Position | Depth | Nodes | Time (ms) | Nodes/ms |
| -------- | ----: | ----: | --------: | -------: |
| midgame-10 | 1 | 7 | 0.8 | 9 |
| midgame-10 | 2 | 56 | 1.3 | 42 |
| midgame-10 | 3 | 213 | 3.0 | 72 |
| midgame-10 | 4 | 982 | 6.2 | 158 |
| midgame-10 | 5 | 2896 | 13.9 | 208 |
| midgame-10 | 6 | 8572 | 35.9 | 239 |
| midgame-10 | 7 | 26041 | 107.6 | 242 |
| midgame-10 | 8 | 56894 | 219.8 | 259 |
| midgame-10 | 9 | 133557 | 514.7 | 259 |
| midgame-10 | 10 | 303616 | 1322.1 | 230 |
| midgame-10 | 11 | 601639 | 2724.5 | 221 |
| midgame-10 | 12 | 1311623 | 5163.0 | 254 |
| midgame-14 | 1 | 7 | 0.1 | 89 |
| midgame-14 | 2 | 56 | 0.4 | 146 |
| midgame-14 | 3 | 176 | 1.4 | 123 |
| midgame-14 | 4 | 1031 | 7.0 | 147 |
| midgame-14 | 5 | 1900 | 8.2 | 232 |
| midgame-14 | 6 | 8292 | 48.4 | 171 |
| midgame-14 | 7 | 13994 | 63.6 | 220 |
| midgame-14 | 8 | 42617 | 270.3 | 158 |
| midgame-14 | 9 | 79783 | 426.0 | 187 |
| midgame-14 | 10 | 211105 | 954.2 | 221 |
| midgame-14 | 11 | 326718 | 1606.8 | 203 |
| midgame-14 | 12 | 811298 | 3985.0 | 204 |
| midgame-18 | 1 | 6 | 0.1 | 64 |
| midgame-18 | 2 | 41 | 0.3 | 130 |
| midgame-18 | 3 | 151 | 0.8 | 197 |
| midgame-18 | 4 | 433 | 3.0 | 147 |
| midgame-18 | 5 | 1473 | 10.4 | 141 |
| midgame-18 | 6 | 3228 | 20.3 | 159 |
| midgame-18 | 7 | 8047 | 34.5 | 233 |
| midgame-18 | 8 | 15561 | 70.3 | 221 |
| midgame-18 | 9 | 34139 | 228.7 | 149 |
| midgame-18 | 10 | 58479 | 410.5 | 142 |
| midgame-18 | 11 | 107320 | 703.6 | 153 |
| midgame-18 | 12 | 177649 | 806.4 | 220 |
| midgame-22 | 1 | 5 | 0.0 | 147 |
| midgame-22 | 2 | 30 | 0.1 | 229 |
| midgame-22 | 3 | 110 | 0.4 | 245 |
| midgame-22 | 4 | 384 | 1.6 | 243 |
| midgame-22 | 5 | 1064 | 6.7 | 159 |
| midgame-22 | 6 | 2283 | 12.2 | 187 |
| midgame-22 | 7 | 5309 | 27.7 | 192 |
| midgame-22 | 8 | 9600 | 49.3 | 195 |
| midgame-22 | 9 | 16958 | 79.6 | 213 |
| midgame-22 | 10 | 25397 | 119.1 | 213 |
| midgame-22 | 11 | 38495 | 156.5 | 246 |
| midgame-22 | 12 | 46284 | 191.4 | 242 |

### Deepest complete search within a time budget

| Position | 100 ms | 250 ms | 1000 ms |
| -------- | -----: | -----: | -----: |
| midgame-10 | 6 | 8 | 9 |
| midgame-14 | 7 | 7 | 10 |
| midgame-18 | 8 | 9 | ≥12 |
| midgame-22 | 9 | ≥12 | ≥12 |

### Default settings (depth 6, 250 ms)

| Position | Best col | Nodes | Time (ms) | Hit time limit | Columns scored |
| -------- | -------: | ----: | --------: | :------------: | -------------: |
| midgame-10 | 4 | 8572 | 36.3 | no | 7/7 |
| midgame-14 | 2 | 8292 | 40.8 | no | 7/7 |
| midgame-18 | 5 | 3228 | 17.9 | no | 6/6 |
| midgame-22 | 6 | 2283 | 10.4 | no | 5/5 |
