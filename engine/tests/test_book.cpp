#include <map>
#include <string>

#include "connect4/book.hpp"
#include "connect4/search.hpp"
#include "harness.hpp"

using namespace connect4;

namespace {

void collect(const Position& pos, std::map<Bitboard, Position>& out) {
    if (pos.moves() > bookMaxDiscs() || pos.lastMoverWon()) return;
    if (!out.emplace(pos.key(), pos).second) return;
    for (int col = 0; col < kWidth; ++col) {
        if (!pos.canPlay(col)) continue;
        Position child = pos;
        child.play(col);
        collect(child, out);
    }
}

std::map<Bitboard, Position> bookPositions() {
    std::map<Bitboard, Position> out;
    collect(Position(), out);
    return out;
}

std::string show(const std::array<std::optional<int>, kWidth>& scores) {
    std::string out = "[";
    for (std::size_t i = 0; i < scores.size(); ++i) {
        if (i) out += ", ";
        out += scores[i] ? std::to_string(*scores[i]) : "null";
    }
    return out + "]";
}

}  // namespace

TEST_CASE(book_is_generated) {
    CHECK(bookDepth() >= 12);
    CHECK(bookMaxDiscs() >= 2);
    CHECK(bookSize() > 10);
}

TEST_CASE(book_covers_every_early_position) {
    const auto positions = bookPositions();
    std::map<Bitboard, int> canonical;
    for (const auto& [key, pos] : positions) {
        CONTEXT(std::to_string(key));
        const auto hit = lookupBook(pos);
        REQUIRE(hit.has_value());
        CHECK_EQ(hit->depth, bookDepth());
        for (int col = 0; col < kWidth; ++col) {
            CHECK_EQ(hit->columnScores[static_cast<std::size_t>(col)].has_value(), pos.canPlay(col));
        }
        canonical[canonicalKey(pos)]++;
    }
    CHECK_EQ(static_cast<int>(canonical.size()), bookSize());
    CHECK(!lookupBook(*Position::fromMoves("3333")).has_value() || bookMaxDiscs() >= 4);
}

TEST_CASE(book_is_mirror_symmetric) {
    for (const auto& [key, pos] : bookPositions()) {
        CONTEXT(std::to_string(key));
        const auto a = lookupBook(pos);
        const auto b = lookupBook(pos.mirrored());
        REQUIRE(a.has_value() && b.has_value());
        for (int col = 0; col < kWidth; ++col) {
            CHECK_EQ(a->columnScores[static_cast<std::size_t>(col)],
                     b->columnScores[static_cast<std::size_t>(kWidth - 1 - col)]);
        }
    }
}

TEST_CASE(book_matches_a_fresh_search) {
    // Deepest book positions are the cheapest to re-search; check a mirrored
    // pair so both lookup orientations are covered.
    Engine engine(22);
    for (const char* moves : {"012", "654"}) {
        CONTEXT(moves);
        const auto pos = Position::fromMoves(moves);
        REQUIRE(pos.has_value() && pos->moves() <= bookMaxDiscs());
        const auto fresh = engine.chooseMove(*pos, {bookDepth(), 0, false});
        const auto hit = lookupBook(*pos);
        REQUIRE(hit.has_value());
        CHECK_EQ(show(hit->columnScores), show(fresh.columnScores));
    }
}

TEST_CASE(choose_move_uses_book_only_when_deep_enough) {
    Engine engine;
    const Position empty;

    const auto book = engine.chooseMove(empty, {6, 250});
    CHECK(book.opening);
    CHECK_EQ(book.nodes, std::uint64_t{0});
    CHECK_EQ(book.usedDepth, bookDepth());
    CHECK_EQ(book.columnScores[static_cast<std::size_t>(book.bestCol)], std::optional<int>(book.bestScore));

    const auto noBook = engine.chooseMove(empty, {6, 0, false});
    CHECK(!noBook.opening);
    CHECK_EQ(noBook.usedDepth, 6);

    const auto deeper = engine.chooseMove(empty, {bookDepth() + 1, 1});
    CHECK(!deeper.opening);
}
