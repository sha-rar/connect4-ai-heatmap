// Native benchmark for the C++ engine. Mirrors apps/api/bench/benchmark.ts so
// the two engines can be compared on the same fixtures.
//
// Usage: connect4_bench [--max-depth N] [--runs N]

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include "connect4/search.hpp"
#include "fixtures.hpp"

using namespace connect4;
using namespace connect4::support;

namespace {

constexpr double kDepthCutoffMs = 5000.0;  // stop deepening a position after this
constexpr int kBudgetsMs[] = {100, 250, 1000};
constexpr int kDefaultDepth = 6;
constexpr int kDefaultTimeMs = 250;

int argValue(int argc, char** argv, const char* name, int fallback) {
    for (int i = 1; i + 1 < argc; ++i) {
        if (std::strcmp(argv[i], name) == 0) return std::atoi(argv[i + 1]);
    }
    return fallback;
}

struct Timed {
    SearchResult result;
    double ms;
};

/// Median wall time of `runs` searches; each search starts a fresh TT generation.
Timed timed(Engine& engine, const Position& pos, SearchOptions options, int runs) {
    std::vector<double> times;
    SearchResult result;
    for (int i = 0; i < runs; ++i) {
        const auto t0 = std::chrono::steady_clock::now();
        result = engine.chooseMove(pos, options);
        const auto t1 = std::chrono::steady_clock::now();
        times.push_back(std::chrono::duration<double, std::milli>(t1 - t0).count());
    }
    std::sort(times.begin(), times.end());
    return {result, times[times.size() / 2]};
}

}  // namespace

int main(int argc, char** argv) {
    const int maxDepth = argValue(argc, argv, "--max-depth", 12);
    const int runs = std::max(1, argValue(argc, argv, "--runs", 3));

    std::vector<std::pair<std::string, Position>> positions;
    for (const auto& f : loadPositions()) {
        if (!f.hasTag("benchmark")) continue;
        auto pos = Position::fromCells(rowsToCells(f.rows), f.toMove);
        if (!pos) {
            std::fprintf(stderr, "invalid fixture %s\n", f.id.c_str());
            return 1;
        }
        positions.emplace_back(f.id, *pos);
    }

    Engine engine;

    std::printf("# C++ engine benchmark\n\n");
    std::printf("Native build, median of %d runs, %zu-entry transposition table.\n\n", runs,
                std::size_t{1} << 20);

    std::printf("## Fixed depth (no time limit)\n\n");
    std::printf("| Position | Depth | Nodes | Time (ms) | Nodes/ms |\n");
    std::printf("| -------- | ----: | ----: | --------: | -------: |\n");
    for (const auto& [id, pos] : positions) {
        for (int depth = 1; depth <= maxDepth; ++depth) {
            const auto [result, ms] = timed(engine, pos, {depth, 0, false}, runs);
            const double rate = ms > 0 ? static_cast<double>(result.nodes) / ms : 0.0;
            std::printf("| %s | %d | %llu | %.1f | %.0f |\n", id.c_str(), depth,
                        static_cast<unsigned long long>(result.nodes), ms, rate);
            if (ms > kDepthCutoffMs || result.usedDepth < depth) break;
        }
    }

    std::printf("\n## Deepest complete search within a time budget\n\n");
    std::printf("Iterative deepening to the end of the game; reports usedDepth.\n\n");
    std::printf("| Position | 100 ms | 250 ms | 1000 ms |\n");
    std::printf("| -------- | -----: | -----: | ------: |\n");
    for (const auto& [id, pos] : positions) {
        std::printf("| %s", id.c_str());
        for (const int budget : kBudgetsMs) {
            const auto [result, ms] = timed(engine, pos, {kMaxPly, budget}, runs);
            (void)ms;
            const bool solved = !result.timedOut;
            std::printf(" | %s%d", solved ? "solved " : "", result.usedDepth);
        }
        std::printf(" |\n");
    }

    std::printf("\n## Default settings (depth %d, %d ms)\n\n", kDefaultDepth, kDefaultTimeMs);
    std::printf("| Position | Best col | Nodes | Time (ms) | Timed out | Columns scored |\n");
    std::printf("| -------- | -------: | ----: | --------: | :-------: | -------------: |\n");
    for (const auto& [id, pos] : positions) {
        const auto [result, ms] = timed(engine, pos, {kDefaultDepth, kDefaultTimeMs}, runs);
        int scored = 0;
        int legal = 0;
        for (int col = 0; col < kWidth; ++col) {
            legal += pos.canPlay(col) ? 1 : 0;
            scored += result.columnScores[static_cast<std::size_t>(col)] ? 1 : 0;
        }
        std::printf("| %s | %d | %llu | %.2f | %s | %d/%d |\n", id.c_str(), result.bestCol,
                    static_cast<unsigned long long>(result.nodes), ms,
                    result.timedOut ? "yes" : "no", scored, legal);
    }
    return 0;
}
