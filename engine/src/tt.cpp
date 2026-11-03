#include "connect4/tt.hpp"

#include <algorithm>

namespace connect4 {

TranspositionTable::TranspositionTable(int log2Entries) {
    const int bits = std::clamp(log2Entries, 0, 30);
    entries_.resize(std::size_t{1} << bits);
    bucketSize_ = bits == 0 ? 1 : 2;
    shift_ = 64 - (bits == 0 ? 0 : bits - 1);  // hash selects a bucket
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

std::size_t TranspositionTable::bucketOf(Bitboard key) const {
    if (shift_ == 64) return 0;  // single bucket
    // Fibonacci hashing spreads the structured position keys across the table.
    return static_cast<std::size_t>((key * 0x9E3779B97F4A7C15ULL) >> shift_) * bucketSize_;
}

const TTEntry* TranspositionTable::probe(Bitboard key) const {
    const std::size_t first = bucketOf(key);
    for (std::size_t i = first; i < first + bucketSize_; ++i) {
        const TTEntry& entry = entries_[i];
        if (entry.generation == generation_ && entry.key == key) return &entry;
    }
    return nullptr;
}

void TranspositionTable::store(Bitboard key, int depth, int score, Bound bound, int bestMove) {
    const std::size_t first = bucketOf(key);

    // Same position already stored: update it unless the stored result is deeper.
    TTEntry* target = nullptr;
    for (std::size_t i = first; i < first + bucketSize_; ++i) {
        TTEntry& e = entries_[i];
        if (e.generation == generation_ && e.key == key) {
            if (depth < e.depth) return;
            target = &e;
            break;
        }
    }
    // Otherwise replace a stale entry, or the shallower one.
    if (!target) {
        for (std::size_t i = first; i < first + bucketSize_; ++i) {
            TTEntry& e = entries_[i];
            const bool stale = e.generation != generation_;
            if (!target || stale || (target->generation == generation_ && e.depth < target->depth)) {
                target = &e;
                if (stale) break;
            }
        }
    }

    TTEntry& entry = *target;

    entry.key = key;
    entry.score = score;
    entry.generation = generation_;
    entry.depth = static_cast<std::uint8_t>(depth);
    entry.packed = static_cast<std::uint8_t>(static_cast<int>(bound) | ((bestMove + 1) << 2));
}

}  // namespace connect4
