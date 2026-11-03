#include <array>
#include <cstdint>

#include "connect4/search.hpp"
#include "fixtures.hpp"
#include "harness.hpp"

using namespace connect4;
using namespace connect4::support;

extern "C" {
int c4_result_size();
void c4_reset();
int c4_choose_move(const std::int32_t* cells, int player, int depth, int timeLimitMs,
                   std::int32_t* result);
}

namespace {

constexpr int kColumnScores = 10;

std::array<std::int32_t, kCells> toInt32(const Cells& cells) {
    std::array<std::int32_t, kCells> out{};
    for (std::size_t i = 0; i < out.size(); ++i) out[i] = cells[i];
    return out;
}

}  // namespace

TEST_CASE(bindings_result_layout_is_stable) {
    // Must match RESULT_SIZE in apps/web/src/engine/wasmEngine.ts.
    CHECK_EQ(c4_result_size(), 17);
}

TEST_CASE(bindings_match_engine_results) {
    std::array<std::int32_t, 17> out{};
    for (const auto& f : loadPositions()) {
        CONTEXT(f.id);
        const Cells cells = rowsToCells(f.rows);
        const auto input = toInt32(cells);
        c4_reset();
        const int status = c4_choose_move(input.data(), f.toMove, 5, 0, out.data());
        REQUIRE(status == 0);

        Engine engine;
        const auto pos = Position::fromCells(cells, f.toMove);
        REQUIRE(pos.has_value());
        const auto expected = engine.chooseMove(*pos, {5, 0});

        CHECK_EQ(out[0], 0);
        CHECK_EQ(out[1], expected.bestCol);
        CHECK_EQ(out[2], expected.bestScore);
        CHECK_EQ(out[3], expected.usedDepth);
        CHECK_EQ(static_cast<std::uint64_t>(static_cast<std::uint32_t>(out[7])) |
                     (static_cast<std::uint64_t>(static_cast<std::uint32_t>(out[8])) << 32),
                 expected.nodes);
        for (int col = 0; col < kWidth; ++col) {
            const auto& score = expected.columnScores[static_cast<std::size_t>(col)];
            CHECK_EQ(((out[9] >> col) & 1) == 1, score.has_value());
            if (score) CHECK_EQ(out[kColumnScores + col], *score);
        }
    }
}

TEST_CASE(bindings_reject_invalid_and_finished_positions) {
    std::array<std::int32_t, 17> out{};
    std::array<std::int32_t, kCells> cells{};

    CHECK_EQ(c4_choose_move(cells.data(), 2, 4, 0, out.data()), 1);  // wrong player
    CHECK_EQ(out[1], -1);

    cells[5 * kWidth + 0] = 3;  // bad value
    CHECK_EQ(c4_choose_move(cells.data(), 2, 4, 0, out.data()), 1);

    for (const auto& w : loadWins()) {
        if (w.status == "playing") continue;
        CONTEXT(w.id);
        const Cells won = rowsToCells(w.rows);
        const auto input = toInt32(won);
        CHECK_EQ(c4_choose_move(input.data(), impliedToMove(won), 4, 0, out.data()), 2);
    }
}
