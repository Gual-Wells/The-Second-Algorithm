#include "../../content/binary-search/二分查找.cpp"
#include <cstdlib>
#include <functional>
#include <iostream>
#include <map>
#include <numeric>
#include <random>
#include <stdexcept>

using namespace std;
using namespace binary_foundations;
map<string, long long> checks;

void require(bool condition, const string& family) {
    ++checks[family];
    if (!condition) throw runtime_error("FAILED: " + family);
}

void sequences(int max_length, int alphabet, const function<void(const vector<int>&)>& visit) {
    vector<int> a;
    function<void()> dfs = [&] {
        visit(a);
        if ((int)a.size() == max_length) return;
        for (int x = 0; x < alphabet; ++x) {
            a.push_back(x); dfs(); a.pop_back();
        }
    };
    dfs();
}

int reference_lis(const vector<int>& a, bool non_decreasing) {
    vector<int> d(a.size(), 1);
    int best = 0;
    for (int i = 0; i < (int)a.size(); ++i) {
        for (int j = 0; j < i; ++j)
            if (non_decreasing ? a[j] <= a[i] : a[j] < a[i]) d[i] = max(d[i], d[j] + 1);
        best = max(best, d[i]);
    }
    return best;
}

void check_lis(const vector<int>& a) {
    for (bool non_decreasing : {false, true}) {
        int expected = reference_lis(a, non_decreasing);
        require(lis_length(a, non_decreasing) == expected, "lis-length-vs-quadratic-dp");
        auto result = lis_indices(a, non_decreasing);
        require((int)result.size() == expected, "lis-recovery-length");
        for (int i = 0; i < (int)result.size(); ++i) {
            require(0 <= result[i] && result[i] < (int)a.size(), "lis-recovery-index");
            if (i) {
                require(result[i - 1] < result[i], "lis-recovery-order");
                require(non_decreasing ? a[result[i - 1]] <= a[result[i]]
                                       : a[result[i - 1]] < a[result[i]], "lis-recovery-value");
            }
        }
    }
}

void check_peak(const vector<vector<int>>& a) {
    auto [r, c] = peak2d(a);
    int rows = (int)a.size(), cols = (int)a[0].size();
    require(0 <= r && r < rows && 0 <= c && c < cols, "peak2d-in-range");
    for (auto [dr, dc] : vector<pair<int,int>>{{-1,0},{1,0},{0,-1},{0,1}}) {
        int nr = r + dr, nc = c + dc;
        if (0 <= nr && nr < rows && 0 <= nc && nc < cols)
            require(a[r][c] >= a[nr][nc], "peak2d-neighbor-oracle");
    }
}

int main() {
    // All distinct subsets of a signed universe; reference is a linear first-match scan.
    for (int mask = 0; mask < (1 << 12); ++mask) {
        vector<int> a;
        for (int b = 0; b < 12; ++b) if (mask >> b & 1) a.push_back(b - 3);
        int expected = -1;
        for (int i = 0; i < (int)a.size(); ++i) if (a[i] == i) { expected = i; break; }
        require(fixed_point_distinct(a) == expected, "fixed-point-vs-linear");
    }
    require(fixed_point_distinct({INT_MIN, 1, INT_MAX}) == 1, "fixed-point-extreme-values");

    vector<string> vocabulary{"", "a", "aa", "ab", "b", "ba", "bb"};
    vector<string> queries = vocabulary;
    queries.insert(queries.end(), {"aaa", "ac", "c", string(1, '\0'), string(1, (char)255)});
    vector<string> words;
    function<void(int)> word_lists = [&](int from) {
        for (const auto& p : queries) {
            auto [first, last] = prefix_range(words, p);
            int expected_first = 0;
            while (expected_first < (int)words.size() &&
                   words[expected_first].compare(0, p.size(), p) < 0) ++expected_first;
            int expected_last = expected_first;
            while (expected_last < (int)words.size() &&
                   words[expected_last].compare(0, p.size(), p) == 0) ++expected_last;
            require(first == expected_first && last == expected_last, "prefix-range-vs-linear");
        }
        if (words.size() == 5) return;
        for (int i = from; i < (int)vocabulary.size(); ++i) {
            words.push_back(vocabulary[i]); word_lists(i); words.pop_back();
        }
    };
    word_lists(0);
    vector<string> byte_words{string("a\0b",3), string("a\0",2), string("a\xff",2), "a", ""};
    sort(byte_words.begin(), byte_words.end());
    require(prefix_range(byte_words, string("a\0",2)) == make_pair(2,4), "prefix-embedded-zero");
    require(prefix_range(byte_words, string("a\xff",2)) == make_pair(4,5), "prefix-maximum-byte");

    vector<int> citations;
    function<void(int)> h_lists = [&](int from) {
        int expected = 0;
        for (int h = 0; h <= (int)citations.size(); ++h) {
            int enough = 0;
            for (int v : citations) enough += v >= h;
            if (enough >= h) expected = h;
        }
        require(h_index_sorted(citations) == expected, "h-index-vs-definition");
        if (citations.size() == 8) return;
        for (int x = from; x <= 8; ++x) {
            citations.push_back(x); h_lists(x); citations.pop_back();
        }
    };
    h_lists(0);

    sequences(6, 4, [&](const vector<int>& a) {
        auto sum = prefix_sums(a);
        int total = accumulate(a.begin(), a.end(), 0);
        auto cost_sum = sorted_cost_prefix(a);
        for (int target = 0; target <= total + 1; ++target) {
            int prefix = -1, running = 0;
            for (int k = 0; k <= (int)a.size(); ++k) {
                if (running >= target) { prefix = k; break; }
                if (k < (int)a.size()) running += a[k];
            }
            require(first_prefix_at_least(sum, target) == prefix, "prefix-position-vs-linear");
            int affordable = 0;
            for (int mask = 0; mask < (1 << a.size()); ++mask) {
                int cost = 0, count = 0;
                for (int i = 0; i < (int)a.size(); ++i) if (mask >> i & 1) { cost += a[i]; ++count; }
                if (cost <= target) affordable = max(affordable, count);
            }
            require(max_items_with_budget(cost_sum, target) == affordable, "budget-vs-all-subsets");
            if (target == 0) continue;
            int shortest = (int)a.size() + 1;
            for (int l = 0; l < (int)a.size(); ++l) {
                int value = 0;
                for (int r = l; r < (int)a.size(); ++r) {
                    value += a[r];
                    if (value >= target) shortest = min(shortest, r - l + 1);
                }
            }
            if (shortest == (int)a.size() + 1) shortest = 0;
            require(min_nonnegative_subarray_len(a, target) == shortest, "subarray-vs-all-intervals");
        }
    });
    auto wide_sum = prefix_sums({INT_MAX, INT_MAX, 0});
    require(wide_sum.back() == 2LL * INT_MAX && first_prefix_at_least(wide_sum, 2LL*INT_MAX) == 2,
            "prefix-64-bit-accumulation");

    sequences(8, 4, [&](const vector<int>& a) {
        vector<int> shifted = a;
        for (int& x : shifted) x -= 2;
        check_lis(shifted);
    });
    check_lis({INT_MIN, INT_MIN, 0, INT_MAX, INT_MAX});
    check_lis({2, 6, 3, 4, 1, 5});

    for (int rows = 1; rows <= 3; ++rows) for (int cols = 1; cols <= 3; ++cols) {
        int total = 1;
        for (int i = 0; i < rows * cols; ++i) total *= 3;
        for (int state = 0; state < total; ++state) {
            int x = state;
            vector<vector<int>> a(rows, vector<int>(cols));
            for (auto& row : a) for (int& v : row) { v = x % 3 - 1; x /= 3; }
            check_peak(a);
        }
    }
    check_peak({{INT_MIN, INT_MAX}, {INT_MAX, INT_MIN}});

    vector<string> query_strings;
    sequences(4, 3, [&](const vector<int>& v) {
        string s; for (int x : v) s += "abA"[x]; query_strings.push_back(s);
    });
    sequences(6, 3, [&](const vector<int>& v) {
        string source; for (int x : v) source += "abA"[x];
        auto pos = build_positions(source);
        for (const string& query : query_strings) {
            vector<int> expected;
            int next = 0;
            for (char c : query) {
                while (next < (int)source.size() && source[next] != c) ++next;
                if (next == (int)source.size()) break;
                expected.push_back(next++);
            }
            auto result = subsequence_positions(pos, query);
            if (expected.size() == query.size())
                require(result && *result == expected, "subsequence-vs-linear-scan");
            else require(!result, "subsequence-vs-linear-scan");
        }
    });
    string bytes("\xff\0\xff", 3);
    auto bytes_result = subsequence_positions(build_positions(bytes), string("\0\xff",2));
    require(bytes_result && *bytes_result == vector<int>({1,2}), "subsequence-byte-alphabet");

    vector<int> sorted;
    function<void(int)> unknown_lists = [&](int from) {
        for (int cap = 0; cap <= (int)sorted.size() + 2; ++cap) for (int target = -1; target <= 6; ++target) {
            long long calls = 0;
            auto read = [&](ll index) -> optional<ll> {
                ++calls;
                if (index < 0 || index > cap) throw runtime_error("reader escaped cap");
                if (index >= (ll)sorted.size()) return nullopt;
                return sorted[(size_t)index];
            };
            optional<ll> lower, exact;
            for (int i = 0; i < (int)sorted.size() && i <= cap; ++i) {
                if (!lower && sorted[i] >= target) lower = i;
                if (!exact && sorted[i] == target) exact = i;
            }
            require(unknown_lower_index(read, target, cap) == lower, "unknown-lower-vs-linear");
            require(search_unknown(read, target, cap) == exact, "unknown-exact-vs-linear");
            require(calls <= 32, "unknown-reader-call-budget-small");
        }
        if (sorted.size() == 6) return;
        for (int x = from; x <= 4; ++x) { sorted.push_back(x); unknown_lists(x); sorted.pop_back(); }
    };
    unknown_lists(0);
    ll calls = 0;
    auto huge_reader = [&](ll i) -> optional<ll> { ++calls; return i; };
    require(search_unknown(huge_reader, LLONG_MAX) == optional<ll>(LLONG_MAX), "unknown-llong-max-index");
    require(calls <= 140, "unknown-reader-logarithmic-call-budget");

    mt19937 rng(20261026);
    for (int t = 0; t < 3000; ++t) {
        vector<int> a(rng() % 50);
        for (int& x : a) x = (int)(rng() % 31) - 15;
        check_lis(a);
        vector<vector<int>> matrix(1 + rng() % 25, vector<int>(1 + rng() % 25));
        for (auto& row : matrix) for (int& x : row) x = (int)(rng() % 21) - 10;
        check_peak(matrix);
    }
    long long total = 0;
    for (const auto& [name, n] : checks) { cout << name << ": " << n << '\n'; total += n; }
    cout << "TOTAL ASSERTIONS: " << total << '\n';
}
