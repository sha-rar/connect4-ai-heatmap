#include <vector>

#include "connect4/position.hpp"
#include "fixtures.hpp"
#include "harness.hpp"

using namespace connect4;
using namespace connect4::support;

namespace {

std::vector<int> legalMoves(const Position& pos) {
    std::vector<int> moves;
    for (int col = 0; col < kWidth; ++col) {
        if (pos.canPlay(col)) moves.push_back(col);
    }
    return moves;
}

Position mustParse(const char* moves) {
    auto pos = Position::fromMoves(moves);
    REQUIRE(pos.has_value());
    return *pos;
}

}  // namespace

TEST_CASE(empty_position) {
    const Position pos;
    CHECK_EQ(pos.moves(), 0);
    CHECK_EQ(pos.toMove(), 1);
    CHECK_EQ(pos.mask(), Bitboard{0});
    CHECK_EQ(legalMoves(pos), (std::vector<int>{0, 1, 2, 3, 4, 5, 6}));
    CHECK_EQ(pos.winner(), 0);
    CHECK(!pos.isFull());
}

TEST_CASE(play_stacks_discs_and_alternates_players) {
    const Position pos = mustParse("334");
    CHECK_EQ(pos.moves(), 3);
    CHECK_EQ(pos.toMove(), 2);
    CHECK_EQ(pos.cell(5, 3), 1);
    CHECK_EQ(pos.cell(4, 3), 2);
    CHECK_EQ(pos.cell(5, 4), 1);
    CHECK_EQ(pos.cell(3, 3), 0);
    CHECK_EQ(pos.discs(1), cellBit(3, 0) | cellBit(4, 0));
    CHECK_EQ(pos.discs(2), cellBit(3, 1));
}

TEST_CASE(full_column_is_not_playable) {
    const Position pos = mustParse("333333");
    CHECK(!pos.canPlay(3));
    CHECK_EQ(legalMoves(pos), (std::vector<int>{0, 1, 2, 4, 5, 6}));
    CHECK(!Position::fromMoves("3333333").has_value());
}

TEST_CASE(out_of_range_columns_are_not_playable) {
    const Position pos;
    CHECK(!pos.canPlay(-1));
    CHECK(!pos.canPlay(kWidth));
    CHECK(!Position::fromMoves("7").has_value());
    CHECK(!Position::fromMoves("a").has_value());
}

TEST_CASE(moves_after_a_win_are_rejected) {
    const Position won = mustParse("0101010");
    CHECK(won.lastMoverWon());
    CHECK_EQ(won.winner(), 1);
    CHECK(!Position::fromMoves("01010102").has_value());
}

TEST_CASE(winning_moves_in_every_direction) {
    CHECK(mustParse("001122").isWinningMove(3));       // horizontal
    CHECK(mustParse("010101").isWinningMove(0));       // vertical
    CHECK(mustParse("0112232336").isWinningMove(3));   // rising diagonal
    CHECK(mustParse("6554434330").isWinningMove(3));   // falling diagonal
    CHECK(!mustParse("001122").isWinningMove(4));
}

TEST_CASE(alignment_does_not_wrap_between_columns) {
    // Top two cells of column 0 plus bottom two of column 1 are consecutive
    // heights but must not count as a vertical four.
    const Bitboard wrapped = cellBit(0, 4) | cellBit(0, 5) | cellBit(1, 0) | cellBit(1, 1);
    CHECK(!hasAlignment(wrapped));
    CHECK(hasAlignment(cellBit(0, 2) | cellBit(0, 3) | cellBit(0, 4) | cellBit(0, 5)));
}

TEST_CASE(playable_matches_can_play) {
    const Position pos = mustParse("3333332");
    Bitboard expected = 0;
    for (int col = 0; col < kWidth; ++col) {
        if (pos.canPlay(col)) expected |= (pos.mask() + bottomMask(col)) & columnMask(col);
    }
    CHECK_EQ(pos.playable(), expected);
}

TEST_CASE(from_cells_rejects_invalid_boards) {
    Cells cells{};
    CHECK(Position::fromCells(cells, 1).has_value());
    CHECK(!Position::fromCells(cells, 2).has_value());  // wrong player to move
    CHECK(!Position::fromCells(cells, 3).has_value());

    Cells floating{};
    floating[4 * kWidth + 0] = 1;  // row 4, column 0, with row 5 empty
    CHECK(!Position::fromCells(floating, 2).has_value());

    Cells badValue{};
    badValue[5 * kWidth + 0] = 3;
    CHECK(!Position::fromCells(badValue, 2).has_value());

    Cells badCounts{};
    badCounts[5 * kWidth + 0] = 2;  // player 2 cannot have moved first
    CHECK(!Position::fromCells(badCounts, 1).has_value());
    CHECK(!Position::fromCells(badCounts, 2).has_value());
}

TEST_CASE(key_is_unique_for_distinct_positions) {
    // Same discs, different owners.
    CHECK(mustParse("01").key() != mustParse("10").key());
    // Transpositions reach the same key.
    CHECK_EQ(mustParse("0123").key(), mustParse("2103").key());
}

TEST_CASE(fixture_positions_round_trip_and_match_legal_moves) {
    for (const auto& f : loadPositions()) {
        CONTEXT(f.id);
        const Cells cells = rowsToCells(f.rows);
        const auto pos = Position::fromCells(cells, f.toMove);
        REQUIRE(pos.has_value());
        CHECK_EQ(pos->toCells(), cells);
        CHECK_EQ(pos->toMove(), f.toMove);
        CHECK_EQ(legalMoves(*pos), f.legalMoves);
        CHECK_EQ(pos->winner(), 0);
    }
}

TEST_CASE(fixture_wins_match_winner_and_status) {
    for (const auto& f : loadWins()) {
        CONTEXT(f.id);
        const Cells cells = rowsToCells(f.rows);
        const auto pos = Position::fromCells(cells, impliedToMove(cells));
        REQUIRE(pos.has_value());
        CHECK_EQ(pos->winner(), f.winner);
        const char* status = pos->winner() != 0 ? "won" : (pos->isFull() ? "draw" : "playing");
        CHECK_EQ(std::string(status), f.status);
    }
}

TEST_CASE(fixture_best_moves_that_win_are_winning_moves) {
    for (const auto& f : loadPositions()) {
        if (f.outcome != "win" || f.bestMoves.size() != 1) continue;
        CONTEXT(f.id);
        const auto pos = Position::fromCells(rowsToCells(f.rows), f.toMove);
        REQUIRE(pos.has_value());
        CHECK(pos->isWinningMove(f.bestMoves[0]));
    }
}

TEST_CASE(winning_cells_match_brute_force) {
    // Every empty cell flagged by winningCells must complete a four, and
    // every cell that would complete a four must be flagged.
    for (const auto& f : loadEvaluations()) {
        CONTEXT(f.id);
        const Cells cells = rowsToCells(f.rows);
        const auto pos = Position::fromCells(cells, impliedToMove(cells));
        REQUIRE(pos.has_value());
        for (const int player : {1, 2}) {
            const Bitboard own = pos->discs(player);
            if (hasAlignment(own)) continue;  // already won: every cell would "complete" a four
            const Bitboard fast = winningCells(own, pos->mask());
            Bitboard slow = 0;
            for (int col = 0; col < kWidth; ++col) {
                for (int h = 0; h < kHeight; ++h) {
                    const Bitboard b = cellBit(col, h);
                    if ((pos->mask() & b) == 0 && hasAlignment(own | b)) slow |= b;
                }
            }
            CHECK_EQ(fast, slow);
        }
    }
}

TEST_CASE(can_win_next_matches_winning_moves) {
    for (const auto& f : loadPositions()) {
        CONTEXT(f.id);
        const auto pos = Position::fromCells(rowsToCells(f.rows), f.toMove);
        REQUIRE(pos.has_value());
        bool any = false;
        for (int col = 0; col < kWidth; ++col) any |= pos->canPlay(col) && pos->isWinningMove(col);
        CHECK_EQ(pos->canWinNext(), any);
        for (int col = 0; col < kWidth; ++col) {
            if (!pos->canPlay(col)) CHECK_EQ(pos->moveBit(col), Bitboard{0});
        }
    }
}

TEST_CASE(mirrored_reflects_columns) {
    const Position pos = mustParse("0013");
    const Position mirror = pos.mirrored();
    CHECK_EQ(mirror.key(), mustParse("6653").key());
    CHECK_EQ(mirror.mirrored().key(), pos.key());
    CHECK_EQ(mirror.toMove(), pos.toMove());
    for (int row = 0; row < kHeight; ++row) {
        for (int col = 0; col < kWidth; ++col) CHECK_EQ(mirror.cell(row, col), pos.cell(row, kWidth - 1 - col));
    }
    CHECK_EQ(Position().mirrored().key(), Position().key());
}
