#include "json.hpp"

#include <cctype>
#include <cstdlib>
#include <stdexcept>

namespace connect4::support {

namespace {

class Parser {
public:
    explicit Parser(std::string_view text) : text_(text) {}

    Json document() {
        Json value = parseValue();
        skipSpace();
        if (pos_ != text_.size()) fail("trailing characters");
        return value;
    }

private:
    [[noreturn]] void fail(const std::string& what) const {
        throw std::runtime_error(what + " at offset " + std::to_string(pos_));
    }

    void skipSpace() {
        while (pos_ < text_.size() && std::isspace(static_cast<unsigned char>(text_[pos_]))) ++pos_;
    }

    char peek() {
        skipSpace();
        if (pos_ >= text_.size()) fail("unexpected end of input");
        return text_[pos_];
    }

    void expect(char ch) {
        if (peek() != ch) fail(std::string("expected '") + ch + "'");
        ++pos_;
    }

    bool consumeLiteral(std::string_view literal) {
        if (text_.substr(pos_, literal.size()) != literal) return false;
        pos_ += literal.size();
        return true;
    }

    Json parseValue() {
        const char ch = peek();
        if (ch == '{') return parseObject();
        if (ch == '[') return parseArray();
        if (ch == '"') return Json(parseString());
        if (consumeLiteral("true")) return Json(true);
        if (consumeLiteral("false")) return Json(false);
        if (consumeLiteral("null")) return Json();
        return parseNumber();
    }

    Json parseObject() {
        expect('{');
        Json::Object object;
        if (peek() == '}') {
            ++pos_;
            return Json(std::move(object));
        }
        while (true) {
            if (peek() != '"') fail("expected object key");
            std::string key = parseString();
            expect(':');
            object.emplace(std::move(key), parseValue());
            if (peek() == ',') {
                ++pos_;
                continue;
            }
            expect('}');
            return Json(std::move(object));
        }
    }

    Json parseArray() {
        expect('[');
        Json::Array array;
        if (peek() == ']') {
            ++pos_;
            return Json(std::move(array));
        }
        while (true) {
            array.push_back(parseValue());
            if (peek() == ',') {
                ++pos_;
                continue;
            }
            expect(']');
            return Json(std::move(array));
        }
    }

    std::string parseString() {
        expect('"');
        std::string out;
        while (pos_ < text_.size()) {
            const char ch = text_[pos_++];
            if (ch == '"') return out;
            if (ch != '\\') {
                out.push_back(ch);
                continue;
            }
            if (pos_ >= text_.size()) break;
            const char esc = text_[pos_++];
            switch (esc) {
                case '"': out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                case '/': out.push_back('/'); break;
                case 'n': out.push_back('\n'); break;
                case 't': out.push_back('\t'); break;
                case 'r': out.push_back('\r'); break;
                case 'b': out.push_back('\b'); break;
                case 'f': out.push_back('\f'); break;
                default: fail("unsupported escape sequence");  // \u is not used by the fixtures
            }
        }
        fail("unterminated string");
    }

    Json parseNumber() {
        const char* begin = text_.data() + pos_;
        char* end = nullptr;
        const double value = std::strtod(begin, &end);
        if (end == begin) fail("unexpected character");
        pos_ += static_cast<std::size_t>(end - begin);
        return Json(value);
    }

    std::string_view text_;
    std::size_t pos_ = 0;
};

}  // namespace

std::optional<Json> Json::parse(std::string_view text, std::string* error) {
    try {
        return Parser(text).document();
    } catch (const std::exception& e) {
        if (error) *error = e.what();
        return std::nullopt;
    }
}

const Json* Json::find(std::string_view key) const {
    if (!isObject()) return nullptr;
    const auto& members = object();
    const auto it = members.find(key);
    return it == members.end() ? nullptr : &it->second;
}

}  // namespace connect4::support
