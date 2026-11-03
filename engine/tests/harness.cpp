#include "harness.hpp"

#include <exception>
#include <iostream>
#include <string_view>

namespace c4test {

namespace {

int gFailures = 0;
bool gCurrentFailed = false;
std::vector<std::string> gContext;

}  // namespace

std::vector<TestCase>& registry() {
    static std::vector<TestCase> cases;
    return cases;
}

void reportFailure(const char* file, int line, const std::string& message) {
    ++gFailures;
    gCurrentFailed = true;
    std::cerr << "  " << file << ":" << line << ": " << message;
    for (const auto& ctx : gContext) std::cerr << " [" << ctx << "]";
    std::cerr << "\n";
}

Context::Context(std::string text) { gContext.push_back(std::move(text)); }
Context::~Context() { gContext.pop_back(); }

}  // namespace c4test

int main(int argc, char** argv) {
    using namespace c4test;
    const std::string_view filter = argc > 1 ? argv[1] : "";

    int run = 0;
    int failedTests = 0;
    for (const auto& test : registry()) {
        if (!filter.empty() && std::string_view(test.name).find(filter) == std::string_view::npos) {
            continue;
        }
        ++run;
        gCurrentFailed = false;
        gContext.clear();
        try {
            test.fn();
        } catch (const Abort&) {
            // Failure already reported.
        } catch (const std::exception& e) {
            reportFailure(test.name, 0, std::string("unexpected exception: ") + e.what());
        }
        if (gCurrentFailed) {
            ++failedTests;
            std::cerr << "FAIL " << test.name << "\n";
        } else {
            std::cout << "ok   " << test.name << "\n";
        }
    }

    std::cout << "\n" << run - failedTests << "/" << run << " tests passed";
    if (gFailures > 0) std::cout << " (" << gFailures << " failed checks)";
    std::cout << "\n";
    return failedTests == 0 && run > 0 ? 0 : 1;
}
