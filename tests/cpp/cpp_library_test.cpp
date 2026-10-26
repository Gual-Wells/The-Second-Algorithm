#include "../../content/cpp/容器与范围.cpp"
#include "../../content/cpp/文本与文件.cpp"
#include <cassert>
#include <fstream>
#include <forward_list>
#include <iostream>
#include <limits>

namespace c = second_algorithm::containers;
namespace t = second_algorithm::text;

template<class Exception, class Function>
bool throws(Function function) {
    try { function(); } catch (const Exception&) { return true; }
    return false;
}

void container_checks() {
    assert((c::squares(4) == std::vector<long long>{0, 1, 4, 9}));
    assert(c::squares(0).empty());
    assert(!c::maximum_values({}) && c::maximum_values({-3, 8, 1}) == 8);
    assert(throws<std::invalid_argument>([] { c::squares(-1); }));
    assert((c::zero_buffer(3) == std::vector<int>{0, 0, 0}));
    std::vector<int> values{1, -2, 3, -4};
    assert(c::erase_matching(values, [](int x) { return x < 0; }) == 2);
    assert((values == std::vector<int>{1, 3}));
    values = {-2, -1, 0, -3};
    c::erase_negative_one_by_one(values);
    assert((values == std::vector<int>{0}));
    std::map<std::string, int> table{{"a", 4}};
    assert(c::lookup(table, "a") == 4 && !c::lookup(table, "missing"));
    assert(table.size() == 1);
    c::replace_value(table, "a", 8); c::replace_value(table, "b", 5);
    assert(table.at("a") == 8 && table.at("b") == 5);
    assert(c::frequencies({"x", "y", "x"}).at("x") == 2);
    std::map<int, std::unique_ptr<int>> installed;
    auto pointer = std::make_unique<int>(9);
    assert(c::install_once(installed, 3, pointer) && !pointer);
    auto duplicate = std::make_unique<int>(7);
    assert(!c::install_once(installed, 3, duplicate) && *duplicate == 7);
    c::PointCounts points;
    ++points[{1, 2}]; ++points[{1, 2}]; ++points[{2, 1}];
    assert(points.size() == 2 && points.at(c::Point{1, 2}) == 2);
    std::vector<c::Job> jobs{{2, "b"}, {1, "z"}, {2, "a"}};
    c::stable_priority(jobs);
    assert(jobs[0].name == "b" && jobs[1].name == "a");
    c::order_jobs(jobs);
    assert(jobs[0].name == "a" && jobs[1].name == "b" && jobs[2].priority == 1);
    assert((c::first_k_sorted(std::vector<int>{4, 1, 3, 1}, 2) == std::vector<int>{1, 1}));
    assert(c::first_k_sorted(std::vector<int>{1}, 0).empty());
    assert((c::first_k_sorted(std::vector<int>{2, 1}, 9) == std::vector<int>{1, 2}));
    assert(c::kth_value({4, 1, 3, 1}, 2) == 3);
    assert(throws<std::out_of_range>([] { c::kth_value({}, 0); }));
    assert((c::multiset_difference(std::vector<int>{1, 2, 2, 2, 3},
                                   std::vector<int>{2, 3}) == std::vector<int>{1, 2, 2}));
    assert((c::multiset_difference(std::vector<int>{3, 2, 2}, std::vector<int>{2},
                                   std::greater<int>{}) == std::vector<int>{3, 2}));
    std::istringstream input("1 2 3");
    std::vector<std::string> labels{"x", "y"};
    std::array<std::pair<int, std::string>, 2> zipped;
    auto end = c::zip_to(std::istream_iterator<int>(input), {}, labels.begin(), labels.end(),
                         zipped.begin());
    assert(end == zipped.end());
    assert(zipped[0] == std::make_pair(1, std::string("x")));
    assert(zipped[1] == std::make_pair(2, std::string("y")));
    std::istringstream odd("1 2 3 4 5");
    std::vector<std::pair<int, int>> pairs;
    c::disjoint_pairs_to(std::istream_iterator<int>(odd), {}, std::back_inserter(pairs));
    assert((pairs == std::vector<std::pair<int, int>>{{1, 2}, {3, 4}}));
    auto names = c::select_values(jobs.begin(), jobs.end(), &c::Job::name);
    assert((names == std::vector<std::string>{"a", "b", "z"}));
    std::vector<int> ints{3, 5};
    auto owners = c::select_values(ints.begin(), ints.end(), [](int x) {
        return std::make_unique<int>(x);
    });
    assert(*owners[1] == 5 && c::proxy_example());
    c::ReadyQueue queue;
    queue.push({2, 0, "late"}); queue.push({1, 2, "second"}); queue.push({1, 1, "first"});
    assert(queue.top().payload == "first"); queue.pop();
    assert(queue.top().payload == "second");
}

struct Token {
    int value;
    explicit Token(int x) : value(x) {}
    Token(Token&&) noexcept = default;
    Token& operator=(Token&&) noexcept = default;
    Token(const Token&) = delete;
    Token& operator=(const Token&) = delete;
};
void ring_checks() {
    assert(throws<std::invalid_argument>([] { c::overwrite_ring<int> bad(0); }));
    c::overwrite_ring<int> ring(3);
    assert(!ring.pop() && ring.begin() == ring.end());
    ring.push(1); ring.push(2); ring.push(3); ring.push(4);
    assert(ring.size() == 3);
    assert((std::vector<int>(ring.begin(), ring.end()) == std::vector<int>{2, 3, 4}));
    auto copy = ring;
    assert(copy.pop() == 2 && ring.size() == 3);
    assert(ring.pop() == 2); ring.push(5);
    assert((std::vector<int>(ring.begin(), ring.end()) == std::vector<int>{3, 4, 5}));
    assert(std::distance(ring.begin(), ring.end()) == 3);
    assert(*std::find(ring.begin(), ring.end(), 4) == 4);
    ring.clear(); assert(ring.empty()); ring.push(6); assert(ring.pop() == 6);
    c::overwrite_ring<Token> tokens(2);
    tokens.push(Token(1)); tokens.push(Token(2)); tokens.push(Token(3));
    assert(tokens.begin()->value == 2);
    auto moved = std::move(tokens);
    assert(tokens.empty() && tokens.capacity() == 0 && !tokens.pop());
    assert(throws<std::logic_error>([&] { tokens.push(Token(7)); }));
    assert(moved.pop()->value == 2 && moved.pop()->value == 3);
    c::overwrite_ring<std::unique_ptr<int>> pointers(1);
    pointers.push(std::make_unique<int>(4)); pointers.push(std::make_unique<int>(8));
    assert(**pointers.pop() == 8);
}

void text_checks() {
    assert(t::trim_ascii(" \t\n").empty() && t::trim_ascii({}).empty());
    assert(t::trim_ascii("  x \r\n") == "x");
    std::string backing = "a,,b,";
    auto views = t::split_view(backing, ",", true);
    auto saved = t::split_owned(backing, ",", true);
    assert(views.size() == 4 && views[1].empty() && views[3].empty());
    backing[0] = 'z';
    assert(views[0] == "z" && saved[0] == "a");
    assert(t::split_view("", ",").empty());
    assert(t::split_view("", ",", true).size() == 1);
    assert(t::split_view("abc", "").front() == "abc");
    std::forward_list<std::string> words{"a", "b", "c"};
    assert(t::join(words.begin(), words.end(), "/") == "a/b/c");
    assert(t::join(words.end(), words.end(), "/").empty());
    std::istringstream digits("4 5 6");
    assert(t::join(std::istream_iterator<int>(digits), {}, ",") == "4,5,6");
    std::array<std::string, 2> ab{"a", "b"};
    assert(t::join(ab.begin(), ab.end(), std::string_view("\0", 1)) == std::string("a\0b", 3));
    assert(t::remove_locale_spaces(" a\tb\n") == "ab");
    auto counts = t::ascii_letter_counts("aA-z9");
    assert(counts[0] == 2 && counts[25] == 1);
    auto empty = t::ascii_letter_ratios("123");
    assert(std::all_of(empty.begin(), empty.end(), [](double v) { return v == 0; }));
    assert(t::parse_integer<int>("42") == 42 && t::parse_integer<int>("-7") == -7);
    assert(t::parse_integer<int>("ff", 16) == 255);
    assert(t::parse_integer<int>(std::to_string(std::numeric_limits<int>::min())) ==
           std::numeric_limits<int>::min());
    for (auto bad : {"", " 1", "+1", "1x", "9999999999999999999"})
        assert(!t::parse_integer<int>(bad));
    assert(!t::parse_integer<unsigned>("-1") && !t::parse_integer<int>("0xff", 16));
    assert(!t::parse_integer<int>("1", 1));
    std::string bytes("\0\x80\xff", 3);
    assert(t::hex_encode(bytes) == "0080FF");
    assert((t::hex_decode("0080ff").value() == std::vector<unsigned char>{0, 128, 255}));
    assert(t::hex_decode("")->empty());
    assert(!t::hex_decode("F") && !t::hex_decode("0G") && !t::hex_decode("00 0"));
    auto parsed = t::parse_named_count("Alpha:23");
    assert(parsed && parsed->name == "Alpha" && parsed->count == 23);
    assert(!t::parse_named_count("Alpha:23x") && !t::parse_named_count(""));
    assert(!t::parse_named_count("Alpha:99999999999999999999"));
    std::string dates = "01.12.2017 | 02.12.2018";
    assert(t::rewrite_dates(std::string_view(dates.data(), 10)) == "2017-12-01");
    assert(t::rewrite_dates("").empty());
    assert(t::sum_fractions({0.25, 0.75}) == 1.0);
    assert(t::sum_integers({std::numeric_limits<int>::max(), 1}) ==
           static_cast<long long>(std::numeric_limits<int>::max()) + 1);
}

void stream_checks() {
    std::istringstream lines("\nA\nB");
    assert((t::read_lines(lines) == std::vector<std::string>{"", "A", "B"}));
    std::istringstream pairs("a 1 b 2");
    assert((t::read_pairs(pairs) == std::vector<std::pair<std::string, int>>{{"a", 1}, {"b", 2}}));
    assert(throws<std::runtime_error>([] { std::istringstream in("a"); t::read_pairs(in); }));
    assert(throws<std::runtime_error>([] { std::istringstream in("a x"); t::read_pairs(in); }));
    std::ostringstream formatted;
    formatted.precision(7); formatted.fill('_');
    auto old_flags = formatted.flags();
    t::write_amount(formatted, 1.234);
    assert(formatted.str() == "1.23" && formatted.precision() == 7 &&
           formatted.fill() == '_' && formatted.flags() == old_flags);
    std::stringstream binary(std::ios::in | std::ios::out | std::ios::binary);
    t::write_record(binary, {0x01020304U, std::string("a\0b", 3)});
    t::write_record(binary, {0, ""});
    assert(static_cast<unsigned char>(binary.str()[0]) == 4);
    binary.seekg(0);
    auto first = t::read_record(binary), second = t::read_record(binary);
    assert(first && first->id == 0x01020304U && first->name == std::string("a\0b", 3));
    assert(second && second->name.empty() && !t::read_record(binary));
    assert(throws<std::runtime_error>([] {
        std::istringstream partial(std::string("\x01\x02", 2)); t::read_record(partial);
    }));
    assert(throws<std::runtime_error>([] {
        std::ostringstream out; t::write_record(out, {1, "abc"});
        auto data = out.str(); data.pop_back(); std::istringstream in(data); t::read_record(in);
    }));
    assert(throws<std::length_error>([] {
        std::ostringstream out; t::write_record(out, {1, "abc"});
        std::istringstream in(out.str()); t::read_record(in, 2);
    }));
    std::istringstream source(" \t\nkeep\n\n  content \nlast");
    std::ostringstream target;
    t::copy_nonblank_lines(source, target);
    assert(target.str() == "keep\n  content \nlast\n");
}

void filesystem_checks() {
    namespace fs = std::filesystem;
    const auto root = fs::current_path() / ".local/cpp-research/library/io-test-owned";
    const auto nested = root / "nested";
    fs::create_directories(nested);
    { std::ofstream out(root / "a.txt", std::ios::binary); out << "abc"; }
    { std::ofstream out(nested / "b.bin", std::ios::binary); out << "de"; }
    assert(t::directory_bytes(root) == 5);
    auto matches = t::matching_files(root, std::regex(R"(.*\.txt)"));
    assert(matches.size() == 1 && matches[0].filename() == "a.txt");
    assert(throws<fs::filesystem_error>([&] { t::directory_bytes(root / "missing"); }));
    fs::remove(root / "a.txt"); fs::remove(nested / "b.bin");
    fs::remove(nested); fs::remove(root); // 仅删除本测试明确创建的文件和空目录
}

int main() {
    container_checks(); ring_checks(); text_checks(); stream_checks(); filesystem_checks();
    std::cout << "C++17 library semantic checks passed\n";
}
