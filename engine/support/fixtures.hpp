#pragma once

#include <string>
#include <vector>

#include "connect4/position.hpp"

namespace connect4::support {

/// One entry of tests/fixtures/positions.json.
struct PositionFixture {
    std::string id;
    std::string description;
    std::vector<std::string> rows;
    int toMove = 1;
    std::vector<int> legalMoves;
    std::vector<int> bestMoves;  // empty when the fixture has no expected answer
    std::string outcome;         // "win", "loss", "draw" or empty
    std::vector<std::string> tags;

    bool hasTag(const std::string& tag) const;
};

/// One entry of tests/fixtures/wins.json.
struct WinFixture {
    std::string id;
    std::vector<std::string> rows;
    int winner = 0;
    std::string status;  // "playing", "won" or "draw"
};

/// Directory holding the shared fixture files. Uses the CONNECT4_FIXTURES
/// environment variable if set, otherwise the repository's tests/fixtures.
std::string fixtureDir();

/// Load the shared fixtures. Throws std::runtime_error on a missing or invalid file.
std::vector<PositionFixture> loadPositions();
std::vector<WinFixture> loadWins();

/// Convert top-to-bottom row strings ('.', '1', '2') into contract cells.
Cells rowsToCells(const std::vector<std::string>& rows);

/// Player to move implied by the disc counts (1 when equal, otherwise 2).
int impliedToMove(const Cells& cells);

}  // namespace connect4::support
