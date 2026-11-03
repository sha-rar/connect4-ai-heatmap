#pragma once

#include <map>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace connect4::support {

/// Minimal JSON value, enough to read the shared fixture files.
class Json {
public:
    using Array = std::vector<Json>;
    using Object = std::map<std::string, Json, std::less<>>;

    Json() = default;
    explicit Json(bool b) : value_(b) {}
    explicit Json(double d) : value_(d) {}
    explicit Json(std::string s) : value_(std::move(s)) {}
    explicit Json(Array a) : value_(std::make_shared<Array>(std::move(a))) {}
    explicit Json(Object o) : value_(std::make_shared<Object>(std::move(o))) {}

    /// Parse a JSON document. Returns nullopt and sets `error` on failure.
    static std::optional<Json> parse(std::string_view text, std::string* error = nullptr);

    bool isNull() const { return std::holds_alternative<std::monostate>(value_); }
    bool isNumber() const { return std::holds_alternative<double>(value_); }
    bool isString() const { return std::holds_alternative<std::string>(value_); }
    bool isArray() const { return std::holds_alternative<std::shared_ptr<Array>>(value_); }
    bool isObject() const { return std::holds_alternative<std::shared_ptr<Object>>(value_); }

    double number() const { return std::get<double>(value_); }
    int integer() const { return static_cast<int>(number()); }
    const std::string& string() const { return std::get<std::string>(value_); }
    const Array& array() const { return *std::get<std::shared_ptr<Array>>(value_); }
    const Object& object() const { return *std::get<std::shared_ptr<Object>>(value_); }

    /// Member lookup; nullptr if this is not an object or the key is missing.
    const Json* find(std::string_view key) const;

private:
    std::variant<std::monostate, bool, double, std::string, std::shared_ptr<Array>,
                 std::shared_ptr<Object>>
        value_;
};

}  // namespace connect4::support
