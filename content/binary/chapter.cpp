#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <iterator>
#include <limits>
#include <numeric>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace binary_boundary {

// BEGIN boundary-ordered-manual
std::size_t lower_manual(const std::vector<int>& a, int key) {
    std::size_t lo = 0, hi = a.size();
    // [0,lo) < key；[hi,n) >= key，尚未分类的只有 [lo,hi)。
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (a[mid] < key) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
std::size_t upper_manual(const std::vector<int>& a, int key) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (a[mid] <= key) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
std::pair<std::size_t, std::size_t>
equal_manual(const std::vector<int>& a, int key) {
    return {lower_manual(a, key), upper_manual(a, key)};
}
std::optional<int> predecessor_manual(const std::vector<int>& a, int key) {
    const auto end = upper_manual(a, key);
    if (end == 0) return std::nullopt;
    return a[end - 1];
}
// END boundary-ordered-manual

// BEGIN boundary-time-manual
struct TimedValue { int time; std::string value; };
// 同一key的记录已按time严格递增；查最后一个time<=query。
std::optional<std::string> time_manual(const std::vector<TimedValue>& a, int query) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (a[mid].time <= query) lo = mid + 1;
        else hi = mid;
    }
    if (lo == 0) return std::nullopt;
    return a[lo - 1].value;
}
// END boundary-time-manual

// BEGIN boundary-ordered-standard
std::pair<std::size_t, std::size_t>
equal_standard(const std::vector<int>& a, int key) {
    const auto range = std::equal_range(a.begin(), a.end(), key);
    return {static_cast<std::size_t>(range.first - a.begin()),
            static_cast<std::size_t>(range.second - a.begin())};
}
// END boundary-ordered-standard

// BEGIN boundary-time-standard
std::optional<std::string> time_standard(const std::vector<TimedValue>& a, int query) {
    // upper_bound比较方向是comp(value, element)，不同于lower_bound。
    auto it = std::upper_bound(a.begin(), a.end(), query,
        [](int time, const TimedValue& entry) { return time < entry.time; });
    if (it == a.begin()) return std::nullopt;
    return std::prev(it)->value;
}
// END boundary-time-standard

// BEGIN boundary-access-manual
template<class Predicate>
std::uint64_t first_true_manual(std::uint64_t n, Predicate yes) {
    // 搜索[0,n)，返回n表示全假；n本身不调用yes。
    std::uint64_t lo = 0, hi = n;
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (yes(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
template<class Predicate>
std::optional<std::uint64_t>
first_true_unknown(std::uint64_t cap, Predicate yes) {
    // cap是允许查询的最大下标，不保证其中一定有真值。
    if (yes(0)) return 0;
    if (cap == 0) return std::nullopt;
    std::uint64_t lo = 0, hi = 1;
    while (!yes(hi)) {
        if (hi == cap) return std::nullopt;
        lo = hi;
        hi = hi > cap - hi ? cap : hi + hi; // 饱和扩张，避免翻倍溢出。
    }
    // 此时lo假、hi真；不重复探测已知端点。
    while (hi - lo > 1) {
        const auto mid = lo + (hi - lo) / 2;
        if (yes(mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}
// END boundary-access-manual

// BEGIN boundary-access-standard
std::optional<std::uint64_t>
find_unknown_at(const std::vector<int>& hidden, int key, std::uint64_t cap) {
    // 演示题定访问器：长度不向算法公开，只有at越界才表示域结束。
    auto read = [&](std::uint64_t i) -> std::optional<int> {
        if (i > std::numeric_limits<std::size_t>::max()) return std::nullopt;
        try { return hidden.at(static_cast<std::size_t>(i)); }
        catch (const std::out_of_range&) { return std::nullopt; }
    };
    auto pos = first_true_unknown(cap, [&](std::uint64_t i) {
        const auto value = read(i);
        return !value || *value >= key; // 域结束在此合同中等价于+∞。
    });
    if (!pos) return std::nullopt;
    const auto value = read(*pos);
    if (!value || *value != key) return std::nullopt;
    return pos;
}
// END boundary-access-standard

// BEGIN boundary-transformed-manual
std::optional<std::size_t> fixed_distinct(const std::vector<int>& a) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        // 数学差A[m]-m非降；直接比较避免先做可能溢出的int减法。
        if (static_cast<std::int64_t>(a[m]) < static_cast<std::int64_t>(m)) lo = m + 1;
        else hi = m;
    }
    if (lo < a.size() && static_cast<std::int64_t>(a[lo]) == static_cast<std::int64_t>(lo)) return lo;
    return std::nullopt;
}
// END boundary-transformed-manual

// BEGIN boundary-fixed-duplicates
std::optional<std::size_t>
fixed_duplicate_range(const std::vector<int>& a, std::ptrdiff_t lo, std::ptrdiff_t hi) {
    if (lo > hi) return std::nullopt;
    const auto m = lo + (hi - lo) / 2;
    const auto value = static_cast<std::ptrdiff_t>(a[static_cast<std::size_t>(m)]);
    if (value == m) return static_cast<std::size_t>(m);
    // 重复破坏单调，但排序仍证明这两块之外不可能有固定点。
    if (auto left = fixed_duplicate_range(a, lo, std::min(m - 1, value))) return left;
    return fixed_duplicate_range(a, std::max(m + 1, value), hi);
}
std::optional<std::size_t> fixed_duplicates(const std::vector<int>& a) {
    return fixed_duplicate_range(a, 0, static_cast<std::ptrdiff_t>(a.size()) - 1);
}
// END boundary-fixed-duplicates

// BEGIN boundary-missing-manual
std::int64_t kth_missing_manual(const std::vector<int>& a, std::int64_t k) {
    // a严格递增、正整数；k>0，且n+k可用int64表示。
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        const auto missing = static_cast<std::int64_t>(a[m]) - static_cast<std::int64_t>(m) - 1;
        if (missing < k) lo = m + 1;
        else hi = m;
    }
    return k + static_cast<std::int64_t>(lo);
}
// END boundary-missing-manual

// BEGIN boundary-transformed-standard
std::int64_t kth_missing_precomputed(const std::vector<int>& a, std::int64_t k) {
    // 明示O(n)预处理：多查询可把gap保留，而非每次重建。
    std::vector<std::int64_t> gap;
    gap.reserve(a.size());
    for (std::size_t i = 0; i < a.size(); ++i)
        gap.push_back(static_cast<std::int64_t>(a[i]) - static_cast<std::int64_t>(i) - 1);
    const auto p = std::lower_bound(gap.begin(), gap.end(), k) - gap.begin();
    return k + p;
}
// END boundary-transformed-standard

// BEGIN boundary-rotated-manual
std::optional<int> rotated_min_manual(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] > a[hi]) lo = m + 1;
        else if (a[m] < a[hi]) hi = m;
        else --hi; // 只能证明丢掉这个副本不会丢掉所有最小值。
    }
    return a[lo];
}
bool rotated_member_manual(const std::vector<int>& a, int key) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] == key) return true;
        if (a[lo] == a[m] && a[m] == a[hi - 1]) { ++lo; --hi; continue; }
        if (a[lo] <= a[m]) { // 左半有序。
            if (a[lo] <= key && key < a[m]) hi = m;
            else lo = m + 1;
        } else { // 右半有序。
            if (a[m] < key && key <= a[hi - 1]) lo = m + 1;
            else hi = m;
        }
    }
    return false;
}
// END boundary-rotated-manual

// BEGIN boundary-rotated-standard
bool rotated_member_standard(const std::vector<int>& a, int key) {
    // 先线性找唯一下降点；两段各自有序，才能分别使用binary_search。
    const auto cut = std::is_sorted_until(a.begin(), a.end());
    return std::binary_search(a.begin(), cut, key) ||
           std::binary_search(cut, a.end(), key);
}
std::optional<int> rotated_min_standard(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    return *std::min_element(a.begin(), a.end());
}
// END boundary-rotated-standard

// BEGIN boundary-paired-manual
int paired_unique_manual(const std::vector<int>& a) {
    // 非空奇数长有序数组：恰一项一次，其余每项恰两次。
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        auto m = lo + (hi - lo) / 2;
        m -= m % 2; // 一律从偶下标检查一整对。
        if (a[m] == a[m + 1]) lo = m + 2;
        else hi = m;
    }
    return a[lo];
}
int paired_unique_xor_index(const std::vector<int>& a) {
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] == a[m ^ std::size_t{1}]) lo = m + 1;
        else hi = m;
    }
    return a[lo];
}
// END boundary-paired-manual

// BEGIN boundary-paired-standard
int paired_unique_standard(const std::vector<int>& a) {
    // 不同算法：成对值的XOR抵消。线性基线，不满足原题O(logn)要求。
    return std::accumulate(a.begin(), a.end(), 0, std::bit_xor<int>{});
}
// END boundary-paired-standard

// BEGIN boundary-peak-manual
std::optional<std::size_t> peak_manual(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] < a[m + 1]) lo = m + 1;
        else hi = m; // 有向内的上升/下降边界证书，不是全局斜率单调。
    }
    return lo;
}
// END boundary-peak-manual

// BEGIN boundary-peak-standard
std::optional<std::size_t> peak_standard(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    // 邻值不等时任一全局最大值必是严格局部峰；此基线O(n)。
    return static_cast<std::size_t>(std::max_element(a.begin(), a.end()) - a.begin());
}
// END boundary-peak-standard

// BEGIN boundary-matrix-peak-manual
template<class ColumnMaximum>
std::optional<std::pair<std::size_t, std::size_t>>
matrix_peak_core(const std::vector<std::vector<int>>& a, ColumnMaximum maximum_row) {
    if (a.empty() || a.front().empty()) return std::nullopt;
    std::size_t lo = 0, hi = a.front().size() - 1;
    while (lo <= hi) {
        const auto col = lo + (hi - lo) / 2;
        const auto row = maximum_row(col); // 必须是中列最大，而不是随便一行。
        if (col + 1 < a.front().size() && a[row][col + 1] > a[row][col]) lo = col + 1;
        else if (col > 0 && a[row][col - 1] > a[row][col]) hi = col - 1;
        else return std::pair<std::size_t, std::size_t>{row, col};
    }
    throw std::logic_error("invalid matrix-peak contract");
}
std::optional<std::pair<std::size_t, std::size_t>>
matrix_peak_manual(const std::vector<std::vector<int>>& a) {
    return matrix_peak_core(a, [&](std::size_t col) {
        std::size_t row = 0;
        for (std::size_t r = 1; r < a.size(); ++r)
            if (a[r][col] > a[row][col]) row = r;
        return row;
    });
}
// END boundary-matrix-peak-manual

// BEGIN boundary-matrix-peak-standard
std::optional<std::pair<std::size_t, std::size_t>>
matrix_peak_standard(const std::vector<std::vector<int>>& a) {
    // std设施只替换“取中列最大行”；共享的是前面的二分证书和核心。
    std::vector<std::size_t> rows(a.size());
    std::iota(rows.begin(), rows.end(), std::size_t{0});
    return matrix_peak_core(a, [&](std::size_t col) {
        return *std::max_element(rows.begin(), rows.end(), [&](std::size_t x, std::size_t y) {
            return a[x][col] < a[y][col];
        });
    });
}
// END boundary-matrix-peak-standard

// BEGIN boundary-matrix-lookup-manual
bool matrix_flat_manual(const std::vector<std::vector<int>>& a, int key) {
    if (a.empty() || a.front().empty()) return false;
    const auto rows = a.size(), cols = a.front().size();
    if (rows > std::numeric_limits<std::size_t>::max() / cols)
        throw std::length_error("matrix index domain overflow");
    // 强合同：矩形且按行展平后全局非降；不真正复制mn个元素。
    std::size_t lo = 0, hi = rows * cols;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m / cols][m % cols] < key) lo = m + 1;
        else hi = m;
    }
    return lo < rows * cols && a[lo / cols][lo % cols] == key;
}
bool matrix_staircase(const std::vector<std::vector<int>>& a, int key) {
    if (a.empty() || a.front().empty()) return false;
    // 弱合同：矩形，各行各列非降。col用“列数”避免无符号-1。
    std::size_t row = 0, col = a.front().size();
    while (row < a.size() && col > 0) {
        const auto x = a[row][col - 1];
        if (x == key) return true;
        if (x < key) ++row;
        else --col;
    }
    return false;
}
// END boundary-matrix-lookup-manual

// BEGIN boundary-matrix-lookup-standard
bool matrix_row_standard(const std::vector<std::vector<int>>& a, int key) {
    // 只要求各行有序；甚至不要求各行等长或列有序。
    return std::any_of(a.begin(), a.end(), [&](const std::vector<int>& row) {
        const auto it = std::lower_bound(row.begin(), row.end(), key);
        return it != row.end() && *it == key;
    });
}
// END boundary-matrix-lookup-standard

// BEGIN boundary-integer-root-manual
std::uint64_t isqrt_manual(std::uint64_t x) {
    std::uint64_t lo = 0, hi = x;
    while (lo < hi) {
        const auto width = hi - lo;
        const auto m = lo + width / 2 + width % 2; // 上中点保证lo前进。
        if (m <= x / m) lo = m; // m>0；乘法m*m可能溢出，改为除法。
        else hi = m - 1;
    }
    return lo;
}
// END boundary-integer-root-manual

// BEGIN boundary-integer-root-standard
std::uint64_t isqrt_estimate_standard(std::uint64_t x) {
    // sqrt给近似，整数不等式最终确证；不能把浮点转整数当完整答案。
    auto r = static_cast<std::uint64_t>(std::sqrt(static_cast<long double>(x)));
    while (r > 0 && r > x / r) --r;
    while (r < std::numeric_limits<std::uint64_t>::max() && r + 1 <= x / (r + 1)) ++r;
    return r;
}
// END boundary-integer-root-standard

// BEGIN boundary-continuous-manual
struct RootBracket { double lo, hi; };
template<class Function>
std::optional<RootBracket>
bisect_root(Function f, double lo, double hi, double tolerance = 1e-10, int steps = 200) {
    if (!std::isfinite(lo) || !std::isfinite(hi) || lo > hi ||
        !std::isfinite(tolerance) || tolerance <= 0 || steps < 0)
        throw std::invalid_argument("invalid root interval");
    auto value = [&](double x) {
        const double y = f(x);
        if (!std::isfinite(y)) throw std::domain_error("non-finite function value");
        return y;
    };
    double fl = value(lo), fr = value(hi);
    if (fl == 0) return RootBracket{lo, lo};
    if (fr == 0) return RootBracket{hi, hi};
    if ((fl < 0) == (fr < 0)) return std::nullopt;
    // 调用者保证f连续；异号保证区间中至少有某个根，不要求单调。
    for (int i = 0; i < steps && hi - lo > tolerance; ++i) {
        const double m = lo / 2 + hi / 2;
        if (m == lo || m == hi) break; // 浮点相邻数使细分停止。
        const double fm = value(m);
        if (fm == 0) return RootBracket{m, m};
        if ((fl < 0) == (fm < 0)) { lo = m; fl = fm; }
        else { hi = m; fr = fm; }
    }
    return RootBracket{lo, hi}; // 返回实际夹区，不伪称必已达到所求误差。
}
// END boundary-continuous-manual

// BEGIN boundary-continuous-standard
std::vector<double> cubic_roots_by_critical_points(long double a, long double b,
                                                 long double c, long double d) {
    // P1024：三个互异实根在[-100,100]，根间距>=1。
    if (!std::isfinite(a) || !std::isfinite(b) || !std::isfinite(c) || !std::isfinite(d) || a == 0)
        throw std::invalid_argument("invalid cubic coefficients");
    // 归一后不受整体缩放影响；根有界使|B|<=300、|C|<=30000、|D|<=1e6。
    const long double B = b / a, C = c / a, D = d / a;
    const long double delta = std::fma(B, B, -3 * C);
    if (!(delta > 0) || !std::isfinite(delta))
        throw std::domain_error("cubic requires two distinct critical points");
    const long double square = std::sqrt(delta);
    const double first = static_cast<double>((-B - square) / 3);
    const double second = static_cast<double>((-B + square) / 3);
    // Rolle定理给r1<t1<r2<t2<r3；外端取±101，避开根恰在±100的脆弱判断。
    if (!(-101 < first && first < second && second < 101))
        throw std::domain_error("critical points outside problem contract");
    auto f = [=](double x) {
        const long double X = x;
        return static_cast<double>(std::fma(std::fma(X + B, X, C), X, D));
    };
    const double cut[] = {-101, first, second, 101};
    std::vector<double> roots;
    for (int i = 0; i < 3; ++i) {
        const auto bracket = bisect_root(f, cut[i], cut[i + 1], 1e-11);
        if (!bracket || bracket->hi - bracket->lo > 1e-9)
            throw std::domain_error("root bracketing failed");
        roots.push_back(bracket->lo / 2 + bracket->hi / 2);
    }
    return roots; // 三个夹区本身按序、各含一根，不需要epsilon去重。
}
// END boundary-continuous-standard

// BEGIN boundary-prefix-manual
std::pair<std::size_t, std::size_t>
prefix_range_manual(const std::vector<std::string>& words, std::string_view prefix) {
    // compare只看word的前|prefix|个字符；匹配返回0，短于prefix返回负。
    auto compare = [&](std::size_t i) { return std::string_view(words[i]).substr(0, prefix.size()).compare(prefix); };
    std::size_t lo = 0, hi = words.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (compare(m) < 0) lo = m + 1;
        else hi = m;
    }
    const auto first = lo;
    hi = words.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (compare(m) <= 0) lo = m + 1;
        else hi = m;
    }
    return {first, lo};
}
// END boundary-prefix-manual

// BEGIN boundary-lcp-manual
std::size_t lcp_binary(std::string_view a, std::string_view b) {
    std::size_t lo = 0, hi = std::min(a.size(), b.size());
    while (lo < hi) {
        const auto width = hi - lo;
        const auto m = lo + width / 2 + width % 2;
        if (a.substr(0, m) == b.substr(0, m)) lo = m;
        else hi = m - 1;
    }
    return lo;
}
// END boundary-lcp-manual

// BEGIN boundary-prefix-standard
std::pair<std::size_t, std::size_t>
prefix_range_standard(const std::vector<std::string>& words, std::string_view prefix) {
    const auto first = std::lower_bound(words.begin(), words.end(), prefix,
        [](const std::string& word, std::string_view p) {
            return std::string_view(word).substr(0, p.size()).compare(p) < 0;
        });
    const auto last = std::upper_bound(first, words.end(), prefix,
        [](std::string_view p, const std::string& word) {
            return std::string_view(word).substr(0, p.size()).compare(p) > 0;
        });
    return {static_cast<std::size_t>(first - words.begin()),
            static_cast<std::size_t>(last - words.begin())};
}
// END boundary-prefix-standard

// BEGIN boundary-suggestions-standard
std::vector<std::vector<std::string>>
suggestions_standard(std::vector<std::string> products, std::string_view query) {
    std::sort(products.begin(), products.end());
    std::vector<std::vector<std::string>> result;
    for (std::size_t length = 1; length <= query.size(); ++length) {
        const auto range = prefix_range_standard(products, query.substr(0, length));
        std::vector<std::string> row;
        for (auto i = range.first; i < range.second && row.size() < 3; ++i) row.push_back(products[i]);
        result.push_back(std::move(row));
    }
    return result;
}
// END boundary-suggestions-standard

// BEGIN boundary-lcp-standard
std::size_t lcp_standard(std::string_view a, std::string_view b) {
    return static_cast<std::size_t>(std::mismatch(a.begin(), a.end(), b.begin(), b.end()).first - a.begin());
}
// END boundary-lcp-standard

// BEGIN boundary-convex-manual
struct Point { std::int64_t x, y; };
enum class Location { outside, boundary, inside };
std::int64_t cross(Point a, Point b, Point q) {
    // 本题abs坐标<=1e9：差<=2e9，两个乘积之差绝对值粗界8e18。
    return (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
}
bool on_segment(Point a, Point b, Point q) {
    return cross(a, b, q) == 0 && q.x >= std::min(a.x, b.x) && q.x <= std::max(a.x, b.x)
        && q.y >= std::min(a.y, b.y) && q.y <= std::max(a.y, b.y);
}
std::optional<Location> fan_boundary(const std::vector<Point>& p, Point q) {
    if (p.size() < 3) throw std::invalid_argument("polygon needs three vertices");
    const auto left = cross(p[0], p[1], q), right = cross(p[0], p.back(), q);
    if (left < 0 || right > 0) return Location::outside;
    if (left == 0) return on_segment(p[0], p[1], q) ? Location::boundary : Location::outside;
    if (right == 0) return on_segment(p[0], p.back(), q) ? Location::boundary : Location::outside;
    return std::nullopt; // 位于开扇形内，继续定位扇区。
}
Location convex_manual(const std::vector<Point>& p, Point q) {
    // p严格凸、逆时针，去掉末尾重复首点；q同样满足坐标预算。
    if (auto result = fan_boundary(p, q)) return *result;
    std::size_t lo = 1, hi = p.size() - 1;
    while (hi - lo > 1) {
        const auto m = lo + (hi - lo) / 2;
        if (cross(p[0], p[m], q) >= 0) lo = m;
        else hi = m;
    }
    const auto side = cross(p[lo], p[hi], q);
    return side < 0 ? Location::outside : side == 0 ? Location::boundary : Location::inside;
}
// END boundary-convex-manual

// BEGIN boundary-convex-standard
Location convex_standard(const std::vector<Point>& p, Point q) {
    if (auto result = fan_boundary(p, q)) return *result;
    // 扇形内射线按角度排列，该谓词是true...true,false...false。
    const auto end = std::partition_point(p.begin() + 1, p.end(), [&](Point v) {
        return cross(p[0], v, q) >= 0;
    });
    const auto side = cross(*std::prev(end), *end, q);
    return side < 0 ? Location::outside : side == 0 ? Location::boundary : Location::inside;
}
// END boundary-convex-standard

} // namespace binary_boundary

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <functional>
#include <numeric>
#include <queue>
#include <deque>
#include <utility>
#include <vector>

namespace binary_decision {

// BEGIN decision-search-core
using i64 = long long;

// 闭区间中至少有一个真值；判定为 false...false,true...true。
template<class Predicate>
i64 first_true(i64 lo, i64 hi, Predicate feasible) {
    while (lo < hi) {
        const i64 mid = lo + (hi - lo) / 2;
        if (feasible(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

// 闭区间中至少有一个真值；判定为 true...true,false...false。
template<class Predicate>
i64 last_true(i64 lo, i64 hi, Predicate feasible) {
    while (lo < hi) {
        const i64 gap = hi - lo;
        const i64 mid = lo + gap / 2 + gap % 2; // 上中点，避免 lo 卡住。
        if (feasible(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

// END decision-search-core

// BEGIN decision-real-search-core
// 固定迭代预算，并防止浮点中点已无法前进。
template<class Predicate>
long double real_last_true(long double lo, long double hi, Predicate feasible) {
    for (int step = 0; step < 80; ++step) {
        const long double mid = lo + (hi - lo) / 2;
        if (mid == lo || mid == hi) break;
        if (feasible(mid)) lo = mid;
        else hi = mid;
    }
    return lo;
}

template<class Predicate>
long double real_first_true(long double lo, long double hi, Predicate feasible) {
    for (int step = 0; step < 80; ++step) {
        const long double mid = lo + (hi - lo) / 2;
        if (mid == lo || mid == hi) break;
        if (feasible(mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}
// END decision-real-search-core

// BEGIN decision-capacity-manual
// a 非空、各项非负、1 <= k <= a.size()；总和须可用 i64 表示。
i64 capacity_manual(const std::vector<i64>& a, int k) {
    i64 lower = 0, upper = 0;
    for (i64 x : a) {
        if (x > lower) lower = x;
        upper += x;
    }
    auto feasible = [&](i64 limit) {
        int blocks = 1;
        i64 used = 0;
        for (i64 x : a) {
            // lower 已保证 x <= limit；比较差值避免 used+x 溢出。
            if (used > limit - x) {
                if (++blocks > k) return false;
                used = x;
            } else used += x;
        }
        return true;
    };
    return first_true(lower, upper, feasible);
}
// END decision-capacity-manual

// BEGIN decision-capacity-support
// 库只接管边界统计；它没有接管“为何贪心段数可作判定”。
std::pair<i64, i64> capacity_bounds_standard(const std::vector<i64>& a) {
    return {*std::max_element(a.begin(), a.end()),
            std::accumulate(a.begin(), a.end(), 0LL)};
}
// END decision-capacity-support

// BEGIN decision-spacing-manual
// sorted_position 已升序，至少两个互异位置；2 <= balls <= n。
i64 spacing_sorted_manual(const std::vector<i64>& sorted_position, int balls) {
    const i64 span = sorted_position.back() - sorted_position.front();
    auto feasible = [&](i64 distance) {
        int placed = 1;
        i64 last = sorted_position.front();
        for (std::size_t i = 1; i < sorted_position.size(); ++i) {
            if (sorted_position[i] - last >= distance) {
                last = sorted_position[i];
                if (++placed >= balls) return true;
            }
        }
        return false;
    };
    return last_true(0, span / (balls - 1), feasible);
}
// END decision-spacing-manual

// BEGIN decision-spacing-standard
// 值传递接管一份位置副本；调用方原序不变，手写核心获得有序前提。
i64 spacing_standard(std::vector<i64> position, int balls) {
    std::sort(position.begin(), position.end());
    return spacing_sorted_manual(position, balls);
}
// END decision-spacing-standard

// BEGIN decision-production-manual
// times 非空且为正；target >= 1；min(times)*target 可用 i64 表示。
i64 production_manual(const std::vector<i64>& times, i64 target) {
    i64 fastest = times.front();
    for (i64 t : times) if (t < fastest) fastest = t;
    auto feasible = [&](i64 time) {
        i64 remaining = target;
        for (i64 t : times) {
            const i64 made = time / t;
            // 判定只需知道是否达标；保留剩余目标，不必累计完整产能。
            if (made >= remaining) return true;
            remaining -= made;
        }
        return false;
    };
    return first_true(0, fastest * target, feasible);
}
// END decision-production-manual

// BEGIN decision-production-support
i64 production_upper_standard(const std::vector<i64>& times, i64 target) {
    // 返回已证明有效的搜索界；乘法在 i64 中进行。
    return *std::min_element(times.begin(), times.end()) * target;
}
// END decision-production-support

// BEGIN decision-simulation-manual
class MinHeap {
    std::vector<i64> data;
public:
    explicit MinHeap(int slots) : data(slots, 0) {}
    i64 take_min() {
        const i64 result = data[0];
        data[0] = data.back();
        data.pop_back();
        std::size_t p = 0;
        while (2 * p + 1 < data.size()) {
            std::size_t child = 2 * p + 1;
            if (child + 1 < data.size() && data[child + 1] < data[child]) ++child;
            if (data[p] <= data[child]) break;
            std::swap(data[p], data[child]);
            p = child;
        }
        return result;
    }
    void push(i64 value) {
        data.push_back(value);
        std::size_t p = data.size() - 1;
        while (p > 0) {
            const std::size_t parent = (p - 1) / 2;
            if (data[parent] <= data[p]) break;
            std::swap(data[parent], data[p]);
            p = parent;
        }
    }
};

int stage_slots_manual(const std::vector<i64>& duration, i64 deadline) {
    auto feasible = [&](i64 slots) {
        MinHeap heap(static_cast<int>(slots));
        for (i64 d : duration) {
            const i64 finish = heap.take_min() + d;
            if (finish > deadline) return false;
            heap.push(finish);
        }
        return true;
    };
    // 原题保证 duration.size() 个台位可在 deadline 内完成。
    return static_cast<int>(first_true(1, duration.size(), feasible));
}
// END decision-simulation-manual

// BEGIN decision-simulation-standard
int stage_slots_standard(const std::vector<i64>& duration, i64 deadline) {
    auto feasible = [&](i64 slots) {
        std::priority_queue<i64, std::vector<i64>, std::greater<i64>> finish;
        for (i64 i = 0; i < slots; ++i) finish.push(0);
        for (i64 d : duration) {
            const i64 next = finish.top() + d; // 取值，不保留跨 pop 的引用。
            finish.pop();
            if (next > deadline) return false;
            finish.push(next);
        }
        return true;
    };
    return static_cast<int>(first_true(1, duration.size(), feasible));
}
// END decision-simulation-standard

// BEGIN decision-graph-manual
int path_effort_manual(const std::vector<std::vector<int>>& height) {
    const int rows = static_cast<int>(height.size());
    const int cols = static_cast<int>(height[0].size());
    const int count = rows * cols;
    const int dr[4] = {-1, 1, 0, 0}, dc[4] = {0, 0, -1, 1};
    auto feasible = [&](i64 limit) {
        std::vector<unsigned char> seen(count, 0);
        std::vector<int> queue(count);
        int head = 0, tail = 0;
        queue[tail++] = 0;
        seen[0] = 1; // 入队即标记，队列最多容纳 count 个格子。
        while (head < tail) {
            const int id = queue[head++];
            if (id == count - 1) return true;
            const int r = id / cols, c = id % cols;
            for (int direction = 0; direction < 4; ++direction) {
                const int nr = r + dr[direction], nc = c + dc[direction];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                const int next = nr * cols + nc;
                const i64 gap = std::llabs(i64(height[r][c]) - height[nr][nc]);
                if (!seen[next] && gap <= limit) {
                    seen[next] = 1;
                    queue[tail++] = next;
                }
            }
        }
        return false;
    };
    // 原题高度在 [1, 10^6]；整个网格在此界下必连通。
    return static_cast<int>(first_true(0, 999999, feasible));
}
// END decision-graph-manual

// BEGIN decision-graph-standard
int path_effort_standard(const std::vector<std::vector<int>>& height) {
    const int rows = static_cast<int>(height.size());
    const int cols = static_cast<int>(height[0].size());
    const int dr[4] = {-1, 1, 0, 0}, dc[4] = {0, 0, -1, 1};
    auto feasible = [&](i64 limit) {
        std::vector<unsigned char> seen(rows * cols, 0);
        std::queue<std::pair<int, int>> frontier;
        frontier.emplace(0, 0);
        seen[0] = 1;
        while (!frontier.empty()) {
            const auto [r, c] = frontier.front();
            frontier.pop();
            if (r == rows - 1 && c == cols - 1) return true;
            for (int direction = 0; direction < 4; ++direction) {
                const int nr = r + dr[direction], nc = c + dc[direction];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                const int id = nr * cols + nc;
                const i64 gap = std::llabs(i64(height[r][c]) - height[nr][nc]);
                if (!seen[id] && gap <= limit) {
                    seen[id] = 1;
                    frontier.emplace(nr, nc);
                }
            }
        }
        return false;
    };
    return static_cast<int>(first_true(0, 999999, feasible));
}
// END decision-graph-standard

// BEGIN decision-prefix-manual
int first_nails_manual(const std::vector<int>& left, const std::vector<int>& right,
                       const std::vector<int>& nails) {
    const int m = static_cast<int>(nails.size());
    auto feasible = [&](i64 prefix) {
        if (prefix == m + 1) return true; // 仅用于表示所有真实前缀均失败。
        std::vector<int> count(2 * m + 1, 0);
        for (int i = 0; i < prefix; ++i) ++count[nails[i]];
        for (int x = 1; x <= 2 * m; ++x) count[x] += count[x - 1];
        for (std::size_t i = 0; i < left.size(); ++i)
            if (count[right[i]] == count[left[i] - 1]) return false;
        return true;
    };
    const int result = static_cast<int>(first_true(1, m + 1, feasible));
    return result == m + 1 ? -1 : result;
}

struct Order {
    i64 demand;
    int left, right; // 0-based 半开天区间；原题 [s,t] 转成 [s-1,t)。
};

std::vector<i64> order_difference(int days, const std::vector<Order>& orders, int prefix) {
    std::vector<i64> difference(days + 1, 0);
    for (int i = 0; i < prefix; ++i) {
        difference[orders[i].left] += orders[i].demand;
        difference[orders[i].right] -= orders[i].demand;
    }
    return difference;
}

int first_failed_order_manual(const std::vector<i64>& capacity,
                              const std::vector<Order>& orders) {
    const int m = static_cast<int>(orders.size());
    auto failed = [&](i64 prefix) {
        if (prefix == m + 1) return true;
        const auto difference = order_difference(capacity.size(), orders, prefix);
        i64 used = 0;
        for (std::size_t day = 0; day < capacity.size(); ++day) {
            used += difference[day];
            if (used > capacity[day]) return true;
        }
        return false;
    };
    const int result = static_cast<int>(first_true(1, m + 1, failed));
    return result == m + 1 ? 0 : result; // 返回申请人 1 基编号；0 表示全部成功。
}
// END decision-prefix-manual

// BEGIN decision-prefix-standard
int first_nails_standard(const std::vector<int>& left, const std::vector<int>& right,
                         const std::vector<int>& nails) {
    const int m = static_cast<int>(nails.size());
    auto feasible = [&](i64 prefix) {
        if (prefix == m + 1) return true;
        std::vector<int> count(2 * m + 1, 0);
        for (int i = 0; i < prefix; ++i) ++count[nails[i]];
        std::partial_sum(count.begin(), count.end(), count.begin());
        for (std::size_t i = 0; i < left.size(); ++i)
            if (count[right[i]] == count[left[i] - 1]) return false;
        return true;
    };
    const int result = static_cast<int>(first_true(1, m + 1, feasible));
    return result == m + 1 ? -1 : result;
}

int first_failed_order_standard(const std::vector<i64>& capacity,
                                const std::vector<Order>& orders) {
    const int m = static_cast<int>(orders.size());
    auto failed = [&](i64 prefix) {
        if (prefix == m + 1) return true;
        auto used = order_difference(capacity.size(), orders, prefix);
        std::partial_sum(used.begin(), used.end(), used.begin());
        // used 尾端多一项用于差分归零，不属于任何真实一天。
        return !std::equal(capacity.begin(), capacity.end(), used.begin(),
                           [](i64 available, i64 required) { return required <= available; });
    };
    const int result = static_cast<int>(first_true(1, m + 1, failed));
    return result == m + 1 ? 0 : result;
}
// END decision-prefix-standard

// BEGIN decision-matching-manual
// 返回至多 need 条低权边组成的匹配：right_owner[c] = row 或 -1。
std::vector<int> threshold_matching(const std::vector<std::vector<int>>& a,
                                    int limit, int need) {
    const int n = static_cast<int>(a.size()), m = static_cast<int>(a[0].size());
    std::vector<int> right_owner(m, -1);
    int matched = 0;
    for (int row = 0; row < n && matched < need; ++row) {
        std::vector<unsigned char> seen(m, 0);
        auto augment = [&](auto&& self, int r) -> bool {
            for (int c = 0; c < m; ++c) {
                if (a[r][c] > limit || seen[c]) continue;
                seen[c] = 1;
                // 空列或能把原主人搬走，就为当前行腾出这个列。
                if (right_owner[c] == -1 || self(self, right_owner[c])) {
                    right_owner[c] = r;
                    return true;
                }
            }
            return false;
        };
        if (augment(augment, row)) ++matched;
    }
    return right_owner;
}

int matching_size(const std::vector<int>& right_owner) {
    int result = 0;
    for (int r : right_owner) if (r != -1) ++result;
    return result;
}

int matching_threshold_manual(const std::vector<std::vector<int>>& a, int k) {
    int lower = a[0][0], upper = a[0][0];
    for (const auto& row : a) for (int value : row) {
        if (value < lower) lower = value;
        if (value > upper) upper = value;
    }
    const int need = static_cast<int>(a.size()) - k + 1;
    auto feasible = [&](i64 limit) {
        return matching_size(threshold_matching(a, static_cast<int>(limit), need)) >= need;
    };
    return static_cast<int>(first_true(lower, upper, feasible));
}
// END decision-matching-manual

// BEGIN decision-matching-standard
struct MatchAnswer {
    int threshold;
    std::vector<int> column; // 每行最终选择哪一列，构成完整 n 条边。
};

MatchAnswer matching_standard(const std::vector<std::vector<int>>& a, int k) {
    std::vector<int> values;
    for (const auto& row : a) values.insert(values.end(), row.begin(), row.end());
    std::sort(values.begin(), values.end());
    values.erase(std::unique(values.begin(), values.end()), values.end());
    const int n = static_cast<int>(a.size()), m = static_cast<int>(a[0].size());
    const int need = n - k + 1;
    auto feasible = [&](i64 index) {
        return matching_size(threshold_matching(a, values[index], need)) >= need;
    };
    const int index = static_cast<int>(first_true(0, values.size() - 1, feasible));
    const auto owners = threshold_matching(a, values[index], need);
    std::vector<int> column(n, -1), free_columns;
    for (int c = 0; c < m; ++c) {
        if (owners[c] == -1) free_columns.push_back(c);
        else column[owners[c]] = c;
    }
    // 原矩阵完整且 m>=n，未配行可任取未用列；低权边数仍至少 need。
    std::size_t next = 0;
    for (int r = 0; r < n; ++r)
        if (column[r] == -1) column[r] = free_columns[next++];
    return {values[index], std::move(column)};
}
// END decision-matching-standard

// BEGIN decision-average-manual
long double max_average_manual(const std::vector<i64>& a, int shortest, int longest) {
    long double lower = a[0], upper = a[0];
    for (i64 x : a) { if (x < lower) lower = x; if (x > upper) upper = x; }
    const int n = static_cast<int>(a.size());
    auto feasible = [&](long double guess) {
        std::vector<long double> prefix(n + 1, 0);
        for (int i = 0; i < n; ++i) prefix[i + 1] = prefix[i] + a[i] - guess;
        std::vector<int> queue(n + 1);
        int head = 0, tail = 0;
        for (int r = shortest; r <= n; ++r) {
            const int enter = r - shortest;
            while (head < tail && prefix[queue[tail - 1]] >= prefix[enter]) --tail;
            queue[tail++] = enter;
            while (head < tail && queue[head] < r - longest) ++head;
            // 合法左前缀范围为 [r-longest, r-shortest]，队头是其最小值。
            if (prefix[r] >= prefix[queue[head]]) return true;
        }
        return false;
    };
    return real_last_true(lower, upper, feasible);
}

long double min_remaining_average_manual(const std::vector<i64>& a) {
    auto feasible = [&](long double guess) {
        long double total = 0;
        for (i64 x : a) total += x - guess;
        // 删除段必须非空，且不得包含 a.front()/a.back()。
        long double current = a[1] - guess, best = current;
        for (std::size_t i = 2; i + 1 < a.size(); ++i) {
            const long double x = a[i] - guess;
            current = current > 0 ? current + x : x;
            if (current > best) best = current;
        }
        return best >= total; // 剩余变换和 <=0，亦即剩余平均 <=guess。
    };
    return real_first_true(1, 10000, feasible);
}
// END decision-average-manual

// BEGIN decision-average-standard
long double max_average_standard(const std::vector<i64>& a, int shortest, int longest) {
    const auto limits = std::minmax_element(a.begin(), a.end());
    const int n = static_cast<int>(a.size());
    auto feasible = [&](long double guess) {
        std::vector<long double> prefix(n + 1, 0);
        for (int i = 0; i < n; ++i) prefix[i + 1] = prefix[i] + a[i] - guess;
        std::deque<int> candidates;
        for (int r = shortest; r <= n; ++r) {
            const int enter = r - shortest;
            while (!candidates.empty() && prefix[candidates.back()] >= prefix[enter])
                candidates.pop_back();
            candidates.push_back(enter);
            while (candidates.front() < r - longest) candidates.pop_front();
            if (prefix[r] >= prefix[candidates.front()]) return true;
        }
        return false;
    };
    return real_last_true(*limits.first, *limits.second, feasible);
}

// Sabotage 的设施层只展示“减去阈值”；它不代替非空 Kadane 证明。
std::vector<long double> shifted_values_standard(const std::vector<i64>& a,
                                                 long double guess) {
    std::vector<long double> result(a.size());
    std::transform(a.begin(), a.end(), result.begin(),
                   [guess](i64 value) { return value - guess; });
    return result;
}
// END decision-average-standard

// BEGIN decision-ratio-manual
struct Ingredient { i64 value, cost; };

long double ratio_manual(const std::vector<Ingredient>& items, int choose) {
    auto feasible = [&](long double guess) {
        std::vector<long double> score;
        for (const auto& item : items) {
            score.push_back(item.value - guess * item.cost);
            // 手写插入排序，保持已经生成的变换分数降序。
            std::size_t p = score.size() - 1;
            while (p > 0 && score[p] > score[p - 1]) {
                const auto temporary = score[p];
                score[p] = score[p - 1]; score[p - 1] = temporary;
                --p;
            }
        }
        long double sum = 0;
        for (int i = 0; i < choose; ++i) sum += score[i];
        return sum >= 0;
    };
    return real_last_true(0, 1000, feasible); // 原题保证最优比值不超过 1000。
}
// END decision-ratio-manual

// BEGIN decision-ratio-standard
long double ratio_standard(const std::vector<Ingredient>& items, int choose) {
    auto feasible = [&](long double guess) {
        std::vector<long double> score;
        score.reserve(items.size());
        for (const auto& item : items) score.push_back(item.value - guess * item.cost);
        if (choose < static_cast<int>(score.size()))
            std::nth_element(score.begin(), score.begin() + choose, score.end(),
                             std::greater<long double>{});
        // 前 choose 项是最大的 choose 项，但它们内部没有排好序。
        return std::accumulate(score.begin(), score.begin() + choose, 0.0L) >= 0;
    };
    return real_last_true(0, 1000, feasible);
}
// END decision-ratio-standard

} // namespace binary_decision

#include <algorithm>
#include <cassert>
#include <cstdint>
#include <limits>
#include <numeric>
#include <random>
#include <utility>
#include <vector>

namespace binary_selection {
using i64 = long long;

// BEGIN duplicate-manual
template<class Count>
int duplicate_core(int n, Count count_le) {
    int lo = 1, hi = n;
    while (lo < hi) {
        const int mid = lo + (hi-lo)/2;
        // 唯一重复值进入前缀后，数量必超过前缀容量。
        if (count_le(mid) > mid) hi = mid;
        else lo = mid+1;
    }
    return lo;
}
int duplicate_manual(const std::vector<int>& a) {
    return duplicate_core(static_cast<int>(a.size())-1, [&](int x) {
        int count = 0;
        for (int value : a) if (value <= x) ++count;
        return count;
    });
}
// END duplicate-manual

// BEGIN duplicate-standard
int duplicate_standard(const std::vector<int>& a) {
    return duplicate_core(static_cast<int>(a.size())-1, [&](int x) {
        return std::count_if(a.begin(), a.end(), [x](int v) { return v <= x; });
    });
}
// END duplicate-standard

// BEGIN missing-domain
// values均在[0,universe)，条数<universe；允许重复，返回任意缺失值。
std::uint64_t missing_domain(const std::vector<std::uint32_t>& values,
                             std::uint64_t universe) {
    std::uint64_t lo = 0, hi = universe; // 当前区间计数严格小于容量
    while (hi-lo > 1) {
        const auto mid = lo + (hi-lo)/2;
        std::uint64_t left_count = 0;
        for (auto v : values) if (lo <= v && v < mid) ++left_count;
        if (left_count < mid-lo) hi = mid;
        else lo = mid; // 左半满，欠满性必留在右半
    }
    return lo;
}
// END missing-domain

// BEGIN weighted-manual
std::vector<i64> cumulative_manual(const std::vector<int>& weights) {
    std::vector<i64> prefix;
    i64 total = 0;
    for (int w : weights) { total += w; prefix.push_back(total); }
    return prefix;
}
// 票号从1开始；查第一个累计值>=ticket，不使用浮点概率区间。
int ticket_manual(const std::vector<i64>& prefix, i64 ticket) {
    int lo = 0, hi = static_cast<int>(prefix.size());
    while (lo < hi) {
        const int mid = lo + (hi-lo)/2;
        if (prefix[mid] >= ticket) hi = mid;
        else lo = mid+1;
    }
    return lo;
}
// END weighted-manual

// BEGIN weighted-standard
std::vector<i64> cumulative_standard(const std::vector<int>& weights) {
    // partial_sum按输入value_type累加，先把输入本身转换为64位。
    std::vector<i64> prefix(weights.begin(), weights.end());
    std::partial_sum(prefix.begin(), prefix.end(), prefix.begin());
    return prefix;
}
int ticket_standard(const std::vector<i64>& prefix, i64 ticket) {
    return static_cast<int>(std::lower_bound(prefix.begin(), prefix.end(), ticket)
                            - prefix.begin());
}
int sample_index(const std::vector<i64>& prefix, std::mt19937_64& engine) {
    std::uniform_int_distribution<i64> ticket(1, prefix.back());
    return ticket_standard(prefix, ticket(engine));
}
// END weighted-standard

// BEGIN matrix-rank-manual
// count返回<=x的重数；lo/hi有界且差可表示，k保证存在。
template<class Count>
i64 kth_value(i64 lo, i64 hi, i64 k, Count count) {
    while (lo < hi) {
        const i64 mid = lo + (hi-lo)/2;
        if (count(mid) >= k) hi = mid;
        else lo = mid+1;
    }
    return lo;
}
i64 matrix_count_manual(const std::vector<std::vector<int>>& a, i64 x) {
    int row = static_cast<int>(a.size())-1, col = 0;
    i64 count = 0;
    while (row >= 0 && col < static_cast<int>(a[0].size())) {
        if (a[row][col] <= x) { count += row+1; ++col; }
        else --row;
    }
    return count;
}
i64 matrix_kth_manual(const std::vector<std::vector<int>>& a, i64 k) {
    return kth_value(a.front().front(), a.back().back(), k,
                     [&](i64 x) { return matrix_count_manual(a,x); });
}
// END matrix-rank-manual

// BEGIN matrix-rank-standard
i64 matrix_kth_standard(const std::vector<std::vector<int>>& a, i64 k) {
    return kth_value(a.front().front(), a.back().back(), k, [&](i64 x) {
        i64 count = 0;
        for (const auto& row : a)
            count += std::upper_bound(row.begin(),row.end(),x)-row.begin();
        return count;
    }); // 每行查边界，检查器比楼梯扫描多一个log因子。
}
// END matrix-rank-standard

// BEGIN pair-rank-manual
i64 pair_distance_manual(std::vector<int> a, i64 k) {
    std::sort(a.begin(), a.end());
    return kth_value(0, static_cast<i64>(a.back())-a.front(), k, [&](i64 d) {
        i64 count = 0;
        int left = 0;
        for (int right = 0; right < static_cast<int>(a.size()); ++right) {
            while (static_cast<i64>(a[right])-a[left] > d) ++left;
            count += right-left; // 每个索引数对恰计一次，重复值不去重。
        }
        return count;
    });
}
// END pair-rank-manual

// BEGIN pair-rank-standard
i64 pair_distance_standard(std::vector<int> a, i64 k) {
    std::sort(a.begin(),a.end());
    return kth_value(0, static_cast<i64>(a.back())-a.front(), k, [&](i64 d) {
        i64 count = 0;
        for (int i = 0; i < static_cast<int>(a.size()); ++i)
            count += std::upper_bound(a.begin()+i+1,a.end(),static_cast<i64>(a[i])+d)
                     - (a.begin()+i+1);
        return count;
    });
}
// END pair-rank-standard

// BEGIN multiplication-manual
i64 multiplication_count_manual(int rows, int cols, i64 x) {
    i64 count = 0;
    for (i64 i = 1; i <= rows; ++i) {
        const i64 available = x/i;
        count += available < cols ? available : cols;
    }
    return count;
}
i64 multiplication_kth_manual(int rows, int cols, i64 k) {
    if (rows > cols) std::swap(rows,cols);
    return kth_value(1, 1LL*rows*cols, k,
                     [&](i64 x) { return multiplication_count_manual(rows,cols,x); });
}
// END multiplication-manual

// BEGIN multiplication-standard
// 替换解析计数循环中一行的贡献，值域搜索与求和主体保持共用。
i64 multiplication_row_standard(int cols, i64 x, i64 row) {
    return std::min<i64>(cols, x / row);
}
// END multiplication-standard

// BEGIN two-array-manual
// k为1基；至少一数组非空，输入元素int，64位哨兵不与真实值混淆。
i64 two_array_kth(const std::vector<int>& a, const std::vector<int>& b, int k) {
    if (a.size() > b.size()) return two_array_kth(b,a,k);
    const int m = static_cast<int>(a.size()), n = static_cast<int>(b.size());
    int lo = std::max(0,k-n), hi = std::min(k,m);
    while (lo <= hi) {
        const int i = lo + (hi-lo)/2, j = k-i;
        const i64 al = i ? a[i-1] : std::numeric_limits<i64>::lowest();
        const i64 ar = i < m ? a[i] : std::numeric_limits<i64>::max();
        const i64 bl = j ? b[j-1] : std::numeric_limits<i64>::lowest();
        const i64 br = j < n ? b[j] : std::numeric_limits<i64>::max();
        if (al > br) hi = i-1;       // A左侧取多了
        else if (bl > ar) lo = i+1;  // A左侧取少了
        else return std::max(al,bl);
    }
    assert(false); // 有序且1<=k<=m+n时不会到达
    return 0;
}
double two_array_median(const std::vector<int>& a,const std::vector<int>& b) {
    const int n = static_cast<int>(a.size()+b.size());
    if (n%2) return static_cast<double>(two_array_kth(a,b,n/2+1));
    return (two_array_kth(a,b,n/2)+two_array_kth(a,b,n/2+1))/2.0;
}
// END two-array-manual

// BEGIN two-array-standard
i64 two_array_merge(const std::vector<int>& a,const std::vector<int>& b,int k) {
    std::vector<int> merged(a.size()+b.size());
    std::merge(a.begin(),a.end(),b.begin(),b.end(),merged.begin());
    return merged[k-1]; // 线性时间/空间对照，不能满足LC4的对数要求。
}
// END two-array-standard

// BEGIN lis-manual
template<class Locate>
std::vector<int> lis_core(const std::vector<int>& a, Locate locate) {
    std::vector<int> tails, tail_index, parent(a.size(),-1);
    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        const int p = locate(tails,a[i]);
        if (p) parent[i] = tail_index[p-1]; // 修改tail前保存真实前驱
        if (p == static_cast<int>(tails.size())) {
            tails.push_back(a[i]); tail_index.push_back(i);
        } else { tails[p] = a[i]; tail_index[p] = i; }
    }
    std::vector<int> indices;
    for (int i = tail_index.empty() ? -1 : tail_index.back(); i != -1; i=parent[i])
        indices.push_back(i);
    std::reverse(indices.begin(),indices.end());
    return indices;
}
std::vector<int> lis_manual(const std::vector<int>& a,bool nondecreasing=false) {
    return lis_core(a,[=](const std::vector<int>& tail,int x) {
        int lo=0,hi=static_cast<int>(tail.size());
        while (lo<hi) {
            const int mid=lo+(hi-lo)/2;
            if (nondecreasing ? tail[mid]>x : tail[mid]>=x) hi=mid;
            else lo=mid+1;
        }
        return lo;
    });
}
// END lis-manual

// BEGIN lis-standard
std::vector<int> lis_standard(const std::vector<int>& a,bool nondecreasing=false) {
    return lis_core(a,[=](const std::vector<int>& tail,int x) {
        const auto it = nondecreasing ? std::upper_bound(tail.begin(),tail.end(),x)
                                     : std::lower_bound(tail.begin(),tail.end(),x);
        return static_cast<int>(it-tail.begin()); // 变成下标再允许vector增长
    });
}
// END lis-standard

// BEGIN envelopes-standard
int envelopes_standard(std::vector<std::pair<int,int>> envelopes) {
    std::sort(envelopes.begin(),envelopes.end(),[](auto a,auto b) {
        return a.first != b.first ? a.first<b.first : a.second>b.second;
    });
    std::vector<int> heights;
    for (auto item : envelopes) heights.push_back(item.second);
    return static_cast<int>(lis_standard(heights).size());
}
// END envelopes-standard

// BEGIN lis-count
i64 lis_count(const std::vector<int>& a) {
    if (a.empty()) return 0;
    const int n=static_cast<int>(a.size());
    std::vector<int> len(n,1);
    std::vector<i64> ways(n,1);
    const auto add_count=[](i64 x,i64 y) {
        const i64 cap=std::numeric_limits<i64>::max();
        return y>cap-x ? cap : x+y;
    };
    for (int i=0;i<n;++i) for (int j=0;j<i;++j) if (a[j]<a[i]) {
        // 更长则覆盖旧长度的方案；同长才合并互斥的倒数第二下标。
        if (len[j]+1>len[i]) { len[i]=len[j]+1; ways[i]=ways[j]; }
        else if (len[j]+1==len[i]) ways[i]=add_count(ways[i],ways[j]);
    }
    const int best=*std::max_element(len.begin(),len.end());
    i64 result=0;
    for (int i=0;i<n;++i) if (len[i]==best) result=add_count(result,ways[i]);
    return result; // 若最终答案可表示则精确；无关较短状态过大时饱和。
}
// END lis-count

// BEGIN jobs-manual
struct Job { i64 start,end,reward; };
template<class Predecessor>
i64 jobs_core(std::vector<Job> jobs,bool touching,Predecessor predecessor) {
    std::sort(jobs.begin(),jobs.end(),[](Job a,Job b) { return a.end<b.end; });
    std::vector<i64> ends,dp(jobs.size()+1,0);
    for (int i=0;i<static_cast<int>(jobs.size());++i) {
        // p为已处理任务中兼容的个数，可直接作为dp下标。
        const int p=predecessor(ends,jobs[i].start,touching);
        dp[i+1]=std::max(dp[i],dp[p]+jobs[i].reward);
        ends.push_back(jobs[i].end);
    }
    return dp.back();
}
i64 jobs_manual(std::vector<Job> jobs,bool touching=false) {
    return jobs_core(std::move(jobs),touching,[](const auto& ends,i64 start,bool touch) {
        int lo=0,hi=static_cast<int>(ends.size());
        while (lo<hi) {
            const int mid=lo+(hi-lo)/2;
            if (touch ? ends[mid]<=start : ends[mid]<start) lo=mid+1;
            else hi=mid;
        }
        return lo;
    });
}
// END jobs-manual

// BEGIN jobs-standard
i64 jobs_standard(std::vector<Job> jobs,bool touching=false) {
    return jobs_core(std::move(jobs),touching,[](const auto& ends,i64 start,bool touch) {
        const auto it=touch ? std::upper_bound(ends.begin(),ends.end(),start)
                            : std::lower_bound(ends.begin(),ends.end(),start);
        return static_cast<int>(it-ends.begin());
    });
}
// END jobs-standard

// BEGIN egg-manual
// LC887合同：1<=eggs<=100，0<=floors<=10000。
int egg_moves_manual(int eggs,int floors) {
    auto enough=[=](int moves) {
        i64 term=1,sum=0;
        for (int i=1;i<=eggs && i<=moves;++i) {
            term=term*(moves-i+1)/i; // C(moves,i)，尚未饱和时乘积<=floors²
            sum+=term;
            if (sum>=floors) return true;
        }
        return false;
    };
    int lo=0,hi=floors;
    while (lo<hi) {
        const int mid=lo+(hi-lo)/2;
        if (enough(mid)) hi=mid; else lo=mid+1;
    }
    return lo;
}
// END egg-manual

// BEGIN egg-standard
int egg_moves_coverage(int eggs,int floors) {
    std::vector<int> cover(eggs+1,0);
    int moves=0;
    while (cover[eggs]<floors) {
        ++moves;
        for (int e=eggs;e>=1;--e)
            cover[e]=std::min(floors,cover[e]+cover[e-1]+1);
    }
    return moves; // 另一算法：按次数增长覆盖DP，不是std提供了鸡蛋求解。
}
// END egg-standard
} // namespace binary_selection

#include <algorithm>
#include <cstdint>
#include <functional>
#include <limits>
#include <numeric>
#include <queue>
#include <utility>
#include <vector>

namespace binary_advanced {
using i64 = std::int64_t;

// BEGIN advanced-fenwick-manual
class FrequencyTree {
    int n;
    std::vector<i64> tree;
public:
    explicit FrequencyTree(int count) : n(count), tree(count + 1, 0) {}
    // pos is zero based; actual frequencies must remain nonnegative.
    void add(int pos, i64 delta) {
        for (int p = pos + 1; p <= n; p += p & -p) tree[p] += delta;
    }
    i64 prefix(int end) const { // [0,end)
        i64 answer = 0;
        for (int p = end; p > 0; p -= p & -p) answer += tree[p];
        return answer;
    }
    int kth(i64 k) const {
        if (k <= 0 || k > prefix(n)) return n;
        int accepted = 0;
        int step = 1;
        while (step <= n / 2) step *= 2;
        for (; step != 0; step /= 2) {
            int next = accepted + step;
            // accepted是2*step的倍数，故lowbit(next)=step，
            // tree[next]恰覆盖1基区间(accepted,next]，没有重叠计数。
            if (next <= n && tree[next] < k) {
                accepted = next;
                k -= tree[next]; // rank among the unaccepted suffix
            }
        }
        return accepted; // length of prefix with count < original k = answer index
    }
};

std::vector<i64> remove_by_rank(const std::vector<i64>& values,
                                const std::vector<int>& ranks) {
    FrequencyTree alive(static_cast<int>(values.size()));
    for (int i = 0; i < static_cast<int>(values.size()); ++i) alive.add(i, 1);
    std::vector<i64> answer;
    answer.reserve(ranks.size());
    for (int rank : ranks) { // 1 <= rank <= remaining size
        int position = alive.kth(rank);
        answer.push_back(values[position]);
        alive.add(position, -1);
    }
    return answer;
}
// END advanced-fenwick-manual

// BEGIN advanced-fenwick-standard
int kth_with_prefix(const std::vector<i64>& frequency, i64 k) {
    std::vector<i64> prefix(frequency.size());
    std::partial_sum(frequency.begin(), frequency.end(), prefix.begin());
    if (k <= 0) return static_cast<int>(frequency.size());
    return static_cast<int>(std::lower_bound(prefix.begin(), prefix.end(), k)
                            - prefix.begin());
}
// END advanced-fenwick-standard

// BEGIN advanced-summary-manual
class MaxTree {
    int n, base = 1;
    std::vector<i64> tree;
    int descend(int node, int left, int right, int start, i64 target) const {
        if (right <= start || left >= n || tree[node] < target) return n;
        if (right - left == 1) return left;
        int mid = left + (right - left) / 2;
        int found = descend(node * 2, left, mid, start, target);
        if (found != n) return found; // leftmost eligible leaf has priority
        return descend(node * 2 + 1, mid, right, start, target);
    }
public:
    explicit MaxTree(const std::vector<i64>& values) : n(static_cast<int>(values.size())) {
        while (base < n) base *= 2;
        tree.assign(base * 2, std::numeric_limits<i64>::lowest());
        std::copy(values.begin(), values.end(), tree.begin() + base);
        for (int p = base - 1; p > 0; --p) tree[p] = std::max(tree[2*p], tree[2*p+1]);
    }
    void set(int position, i64 value) {
        int p = base + position;
        tree[p] = value;
        while ((p /= 2) != 0) tree[p] = std::max(tree[2*p], tree[2*p+1]);
    }
    i64 range_max(int left, int right) const { // [left,right)
        i64 answer = std::numeric_limits<i64>::lowest();
        for (left += base, right += base; left < right; left /= 2, right /= 2) {
            if (left & 1) answer = std::max(answer, tree[left++]);
            if (right & 1) answer = std::max(answer, tree[--right]);
        }
        return answer;
    }
    int first_at_least(int start, i64 target) const { // absent => n
        return descend(1, 0, base, start, target);
    }
};
// END advanced-summary-manual

// BEGIN advanced-summary-standard
int first_at_least_linear(const std::vector<i64>& values, int start, i64 target) {
    auto found = std::find_if(values.begin() + start, values.end(),
                             [target](i64 value) { return value >= target; });
    return static_cast<int>(found - values.begin());
}
// END advanced-summary-standard

// BEGIN advanced-ancestor-manual
class Ancestors {
    std::vector<std::vector<int>> up;
    std::vector<int> depth;
public:
    // Nonempty rooted tree: parent[0]=0, and parent[v]<v for v>0.
    explicit Ancestors(const std::vector<int>& parent) : depth(parent.size(), 0) {
        int levels = 1, n = static_cast<int>(parent.size());
        while ((i64{1} << levels) <= n) ++levels;
        up.assign(levels, std::vector<int>(n));
        up[0] = parent;
        for (int v = 1; v < n; ++v) depth[v] = depth[parent[v]] + 1;
        for (int b = 1; b < levels; ++b)
            for (int v = 0; v < n; ++v) up[b][v] = up[b-1][up[b-1][v]];
    }
    int kth(int v, i64 steps) const {
        if (steps < 0 || steps > depth[v]) return -1;
        for (int b = 0; steps != 0; ++b, steps >>= 1)
            if (steps & 1) v = up[b][v];
        return v;
    }
    int lca(int a, int b) const {
        if (depth[a] < depth[b]) std::swap(a, b);
        a = kth(a, depth[a] - depth[b]);
        if (a == b) return a;
        for (int power = static_cast<int>(up.size()) - 1; power >= 0; --power)
            if (up[power][a] != up[power][b]) {
                a = up[power][a]; b = up[power][b];
            } // accept a jump only while the two ancestors remain distinct
        return up[0][a];
    }
};
// END advanced-ancestor-manual

// BEGIN advanced-ancestor-standard
int lca_with_find(const std::vector<int>& parent, int a, int b) {
    std::vector<int> chain;
    for (int v = a;; v = parent[v]) {
        chain.push_back(v);
        if (v == parent[v]) break;
    }
    for (int v = b;; v = parent[v]) {
        if (std::find(chain.begin(), chain.end(), v) != chain.end()) return v;
        if (v == parent[v]) return -1;
    }
}
// END advanced-ancestor-standard

// BEGIN advanced-ancestor-threshold
// weights[parent[v]] <= weights[v]. Query = {node, threshold}.
// Answer is the shallowest qualifying ancestor, or -1.
std::vector<int> threshold_ancestor_queries(
        const std::vector<int>& parent, const std::vector<i64>& weights,
        const std::vector<std::pair<int, i64>>& queries) {
    int n = static_cast<int>(parent.size());
    std::vector<std::vector<int>> children(n);
    for (int v = 1; v < n; ++v) children[parent[v]].push_back(v);
    std::vector<std::vector<std::pair<i64,int>>> at(n);
    for (int id = 0; id < static_cast<int>(queries.size()); ++id)
        at[queries[id].first].push_back({queries[id].second, id});
    std::vector<int> answer(queries.size(), -1), path_nodes;
    std::vector<i64> path_weights;
    std::vector<std::pair<int,bool>> stack{{0,false}};
    while (!stack.empty()) {
        auto event = stack.back(); stack.pop_back();
        int v = event.first;
        if (event.second) { path_nodes.pop_back(); path_weights.pop_back(); continue; }
        path_nodes.push_back(v); path_weights.push_back(weights[v]);
        for (auto query : at[v]) {
            auto it = std::lower_bound(path_weights.begin(), path_weights.end(), query.first);
            if (it != path_weights.end()) answer[query.second] = path_nodes[it-path_weights.begin()];
        }
        stack.push_back({v,true}); // leave event restores the parent's current path
        for (auto it = children[v].rbegin(); it != children[v].rend(); ++it)
            stack.push_back({*it,false});
    }
    return answer;
}
// END advanced-ancestor-threshold

// BEGIN advanced-cyclic-core
int cyclic_min_from_successors(const std::vector<int>& next, int n) {
    int end = 2 * n, levels = 1;
    while ((i64{1} << levels) <= n) ++levels;
    std::vector<std::vector<int>> jump(levels, std::vector<int>(end + 1));
    jump[0] = next;
    for (int b = 1; b < levels; ++b)
        for (int i = 0; i <= end; ++i) jump[b][i] = jump[b-1][jump[b-1][i]];
    int answer = n;
    for (int start = 0; start < n; ++start) {
        int position = start, used = 0, target = start + n;
        for (int b = levels - 1; b >= 0; --b)
            if (jump[b][position] < target) { // remain strictly short of full coverage
                position = jump[b][position]; used += 1 << b;
            }
        answer = std::min(answer, used + 1); // one final segment reaches target
    }
    return answer;
}
// END advanced-cyclic-core

// BEGIN advanced-cyclic-manual
int min_cyclic_parts(const std::vector<i64>& values, i64 capacity) {
    int n = static_cast<int>(values.size()), end = 2*n, right = 0;
    std::vector<int> next(end + 1, end);
    i64 sum = 0;
    for (int left = 0; left < end; ++left) {
        while (right < end && values[right % n] <= capacity - sum) {
            sum += values[right % n]; ++right;
        }
        next[left] = right; // [left,right) is the farthest legal greedy segment
        sum -= values[left % n]; // positive values <=capacity ensure right>left
    }
    return cyclic_min_from_successors(next, n);
}
// END advanced-cyclic-manual

// BEGIN advanced-cyclic-standard
int min_cyclic_parts_with_bounds(const std::vector<i64>& values, i64 capacity) {
    int n = static_cast<int>(values.size()), end = 2*n;
    std::vector<i64> prefix(end + 1, 0);
    for (int i = 0; i < end; ++i) prefix[i+1] = prefix[i] + values[i % n];
    std::vector<int> next(end + 1, end);
    for (int i = 0; i < end; ++i)
        next[i] = static_cast<int>(std::upper_bound(prefix.begin()+i+1, prefix.end(),
                                                   prefix[i] + capacity) - prefix.begin()) - 1;
    return cyclic_min_from_successors(next, n);
}
// END advanced-cyclic-standard

// BEGIN advanced-pbs-standard
class DisjointSet {
    std::vector<int> parent, size;
public:
    explicit DisjointSet(int n) : parent(n), size(n,1) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        while (x != parent[x]) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
    }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (size[a] < size[b]) std::swap(a,b);
        parent[b] = a; size[a] += size[b];
    }
};
// END advanced-pbs-standard

// BEGIN advanced-pbs-manual
std::vector<int> first_connection_days(int n, const std::vector<std::pair<int,int>>& edges,
                                      const std::vector<std::pair<int,int>>& queries) {
    int m = static_cast<int>(edges.size()), q = static_cast<int>(queries.size());
    std::vector<int> low(q,-1), high(q,m+1);
    for (;;) {
        std::vector<std::vector<int>> bucket(m+1);
        bool pending = false;
        for (int id = 0; id < q; ++id) if (high[id] - low[id] > 1) {
            pending = true;
            bucket[low[id] + (high[id]-low[id])/2].push_back(id);
        }
        if (!pending) break;
        DisjointSet state(n); // no attempt to undo path compression
        for (int day = 0; day <= m; ++day) {
            if (day > 0) state.unite(edges[day-1].first, edges[day-1].second);
            for (int id : bucket[day]) {
                auto query = queries[id];
                if (state.find(query.first) == state.find(query.second)) high[id] = day;
                else low[id] = day;
            }
        }
    }
    for (int& day : high) if (day == m+1) day = -1;
    return high;
}
// END advanced-pbs-manual

// BEGIN advanced-kth-model
struct RangeOperation {
    enum class Kind { assign, query } kind;
    int left, right, k; // query uses inclusive [left,right]; assign uses left only
    i64 value;        // new value for assign
};
struct RankEvent {
    bool query;
    int left, right; // update uses left as position; query uses inclusive [left,right]
    int rank;        // query only: rank within the current candidate value interval
    int delta;       // update only: +1 insert, -1 delete
    int id, value;   // query output index; update compressed value
};
// END advanced-kth-model

// BEGIN advanced-kth-standard
std::vector<i64> compressed_values(const std::vector<i64>& initial,
                                    const std::vector<RangeOperation>& operations) {
    std::vector<i64> values = initial;
    for (const auto& op : operations)
        if (op.kind == RangeOperation::Kind::assign) values.push_back(op.value);
    std::sort(values.begin(), values.end());
    values.erase(std::unique(values.begin(), values.end()), values.end());
    return values;
}
int value_rank(const std::vector<i64>& values, i64 value) {
    return static_cast<int>(std::lower_bound(values.begin(), values.end(), value)-values.begin());
}
// END advanced-kth-standard

// BEGIN advanced-kth-manual
std::vector<i64> dynamic_range_kth(const std::vector<i64>& initial,
                                   const std::vector<RangeOperation>& operations) {
    const auto values = compressed_values(initial, operations);
    std::vector<i64> current = initial;
    std::vector<RankEvent> events;
    for (int i = 0; i < static_cast<int>(initial.size()); ++i)
        events.push_back({false,i,i,0,1,-1,value_rank(values,initial[i])});
    int queries = 0;
    for (const auto& op : operations) {
        if (op.kind == RangeOperation::Kind::assign) {
            if (current[op.left] == op.value) continue;
            events.push_back({false,op.left,op.left,0,-1,-1,value_rank(values,current[op.left])});
            events.push_back({false,op.left,op.left,0,1,-1,value_rank(values,op.value)});
            current[op.left] = op.value; // the next assignment must delete this value
        } else events.push_back({true,op.left,op.right,op.k,0,queries++,0});
    }
    std::vector<i64> answer(queries);
    if (queries == 0) return answer;
    std::vector<RankEvent> scratch(events.size());
    std::vector<unsigned char> goes_left(events.size());
    FrequencyTree count(static_cast<int>(initial.size()));
    std::function<void(int,int,int,int)> solve = [&](int lo, int hi, int begin, int end) {
        if (begin == end) return;
        if (lo == hi) {
            for (int i = begin; i < end; ++i)
                if (events[i].query) answer[events[i].id] = values[lo];
            return;
        }
        int mid = lo + (hi-lo)/2, left_count = 0;
        for (int i = begin; i < end; ++i) {
            auto& event = events[i];
            bool left;
            if (!event.query) {
                left = event.value <= mid;
                if (left) count.add(event.left,event.delta);
            } else {
                i64 smaller = count.prefix(event.right+1)-count.prefix(event.left);
                left = event.rank <= smaller;
                if (!left) event.rank -= static_cast<int>(smaller); // residual rank
            }
            goes_left[i] = static_cast<unsigned char>(left);
            left_count += left;
        }
        // Reverse replay restores actual earlier states, including nonnegative frequencies.
        // No query from either child is allowed before this node is fully undone.
        for (int i = end-1; i >= begin; --i)
            if (!events[i].query && goes_left[i]) count.add(events[i].left,-events[i].delta);
        int l = begin, r = begin+left_count;
        for (int i = begin; i < end; ++i)
            scratch[goes_left[i] ? l++ : r++] = events[i]; // stable in each child
        std::copy(scratch.begin()+begin,scratch.begin()+end,events.begin()+begin);
        solve(lo,mid,begin,begin+left_count);
        solve(mid+1,hi,begin+left_count,end);
    };
    solve(0,static_cast<int>(values.size())-1,0,static_cast<int>(events.size()));
    return answer;
}
// END advanced-kth-manual

// BEGIN advanced-penalty-manual
struct MarginalResult {
    i64 value, cutoff, strict_count, equal_count, used_count, penalized_value;
};
MarginalResult maximize_fun(const std::vector<i64>& initial, i64 budget) {
    i64 total = 0, maximum = 0;
    for (i64 value : initial) { total += value; maximum = std::max(maximum,value); }
    i64 used = std::min(budget,total);
    if (used == 0) return {0,0,0,0,0,0};
    auto enough = [&](i64 threshold) {
        i64 count = 0;
        for (i64 value : initial) {
            count += std::max<i64>(0,value-threshold+1);
            if (count >= used) return true; // count only, never total all rewards here
        }
        return false;
    };
    i64 low = 1, high = maximum+1;
    while (high-low > 1) {
        i64 mid = low+(high-low)/2;
        if (enough(mid)) low = mid;
        else high = mid;
    }
    i64 strict = 0, equal = 0, penalized = 0;
    for (i64 value : initial) {
        i64 count = std::max<i64>(0,value-low);
        strict += count;
        equal += value >= low;
        penalized += count*(count+1)/2; // safe at final cutoff, not at arbitrary lambda
    }
    return {penalized+low*used,low,strict,equal,used,penalized};
}
// END advanced-penalty-manual

// BEGIN advanced-penalty-standard
i64 fun_with_priority_queue(const std::vector<i64>& initial, i64 budget) {
    std::priority_queue<i64> available(initial.begin(),initial.end());
    i64 answer = 0;
    while (budget-- > 0 && !available.empty() && available.top() > 0) {
        i64 value = available.top(); available.pop();
        answer += value;
        available.push(value-1);
    }
    return answer;
}
// END advanced-penalty-standard
} // namespace binary_advanced
