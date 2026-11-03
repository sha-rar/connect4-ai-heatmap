// C ABI used by the WebAssembly build (and by native tests).
//
// The JavaScript side owns two Int32 buffers allocated with _malloc:
//   cells:  kCells values in the chooseMove() contract layout
//   result: kResultSize values, laid out as the C4_RESULT_* indices below
//
// Keep the indices in sync with apps/web/src/engine/wasmEngine.ts.

#include <cstdint>

#include "connect4/search.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define C4_EXPORT extern "C" EMSCRIPTEN_KEEPALIVE
#else
#define C4_EXPORT extern "C"
#endif

using namespace connect4;

namespace {

enum ResultIndex : int {
    kStatus = 0,      // 0 ok, 1 invalid position, 2 game already over
    kBestCol = 1,
    kBestScore = 2,
    kUsedDepth = 3,
    kMs = 4,
    kOpening = 5,     // 0 or 1
    kTimedOut = 6,    // 0 or 1
    kNodesLow = 7,    // nodes, low 32 bits
    kNodesHigh = 8,   // nodes, high 32 bits
    kScoredMask = 9,  // bit c set when column c has a score
    kColumnScores = 10,  // kWidth scores follow
    kResultSize = kColumnScores + kWidth,
};

enum Status : int { kOk = 0, kInvalidPosition = 1, kGameOver = 2 };

Engine& engine() {
    // 2^20 entries = 16 MiB; the WASM build allows memory growth.
    static Engine instance(20);
    return instance;
}

}  // namespace

/// Number of int32 values the result buffer must hold.
C4_EXPORT int c4_result_size() { return kResultSize; }

/// Clear the transposition table.
C4_EXPORT void c4_reset() { engine().clear(); }

/// Search `cells` for `player`. Writes kResultSize values to `result` and
/// returns the status code (also stored at result[0]).
C4_EXPORT int c4_choose_move(const std::int32_t* cells, int player, int depth, int timeLimitMs,
                             std::int32_t* result) {
    for (int i = 0; i < kResultSize; ++i) result[i] = 0;
    result[kBestCol] = -1;

    Cells board{};
    for (int i = 0; i < kCells; ++i) board[static_cast<std::size_t>(i)] = cells[i];

    const auto pos = Position::fromCells(board, player);
    if (!pos) return result[kStatus] = kInvalidPosition;
    if (pos->lastMoverWon() || pos->winner() != 0 || pos->isFull()) {
        return result[kStatus] = kGameOver;
    }

    const SearchResult r = engine().chooseMove(*pos, {depth, timeLimitMs});

    result[kStatus] = kOk;
    result[kBestCol] = r.bestCol;
    result[kBestScore] = r.bestScore;
    result[kUsedDepth] = r.usedDepth;
    result[kMs] = r.ms;
    result[kOpening] = r.opening ? 1 : 0;
    result[kTimedOut] = r.timedOut ? 1 : 0;
    result[kNodesLow] = static_cast<std::int32_t>(r.nodes & 0xffffffffu);
    result[kNodesHigh] = static_cast<std::int32_t>(r.nodes >> 32);

    std::int32_t mask = 0;
    for (int col = 0; col < kWidth; ++col) {
        const auto& score = r.columnScores[static_cast<std::size_t>(col)];
        if (!score) continue;
        mask |= 1 << col;
        result[kColumnScores + col] = *score;
    }
    result[kScoredMask] = mask;
    return kOk;
}
