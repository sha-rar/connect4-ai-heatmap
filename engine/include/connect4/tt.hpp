#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

#include "connect4/position.hpp"

namespace connect4 {

/// How a stored score relates to the true value of the position.
enum class Bound : std::uint8_t {
    Exact,  // score is the value
    Lower,  // value >= score (search failed high)
    Upper,  // value <= score (search failed low)
};

struct TTEntry {
    Bitboard key = 0;
    std::int32_t score = 0;
    std::uint16_t generation = 0;  // 0 = empty
    std::uint8_t depth = 0;
    Bound bound = Bound::Exact;
};
static_assert(sizeof(TTEntry) == 16);

/// Fixed-size transposition table with depth-preferred replacement.
///
/// Entries belong to a generation (one per chooseMove() call). Probes only
/// return entries from the current generation: stored scores depend on the
/// root player (evaluation is asymmetric) and on the ply from the root (mate
/// distance), and both are fixed within a single search because a position's
/// ply is determined by its disc count.
class TranspositionTable {
public:
    /// Table with 2^log2Entries slots of 16 bytes each.
    explicit TranspositionTable(int log2Entries = 20);

    /// Start a new search; older entries become invisible.
    void newSearch();

    /// Remove every entry.
    void clear();

    /// Entry for `key` from the current search, or nullptr.
    const TTEntry* probe(Bitboard key) const;

    /// Store a result, keeping a deeper entry for the same slot if one exists.
    void store(Bitboard key, int depth, int score, Bound bound);

    std::size_t capacity() const { return entries_.size(); }

private:
    std::size_t indexOf(Bitboard key) const;

    std::vector<TTEntry> entries_;
    int shift_;
    std::uint16_t generation_ = 1;
};

}  // namespace connect4
