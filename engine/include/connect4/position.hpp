#pragma once

#include <array>
#include <cstdint>
#include <optional>
#include <string_view>

namespace connect4 {

inline constexpr int kWidth = 7;
inline constexpr int kHeight = 6;
inline constexpr int kCells = kWidth * kHeight;
inline constexpr int kMaxPly = kCells;

using Bitboard = std::uint64_t;

/// Board in the chooseMove() contract format: row-major, row 0 at the top,
/// values 0 (empty), 1 (player 1) or 2 (player 2). See docs/api.md.
using Cells = std::array<int, kCells>;

// Bitboard layout: each column uses kHeight + 1 bits (one spare bit above the
// top row), so bit (col * 7 + height) is the cell `height` discs above the
// bottom of `col`. The spare bits stop shifted alignments wrapping columns.

/// Bit for the cell `height` discs above the bottom of `col`.
constexpr Bitboard cellBit(int col, int height) {
    return Bitboard{1} << (col * (kHeight + 1) + height);
}

/// All playable cells of `col`.
constexpr Bitboard columnMask(int col) {
    return ((Bitboard{1} << kHeight) - 1) << (col * (kHeight + 1));
}

/// Bottom cell of `col`.
constexpr Bitboard bottomMask(int col) { return cellBit(col, 0); }

/// Top cell of `col`.
constexpr Bitboard topMask(int col) { return cellBit(col, kHeight - 1); }

/// Bottom cell of every column.
inline constexpr Bitboard kBottomRow = [] {
    Bitboard b = 0;
    for (int col = 0; col < kWidth; ++col) b |= bottomMask(col);
    return b;
}();

/// Every playable cell (excludes the spare bit above each column).
inline constexpr Bitboard kBoardMask = kBottomRow * ((Bitboard{1} << kHeight) - 1);

/// True if `discs` contains four in a row in any direction.
constexpr bool hasAlignment(Bitboard discs) {
    // Vertical, horizontal and the two diagonals.
    constexpr int kShifts[] = {1, kHeight + 1, kHeight, kHeight + 2};
    for (const int shift : kShifts) {
        const Bitboard pairs = discs & (discs >> shift);
        if ((pairs & (pairs >> (2 * shift))) != 0) return true;
    }
    return false;
}

/// Empty cells that would complete four in a row for `discs`, given the
/// occupied cells `mask`. Cells need not be playable yet (they may float).
constexpr Bitboard winningCells(Bitboard discs, Bitboard mask) {
    // Vertical: three discs directly below.
    Bitboard r = (discs << 1) & (discs << 2) & (discs << 3);

    // Horizontal and both diagonals: the empty cell can be at any of the four
    // positions in the line.
    for (const int shift : {kHeight + 1, kHeight, kHeight + 2}) {
        Bitboard pair = (discs << shift) & (discs << (2 * shift));
        r |= pair & (discs << (3 * shift));  // three to one side
        r |= pair & (discs >> shift);        // two on one side, one on the other
        pair = (discs >> shift) & (discs >> (2 * shift));
        r |= pair & (discs << shift);
        r |= pair & (discs >> (3 * shift));
    }
    return r & (kBoardMask ^ mask);
}

/// Connect 4 position stored as two 64-bit bitboards.
class Position {
public:
    /// Empty board, player 1 to move.
    Position() = default;

    /// Build from contract cells. Returns nullopt if a disc floats above an
    /// empty cell, a value is out of range, or the disc counts do not match
    /// `player` being the one to move.
    static std::optional<Position> fromCells(const Cells& cells, int player);

    /// Build by playing zero-based column digits from the empty board,
    /// e.g. "3324". Returns nullopt on a bad digit, a full column, or a move
    /// played after the game was already won.
    static std::optional<Position> fromMoves(std::string_view moves);

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

    /// True if `col` is on the board and not full.
    bool canPlay(int col) const {
        return col >= 0 && col < kWidth && (mask_ & topMask(col)) == 0;
    }

    /// Drop a disc for the player to move. Precondition: canPlay(col).
    void play(int col) {
        current_ ^= mask_;
        mask_ |= mask_ + bottomMask(col);
        ++moves_;
    }

    /// True if playing `col` wins for the player to move. Precondition: canPlay(col).
    bool isWinningMove(int col) const {
        const Bitboard after = current_ | ((mask_ + bottomMask(col)) & columnMask(col));
        return hasAlignment(after);
    }

    /// Bitmask of the cell each legal move would fill.
    Bitboard playable() const { return (mask_ + kBottomRow) & kBoardMask; }

    /// Empty cells that would win for the player to move.
    Bitboard winningCellsForCurrent() const { return winningCells(current_, mask_); }

    /// Empty cells that would win for the player who moved last.
    Bitboard winningCellsForOpponent() const { return winningCells(opponent(), mask_); }

    /// True if the player to move has a winning move right now.
    bool canWinNext() const { return (winningCellsForCurrent() & playable()) != 0; }

    /// Cell `col` would be filled by, or 0 if the column is full.
    Bitboard moveBit(int col) const { return (mask_ + bottomMask(col)) & columnMask(col); }

    /// The same position reflected left to right (column c becomes 6 - c).
    Position mirrored() const;

    /// True if the player who moved last has four in a row.
    bool lastMoverWon() const { return hasAlignment(opponent()); }

    /// Winner (1 or 2) or 0 if nobody has four in a row.
    int winner() const;

    /// True when every cell is filled.
    bool isFull() const { return moves_ == kCells; }

private:
    Bitboard current_ = 0;  // discs of the player to move
    Bitboard mask_ = 0;     // all discs
    int moves_ = 0;
};

}  // namespace connect4
