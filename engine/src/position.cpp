#include "connect4/position.hpp"

namespace connect4 {

namespace {

// Contract rows count from the top; bitboard heights count from the bottom.
constexpr int heightOf(int row) { return kHeight - 1 - row; }

}  // namespace

std::optional<Position> Position::fromCells(const Cells& cells, int player) {
    if (player != 1 && player != 2) return std::nullopt;

    Bitboard p1 = 0;
    Bitboard p2 = 0;
    int count1 = 0;
    int count2 = 0;

    for (int col = 0; col < kWidth; ++col) {
        bool seenEmpty = false;
        for (int row = kHeight - 1; row >= 0; --row) {
            const int value = cells[static_cast<std::size_t>(row * kWidth + col)];
            if (value == 0) {
                seenEmpty = true;
                continue;
            }
            if (value != 1 && value != 2) return std::nullopt;
            if (seenEmpty) return std::nullopt;  // disc floating above a gap

            const Bitboard b = cellBit(col, heightOf(row));
            if (value == 1) {
                p1 |= b;
                ++count1;
            } else {
                p2 |= b;
                ++count2;
            }
        }
    }

    // Player 1 moves first, so it is to move exactly when the counts are equal.
    const int expected = count1 == count2 ? 1 : (count1 == count2 + 1 ? 2 : 0);
    if (expected != player) return std::nullopt;

    Position pos;
    pos.mask_ = p1 | p2;
    pos.current_ = player == 1 ? p1 : p2;
    pos.moves_ = count1 + count2;
    return pos;
}

std::optional<Position> Position::fromMoves(std::string_view moves) {
    Position pos;
    for (const char ch : moves) {
        const int col = ch - '0';
        if (!pos.canPlay(col) || pos.lastMoverWon()) return std::nullopt;
        pos.play(col);
    }
    return pos;
}

namespace {

Bitboard mirrorBits(Bitboard b) {
    constexpr Bitboard kColumnBits = (Bitboard{1} << (kHeight + 1)) - 1;
    Bitboard out = 0;
    for (int col = 0; col < kWidth; ++col) {
        const Bitboard bits = (b >> (col * (kHeight + 1))) & kColumnBits;
        out |= bits << ((kWidth - 1 - col) * (kHeight + 1));
    }
    return out;
}

}  // namespace

Position Position::mirrored() const {
    Position pos;
    pos.current_ = mirrorBits(current_);
    pos.mask_ = mirrorBits(mask_);
    pos.moves_ = moves_;
    return pos;
}

int Position::winner() const {
    const int last = toMove() == 1 ? 2 : 1;
    if (hasAlignment(opponent())) return last;
    if (hasAlignment(current())) return toMove();  // only in hand-built positions
    return 0;
}

int Position::cell(int row, int col) const {
    const Bitboard b = cellBit(col, heightOf(row));
    if ((mask_ & b) == 0) return 0;
    const bool mine = (current_ & b) != 0;
    const int other = toMove() == 1 ? 2 : 1;
    return mine ? toMove() : other;
}

Cells Position::toCells() const {
    Cells cells{};
    for (int row = 0; row < kHeight; ++row) {
        for (int col = 0; col < kWidth; ++col) {
            cells[static_cast<std::size_t>(row * kWidth + col)] = cell(row, col);
        }
    }
    return cells;
}

}  // namespace connect4
