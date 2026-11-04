// Shared rule tests: replay tests/fixtures/games.json, generated from the
// TypeScript rules, and require the C++ position to agree at every ply.
// tests/shared/rules.test.ts checks the same file against TypeScript and WASM.

#include <string>

#include "connect4/position.hpp"
#include "fixtures.hpp"
#include "harness.hpp"

using namespace connect4;
using namespace connect4::support;

namespace {

std::string legalDigits(const Position& pos) {
    std::string out;
    for (int col = 0; col < kWidth; ++col) {
        if (pos.canPlay(col)) out += static_cast<char>('0' + col);
    }
    return out;
}

}  // namespace

TEST_CASE(rules_games_corpus_is_loaded) {
    const auto games = loadGames();
    CHECK(games.size() >= 50);
    bool draw = false;
    for (const auto& g : games) draw = draw || g.status == "draw";
    CHECK(draw);
}

TEST_CASE(rules_match_typescript_at_every_ply) {
    for (const auto& game : loadGames()) {
        CONTEXT(game.id);
        REQUIRE(game.legal.size() == game.moves.size());
        Position pos;
        for (std::size_t ply = 0; ply < game.moves.size(); ++ply) {
            CONTEXT("ply " + std::to_string(ply));
            REQUIRE(!pos.lastMoverWon());
            const int col = game.moves[ply] - '0';
            REQUIRE(pos.canPlay(col));
            pos.play(col);
            CHECK_EQ(legalDigits(pos), game.legal[ply]);
            const bool last = ply + 1 == game.moves.size();
            if (!last) {
                CHECK_EQ(pos.winner(), 0);
                CHECK(!pos.isFull());
            }
        }
        CHECK_EQ(pos.winner(), game.winner);
        CHECK_EQ(pos.lastMoverWon(), game.status == "won");
        CHECK_EQ(pos.isFull(), game.status == "draw" || pos.moves() == kCells);
    }
}

TEST_CASE(rules_final_boards_round_trip) {
    for (const auto& game : loadGames()) {
        CONTEXT(game.id);
        const auto played = Position::fromMoves(game.moves);
        REQUIRE(played.has_value());
        const Cells cells = rowsToCells(game.rows);
        CHECK(played->toCells() == cells);
        const auto parsed = Position::fromCells(cells, played->toMove());
        REQUIRE(parsed.has_value());
        CHECK_EQ(parsed->key(), played->key());
    }
}

TEST_CASE(rules_reject_moves_after_a_win) {
    for (const auto& game : loadGames()) {
        if (game.status != "won" || game.legal.back().empty()) continue;
        CONTEXT(game.id);
        CHECK(!Position::fromMoves(game.moves + game.legal.back()[0]).has_value());
    }
}
