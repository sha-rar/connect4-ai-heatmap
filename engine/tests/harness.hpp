#pragma once

// Minimal dependency-free test harness.
//
//   TEST_CASE(name) { CHECK(cond); CHECK_EQ(a, b); REQUIRE(cond); }
//
// CHECK records a failure and continues; REQUIRE stops the current test.

#include <sstream>
#include <string>
#include <vector>

namespace c4test {

struct TestCase {
    const char* name;
    void (*fn)();
};

std::vector<TestCase>& registry();

struct Registrar {
    Registrar(const char* name, void (*fn)()) { registry().push_back({name, fn}); }
};

/// Thrown by REQUIRE to abort the current test.
struct Abort {};

void reportFailure(const char* file, int line, const std::string& message);

template <typename T>
std::string show(const T& value) {
    std::ostringstream os;
    if constexpr (requires { os << value; }) {
        os << value;
    } else if constexpr (requires { value.begin(); value.end(); }) {
        os << '[';
        bool first = true;
        for (const auto& item : value) {
            if (!first) os << ", ";
            os << show(item);
            first = false;
        }
        os << ']';
    } else {
        os << "<unprintable>";
    }
    return os.str();
}

}  // namespace c4test

#define TEST_CASE(name)                                                   \
    static void name();                                                   \
    static const ::c4test::Registrar name##_registrar(#name, &name);      \
    static void name()

#define CHECK(cond)                                                                 \
    do {                                                                            \
        if (!(cond)) ::c4test::reportFailure(__FILE__, __LINE__, "CHECK(" #cond ")"); \
    } while (0)

#define CHECK_EQ(actual, expected)                                                       \
    do {                                                                                 \
        const auto& c4_actual = (actual);                                                \
        const auto& c4_expected = (expected);                                            \
        if (!(c4_actual == c4_expected)) {                                               \
            ::c4test::reportFailure(__FILE__, __LINE__,                                  \
                                    "CHECK_EQ(" #actual ", " #expected "): got " +       \
                                        ::c4test::show(c4_actual) + ", expected " +      \
                                        ::c4test::show(c4_expected));                    \
        }                                                                                \
    } while (0)

#define REQUIRE(cond)                                                                   \
    do {                                                                                \
        if (!(cond)) {                                                                  \
            ::c4test::reportFailure(__FILE__, __LINE__, "REQUIRE(" #cond ")");          \
            throw ::c4test::Abort{};                                                    \
        }                                                                               \
    } while (0)

/// Attach context (e.g. a fixture id) to failures reported in the current scope.
#define C4_CONCAT_INNER(a, b) a##b
#define C4_CONCAT(a, b) C4_CONCAT_INNER(a, b)
#define CONTEXT(text) const ::c4test::Context C4_CONCAT(c4_context_, __LINE__)(text)

namespace c4test {

class Context {
public:
    explicit Context(std::string text);
    ~Context();
    Context(const Context&) = delete;
    Context& operator=(const Context&) = delete;
};

}  // namespace c4test
