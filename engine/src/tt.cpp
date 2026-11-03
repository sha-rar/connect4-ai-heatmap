#include "connect4/tt.hpp"

#include <algorithm>

namespace connect4 {

TranspositionTable::TranspositionTable(int log2Entries) {
    const int bits = std::clamp(log2Entries, 0, 30);
    entries_.resize(std::size_t{1} << bits);
    shift_ = 64 - bits;
}

void TranspositionTable::newSearch() {
    ++generation_;
    if (generation_ == 0) {  // wrapped: stale entries would look current again
        clear();
        generation_ = 1;
    }
}

void TranspositionTable::clear() {
    std::fill(entries_.begin(), entries_.end(), TTEntry{});
}

std::size_t TranspositionTable::indexOf(Bitboard key) const {
    if (shift_ == 64) return 0;  // single slot
    // Fibonacci hashing spreads the structured position keys across the table.
    return static_cast<std::size_t>((key * 0x9E3779B97F4A7C15ULL) >> shift_);
}

const TTEntry* TranspositionTable::probe(Bitboard key) const {
    const TTEntry& entry = entries_[indexOf(key)];
    if (entry.generation != generation_ || entry.key != key) return nullptr;
    return &entry;
}

void TranspositionTable::store(Bitboard key, int depth, int score, Bound bound, int bestMove) {
    TTEntry& entry = entries_[indexOf(key)];
    const bool stale = entry.generation != generation_;
    if (!stale && depth < entry.depth) return;  // keep the deeper result

    entry.key = key;
    entry.score = score;
    entry.generation = generation_;
    entry.depth = static_cast<std::uint8_t>(depth);
    entry.packed = static_cast<std::uint8_t>(static_cast<int>(bound) | ((bestMove + 1) << 2));
}

}  // namespace connect4
