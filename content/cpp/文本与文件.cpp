#include <algorithm>
#include <array>
#include <charconv>
#include <cctype>
#include <climits>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <iomanip>
#include <ios>
#include <istream>
#include <iterator>
#include <limits>
#include <numeric>
#include <optional>
#include <ostream>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>
#include <type_traits>
#include <utility>
#include <vector>

namespace second_algorithm::text {

// BEGIN trim-split
inline std::string_view trim_ascii(std::string_view text) {
    constexpr auto blanks = " \t\r\n\f\v";
    auto first = text.find_first_not_of(blanks);
    if (first == std::string_view::npos) return {};
    auto last = text.find_last_not_of(blanks);
    return text.substr(first, last - first + 1);
}
inline std::vector<std::string_view>
split_view(std::string_view text, std::string_view delimiters,
           bool keep_empty = false) {
    std::vector<std::string_view> result;
    std::size_t start = 0;
    for (std::size_t i = 0; i < text.size(); ++i) {
        if (delimiters.find(text[i]) == std::string_view::npos) continue;
        if (keep_empty || i != start) result.push_back(text.substr(start, i - start));
        start = i + 1;
    }
    if (keep_empty || start != text.size()) result.push_back(text.substr(start));
    return result;
}
inline std::vector<std::string>
split_owned(std::string_view text, std::string_view delimiters,
            bool keep_empty = false) {
    std::vector<std::string> result;
    for (auto token : split_view(text, delimiters, keep_empty))
        result.emplace_back(token);
    return result;
}
// END trim-split

// BEGIN join-input
template<class Input>
std::string join(Input first, Input last, std::string_view delimiter) {
    std::ostringstream out;
    bool need_separator = false;
    for (; first != last; ++first) {
        if (need_separator) out << delimiter;
        out << *first;
        need_separator = true;
    }
    return out.str();
}
// END join-input

// BEGIN character-policy
inline std::string remove_locale_spaces(std::string text) {
    auto end = std::remove_if(text.begin(), text.end(), [](unsigned char ch) {
        return std::isspace(ch) != 0;
    });
    text.erase(end, text.end());
    return text;
}
inline std::array<std::size_t, 26> ascii_letter_counts(std::string_view text) {
    std::array<std::size_t, 26> counts{};
    for (unsigned char ch : text) {
        if (ch >= 'A' && ch <= 'Z') ++counts[ch - 'A'];
        else if (ch >= 'a' && ch <= 'z') ++counts[ch - 'a'];
    }
    return counts;
}
inline std::array<double, 26> ascii_letter_ratios(std::string_view text) {
    auto counts = ascii_letter_counts(text);
    auto total = std::accumulate(counts.begin(), counts.end(), std::size_t{0});
    std::array<double, 26> ratios{};
    if (total != 0)
        for (std::size_t i = 0; i < counts.size(); ++i)
            ratios[i] = static_cast<double>(counts[i]) / static_cast<double>(total);
    return ratios; // 没有字母时全部为 0，不做除 0
}
// END character-policy

// BEGIN strict-integer
template<class Integer>
std::optional<Integer> parse_integer(std::string_view text, int base = 10) {
    static_assert(std::is_integral_v<Integer> && !std::is_same_v<Integer, bool>);
    if (text.empty() || base < 2 || base > 36) return std::nullopt;
    Integer result{};
    auto [end, error] = std::from_chars(text.data(), text.data() + text.size(),
                                      result, base);
    if (error != std::errc{} || end != text.data() + text.size())
        return std::nullopt;
    return result;
}
// END strict-integer

// BEGIN hex-codec
inline std::string hex_encode(std::string_view bytes) {
    constexpr char digits[] = "0123456789ABCDEF";
    std::string result;
    if (bytes.size() > result.max_size() / 2) throw std::length_error("hex output");
    result.reserve(2 * bytes.size());
    for (unsigned char byte : bytes) {
        result.push_back(digits[byte >> 4]);
        result.push_back(digits[byte & 15]);
    }
    return result;
}
inline int hex_digit(unsigned char ch) {
    if (ch >= '0' && ch <= '9') return ch - '0';
    if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
    if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
    return -1;
}
inline std::optional<std::vector<unsigned char>> hex_decode(std::string_view text) {
    if (text.size() % 2 != 0) return std::nullopt;
    std::vector<unsigned char> result;
    result.reserve(text.size() / 2);
    for (std::size_t i = 0; i < text.size(); i += 2) {
        int high = hex_digit(static_cast<unsigned char>(text[i]));
        int low = hex_digit(static_cast<unsigned char>(text[i + 1]));
        if (high < 0 || low < 0) return std::nullopt;
        result.push_back(static_cast<unsigned char>((high << 4) | low));
    }
    return result; // 空串是合法的空字节序列；不接受空白或 0x 前缀
}
// END hex-codec

// BEGIN bounded-regex
struct NamedCount { std::string name; unsigned count; };
inline std::optional<NamedCount> parse_named_count(std::string_view text) {
    if (text.empty()) return std::nullopt;
    static const std::regex pattern(R"(([A-Za-z]+):([0-9]+))");
    std::match_results<std::string_view::const_iterator> match;
    if (!std::regex_match(text.begin(), text.end(), match, pattern)) return std::nullopt;
    auto count_text = text.substr(static_cast<std::size_t>(match.position(2)),
                                  static_cast<std::size_t>(match.length(2)));
    auto count = parse_integer<unsigned>(count_text);
    if (!count) return std::nullopt;
    return NamedCount{match[1].str(), *count};
}
inline std::string rewrite_dates(std::string_view text) {
    if (text.empty()) return {};
    static const std::regex pattern(R"((\d{2})\.(\d{2})\.(\d{4}))");
    std::string result;
    std::regex_replace(std::back_inserter(result), text.begin(), text.end(),
                       pattern, "$3-$2-$1");
    return result;
}
// END bounded-regex

// BEGIN fold-type
inline double sum_fractions(const std::vector<double>& values) {
    return std::accumulate(values.begin(), values.end(), 0.0);
}
inline long long sum_integers(const std::vector<int>& values) {
    return std::accumulate(values.begin(), values.end(), 0LL);
}
// END fold-type

// BEGIN stream-read
inline std::vector<std::string> read_lines(std::istream& input) {
    std::vector<std::string> lines;
    for (std::string line; std::getline(input, line);) lines.push_back(std::move(line));
    if (input.bad() || !input.eof()) throw std::runtime_error("line read failed");
    return lines;
}
inline std::vector<std::pair<std::string, int>> read_pairs(std::istream& input) {
    std::vector<std::pair<std::string, int>> result;
    for (std::string name; input >> name;) {
        int count;
        if (!(input >> count)) throw std::runtime_error("invalid or incomplete record");
        result.emplace_back(std::move(name), count);
    }
    if (input.bad() || !input.eof()) throw std::runtime_error("record read failed");
    return result;
}
// END stream-read

// BEGIN stream-format
class format_guard {
    std::ostream& out_;
    std::ios::fmtflags flags_;
    std::streamsize precision_;
    char fill_;
public:
    explicit format_guard(std::ostream& out)
        : out_(out), flags_(out.flags()), precision_(out.precision()), fill_(out.fill()) {}
    format_guard(const format_guard&) = delete;
    format_guard& operator=(const format_guard&) = delete;
    ~format_guard() { out_.flags(flags_); out_.precision(precision_); out_.fill(fill_); }
};
inline void write_amount(std::ostream& out, double value) {
    format_guard saved(out);
    out << std::fixed << std::setprecision(2) << value;
}
// END stream-format

// BEGIN binary-record
static_assert(CHAR_BIT == 8, "this byte format uses 8-bit bytes");
struct BinaryRecord { std::uint32_t id; std::string name; };
inline void write_u32_le(std::ostream& output, std::uint32_t value) {
    unsigned char bytes[4];
    for (unsigned i = 0; i < 4; ++i) bytes[i] = static_cast<unsigned char>(value >> (8 * i));
    output.write(reinterpret_cast<const char*>(bytes), 4);
    if (!output) throw std::runtime_error("binary write failed");
}
inline std::uint32_t read_u32_le(std::istream& input) {
    char bytes[4];
    if (!input.read(bytes, 4)) throw std::runtime_error("truncated u32");
    std::uint32_t value = 0;
    for (unsigned i = 0; i < 4; ++i)
        value |= std::uint32_t(static_cast<unsigned char>(bytes[i])) << (8 * i);
    return value;
}
inline void write_record(std::ostream& output, const BinaryRecord& record) {
    if (record.name.size() > std::numeric_limits<std::uint32_t>::max() ||
        record.name.size() > static_cast<std::size_t>(std::numeric_limits<std::streamsize>::max()))
        throw std::length_error("name too long");
    write_u32_le(output, record.id);
    write_u32_le(output, static_cast<std::uint32_t>(record.name.size()));
    output.write(record.name.data(), static_cast<std::streamsize>(record.name.size()));
    if (!output) throw std::runtime_error("binary write failed");
}
inline std::optional<BinaryRecord> read_record(std::istream& input,
                                              std::uint32_t max_name = 1U << 20) {
    if (input.peek() == std::char_traits<char>::eof()) {
        if (input.bad() || !input.eof()) throw std::runtime_error("binary read failed");
        return std::nullopt; // 记录边界的正常 EOF，不是半条记录
    }
    auto id = read_u32_le(input), length = read_u32_le(input);
    if (length > max_name ||
        static_cast<std::uintmax_t>(length) >
            static_cast<std::uintmax_t>(std::numeric_limits<std::streamsize>::max()))
        throw std::length_error("name limit");
    std::string name(length, '\0');
    if (length != 0 && !input.read(name.data(), static_cast<std::streamsize>(length)))
        throw std::runtime_error("truncated name");
    return BinaryRecord{id, std::move(name)};
}
// END binary-record

// BEGIN filesystem-query
inline std::uintmax_t directory_bytes(const std::filesystem::path& root) {
    std::uintmax_t total = 0;
    for (const auto& entry : std::filesystem::recursive_directory_iterator(root)) {
        // 不跟随目录链接，也不把文件链接的目标另算一份。
        if (!std::filesystem::is_regular_file(entry.symlink_status())) continue;
        auto size = entry.file_size();
        if (size > std::numeric_limits<std::uintmax_t>::max() - total)
            throw std::overflow_error("directory total");
        total += size;
    }
    return total; // 访问或遍历失败抛 filesystem_error，不静默当作 0
}
inline std::vector<std::filesystem::path>
matching_files(const std::filesystem::path& root, const std::regex& filename_pattern) {
    std::vector<std::filesystem::path> result;
    for (const auto& entry : std::filesystem::recursive_directory_iterator(root)) {
        if (std::filesystem::is_regular_file(entry.symlink_status()) &&
            std::regex_match(entry.path().filename().string(), filename_pattern))
            result.push_back(entry.path());
    }
    std::sort(result.begin(), result.end()); // 遍历本身不承诺目录项顺序
    return result;
}
// END filesystem-query

// BEGIN stream-transform
inline void copy_nonblank_lines(std::istream& input, std::ostream& output) {
    for (std::string line; std::getline(input, line);) {
        if (!trim_ascii(line).empty()) output << line << '\n';
        if (!output) throw std::runtime_error("text write failed");
    }
    if (input.bad() || !input.eof()) throw std::runtime_error("text read failed");
}
// END stream-transform

} // namespace second_algorithm::text
