#include "connect4/search.hpp"

#include <algorithm>
#include <chrono>

namespace connect4 {

namespace {

using Clock = std::chrono::steady_clock;

/// Columns from the centre outwards; good moves tend to be central.
constexpr std::array<int, kWidth> kMoveOrder = {3, 2, 4, 1, 5, 0, 6};

/// Larger than any reachable score.
constexpr int kInfinity = kWinScore + 1;

/// Check the clock once every this many nodes (must be a power of two).
constexpr std::uint64_t kTimeCheckInterval = 1024;

using ColumnScores = std::array<std::optional<int>, kWidth>;

class Searcher {
public:
    Searcher(TranspositionTable& tt, int rootPlayer, Clock::time_point deadline, bool hasDeadline)
        : tt_(tt), rootPlayer_(rootPlayer), deadline_(deadline), hasDeadline_(hasDeadline) {}

    /// Search every legal root column to `depth` with a full window.
    /// Returns false if the time limit interrupted the iteration; `scores` is
    /// then incomplete and must be ignored.
    bool searchRoot(const Position& pos, int depth, bool abortable, ColumnScores& scores) {
        abortable_ = abortable && hasDeadline_;
        stopped_ = false;
        scores = {};

        for (const int col : kMoveOrder) {
            if (!pos.canPlay(col)) continue;

            int score;
            if (pos.isWinningMove(col)) {
                ++nodes_;
                score = kWinScore;  // contract: an immediate win scores exactly kWinScore
            } else {
                Position child = pos;
                child.play(col);
                score = -negamax(child, depth - 1, -kInfinity, kInfinity, 1);
                if (stopped_) return false;
            }
            scores[static_cast<std::size_t>(col)] = score;
        }
        return true;
    }

    std::uint64_t nodes() const { return nodes_; }

    bool pastDeadline() const { return hasDeadline_ && Clock::now() >= deadline_; }

private:
    /// Negamax with alpha-beta pruning. Scores are from the perspective of
    /// the player to move in `pos`; `ply` counts moves made since the root.
    /// Once stopped_ is set the return value is meaningless and nothing more
    /// is written to the transposition table.
    int negamax(const Position& pos, int depth, int alpha, int beta, int ply) {
        ++nodes_;
        if (abortable_ && (nodes_ & (kTimeCheckInterval - 1)) == 0 && pastDeadline()) stopped_ = true;
        if (stopped_) return 0;

        if (pos.isFull()) return 0;
        if (depth <= 0) {
            // evaluate() is not symmetric between players, so always score
            // from the root player's side and flip for the opponent.
            const int score = evaluate(pos, rootPlayer_);
            return pos.toMove() == rootPlayer_ ? score : -score;
        }

        const Bitboard key = pos.key();
        if (const TTEntry* entry = tt_.probe(key); entry && entry->depth >= depth) {
            switch (entry->bound) {
                case Bound::Exact: return entry->score;
                case Bound::Lower: alpha = std::max(alpha, entry->score); break;
                case Bound::Upper: beta = std::min(beta, entry->score); break;
            }
            if (alpha >= beta) return entry->score;
        }
        // Classify the result against the window actually searched, after
        // any narrowing from the table.
        const int alphaSearched = alpha;

        int best = -kInfinity;
        for (const int col : kMoveOrder) {
            if (!pos.canPlay(col)) continue;

            // A win on this move is the best result available here.
            if (pos.isWinningMove(col)) {
                ++nodes_;
                return kWinScore - (ply + 1);
            }

            Position child = pos;
            child.play(col);
            const int score = -negamax(child, depth - 1, -beta, -alpha, ply + 1);
            if (stopped_) return 0;  // partial result: do not store

            best = std::max(best, score);
            alpha = std::max(alpha, best);
            if (alpha >= beta) break;
        }

        const Bound bound = best <= alphaSearched ? Bound::Upper
                            : best >= beta        ? Bound::Lower
                                                  : Bound::Exact;
        tt_.store(key, depth, best, bound);
        return best;
    }

    TranspositionTable& tt_;
    int rootPlayer_;
    Clock::time_point deadline_;
    bool hasDeadline_;
    bool abortable_ = false;
    bool stopped_ = false;
    std::uint64_t nodes_ = 0;
};

}  // namespace

SearchResult Engine::chooseMove(const Position& pos, const SearchOptions& options) {
    const auto start = Clock::now();
    SearchResult result;
    if (pos.lastMoverWon() || pos.isFull()) return result;

    tt_.newSearch();
    const int remaining = kCells - pos.moves();
    const int maxDepth = std::clamp(options.depth, 1, remaining);
    const bool hasDeadline = options.timeLimitMs > 0;
    Searcher searcher(tt_, pos.toMove(), start + std::chrono::milliseconds(options.timeLimitMs),
                      hasDeadline);

    ColumnScores scores;
    for (int depth = 1; depth <= maxDepth; ++depth) {
        // Depth 1 always runs to completion so there is always a move.
        const bool first = depth == 1;
        if (!first && searcher.pastDeadline()) {
            result.timedOut = true;
            break;
        }
        if (!searcher.searchRoot(pos, depth, !first, scores)) {
            result.timedOut = true;
            break;
        }
        result.columnScores = scores;
        result.usedDepth = depth;
    }

    int bestScore = -kInfinity;
    for (const int col : kMoveOrder) {  // ties go to the more central column
        const auto& score = result.columnScores[static_cast<std::size_t>(col)];
        if (score && *score > bestScore) {
            bestScore = *score;
            result.bestCol = col;
        }
    }

    result.bestScore = bestScore;
    result.nodes = searcher.nodes();
    result.ms = static_cast<int>(
        std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - start).count());
    return result;
}

}  // namespace connect4
