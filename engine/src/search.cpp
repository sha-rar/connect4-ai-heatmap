#include "connect4/search.hpp"

#include <algorithm>
#include <chrono>

namespace connect4 {

namespace {

/// Columns from the centre outwards; good moves tend to be central.
constexpr std::array<int, kWidth> kMoveOrder = {3, 2, 4, 1, 5, 0, 6};

/// Larger than any reachable score.
constexpr int kInfinity = kWinScore + 1;

class Searcher {
public:
    Searcher(TranspositionTable& tt, int rootPlayer) : tt_(tt), rootPlayer_(rootPlayer) {}

    /// Negamax with alpha-beta pruning. Scores are from the perspective of
    /// the player to move in `pos`; `ply` counts moves made since the root.
    int negamax(const Position& pos, int depth, int alpha, int beta, int ply) {
        ++nodes_;

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

    std::uint64_t nodes() const { return nodes_; }

private:
    TranspositionTable& tt_;
    int rootPlayer_;
    std::uint64_t nodes_ = 0;
};

}  // namespace

SearchResult Engine::chooseMove(const Position& pos, const SearchOptions& options) {
    const auto start = std::chrono::steady_clock::now();
    SearchResult result;
    if (pos.lastMoverWon() || pos.isFull()) return result;

    tt_.newSearch();
    const int depth = std::max(1, options.depth);
    Searcher searcher(tt_, pos.toMove());

    int bestScore = -kInfinity;
    for (const int col : kMoveOrder) {
        if (!pos.canPlay(col)) continue;

        int score;
        if (pos.isWinningMove(col)) {
            score = kWinScore;  // contract: an immediate win scores exactly kWinScore
        } else {
            Position child = pos;
            child.play(col);
            score = -searcher.negamax(child, depth - 1, -kInfinity, kInfinity, 1);
        }

        result.columnScores[static_cast<std::size_t>(col)] = score;
        if (score > bestScore) {
            bestScore = score;
            result.bestCol = col;
        }
    }

    const auto elapsed = std::chrono::steady_clock::now() - start;
    result.bestScore = bestScore;
    result.nodes = searcher.nodes();
    result.ms = static_cast<int>(std::chrono::duration_cast<std::chrono::milliseconds>(elapsed).count());
    result.usedDepth = depth;
    return result;
}

}  // namespace connect4
