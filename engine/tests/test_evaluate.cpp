#include "connect4/evaluate.hpp"
#include "fixtures.hpp"
#include "harness.hpp"

using namespace connect4;
using namespace connect4::support;

TEST_CASE(evaluate_empty_board_is_zero) {
    const Position pos;
    CHECK_EQ(evaluate(pos, 1), 0);
    CHECK_EQ(evaluate(pos, 2), 0);
}

TEST_CASE(evaluate_scores_wins_for_each_player) {
    const auto won = Position::fromMoves("0101010");
    REQUIRE(won.has_value());
    CHECK_EQ(evaluate(*won, 1), kWinScore);
    CHECK_EQ(evaluate(*won, 2), -kWinScore);
}

TEST_CASE(evaluate_matches_typescript_reference) {
    const auto fixtures = loadEvaluations();
    REQUIRE(fixtures.size() > 100);
    for (const auto& f : fixtures) {
        CONTEXT(f.id);
        const Cells cells = rowsToCells(f.rows);
        const auto pos = Position::fromCells(cells, impliedToMove(cells));
        REQUIRE(pos.has_value());
        CHECK_EQ(evaluate(*pos, 1), f.scoreFor1);
        CHECK_EQ(evaluate(*pos, 2), f.scoreFor2);
    }
}
