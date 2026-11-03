#include "connect4/book.hpp"

#include <algorithm>
#include <climits>
#include <iterator>

namespace connect4 {

namespace {

// Defines kBookDepth, kBookMaxDiscs and kBookEntries (sorted by key).
// Regenerate with connect4_make_book; see engine/README.md.
#include "book_data.inc"

}  // namespace

std::optional<BookHit> lookupBook(const Position& pos) {
    if (pos.moves() > kBookMaxDiscs) return std::nullopt;

    const Bitboard key = pos.key();
    const Bitboard mirrorKey = pos.mirrored().key();
    const Bitboard canonical = std::min(key, mirrorKey);

    const auto begin = std::begin(kBookEntries);
    const auto end = std::end(kBookEntries);
    const auto it = std::lower_bound(begin, end, canonical,
                                     [](const BookEntry& e, Bitboard k) { return e.key < k; });
    if (it == end || it->key != canonical) return std::nullopt;

    // The book stores the canonical orientation; reflect scores if needed.
    const bool reflect = canonical != key;
    BookHit hit{{}, kBookDepth};
    for (int col = 0; col < kWidth; ++col) {
        const int source = reflect ? kWidth - 1 - col : col;
        const std::int32_t score = it->scores[static_cast<std::size_t>(source)];
        if (score != kNoScore) hit.columnScores[static_cast<std::size_t>(col)] = score;
    }
    return hit;
}

int bookDepth() { return kBookDepth; }
int bookMaxDiscs() { return kBookMaxDiscs; }
int bookSize() { return static_cast<int>(std::size(kBookEntries)); }

}  // namespace connect4
