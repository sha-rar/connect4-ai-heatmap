#pragma once

#include "connect4/position.hpp"

namespace connect4 {

/// Score of a won position. Mate scores are kWinScore minus the ply count.
/// Must match WIN_SCORE in packages/core/src/engine.ts.
inline constexpr int kWinScore = 1'000'000;

/// Static evaluation from `rootPlayer`'s perspective (positive is good for
/// rootPlayer). Port of apps/api/src/engine/evaluate.ts; returns identical
/// values so the two engines are directly comparable.
int evaluate(const Position& pos, int rootPlayer);

}  // namespace connect4
