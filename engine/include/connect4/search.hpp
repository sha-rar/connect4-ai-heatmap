#pragma once

#include <array>
#include <cstdint>
#include <optional>

#include "connect4/evaluate.hpp"
#include "connect4/position.hpp"
#include "connect4/tt.hpp"

namespace connect4 {

/// Inputs of chooseMove(); mirrors ChooseMoveOptions in docs/api.md.
struct SearchOptions {
    /// Maximum search depth in plies, counting the root move. Clamped to
    /// [1, empty cells]; searching past the end of the game changes nothing.
    int depth = 6;
    /// Time budget in milliseconds; 0 or less means no limit. Depth 1 always
    /// completes, so a very short budget can be exceeded.
    int timeLimitMs = 250;
    /// Answer from the opening book when it covers the position at least as
    /// deeply as `depth`. The book holds precomputed search results, so the
    /// answer equals a fresh search at the book's depth, only instantly.
    bool useBook = true;
};

/// Output of chooseMove(); mirrors ChooseMoveResult in docs/api.md.
struct SearchResult {
    /// Column to play, or -1 if the position is already over.
    int bestCol = -1;
    /// Score of bestCol from the mover's perspective.
    int bestScore = 0;
    /// Exact score of every legal column; nullopt for full columns.
    std::array<std::optional<int>, kWidth> columnScores{};
    /// Search nodes visited.
    std::uint64_t nodes = 0;
    /// Wall-clock time in milliseconds.
    int ms = 0;
    /// Deepest fully completed iteration; the scores come from this depth.
    int usedDepth = 0;
    /// True when the time limit stopped the search before the requested depth.
    bool timedOut = false;
    /// True when the result came from the opening book (nodes is then 0 and
    /// usedDepth is the book's depth).
    bool opening = false;
};

/// Search engine. Owns the transposition table, so create one and reuse it
/// for every move rather than constructing it per call.
class Engine {
public:
    /// `ttLog2Entries` sets the table to 2^n entries of 16 bytes (default 16 MiB).
    explicit Engine(int ttLog2Entries = 20) : tt_(ttLog2Entries) {}

    /// Pick a move for the player to move in `pos`.
    ///
    /// Uses iterative deepening: depths 1, 2, ... are searched in turn, and an
    /// iteration cut short by the time limit is discarded, so the result always
    /// comes from a complete search. Every legal root column is searched with a
    /// full window, so columnScores are exact minimax values at usedDepth. Scores use the shared
    /// scale: kWinScore - p for a win p plies from the root (kWinScore for an
    /// immediate win), -kWinScore + p for a loss, otherwise evaluate().
    SearchResult chooseMove(const Position& pos, const SearchOptions& options = {});

    /// Forget everything learned in earlier searches.
    void clear() { tt_.clear(); }

private:
    TranspositionTable tt_;
};

}  // namespace connect4
