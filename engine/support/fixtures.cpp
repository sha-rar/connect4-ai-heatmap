#include "fixtures.hpp"

#include <algorithm>
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <stdexcept>

#include "json.hpp"

#ifndef CONNECT4_FIXTURE_DIR
#error "CONNECT4_FIXTURE_DIR must be defined by the build"
#endif

namespace connect4::support {

namespace {

Json readFile(const std::string& name) {
    const std::string path = fixtureDir() + "/" + name;
    std::ifstream in(path, std::ios::binary);
    if (!in) throw std::runtime_error("cannot open fixture file " + path);
    std::stringstream buffer;
    buffer << in.rdbuf();

    std::string error;
    auto json = Json::parse(buffer.str(), &error);
    if (!json) throw std::runtime_error(path + ": " + error);
    return *json;
}

const Json& member(const Json& object, const char* key) {
    const Json* value = object.find(key);
    if (!value) throw std::runtime_error(std::string("fixture is missing \"") + key + "\"");
    return *value;
}

std::vector<int> intArray(const Json& json) {
    std::vector<int> out;
    for (const auto& v : json.array()) out.push_back(v.integer());
    return out;
}

std::vector<std::string> stringArray(const Json& json) {
    std::vector<std::string> out;
    for (const auto& v : json.array()) out.push_back(v.string());
    return out;
}

std::string optionalString(const Json& object, const char* key) {
    const Json* value = object.find(key);
    return value && value->isString() ? value->string() : std::string();
}

}  // namespace

bool PositionFixture::hasTag(const std::string& tag) const {
    return std::find(tags.begin(), tags.end(), tag) != tags.end();
}

std::string fixtureDir() {
    if (const char* env = std::getenv("CONNECT4_FIXTURES"); env && *env) return env;
    return CONNECT4_FIXTURE_DIR;
}

std::vector<PositionFixture> loadPositions() {
    const Json root = readFile("positions.json");
    std::vector<PositionFixture> out;
    for (const auto& p : member(root, "positions").array()) {
        PositionFixture f;
        f.id = member(p, "id").string();
        f.description = optionalString(p, "description");
        f.rows = stringArray(member(p, "rows"));
        f.toMove = member(p, "toMove").integer();
        f.legalMoves = intArray(member(p, "legalMoves"));
        if (const Json* best = p.find("bestMoves")) f.bestMoves = intArray(*best);
        f.outcome = optionalString(p, "outcome");
        if (const Json* tags = p.find("tags")) f.tags = stringArray(*tags);
        out.push_back(std::move(f));
    }
    return out;
}

std::vector<WinFixture> loadWins() {
    const Json root = readFile("wins.json");
    std::vector<WinFixture> out;
    for (const auto& p : member(root, "positions").array()) {
        WinFixture f;
        f.id = member(p, "id").string();
        f.rows = stringArray(member(p, "rows"));
        f.winner = member(p, "winner").integer();
        f.status = member(p, "status").string();
        out.push_back(std::move(f));
    }
    return out;
}

Cells rowsToCells(const std::vector<std::string>& rows) {
    if (rows.size() != static_cast<std::size_t>(kHeight)) {
        throw std::runtime_error("fixture board must have 6 rows");
    }
    Cells cells{};
    std::size_t i = 0;
    for (const auto& row : rows) {
        if (row.size() != static_cast<std::size_t>(kWidth)) {
            throw std::runtime_error("fixture row must have 7 cells: " + row);
        }
        for (const char ch : row) {
            if (ch == '.') cells[i++] = 0;
            else if (ch == '1') cells[i++] = 1;
            else if (ch == '2') cells[i++] = 2;
            else throw std::runtime_error(std::string("invalid fixture cell '") + ch + "'");
        }
    }
    return cells;
}

int impliedToMove(const Cells& cells) {
    const auto ones = std::count(cells.begin(), cells.end(), 1);
    const auto twos = std::count(cells.begin(), cells.end(), 2);
    return ones == twos ? 1 : 2;
}

}  // namespace connect4::support
