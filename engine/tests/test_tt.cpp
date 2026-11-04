#include "connect4/search.hpp"
#include "connect4/tt.hpp"
#include "harness.hpp"

using namespace connect4;

namespace {

// 2^1 slots form a single two-entry bucket, so every key collides and the
// replacement policy can be tested directly.
TranspositionTable oneBucket() { return TranspositionTable(1); }

}  // namespace

TEST_CASE(tt_probe_misses_an_empty_table) {
    const TranspositionTable tt(4);
    CHECK_EQ(tt.capacity(), std::size_t{16});
    CHECK(tt.probe(12345) == nullptr);
}

TEST_CASE(tt_store_round_trips_every_field) {
    TranspositionTable tt(10);
    struct Case {
        Bitboard key;
        int depth;
        int score;
        Bound bound;
        int move;
    };
    const Case cases[] = {
        {1, 1, 0, Bound::Exact, -1},
        {2, 42, kWinScore - 7, Bound::Lower, 6},
        {3, 12, -kWinScore + 2, Bound::Upper, 0},
        {4, 6, -123, Bound::Exact, 3},
    };
    for (const auto& c : cases) tt.store(c.key, c.depth, c.score, c.bound, c.move);
    for (const auto& c : cases) {
        CONTEXT("key " + std::to_string(c.key));
        const TTEntry* e = tt.probe(c.key);
        REQUIRE(e != nullptr);
        CHECK_EQ(e->key, c.key);
        CHECK_EQ(static_cast<int>(e->depth), c.depth);
        CHECK_EQ(e->score, c.score);
        CHECK(e->bound() == c.bound);
        CHECK_EQ(e->bestMove(), c.move);
    }
}

TEST_CASE(tt_new_search_hides_older_entries) {
    TranspositionTable tt(10);
    tt.store(7, 5, 10, Bound::Exact, 2);
    REQUIRE(tt.probe(7) != nullptr);
    tt.newSearch();
    CHECK(tt.probe(7) == nullptr);
    tt.store(7, 1, 20, Bound::Exact, 4);
    REQUIRE(tt.probe(7) != nullptr);
    CHECK_EQ(tt.probe(7)->score, 20);
}

TEST_CASE(tt_generation_wrap_does_not_revive_old_entries) {
    TranspositionTable tt(4);
    tt.store(9, 3, 1, Bound::Exact, 0);
    // 65535 increments bring the 16-bit generation back round to its start.
    for (int i = 0; i < 65535; ++i) tt.newSearch();
    CHECK(tt.probe(9) == nullptr);
}

TEST_CASE(tt_same_key_keeps_the_deeper_result) {
    auto tt = oneBucket();
    tt.store(5, 8, 100, Bound::Exact, 1);
    tt.store(5, 4, 200, Bound::Lower, 2);  // shallower: ignored
    CHECK_EQ(tt.probe(5)->score, 100);
    tt.store(5, 8, 300, Bound::Upper, 3);  // equal depth: replaces
    CHECK_EQ(tt.probe(5)->score, 300);
    CHECK(tt.probe(5)->bound() == Bound::Upper);
    tt.store(5, 9, 400, Bound::Exact, 4);  // deeper: replaces
    CHECK_EQ(tt.probe(5)->score, 400);
    // Updating one key never evicts the other entry in the bucket.
    tt.store(6, 1, 0, Bound::Exact, 0);
    tt.store(5, 10, 500, Bound::Exact, 0);
    CHECK(tt.probe(6) != nullptr);
}

TEST_CASE(tt_full_bucket_replaces_the_shallower_entry) {
    auto tt = oneBucket();
    tt.store(1, 5, 0, Bound::Exact, 0);
    tt.store(2, 3, 0, Bound::Exact, 0);
    tt.store(3, 4, 0, Bound::Exact, 0);
    CHECK(tt.probe(1) != nullptr);
    CHECK(tt.probe(2) == nullptr);
    CHECK(tt.probe(3) != nullptr);
}

TEST_CASE(tt_stale_entries_are_replaced_first) {
    auto tt = oneBucket();
    tt.store(1, 20, 0, Bound::Exact, 0);
    tt.newSearch();
    tt.store(2, 1, 0, Bound::Exact, 0);
    tt.store(3, 1, 0, Bound::Exact, 0);
    // Both fresh shallow results fit because the deep entry is stale.
    CHECK(tt.probe(2) != nullptr);
    CHECK(tt.probe(3) != nullptr);
}

TEST_CASE(tt_clear_removes_everything) {
    TranspositionTable tt(6);
    for (Bitboard k = 1; k <= 20; ++k) tt.store(k, 1, 0, Bound::Exact, 0);
    tt.clear();
    for (Bitboard k = 1; k <= 20; ++k) CHECK(tt.probe(k) == nullptr);
}
