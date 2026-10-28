#include "../../content/binary/boundary.cpp"
#include <cassert>
#include <iostream>
#include <random>
#include <array>

using namespace binary_boundary;
static std::uint64_t checks = 0;
static void require(bool ok) { ++checks; if (!ok) throw std::runtime_error("boundary property failed"); }

static void ordered_and_rotation(const std::vector<int>& a) {
    for (int key = -4; key <= 6; ++key) {
        std::size_t lower = 0, upper = 0;
        while (lower < a.size() && a[lower] < key) ++lower;
        while (upper < a.size() && a[upper] <= key) ++upper;
        require(lower_manual(a, key) == lower);
        require(upper_manual(a, key) == upper);
        require(equal_manual(a, key) == std::make_pair(lower, upper));
        require(equal_standard(a, key) == std::make_pair(lower, upper));
        auto pred = predecessor_manual(a, key);
        require(pred == (upper ? std::optional<int>{a[upper - 1]} : std::nullopt));
    }
    if (a.empty()) {
        require(!rotated_min_manual(a)); require(!rotated_min_standard(a));
        require(!rotated_member_manual(a, 0)); require(!rotated_member_standard(a, 0));
    }
    for (std::size_t shift = 0; shift < a.size(); ++shift) {
        auto rotated = a;
        std::rotate(rotated.begin(), rotated.begin() + shift, rotated.end());
        require(rotated_min_manual(rotated) == std::optional<int>{a.front()});
        require(rotated_min_standard(rotated) == std::optional<int>{a.front()});
        for (int key = -4; key <= 6; ++key) {
            bool expected = false;
            for (int x : a) if (x == key) expected = true;
            require(rotated_member_manual(rotated, key) == expected);
            require(rotated_member_standard(rotated, key) == expected);
        }
    }
}
static void sorted_enumeration(std::vector<int>& a, int remaining, int minimum) {
    ordered_and_rotation(a);
    const auto fixed = fixed_duplicates(a);
    bool exists = false;
    for (std::size_t i = 0; i < a.size(); ++i) if (a[i] == static_cast<int>(i)) exists = true;
    require(bool(fixed) == exists);
    if (fixed) require(a[*fixed] == static_cast<int>(*fixed));
    for (int x = minimum; x <= 4 && remaining > 0; ++x) {
        a.push_back(x); sorted_enumeration(a, remaining - 1, x); a.pop_back();
    }
}
static void access_and_transforms() {
    for (std::uint64_t n = 0; n <= 100; ++n)
        for (std::uint64_t boundary = 0; boundary <= n; ++boundary) {
            unsigned calls = 0;
            require(first_true_manual(n, [&](std::uint64_t i) {
                require(i < n); ++calls; return i >= boundary;
            }) == boundary);
            require(calls <= 7);
        }
    for (std::uint64_t cap = 0; cap <= 100; ++cap)
        for (std::uint64_t boundary = 0; boundary <= cap + 1; ++boundary) {
            auto actual = first_true_unknown(cap, [&](std::uint64_t i) {
                require(i <= cap); return i >= boundary;
            });
            require(actual == (boundary <= cap ? std::optional<std::uint64_t>{boundary} : std::nullopt));
        }
    const auto maximum = std::numeric_limits<std::uint64_t>::max();
    require(first_true_manual(maximum, [](std::uint64_t) { return false; }) == maximum);
    require(first_true_manual(maximum, [=](std::uint64_t i) { return i >= maximum - 1; }) == maximum - 1);
    for (auto first : {std::uint64_t{0}, std::uint64_t{1}, maximum / 2, maximum - 1, maximum}) {
        unsigned calls = 0;
        require(first_true_unknown(maximum, [&](std::uint64_t x) { ++calls; return x >= first; }) == first);
        require(calls <= 131);
    }
    require(!first_true_unknown(maximum, [](std::uint64_t) { return false; }));
    bool propagated = false;
    try { first_true_unknown(10, [](std::uint64_t) -> bool { throw std::runtime_error("I/O"); }); }
    catch (const std::runtime_error&) { propagated = true; }
    require(propagated);
    for (const auto& data : std::vector<std::vector<int>>{{}, {1}, {1, 1, 2, 4, 4, 9}})
        for (int key = -1; key <= 11; ++key) {
            std::optional<std::uint64_t> expected;
            for (std::size_t i = 0; i < data.size(); ++i) if (data[i] == key) { expected = i; break; }
            require(find_unknown_at(data, key, 1000) == expected);
        }
    require(!find_unknown_at({1, 2, 3, 4}, 4, 2)); // cap是查询预算而非长度推测。
    for (unsigned mask = 0; mask < (1u << 9); ++mask) {
        std::vector<int> a;
        for (int bit = 0; bit < 9; ++bit) if (mask & (1u << bit)) a.push_back(bit - 4);
        bool exists = false;
        for (std::size_t i = 0; i < a.size(); ++i) if (a[i] == static_cast<int>(i)) exists = true;
        const auto actual = fixed_distinct(a);
        require(bool(actual) == exists);
        if (actual) require(a[*actual] == static_cast<int>(*actual));
        a.clear();
        for (int bit = 0; bit < 9; ++bit) if (mask & (1u << bit)) a.push_back(bit + 1);
        for (int k = 1; k <= 12; ++k) {
            int missing = 0, value = 0;
            while (missing < k) {
                ++value; bool present = false;
                for (int x : a) if (x == value) present = true;
                if (!present) ++missing;
            }
            require(kth_missing_manual(a, k) == value);
            require(kth_missing_precomputed(a, k) == value);
        }
    }
    require(fixed_duplicates({0, 0, 0, 0, 0}) == std::optional<std::size_t>{0});
    require(kth_missing_manual({std::numeric_limits<int>::max()}, 3000000000LL) == 3000000001LL);
    require(kth_missing_precomputed({std::numeric_limits<int>::max()}, 3000000000LL) == 3000000001LL);
    const std::vector<TimedValue> history{{1, "a"}, {5, "b"}, {8, "c"}};
    for (int query = -2; query <= 10; ++query) {
        std::optional<std::string> value;
        for (const auto& entry : history) if (entry.time <= query) value = entry.value;
        require(time_manual(history, query) == value); require(time_standard(history, query) == value);
    }
    require(!time_manual({}, 0)); require(!time_standard({}, 0));
}
static bool peak_ok(const std::vector<int>& a, std::size_t i) {
    return i < a.size() && (i == 0 || a[i] > a[i - 1]) && (i + 1 == a.size() || a[i] > a[i + 1]);
}
static void peak_enumeration(std::vector<int>& a, int remaining) {
    if (!a.empty()) {
        require(peak_ok(a, *peak_manual(a))); require(peak_ok(a, *peak_standard(a)));
    }
    for (int x = 0; x < 3 && remaining > 0; ++x) if (a.empty() || a.back() != x) {
        a.push_back(x); peak_enumeration(a, remaining - 1); a.pop_back();
    }
}
static void pairs_and_peaks() {
    for (unsigned mask = 1; mask < 64; ++mask) {
        for (int single = 0; single < 6; ++single) if (mask & (1u << single)) {
            std::vector<int> a;
            for (int v = 0; v < 6; ++v) if (mask & (1u << v)) {
                a.push_back(v - 3); if (v != single) a.push_back(v - 3);
            }
            require(paired_unique_manual(a) == single - 3);
            require(paired_unique_xor_index(a) == single - 3);
            require(paired_unique_standard(a) == single - 3);
        }
    }
    require(!peak_manual({})); require(!peak_standard({}));
    std::vector<int> a; peak_enumeration(a, 9);
    require(peak_ok({1, 4, 2, 5, 3, 7, 0}, *peak_manual({1, 4, 2, 5, 3, 7, 0})));
    // 弱单峰平台的全局最大只调用线性标准基线，不向严格峰算法喂错合同。
    require(peak_standard({1, 1, 1, 2, 1}) == std::optional<std::size_t>{3});
}
static bool matrix_peak_ok(const std::vector<std::vector<int>>& a, std::pair<std::size_t,std::size_t> p) {
    const auto r = p.first, c = p.second;
    if (r >= a.size() || c >= a.front().size()) return false;
    const auto v = a[r][c];
    return (r == 0 || v > a[r - 1][c]) && (r + 1 == a.size() || v > a[r + 1][c]) &&
           (c == 0 || v > a[r][c - 1]) && (c + 1 == a.front().size() || v > a[r][c + 1]);
}
static void matrices() {
    require(!matrix_peak_manual({})); require(!matrix_peak_standard({}));
    require(!matrix_peak_manual({{}, {}})); require(!matrix_peak_standard({{}, {}}));
    require(!matrix_flat_manual({}, 0)); require(!matrix_staircase({{}}, 0));
    require(!matrix_row_standard({{}, {}, {}}, 0));
    for (std::size_t rows = 1; rows <= 3; ++rows) for (std::size_t cols = 1; cols <= 3; ++cols) {
        std::size_t total = 1;
        for (std::size_t i = 0; i < rows * cols; ++i) total *= 3;
        for (std::size_t code = 0; code < total; ++code) {
            std::vector<std::vector<int>> a(rows, std::vector<int>(cols));
            auto value = code; bool valid = true;
            for (std::size_t r = 0; r < rows; ++r) for (std::size_t c = 0; c < cols; ++c) {
                a[r][c] = static_cast<int>(value % 3) + 1; value /= 3;
                if ((r && a[r][c] == a[r - 1][c]) || (c && a[r][c] == a[r][c - 1])) valid = false;
            }
            if (valid) {
                require(matrix_peak_ok(a, *matrix_peak_manual(a)));
                require(matrix_peak_ok(a, *matrix_peak_standard(a)));
            }
        }
        for (int base = -3; base <= 3; ++base) {
            std::vector<std::vector<int>> a(rows, std::vector<int>(cols));
            for (std::size_t i = 0; i < rows * cols; ++i) a[i / cols][i % cols] = base + static_cast<int>(i / 2);
            for (int key = -5; key < 12; ++key) {
                bool expected = false;
                for (const auto& row : a) for (int x : row) if (x == key) expected = true;
                require(matrix_flat_manual(a, key) == expected);
                require(matrix_staircase(a, key) == expected);
                require(matrix_row_standard(a, key) == expected);
            }
        }
    }
    const std::vector<std::vector<int>> weak{{1, 4, 7}, {2, 5, 8}, {3, 6, 9}};
    require(weak[0].back() > weak[1].front()); // 展平合同不成立，绝不调用flat版。
    for (int key = 0; key <= 10; ++key) {
        require(matrix_staircase(weak, key) == (key >= 1 && key <= 9));
        require(matrix_row_standard(weak, key) == (key >= 1 && key <= 9));
    }
    require(matrix_row_standard({{}, {1, 2}, {4}}, 4)); // 行版允许不等长。
}
static void roots() {
    std::uint64_t truth = 0;
    for (std::uint64_t x = 0; x <= 200000; ++x) {
        while ((truth + 1) * (truth + 1) <= x) ++truth;
        require(isqrt_manual(x) == truth); require(isqrt_estimate_standard(x) == truth);
    }
    std::mt19937_64 rng(20261028);
    const auto maximum = std::numeric_limits<std::uint64_t>::max();
    for (int i = 0; i < 10000; ++i) {
        const auto x = i == 0 ? maximum : rng();
        for (auto answer : {isqrt_manual(x), isqrt_estimate_standard(x)}) {
            require(answer > 0 && answer <= x / answer);
            require(answer + 1 > x / (answer + 1));
        }
        const auto r = static_cast<std::uint64_t>(static_cast<std::uint32_t>(rng()));
        const auto square = r * r;
        require(isqrt_manual(square) == r); require(isqrt_estimate_standard(square) == r);
        if (r) { require(isqrt_manual(square - 1) == r - 1); require(isqrt_estimate_standard(square - 1) == r - 1); }
        if (r) { require(isqrt_manual(square + 1) == r); require(isqrt_estimate_standard(square + 1) == r); }
    }
    require(isqrt_manual(maximum) == 4294967295ULL);
    auto nonmonotone = bisect_root([](double x) { return x*x*x-x; }, -2.0, 2.0);
    require(nonmonotone && nonmonotone->lo <= 0 && nonmonotone->hi >= 0);
    require(!bisect_root([](double x) { return x*x; }, -1.0, 1.0)); // 偶重根存在却无异号证书。
    auto initial = bisect_root([](double x) { return x-0.3; }, 0.0, 1.0, 1e-30, 0);
    require(initial && initial->lo == 0 && initial->hi == 1);
    const double lo = 1, hi = std::nextafter(1.0, 2.0);
    const long double between = (static_cast<long double>(lo) + hi) / 2;
    auto adjacent = bisect_root([&](double x) { return static_cast<double>(static_cast<long double>(x) - between); }, lo, hi, 1e-300);
    require(adjacent && adjacent->lo == lo && adjacent->hi == hi);
    bool threw = false;
    try { bisect_root([](double) { return std::numeric_limits<double>::infinity(); }, 0.0, 1.0); }
    catch (const std::domain_error&) { threw = true; }
    require(threw);
    threw = false;
    try { bisect_root([](double x) { return x; }, -1.0, 1.0, 0.0); }
    catch (const std::invalid_argument&) { threw = true; }
    require(threw);
    for (int a = -5; a <= 3; ++a) for (int b = a+1; b <= 4; ++b) for (int c = b+1; c <= 5; ++c) {
        const auto found = cubic_roots_by_critical_points(1, -(a+b+c), a*b+a*c+b*c, -a*b*c);
        require(found.size() == 3);
        require(std::abs(found[0]-a) < 1e-7 && std::abs(found[1]-b) < 1e-7 && std::abs(found[2]-c) < 1e-7);
    }
    const auto endpoints = cubic_roots_by_critical_points(1, 0, -10000, 0);
    require(endpoints.size() == 3);
    require(std::abs(endpoints[0]+100) < 1e-7 && std::abs(endpoints[1]) < 1e-7 && std::abs(endpoints[2]-100) < 1e-7);
    const auto halves = cubic_roots_by_critical_points(1, -3.5, -12.25, 6.875); // -2.5,0.5,5.5
    require(halves.size() == 3);
    require(std::abs(halves[0]+2.5) < 1e-7 && std::abs(halves[1]-0.5) < 1e-7 && std::abs(halves[2]-5.5) < 1e-7);
    for (const auto& coef : std::vector<std::array<long double,4>>{
        {0.1, -0.6, 1.1, -0.6}, {0.3, -1.8, 3.3, -1.8}, {0.7, -4.2, 7.7, -4.2},
        {0.1L, -0.6L, 1.1L, -0.6L}, {0.3L, -1.8L, 3.3L, -1.8L}, {0.7L, -4.2L, 7.7L, -4.2L}}) {
        const auto answer=cubic_roots_by_critical_points(coef[0],coef[1],coef[2],coef[3]);
        require(answer.size()==3);
        for(int j=0;j<3;++j) require(std::abs(answer[j]-(j+1))<1e-7);
    }
    // 根恰落原边界、恰距1，小数系数及整体极大/极小缩放均不能漏根。
    for (long double scale : {0.1L,0.3L,0.7L,-0.1L,1e-200L,-1e200L})
        for (const auto& truth : std::vector<std::array<long double,3>>{
            {-100,-99,-98}, {98,99,100}, {-100,0,100}, {-1.25L,0.25L,1.25L}}) {
            const auto x=truth[0],y=truth[1],z=truth[2];
            const auto answer=cubic_roots_by_critical_points(scale,-scale*(x+y+z),scale*(x*y+x*z+y*z),-scale*x*y*z);
            require(answer.size()==3);
            for(int j=0;j<3;++j)require(std::abs(static_cast<long double>(answer[j])-truth[j])<1e-6L);
        }
    for(int sample=0;sample<1000;++sample) {
        std::array<long double,3> truth;
        do {
            for(auto& x:truth)x=static_cast<int>(rng()%801)/4.0L-100;
            std::sort(truth.begin(),truth.end());
        } while(truth[1]-truth[0]<1 || truth[2]-truth[1]<1);
        const long double scale=sample%3==0?0.1L:sample%3==1?-0.3L:0.7L;
        const auto x=truth[0],y=truth[1],z=truth[2];
        const auto answer=cubic_roots_by_critical_points(scale,-scale*(x+y+z),scale*(x*y+x*z+y*z),-scale*x*y*z);
        require(answer.size()==3);
        for(int j=0;j<3;++j)require(std::abs(static_cast<long double>(answer[j])-truth[j])<1e-6L);
    }
}
static bool begins(std::string_view value, std::string_view prefix) {
    if (value.size() < prefix.size()) return false;
    for (std::size_t i = 0; i < prefix.size(); ++i) if (value[i] != prefix[i]) return false;
    return true;
}
static void strings() {
    const std::vector<std::string> universe{"", "a", "aa", "ab", "aba", "b", "ba", "bb"};
    for (unsigned mask = 0; mask < (1u << universe.size()); ++mask) {
        std::vector<std::string> words;
        for (std::size_t i = 0; i < universe.size(); ++i) if (mask & (1u << i)) words.push_back(universe[i]);
        for (const auto& prefix : std::vector<std::string>{"", "a", "aa", "ab", "aba", "abcd", "b", "c"}) {
            std::vector<std::string> truth;
            for (const auto& word : words) if (begins(word,prefix)) truth.push_back(word);
            for (auto range : {prefix_range_manual(words,prefix), prefix_range_standard(words,prefix)}) {
                require(range.first <= range.second && range.second <= words.size());
                require(std::vector<std::string>(words.begin()+range.first, words.begin()+range.second) == truth);
            }
        }
        auto unsorted = words; std::reverse(unsorted.begin(), unsorted.end());
        const auto suggestions = suggestions_standard(unsorted,"abacus");
        for (std::size_t i = 0; i < 6; ++i) {
            std::vector<std::string> truth;
            for (const auto& word : words) if (begins(word,std::string_view("abacus").substr(0,i+1)) && truth.size()<3) truth.push_back(word);
            require(suggestions[i] == truth);
        }
    }
    std::vector<std::string> all{""};
    for (int length = 1; length <= 6; ++length) for (unsigned mask = 0; mask < (1u << length); ++mask) {
        std::string word;
        for (int i = 0; i < length; ++i) word += (mask & (1u << i)) ? 'a' : 'b';
        all.push_back(word);
    }
    for (const auto& a : all) for (const auto& b : all) {
        std::size_t truth = 0;
        while (truth < a.size() && truth < b.size() && a[truth] == b[truth]) ++truth;
        require(lcp_binary(a,b) == truth); require(lcp_standard(a,b) == truth);
    }
}
static Location convex_oracle(const std::vector<Point>& p, Point q) {
    bool boundary = false;
    // 独立线性半平面oracle，用long double而非生产cross；小网格运算精确。
    for (std::size_t i = 0; i < p.size(); ++i) {
        const auto a = p[i], b = p[(i+1)%p.size()];
        const long double area = (static_cast<long double>(b.x)-a.x)*(static_cast<long double>(q.y)-a.y)
            -(static_cast<long double>(b.y)-a.y)*(static_cast<long double>(q.x)-a.x);
        if (area < 0) return Location::outside;
        if (area == 0) boundary = true;
    }
    return boundary ? Location::boundary : Location::inside;
}
static void convex() {
    for (const auto& p : std::vector<std::vector<Point>>{
        {{0,0},{6,0},{6,6},{0,6}}, {{0,0},{6,0},{8,3},{4,7},{0,4}},
        {{0,-6},{6,0},{0,6},{-6,0}}, {{-3,-2},{4,-1},{2,5}}}) {
        for (int x=-10;x<=10;++x) for (int y=-10;y<=10;++y) {
            Point q{x,y};const auto truth=convex_oracle(p,q);
            require(convex_manual(p,q)==truth);require(convex_standard(p,q)==truth);
        }
    }
    const std::vector<Point> big{{-1000000000,-1000000000},{1000000000,-1000000000},{-1000000000,1000000000}};
    for (Point q : std::vector<Point>{{0,0},{1000000000,1000000000},{-1000000000,-1000000000},{-999999999,-999999999}}) {
        require(convex_manual(big,q)==convex_oracle(big,q));
        require(convex_standard(big,q)==convex_oracle(big,q));
    }
    require(cross({-1000000000,-1000000000},{1000000000,-1000000000},{-1000000000,1000000000})==4000000000000000000LL);
    require(!on_segment({0,0},{2,0},{3,0})); require(on_segment({0,0},{2,0},{1,0}));
    bool threw=false;try{convex_manual({}, {0,0});}catch(const std::invalid_argument&){threw=true;}require(threw);
}
int main() {
    try {
        std::vector<int> a; sorted_enumeration(a, 7, -3);
        access_and_transforms(); pairs_and_peaks(); matrices(); roots(); strings(); convex();
        std::cout << "chapter01_boundary " << checks << " checks passed\n";
    } catch(const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
