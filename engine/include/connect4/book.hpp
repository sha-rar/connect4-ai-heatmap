#pragma once

#include <array>
#include <cstdint>
#include <optional>

#include "connect4/position.hpp"

namespace connect4 {

/// Book entry: column scores for one position, as a full search at
/// `kBookDepth` returned them. kNoScore marks a full column.
struct BookEntry {
    Bitboard key;  // canonical key: the smaller of the position's and its mirror's
    std::array<std::int32_t, kWidth> scores;
};

inline constexpr std::int32_t kNoScore = INT32_MIN;

/// Column scores for `pos` from the opening book, mirrored back if the
/// book stores the reflected position.
struct BookHit {
    std::array<std::optional<int>, kWidth> columnScores;
    int depth;
};

/// Opening rule for the empty board. The book's depth-limited scores prefer
/// column 2 there, but the first player's only winning first move is the
/// centre (Allis, 1988), so a book answer for the empty board plays it.
inline constexpr int kEmptyBoardMove = kWidth / 2;

/// Look up `pos` in the generated opening book.
std::optional<BookHit> lookupBook(const Position& pos);

/// Depth the book was generated at, and the most discs a book position has.
int bookDepth();
int bookMaxDiscs();

/// Number of positions in the book.
int bookSize();

/// Canonical key shared by a position and its mirror image.
inline Bitboard canonicalKey(const Position& pos) {
    const Bitboard a = pos.key();
    const Bitboard b = pos.mirrored().key();
    return a < b ? a : b;
}

}  // namespace connect4
