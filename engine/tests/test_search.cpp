#include <cstdlib>
#include <algorithm>
#include <string>

#include "connect4/search.hpp"
#include "fixtures.hpp"
#include "harness.hpp"

using namespace connect4;
using namespace connect4::support;

namespace {

/// Plain minimax with no pruning, from the root player's perspective, using
/// the same scoring rules as the engine. Slow, but obviously correct.
int referenceMinimax(const Position& pos, int depth, int ply, int rootPlayer) {
    if (pos.isFull()) return 0;
    if (depth <= 0) return evaluate(pos, rootPlayer);

    const bool maximising = pos.toMove() == rootPlayer;
    int best = maximising ? -kWinScore - 1 : kWinScore + 1;
    for (int col = 0; col < kWidth; ++col) {
        if (!pos.canPlay(col)) continue;
        int score;
        if (pos.isWinningMove(col)) {
            score = maximising ? kWinScore - (ply + 1) : -kWinScore + (ply + 1);
        } else {
            Position child = pos;
            child.play(col);
            score = referenceMinimax(child, depth - 1, ply + 1, rootPlayer);
        }
        best = maximising ? std::max(best, score) : std::min(best, score);
    }
    return best;
}

/// Reference root scores, matching chooseMove()'s column scores.
std::array<std::optional<int>, kWidth> referenceColumnScores(const Position& pos, int depth) {
    std::array<std::optional<int>, kWidth> scores{};
    for (int col = 0; col < kWidth; ++col) {
        if (!pos.canPlay(col)) continue;
        if (pos.isWinningMove(col)) {
            scores[static_cast<std::size_t>(col)] = kWinScore;
            continue;
        }
        Position child = pos;
        child.play(col);
        scores[static_cast<std::size_t>(col)] = referenceMinimax(child, depth - 1, 1, pos.toMove());
    }
    return scores;
}

Position fixturePosition(const PositionFixture& f) {
    auto pos = Position::fromCells(rowsToCells(f.rows), f.toMove);
    REQUIRE(pos.has_value());
    return *pos;
}

/// Options for an exact fixed-depth search: no time limit, no opening book.
SearchOptions fixed(int depth) { return {depth, 0, false}; }

/// One engine for the whole test binary, as the app would use it.
Engine& engine() {
    static Engine instance;
    return instance;
}

SearchResult chooseMove(const Position& pos, const SearchOptions& options) {
    return engine().chooseMove(pos, options);
}

bool isWin(int score) { return score >= kWinScore - kMaxPly; }

std::string show(const std::array<std::optional<int>, kWidth>& scores) {
    std::string out = "[";
    for (std::size_t i = 0; i < scores.size(); ++i) {
        if (i) out += ", ";
        out += scores[i] ? std::to_string(*scores[i]) : "null";
    }
    return out + "]";
}

}  // namespace

TEST_CASE(search_matches_reference_minimax) {
    for (const auto& f : loadPositions()) {
        for (const int depth : {1, 2, 3, 4, 5}) {
            CONTEXT(f.id + " depth " + std::to_string(depth));
            const Position pos = fixturePosition(f);
            const auto result = chooseMove(pos, fixed(depth));
            const auto expected = referenceColumnScores(pos, depth);
            CHECK_EQ(show(result.columnScores), show(expected));
        }
    }
}

TEST_CASE(search_result_obeys_contract) {
    for (const auto& f : loadPositions()) {
        CONTEXT(f.id);
        const Position pos = fixturePosition(f);
        const auto result = chooseMove(pos, fixed(6));

        REQUIRE(pos.canPlay(result.bestCol));
        for (int col = 0; col < kWidth; ++col) {
            const auto& score = result.columnScores[static_cast<std::size_t>(col)];
            CHECK_EQ(score.has_value(), pos.canPlay(col));
            if (score) CHECK(*score <= result.bestScore);
        }
        CHECK_EQ(result.columnScores[static_cast<std::size_t>(result.bestCol)], std::optional<int>(result.bestScore));
        CHECK_EQ(result.usedDepth, std::min(6, kCells - pos.moves()));
        CHECK(!result.opening);
        CHECK(result.nodes > 0);
    }
}

TEST_CASE(search_picks_expected_moves) {
    for (const auto& f : loadPositions()) {
        if (f.bestMoves.empty()) continue;
        CONTEXT(f.id);
        const auto result = chooseMove(fixturePosition(f), fixed(6));
        CHECK(std::find(f.bestMoves.begin(), f.bestMoves.end(), result.bestCol) != f.bestMoves.end());
    }
}

TEST_CASE(search_scores_known_outcomes) {
    for (const auto& f : loadPositions()) {
        if (f.outcome.empty()) continue;
        CONTEXT(f.id);
        const auto result = chooseMove(fixturePosition(f), fixed(6));
        if (f.outcome == "win") CHECK(isWin(result.bestScore));
        if (f.outcome == "draw") CHECK_EQ(result.bestScore, 0);
        if (f.outcome == "loss") {
            // Unlike the TypeScript shortcut, a forced block is not scored as a win.
            for (const auto& score : result.columnScores) {
                if (score) CHECK(*score <= -kWinScore + kMaxPly);
            }
        }
    }
}

TEST_CASE(search_scores_immediate_win_as_win_score) {
    const auto pos = Position::fromMoves("001122");
    REQUIRE(pos.has_value());
    const auto result = chooseMove(*pos, fixed(4));
    CHECK_EQ(result.bestCol, 3);
    CHECK_EQ(result.bestScore, kWinScore);
}

TEST_CASE(search_wins_instead_of_blocking) {
    // Player 1 has an open three on the bottom row (columns 1-3) while
    // player 2 threatens column 6. Winning now beats blocking.
    const auto pos = Position::fromMoves("162636");
    REQUIRE(pos.has_value());
    const auto result = chooseMove(*pos, fixed(5));
    CHECK_EQ(result.bestScore, kWinScore);
    CHECK(result.bestCol == 0 || result.bestCol == 4);
    // Blocking keeps the double threat: player 1 still wins on their next move.
    CHECK_EQ(result.columnScores[6], std::optional<int>(kWinScore - 3));
    // Ignoring both lets player 2 win straight away.
    CHECK_EQ(result.columnScores[5], std::optional<int>(-kWinScore + 2));
}

TEST_CASE(search_on_finished_game_returns_no_move) {
    const auto won = Position::fromMoves("0101010");
    REQUIRE(won.has_value());
    const auto result = chooseMove(*won, fixed(4));
    CHECK_EQ(result.bestCol, -1);
    for (const auto& score : result.columnScores) CHECK(!score.has_value());
}

TEST_CASE(transposition_table_size_does_not_change_scores) {
    // A single-slot table collides constantly; results must stay identical
    // and the full-size table must not visit more nodes.
    Engine tiny(0);
    Engine large(20);
    for (const auto& f : loadPositions()) {
        CONTEXT(f.id);
        const Position pos = fixturePosition(f);
        const auto a = tiny.chooseMove(pos, fixed(7));
        const auto b = large.chooseMove(pos, fixed(7));
        CHECK_EQ(show(a.columnScores), show(b.columnScores));
        CHECK_EQ(a.bestCol, b.bestCol);
        CHECK(b.nodes <= a.nodes);
    }
}

TEST_CASE(transposition_table_matches_reference_at_depth_7) {
    for (const auto& id : {"midgame-18", "midgame-22", "full-columns"}) {
        CONTEXT(id);
        const auto fixtures = loadPositions();
        const auto it = std::find_if(fixtures.begin(), fixtures.end(), [&](const auto& f) { return f.id == id; });
        REQUIRE(it != fixtures.end());
        const Position pos = fixturePosition(*it);
        CHECK_EQ(show(chooseMove(pos, fixed(7)).columnScores), show(referenceColumnScores(pos, 7)));
    }
}

TEST_CASE(reusing_an_engine_gives_the_same_result) {
    Engine fresh;
    for (const auto& f : loadPositions()) {
        CONTEXT(f.id);
        const Position pos = fixturePosition(f);
        const auto reused = chooseMove(pos, fixed(6));
        const auto first = fresh.chooseMove(pos, fixed(6));
        fresh.clear();
        CHECK_EQ(show(reused.columnScores), show(first.columnScores));
    }
}

TEST_CASE(iterative_deepening_reports_completed_depth) {
    const auto pos = fixturePosition(loadPositions().front());
    const auto result = chooseMove(pos, fixed(8));
    CHECK_EQ(result.usedDepth, 8);
    CHECK(!result.timedOut);
}

TEST_CASE(depth_is_clamped_to_the_end_of_the_game) {
    for (const auto& f : loadPositions()) {
        if (f.id != "last-move-draw") continue;
        const auto result = chooseMove(fixturePosition(f), fixed(12));
        CHECK_EQ(result.usedDepth, 1);
        CHECK(!result.timedOut);
        CHECK_EQ(result.bestScore, 0);
    }
}

TEST_CASE(time_limit_keeps_only_completed_iterations) {
    // A full-game search from these early positions cannot finish in 20 ms,
    // so the search must stop early and report results identical to an exact
    // search at usedDepth.
    for (const auto& f : loadPositions()) {
        if (f.id != "empty" && f.id != "midgame-10" && f.id != "midgame-14") continue;
        CONTEXT(f.id);
        const Position pos = fixturePosition(f);
        Engine timed;
        const auto limited = timed.chooseMove(pos, {kMaxPly, 20});

        CHECK(limited.timedOut);
        CHECK(limited.usedDepth >= 1);
        CHECK(limited.usedDepth < kCells - pos.moves());
        CHECK(limited.ms < 20 + 100);  // generous slack for slow machines

        Engine exact;
        const auto reference = exact.chooseMove(pos, fixed(limited.usedDepth));
        CHECK_EQ(show(limited.columnScores), show(reference.columnScores));
        CHECK_EQ(limited.bestCol, reference.bestCol);
    }
}

TEST_CASE(first_iteration_completes_even_with_tiny_limit) {
    const auto pos = fixturePosition(loadPositions().front());
    Engine timed;
    const auto result = timed.chooseMove(pos, {kMaxPly, 1});
    CHECK(result.usedDepth >= 1);
    CHECK(pos.canPlay(result.bestCol));
    for (int col = 0; col < kWidth; ++col) {
        CHECK_EQ(result.columnScores[static_cast<std::size_t>(col)].has_value(), pos.canPlay(col));
    }
}

TEST_CASE(search_matches_reference_on_varied_positions) {
    // The evaluation fixtures include many tactical mid- and late-game
    // positions, which exercise the forced-block and losing-move pruning.
    int checked = 0;
    for (const auto& f : loadEvaluations()) {
        const Cells cells = rowsToCells(f.rows);
        const auto pos = Position::fromCells(cells, impliedToMove(cells));
        REQUIRE(pos.has_value());
        if (pos->winner() != 0 || pos->isFull()) continue;
        ++checked;
        for (const int depth : {1, 2, 3, 4}) {
            CONTEXT(f.id + " depth " + std::to_string(depth));
            const auto result = chooseMove(*pos, fixed(depth));
            CHECK_EQ(show(result.columnScores), show(referenceColumnScores(*pos, depth)));
        }
    }
    CHECK(checked > 100);
}

TEST_CASE(results_are_consistent_with_the_heatmap) {
    // Whatever the options (exact, time-limited, book), the chosen move must
    // be the best-scored column, ties going to the most central column. The
    // empty board's opening rule is the one exception (see test_book).
    Engine engine;
    const SearchOptions variants[] = {{6, 0, false}, {kMaxPly, 5, false}, {6, 250, true}};
    for (const auto& f : loadEvaluations()) {
        const Cells cells = rowsToCells(f.rows);
        const auto pos = Position::fromCells(cells, impliedToMove(cells));
        REQUIRE(pos.has_value());
        if (pos->winner() != 0 || pos->isFull() || pos->moves() == 0) continue;

        for (const auto& options : variants) {
            CONTEXT(f.id + " depth " + std::to_string(options.depth));
            const auto r = engine.chooseMove(*pos, options);
            REQUIRE(pos->canPlay(r.bestCol));
            CHECK_EQ(r.columnScores[static_cast<std::size_t>(r.bestCol)], std::optional<int>(r.bestScore));

            int centreDistance = std::abs(r.bestCol - kWidth / 2);
            for (int col = 0; col < kWidth; ++col) {
                const auto& score = r.columnScores[static_cast<std::size_t>(col)];
                CHECK_EQ(score.has_value(), pos->canPlay(col));
                if (!score) continue;
                CHECK(*score <= r.bestScore);
                if (*score == r.bestScore) CHECK(std::abs(col - kWidth / 2) >= centreDistance);
            }
        }
    }
}
