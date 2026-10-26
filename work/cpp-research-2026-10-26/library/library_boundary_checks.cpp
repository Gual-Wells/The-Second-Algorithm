#include <algorithm>
#include <array>
#include <cassert>
#include <charconv>
#include <cctype>
#include <forward_list>
#include <iostream>
#include <iterator>
#include <map>
#include <memory>
#include <numeric>
#include <optional>
#include <regex>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// Independent small experiments; not book code or a finished teaching chapter.
template<class It>
std::string join_input(It first, It last, std::string_view delimiter) {
    std::ostringstream out;
    bool separator = false;
    for (; first != last; ++first) {
        if (separator) out << delimiter;
        out << *first;
        separator = true;
    }
    return out.str();
}

template<class I, class J, class O>
O zip_to(I a, I a_end, J b, J b_end, O out) {
    while (a != a_end && b != b_end) *out++ = std::make_pair(*a++, *b++);
    return out;
}

template<class I, class O>
O disjoint_pairs_to(I first, I last, O out) {
    while (first != last) {
        auto a = *first++;
        if (first == last) break;
        auto b = *first++;
        *out++ = std::make_pair(a, b);
    }
    return out;
}

std::optional<int> parse_integer(std::string_view text) {
    int value = 0;
    if (text.empty()) return std::nullopt;
    auto [end, ec] = std::from_chars(text.data(), text.data() + text.size(), value);
    if (ec != std::errc{} || end != text.data() + text.size()) return std::nullopt;
    return value;
}

int main() {
    // A bounded view can point into a longer valid null-terminated object.
    std::string backing = "01.12.2017 | 02.12.2018";
    std::string_view prefix(backing.data(), 10);
    std::regex dates(R"((\d{2})\.(\d{2})\.(\d{4}))");
    auto c_string_result = std::regex_replace(prefix.data(), dates, "$3-$2-$1");
    std::string bounded_result;
    std::regex_replace(std::back_inserter(bounded_result), prefix.begin(), prefix.end(),
                       dates, "$3-$2-$1");
    assert(c_string_result == "2017-12-01 | 2018-12-02");
    assert(bounded_result == "2017-12-01");

    std::forward_list<std::string> words{"a", "b", "c"};
    assert(join_input(words.begin(), words.end(), ",") == "a,b,c");
    assert(join_input(words.end(), words.end(), ",").empty());
    std::istringstream one_pass("4 5 6");
    assert(join_input(std::istream_iterator<int>(one_pass), {}, "/") == "4/5/6");

    std::vector<int> numbers{1, 2, 3};
    std::vector<std::string> letters{"x", "y"};
    std::array<std::pair<int, std::string>, 2> zipped;
    auto end = zip_to(numbers.begin(), numbers.end(), letters.begin(), letters.end(), zipped.begin());
    assert(end == zipped.end());
    assert(zipped[0] == std::make_pair(1, std::string("x")));
    assert(zipped[1] == std::make_pair(2, std::string("y")));
    std::array<std::pair<int, int>, 1> grouped;
    auto grouped_end = disjoint_pairs_to(numbers.begin(), numbers.end(), grouped.begin());
    assert(grouped_end == grouped.end() && grouped[0] == std::make_pair(1, 2));

    std::vector<int> remove_values{1, 2, 1, 3};
    auto new_end = std::remove(remove_values.begin(), remove_values.end(), 1);
    assert(remove_values.size() == 4 && new_end - remove_values.begin() == 2);
    remove_values.erase(new_end, remove_values.end());
    assert((remove_values == std::vector<int>{2, 3}));

    std::map<int, std::unique_ptr<int>> objects;
    objects.emplace(1, std::make_unique<int>(3));
    auto pointer = std::make_unique<int>(7);
    auto [position, inserted] = objects.try_emplace(1, std::move(pointer));
    assert(!inserted && pointer && *pointer == 7 && *position->second == 3);
    std::map<int, int> counts;
    assert(counts.find(2) == counts.end() && counts.empty());
    assert(counts[2] == 0 && counts.size() == 1);

    std::vector<int> storage;
    storage.reserve(8);
    assert(storage.size() == 0 && storage.capacity() >= 8);
    storage.emplace_back(6);
    assert(storage.size() == 1 && storage[0] == 6);

    std::vector<double> fractions{0.25, 0.75};
    assert(std::accumulate(fractions.begin(), fractions.end(), 0) == 0);
    assert(std::accumulate(fractions.begin(), fractions.end(), 0.0) == 1.0);
    assert(parse_integer("42") == 42 && parse_integer("-4") == -4);
    assert(!parse_integer("42x") && !parse_integer(" 42") && !parse_integer("+42"));
    assert(!parse_integer("9999999999999999999999"));
    assert(std::isspace(static_cast<unsigned char>('\t')) != 0);
    std::cout << "library boundary checks passed; no UB examples executed\n";
}
