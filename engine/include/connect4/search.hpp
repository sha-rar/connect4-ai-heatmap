#pragma once

#include <array>
#include <cstdint>
#include <optional>

#include "connect4/evaluate.hpp"
#include "connect4/position.hpp"

namespace connect4 {

/// Inputs of chooseMove(); mirrors ChooseMoveOptions in docs/api.md.
struct SearchOptions {
    /// Search depth in plies, counting the root move. Clamped to at least 1.
    int depth = 6;
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
    /// Depth of the search the scores come from.
    int usedDepth = 0;
    /// True when the move came from an opening book (never, for now).
    bool opening = false;
};

/// Pick a move for the player to move in `pos`.
///
/// Every legal root column is searched with a full window, so columnScores
/// are exact minimax values at the searched depth. Scores use the shared
/// scale: kWinScore - p for a win p plies from the root (kWinScore for an
/// immediate win), -kWinScore + p for a loss, otherwise evaluate().
SearchResult chooseMove(const Position& pos, const SearchOptions& options = {});

}  // namespace connect4
