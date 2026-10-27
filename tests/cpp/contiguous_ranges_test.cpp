#include "../../content/contiguous-ranges/连续片段.cpp"
#include <cstdlib>
#include <functional>
#include <iostream>
#include <map>
#include <random>
#include <set>
#include <string_view>

namespace c = second_algorithm::contiguous;
using i64 = long long;
__extension__ using u128 = unsigned __int128; // Independent wide-product test oracle.
std::map<std::string_view, unsigned long long> checks;
std::vector<int> context;
void check(bool condition, std::string_view group) {
    ++checks[group];
    if (!condition) {
        std::cerr << "FAIL " << group << " array:";
        for (int x : context) std::cerr << ' ' << x;
        std::cerr << '\n';
        std::exit(1);
    }
}
template<class Visitor>
void arrays(const std::vector<int>& alphabet, int maximum_length, Visitor visitor) {
    std::vector<int> a;
    std::function<void()> visit = [&] {
        visitor(a);
        if (static_cast<int>(a.size()) == maximum_length) return;
        for (int value : alphabet) { a.push_back(value); visit(); a.pop_back(); }
    };
    visit();
}
struct SumModel { i64 count = 0; int longest = 0, shortest = 0, shortest_ge = 0; };
SumModel sum_model(const std::vector<int>& a, i64 target) {
    SumModel out;
    for (int l = 0; l < static_cast<int>(a.size()); ++l) {
        i64 sum = 0;
        for (int r = l; r < static_cast<int>(a.size()); ++r) {
            sum += a[r];
            const int length = r - l + 1;
            if (sum == target) {
                ++out.count;
                out.longest = std::max(out.longest, length);
                if (!out.shortest || length < out.shortest) out.shortest = length;
            }
            if (sum >= target && (!out.shortest_ge || length < out.shortest_ge))
                out.shortest_ge = length;
        }
    }
    return out;
}
c::WindowStats distinct_model(const std::vector<int>& a, int k, bool exact = false) {
    c::WindowStats out{0, 0};
    for (int l = 0; l < static_cast<int>(a.size()); ++l) {
        std::set<int> seen;
        for (int r = l; r < static_cast<int>(a.size()); ++r) {
            seen.insert(a[r]);
            const int distinct = static_cast<int>(seen.size());
            if (exact ? distinct == k : distinct <= k) {
                ++out.count;
                out.longest = std::max(out.longest, r - l + 1);
            }
        }
    }
    return out;
}
void fixed_models(const std::vector<int>& a, int k) {
    std::vector<i64> sums;
    std::vector<int> distinct, minimum, maximum;
    std::optional<i64> best;
    if (k > 0 && k <= static_cast<int>(a.size())) {
        for (int l = 0; l + k <= static_cast<int>(a.size()); ++l) {
            i64 sum = 0;
            std::set<int> seen;
            int low = a[l], high = a[l];
            for (int i = l; i < l + k; ++i) {
                sum += a[i]; seen.insert(a[i]);
                low = std::min(low, a[i]); high = std::max(high, a[i]);
            }
            sums.push_back(sum); distinct.push_back(static_cast<int>(seen.size()));
            minimum.push_back(low); maximum.push_back(high);
            if (static_cast<int>(seen.size()) == k && (!best || sum > *best)) best = sum;
        }
    }
    check(c::fixed_window_sums(a, k) == sums, "fixed-sum");
    check(c::fixed_window_distinct(a, k) == distinct, "fixed-distinct");
    check(c::max_distinct_window_sum(a, k) == best, "fixed-frequency-and-sum");
    check(c::fixed_window_extreme(a, k, false) == minimum, "fixed-deque-min");
    check(c::fixed_window_extreme(a, k, true) == maximum, "fixed-deque-max");
}
void maximum_models(const std::vector<int>& a) {
    std::optional<i64> best;
    for (int l = 0; l < static_cast<int>(a.size()); ++l) {
        i64 sum = 0;
        for (int r = l; r < static_cast<int>(a.size()); ++r) {
            sum += a[r]; if (!best || sum > *best) best = sum;
        }
    }
    for (const auto got : {c::maximum_sum_prefix(a), c::maximum_sum_kadane(a)}) {
        check(got.has_value() == best.has_value(), "maximum-nonempty");
        if (!got) continue;
        check(got->left >= 0 && got->left < got->right &&
              got->right <= static_cast<int>(a.size()), "maximum-range");
        i64 actual = 0;
        for (int i = got->left; i < got->right; ++i) actual += a[i];
        check(actual == got->sum && got->sum == *best, "maximum-range");
    }
}
void signed_array(const std::vector<int>& a, const std::vector<i64>& targets) {
    context = a;
    const int n = static_cast<int>(a.size());
    const auto sum = c::prefix_sum(a);
    const auto xr = c::prefix_xor(a);
    check(sum.size() == a.size() + 1 && sum[0] == 0 &&
          xr.size() == a.size() + 1 && xr[0] == 0, "prefix-identity");
    for (int l = 0; l <= n; ++l) {
        i64 expected_sum = 0; unsigned expected_xor = 0;
        for (int r = l; r <= n; ++r) {
            check(c::interval_sum(sum, l, r) == expected_sum, "prefix-range");
            check(c::interval_xor(xr, l, r) == expected_xor, "prefix-range");
            if (r < n) { expected_sum += a[r]; expected_xor ^= static_cast<unsigned>(a[r]); }
        }
    }
    for (i64 target : targets) {
        const auto expected = sum_model(a, target);
        check(c::count_sum(a, target) == expected.count, "prefix-count");
        check(c::longest_sum(a, target) == expected.longest, "prefix-first-position");
        check(c::shortest_exact_sum(a, target) == expected.shortest, "prefix-last-position");
        check(c::shortest_signed_sum(a, target) == expected.shortest_ge, "signed-deque-shortest");
    }
    for (int modulus : {-2, 0, 1, 2, 3, 4, 7, 11}) {
        i64 expected = 0;
        for (int l = 0; l < n && modulus > 0; ++l) {
            i64 value = 0;
            for (int r = l; r < n; ++r) { value += a[r]; expected += value % modulus == 0; }
        }
        check(c::count_divisible_sum(a, modulus) == expected, "remainder-state");
    }
    int unique_longest = 0;
    for (int l = 0; l < n; ++l) {
        std::set<int> seen;
        for (int r = l; r < n; ++r) {
            if (!seen.insert(a[r]).second) break;
            unique_longest = std::max(unique_longest, r - l + 1);
        }
    }
    check(c::longest_distinct(a) == unique_longest, "longest-distinct");
    const std::vector<int> widths = n <= 6 ? std::vector<int>{-1, 0, 1, 2, 3, 4, 5, 6, 7}
                                          : std::vector<int>{-1, 0, 1, 2, n / 2, n, n + 1};
    for (int k : widths) {
        const auto expected = distinct_model(a, k);
        const auto got = c::at_most_distinct(a, k);
        check(got.count == expected.count && got.longest == expected.longest, "at-most-distinct");
        check(c::exactly_distinct(a, k) == distinct_model(a, k, true).count, "exactly-distinct");
        fixed_models(a, k);
    }
    maximum_models(a);
}
void nonnegative_array(const std::vector<int>& a) {
    context = a;
    for (i64 target : {-2LL, -1LL, 0LL, 1LL, 2LL, 3LL, 5LL, 8LL, 20LL}) {
        const auto expected = sum_model(a, target);
        i64 at_most = 0;
        for (int l = 0; l < static_cast<int>(a.size()); ++l) {
            i64 sum = 0;
            for (int r = l; r < static_cast<int>(a.size()); ++r) { sum += a[r]; at_most += sum <= target; }
        }
        check(c::count_sum_at_most(a, target) == at_most, "nonnegative-at-most");
        check(c::count_nonnegative_sum(a, target) == expected.count, "nonnegative-exact");
        check(c::shortest_nonnegative_sum(a, target) == expected.shortest_ge, "nonnegative-shortest");
    }
}
i64 product_model(const std::vector<int>& a, i64 k) {
    if (k <= 0) return 0;
    i64 answer = 0;
    for (int l = 0; l < static_cast<int>(a.size()); ++l) {
        u128 product = 1;
        for (int r = l; r < static_cast<int>(a.size()); ++r) {
            product *= static_cast<unsigned>(a[r]);
            answer += product < static_cast<u128>(k);
        }
    }
    return answer;
}
void product_array(const std::vector<int>& a) {
    context = a;
    for (i64 k : {std::numeric_limits<i64>::lowest(), -1LL, 0LL, 1LL, 2LL, 5LL,
                  10LL, 26LL, 100LL, 4611686014132420609LL, 4611686014132420610LL,
                  std::numeric_limits<i64>::max()})
        check(c::count_product_below(a, k) == product_model(a, k), "positive-product");
}
std::vector<std::string> strings(const std::string& alphabet, int maximum_length) {
    std::vector<std::string> out;
    std::string value;
    std::function<void()> visit = [&] {
        out.push_back(value);
        if (static_cast<int>(value.size()) == maximum_length) return;
        for (char ch : alphabet) { value.push_back(ch); visit(); value.pop_back(); }
    };
    visit(); return out;
}
std::vector<int> anagram_model(const std::string& s, std::string pattern) {
    if (pattern.empty() || pattern.size() > s.size()) return {};
    std::sort(pattern.begin(), pattern.end());
    std::vector<int> result;
    for (std::size_t start = 0; start + pattern.size() <= s.size(); ++start) {
        auto piece = s.substr(start, pattern.size());
        std::sort(piece.begin(), piece.end());
        if (piece == pattern) result.push_back(static_cast<int>(start));
    }
    return result;
}
std::string cover_model(const std::string& s, const std::string& pattern) {
    if (pattern.empty()) return {};
    std::map<unsigned char, int> need;
    for (unsigned char ch : pattern) ++need[ch];
    std::string best;
    for (std::size_t l = 0; l < s.size(); ++l) {
        std::map<unsigned char, int> have;
        for (std::size_t r = l; r < s.size(); ++r) {
            ++have[static_cast<unsigned char>(s[r])];
            bool covered = true;
            for (auto [ch, amount] : need) if (have[ch] < amount) { covered = false; break; }
            if (covered && (best.empty() || r - l + 1 < best.size())) best = s.substr(l, r - l + 1);
        }
    }
    return best;
}
int replacement_model(const std::string& s, int budget) {
    int answer = 0;
    for (int l = 0; l < static_cast<int>(s.size()); ++l) {
        std::array<int, 26> count{};
        for (int r = l; r < static_cast<int>(s.size()); ++r) {
            ++count[s[r] - 'A'];
            int largest = 0;
            for (int value : count) largest = std::max(largest, value);
            if (r - l + 1 - largest <= budget) answer = std::max(answer, r - l + 1);
        }
    }
    return answer;
}
int main() {
    std::vector<i64> small_targets;
    for (int x = -11; x <= 11; ++x) small_targets.push_back(x);
    arrays({-2, -1, 0, 1, 2}, 5, [&](const auto& a) { signed_array(a, small_targets); });
    arrays({0, 1, 2}, 7, nonnegative_array);
    arrays({0, 1}, 10, [&](const auto& a) {
        context = a;
        int longest = 0;
        for (int l = 0; l < static_cast<int>(a.size()); ++l) {
            int zeros = 0, ones = 0;
            for (int r = l; r < static_cast<int>(a.size()); ++r) {
                a[r] == 0 ? ++zeros : ++ones;
                if (zeros == ones) longest = std::max(longest, r - l + 1);
            }
        }
        check(c::longest_balanced_binary(a) == longest, "balanced-binary");
    });
    arrays({1, 2, 5}, 7, product_array);
    for (const auto& a : std::vector<std::vector<int>>{
         {2147483647, 2147483647, 2147483647, 2147483647},
         {2147483647, 1, 2147483647, 2}, {1, 2147483647, 1, 2147483647}}) product_array(a);
    const int low = std::numeric_limits<int>::min(), high = std::numeric_limits<int>::max();
    for (const auto& a : std::vector<std::vector<int>>{
         {low, high, 1, 0}, {high, high, high}, {low, low}, {-8, -2, -5},
         {2, 2, 3}, {3, 2, 2}, {1, -1, 1, -1}, {0, 0, 0}})
        signed_array(a, {-4294967296LL, -2147483648LL, -1LL, 0LL, 1LL, 2147483647LL, 4294967294LL});
    std::mt19937 random(20261027);
    for (int trial = 0; trial < 350; ++trial) {
        const int n = static_cast<int>(random() % 26);
        std::vector<int> a(n);
        for (int& x : a) x = static_cast<int>(random() % 31) - 15;
        signed_array(a, {-30, -1, 0, 1, 30});
    }
    const std::string bytes{'A', 'B', '\0', static_cast<char>(0xff)};
    const auto sources = strings(bytes, 5), patterns = strings(bytes, 3);
    context.clear();
    for (const auto& s : sources) for (const auto& pattern : patterns) {
        check(c::anagram_starts(s, pattern) == anagram_model(s, pattern), "byte-anagrams");
        check(c::minimum_cover(s, pattern) == cover_model(s, pattern), "byte-cover");
    }
    for (const auto& s : strings("ABC", 7))
        for (int budget = -1; budget <= static_cast<int>(s.size()) + 1; ++budget)
            check(c::longest_replacement(s, budget) == replacement_model(s, budget), "replacement-budget");
    for (const auto& s : {std::string("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
                          std::string("AZZZYZAAXYZXYZXYZ")})
        for (int budget = -1; budget <= static_cast<int>(s.size()) + 1; ++budget)
            check(c::longest_replacement(s, budget) == replacement_model(s, budget), "replacement-budget");
    const std::string backing("!A\0BA?", 6);
    const std::string_view bounded(backing.data() + 1, 4);
    const std::string_view needle(backing.data() + 1, 2);
    check(c::anagram_starts(bounded, needle) == anagram_model(std::string(bounded), std::string(needle)), "bounded-view");
    check(c::minimum_cover(bounded, needle) == cover_model(std::string(bounded), std::string(needle)), "bounded-view");
    const int n = 200000;
    const std::vector<int> zeros(n, 0);
    const i64 intervals = 1LL * n * (n + 1) / 2;
    check(c::count_sum(zeros, 0) == intervals, "large-smoke");
    check(c::count_nonnegative_sum(zeros, 0) == intervals, "large-smoke");
    check(c::at_most_distinct(zeros, 1).count == intervals, "large-smoke");
    check(c::shortest_signed_sum(zeros, 0) == 1, "large-smoke");
    check(c::fixed_window_extreme(zeros, 1000).size() == static_cast<std::size_t>(n - 999), "large-smoke");
    check(c::longest_replacement(std::string(n, 'A'), 0) == n, "large-smoke");
    unsigned long long total = 0;
    for (auto [group, count] : checks) { std::cout << group << ": " << count << '\n'; total += count; }
    std::cout << "contiguous ranges checks: " << total << "; seed=20261027\n";
}
