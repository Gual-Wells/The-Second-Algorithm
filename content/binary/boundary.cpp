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
// END boundary-ordered-manual

// BEGIN boundary-ordered-standard
std::pair<std::size_t, std::size_t>
equal_standard(const std::vector<int>& a, int key) {
    const auto range = std::equal_range(a.begin(), a.end(), key);
    return {static_cast<std::size_t>(range.first - a.begin()),
            static_cast<std::size_t>(range.second - a.begin())};
}
std::optional<std::string> time_standard(const std::vector<TimedValue>& a, int query) {
    // upper_bound比较方向是comp(value, element)，不同于lower_bound。
    auto it = std::upper_bound(a.begin(), a.end(), query,
        [](int time, const TimedValue& entry) { return time < entry.time; });
    if (it == a.begin()) return std::nullopt;
    return std::prev(it)->value;
}
// END boundary-ordered-standard

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
// END boundary-transformed-manual

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
// END boundary-prefix-manual

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
std::size_t lcp_standard(std::string_view a, std::string_view b) {
    return static_cast<std::size_t>(std::mismatch(a.begin(), a.end(), b.begin(), b.end()).first - a.begin());
}
// END boundary-prefix-standard

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
