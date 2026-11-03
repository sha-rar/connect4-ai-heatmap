#pragma once

#include <array>
#include <cstdint>
#include <optional>

namespace connect4 {

inline constexpr int kWidth = 7;
inline constexpr int kHeight = 6;
inline constexpr int kCells = kWidth * kHeight;
inline constexpr int kMaxPly = kCells;

using Bitboard = std::uint64_t;

/// Board in the chooseMove() contract format: row-major, row 0 at the top,
/// values 0 (empty), 1 (player 1) or 2 (player 2). See docs/api.md.
using Cells = std::array<int, kCells>;

/// Connect 4 position stored as two 64-bit bitboards.
///
/// Each column uses kHeight + 1 bits (one spare bit above the top row), so
/// bit (col * 7 + height) is the cell `height` discs above the bottom of `col`.
/// The spare bits keep shifted alignments from wrapping between columns.
class Position {
public:
    /// Empty board, player 1 to move.
    Position() = default;

    /// Build from contract cells. Returns nullopt if a disc floats above an
    /// empty cell, a value is out of range, or the disc counts do not match
    /// `player` being the one to move.
    static std::optional<Position> fromCells(const Cells& cells, int player);

    /// Convert back to contract cells.
    Cells toCells() const;

    /// Contract value (0, 1 or 2) at `row` (0 = top) and `col`.
    int cell(int row, int col) const;

    /// Number of discs on the board.
    int moves() const { return moves_; }

    /// Player to move: 1 or 2.
    int toMove() const { return moves_ % 2 == 0 ? 1 : 2; }

    /// Discs of the player to move.
    Bitboard current() const { return current_; }

    /// Discs of the player who moved last.
    Bitboard opponent() const { return current_ ^ mask_; }

    /// All discs.
    Bitboard mask() const { return mask_; }

    /// Discs of `player` (1 or 2).
    Bitboard discs(int player) const { return player == toMove() ? current() : opponent(); }

    /// Unique key for this position (fits in 49 bits).
    Bitboard key() const { return current_ + mask_; }

    /// Bit for the cell `height` discs above the bottom of `col`.
    static constexpr Bitboard bit(int col, int height) {
        return Bitboard{1} << (col * (kHeight + 1) + height);
    }

    /// All playable cells of `col`.
    static constexpr Bitboard columnMask(int col) {
        return ((Bitboard{1} << kHeight) - 1) << (col * (kHeight + 1));
    }

    /// Bottom cell of `col`.
    static constexpr Bitboard bottomMask(int col) { return bit(col, 0); }

    /// Top cell of `col`.
    static constexpr Bitboard topMask(int col) { return bit(col, kHeight - 1); }

private:
    Bitboard current_ = 0;
    Bitboard mask_ = 0;
    int moves_ = 0;
};

}  // namespace connect4
