# Testing

The project has four layers of tests. GitHub Actions runs all of them on every push to `main` and on every pull request ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

| Layer | Where | Run locally |
| ----- | ----- | ----------- |
| C++ unit tests | [`engine/tests/`](../engine/tests) | `ctest --test-dir engine/build --output-on-failure` |
| TypeScript unit tests | `packages/core/tests/`, `tests/api/`, `tests/web/` | `pnpm test` |
| Shared rule tests (TypeScript and C++) | [`tests/shared/`](../tests/shared), [`engine/tests/test_rules.cpp`](../engine/tests/test_rules.cpp) | both of the above |
| Browser tests | [`tests/e2e/`](../tests/e2e) | `pnpm test:e2e` |

## C++ unit tests

A small dependency-free harness ([`harness.hpp`](../engine/tests/harness.hpp)) with one CTest entry per `TEST_CASE`, so failures are reported by name. The tests cover:

- **Rules and bitboards:** moves, wins in every direction, no wrap-around between columns, board parsing, winning-cell detection, mirroring.
- **Evaluation:** identical scores to the TypeScript evaluation on 215 positions (`tests/fixtures/evaluations.json`).
- **Search:** exact agreement with an unpruned reference minimax, time limits, iterative deepening, and the heatmap invariant.
- **Transposition table:** storing and probing every field, generations, the replacement policy and generation wrap-around.
- **Opening book:** coverage, mirror symmetry, agreement with a fresh search, and the empty-board opening rule.
- **WebAssembly bindings:** the C ABI, compiled natively.

## Shared rule tests

The website uses the TypeScript rules in `@connect4/core` to draw the board and detect the end of the game. The AI uses the C++ engine's rules. Both must agree.

[`tests/fixtures/games.json`](../tests/fixtures/games.json) holds 63 complete games, generated from the TypeScript rules by [`scripts/generate-games.ts`](../scripts/generate-games.ts) with a fixed seed. Each game records the legal columns after every move and the final result. The corpus includes every win direction, wins for both players, full columns and drawn (full) boards.

Three checks replay the corpus:

- **TypeScript rules** ([`tests/shared/rules.test.ts`](../tests/shared/rules.test.ts)): legal moves and game status after every move, and the final board.
- **C++ engine, WebAssembly build** (same file): the columns the engine scores before every move match the legal moves, and the engine rejects the finished board as game over.
- **C++ engine, native build** ([`engine/tests/test_rules.cpp`](../engine/tests/test_rules.cpp)): legal moves, winner and full board after every move, the final board round-trips through both parsers, and no move is accepted after a win.

The browser tests also replay one game of each kind through the UI.

Regenerate the corpus with `pnpm fixtures:games` after changing the generator. The output is deterministic, so an unchanged generator reproduces the file exactly.

## Browser tests

[Playwright](https://playwright.dev) tests in [`tests/e2e/`](../tests/e2e) run in Chromium against the production build of the web app (`vite build` + `vite preview`), so they exercise the WebAssembly engine in its Web Worker with no API server. Any console error from the page or the worker fails the test. They check that:

- the start screen offers both modes and explains the game and the analysis, and Menu returns to it;
- the board starts empty with seven playable columns;
- the AI answers a human move; the heatmap scores all seven columns and the analysis panel ranks them, marking exactly one as the AI's move;
- the AI opens in column 3 from the opening book when it moves first, and still answers at Expert difficulty;
- Advanced settings switch the difficulty to Custom;
- Undo takes back the human move and the AI's reply (one move in two-player mode), and a hint analyses without playing;
- the Standard view hides the heatmap while the panel keeps the scores, and New game clears both;
- full columns are disabled;
- replayed games from the shared corpus end with the right result, highlight the winning discs, accept no further moves, and Play again starts a new game;
- on a phone-sized screen the board sits above the controls with no horizontal scrolling.

Install the browser once with `pnpm exec playwright install chromium`. Reports and traces of failed tests go to `tests/e2e/.report` and `tests/e2e/.results`.

## Continuous integration

| Job | Runs on | Steps |
| --- | ------- | ----- |
| Native engine (GCC, Clang, MSVC) | Ubuntu 24.04, Windows Server 2022 | Configure, build and run CTest in Release |
| WebAssembly engine | Ubuntu 24.04 | Install Emscripten 6.0.13 (cached), run `scripts/build-wasm.mjs`, and fail if the result differs from the committed `apps/web/src/engine/generated/` files |
| TypeScript and browser tests | Ubuntu 24.04, after the WebAssembly job | Type-check the web app, then `pnpm test` and `pnpm test:e2e`, using the WebAssembly engine built from the commit's sources; uploads the Playwright report on failure |

If the WebAssembly job reports a stale build, run `pnpm build:wasm` (see [engine/README.md](../engine/README.md#webassembly-build)) and commit the regenerated files.
