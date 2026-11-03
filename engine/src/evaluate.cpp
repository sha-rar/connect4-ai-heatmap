#include "connect4/evaluate.hpp"

#include <array>
#include <bit>

namespace connect4 {

namespace {

constexpr int kWindowLength = 4;

// Horizontal 6*4, vertical 7*3, and 2 * 3*4 diagonal windows.
constexpr int kWindowCount = 69;

/// Every group of four cells that can form a line.
constexpr std::array<Bitboard, kWindowCount> kWindows = [] {
    std::array<Bitboard, kWindowCount> windows{};
    int n = 0;
    auto add = [&](int col, int height, int dc, int dh) {
        Bitboard w = 0;
        for (int k = 0; k < kWindowLength; ++k) w |= cellBit(col + dc * k, height + dh * k);
        windows[static_cast<std::size_t>(n++)] = w;
    };
    for (int h = 0; h < kHeight; ++h)
        for (int c = 0; c + kWindowLength <= kWidth; ++c) add(c, h, 1, 0);
    for (int c = 0; c < kWidth; ++c)
        for (int h = 0; h + kWindowLength <= kHeight; ++h) add(c, h, 0, 1);
    for (int c = 0; c + kWindowLength <= kWidth; ++c) {
        for (int h = 0; h + kWindowLength <= kHeight; ++h) {
            add(c, h, 1, 1);                      // rising
            add(c, h + kWindowLength - 1, 1, -1);  // falling
        }
    }
    return windows;
}();

// Heuristic weights; keep in sync with scoreWindow() in evaluate.ts.
constexpr int kOwnThree = 120;
constexpr int kOwnTwo = 12;
constexpr int kOppThree = 140;
constexpr int kOppTwo = 14;
constexpr int kCentreDisc = 8;

int scoreWindow(Bitboard window, Bitboard own, Bitboard opp) {
    const int ownCount = std::popcount(own & window);
    const int oppCount = std::popcount(opp & window);
    const int empty = kWindowLength - ownCount - oppCount;

    int score = 0;
    if (ownCount == 3 && empty == 1) score += kOwnThree;
    if (ownCount == 2 && empty == 2) score += kOwnTwo;
    if (oppCount == 3 && empty == 1) score -= kOppThree;
    if (oppCount == 2 && empty == 2) score -= kOppTwo;
    return score;
}

}  // namespace

int evaluate(const Position& pos, int rootPlayer) {
    const int other = rootPlayer == 1 ? 2 : 1;
    const Bitboard own = pos.discs(rootPlayer);
    const Bitboard opp = pos.discs(other);

    if (hasAlignment(own)) return kWinScore;
    if (hasAlignment(opp)) return -kWinScore;

    int score = std::popcount(own & columnMask(kWidth / 2)) * kCentreDisc;
    for (const Bitboard window : kWindows) score += scoreWindow(window, own, opp);
    return score;
}

}  // namespace connect4
