#include <algorithm>
#include <functional>
#include <limits>
#include <numeric>
#include <vector>
using namespace std;
using ll = long long;

// BEGIN predicate
template<class F>
ll first_true(ll l, ll r, F can) { // 闭区间 [l,r] 内保证有解；r-l 可用 ll 表示
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (can(m)) r = m;
        else l = m + 1;
    }
    return l;
}
template<class F>
ll last_true(ll l, ll r, F can) { // 闭区间 [l,r] 内保证有解；r-l 可用 ll 表示
    while (l < r) {
        ll d = r - l;
        ll m = l + d / 2 + d % 2; // 向上取整，但不计算 d+1
        if (can(m)) l = m;
        else r = m - 1;
    }
    return l;
}
// END predicate

// BEGIN lower
int lower_index(const vector<int>& a, int x) {
    int l = 0, r = (int)a.size();
    while (l < r) {
        int m = l + (r - l) / 2;
        if (a[m] >= x) r = m;
        else l = m + 1;
    }
    return l;
}
// END lower

// BEGIN upper
int upper_index(const vector<int>& a, int x) {
    int l = 0, r = (int)a.size();
    while (l < r) {
        int m = l + (r - l) / 2;
        if (a[m] > x) r = m;
        else l = m + 1;
    }
    return l;
}
// END upper

// BEGIN missing
ll kth_missing_positive(const vector<int>& a, ll k) {
    int l = 0, r = (int)a.size();
    while (l < r) {
        int m = l + (r - l) / 2;
        if ((ll)a[m] - m - 1 >= k) r = m;
        else l = m + 1;
    }
    return l + k;
}
// END missing

// BEGIN closest
int closest_window_left(const vector<int>& a, int k, int x) {
    int l = 0, r = (int)a.size() - k;
    while (l < r) {
        int m = l + (r - l) / 2;
        if ((ll)x - a[m] > (ll)a[m + k] - x) l = m + 1;
        else r = m;
    }
    return l;  // 选取 a[l .. l+k-1]
}
// END closest

// BEGIN rotated-min
int rotated_min_index(const vector<int>& a) {
    int l = 0, r = (int)a.size() - 1;
    while (l < r) {
        int m = l + (r - l) / 2;
        if (a[m] > a[r]) l = m + 1;
        else if (a[m] < a[r]) r = m;
        else --r;
    }
    return l;
}
// END rotated-min

// BEGIN rotated-search
int rotated_search(const vector<int>& a, int x) {
    int l = 0, r = (int)a.size() - 1;
    while (l <= r) {
        int m = l + (r - l) / 2;
        if (a[m] == x) return m;
        if (a[l] == a[m] && a[m] == a[r]) {
            ++l; --r;
        } else if (a[l] <= a[m]) {           // 左半有序
            if (a[l] <= x && x < a[m]) r = m - 1;
            else l = m + 1;
        } else {                            // 右半有序
            if (a[m] < x && x <= a[r]) l = m + 1;
            else r = m - 1;
        }
    }
    return -1;
}
// END rotated-search

// BEGIN peak
int peak_index(const vector<int>& a) {
    int l = 0, r = (int)a.size() - 1;
    while (l < r) {
        int m = l + (r - l) / 2;
        if (a[m] < a[m + 1]) l = m + 1;
        else r = m;
    }
    return l;
}
// END peak

// BEGIN mountain
int mountain_search(const vector<int>& a, int x) {
    int p = peak_index(a);
    auto it = lower_bound(a.begin(), a.begin() + p + 1, x);
    if (it != a.begin() + p + 1 && *it == x)
        return (int)(it - a.begin());
    it = lower_bound(a.begin() + p + 1, a.end(), x, greater<int>());
    return it != a.end() && *it == x ? (int)(it - a.begin()) : -1;
}
// END mountain

// BEGIN singleton
int single_unpaired(const vector<int>& a) {
    int l = 0, r = (int)a.size() - 1;
    while (l < r) {
        int m = l + (r - l) / 2;
        if (a[m] == a[m ^ 1]) l = m + 1;
        else r = m;
    }
    return a[l];
}
// END singleton

// BEGIN flat-matrix
bool flat_matrix_search(const vector<vector<int>>& a, int x) {
    int rows = (int)a.size(), cols = (int)a[0].size();
    ll l = 0, r = (ll)rows * cols;
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (a[m / cols][m % cols] >= x) r = m;
        else l = m + 1;
    }
    return l < (ll)rows * cols && a[l / cols][l % cols] == x;
}
// END flat-matrix

// BEGIN row-matrix
bool row_matrix_search(const vector<vector<int>>& a, int x) {
    for (const auto& row : a)
        if (binary_search(row.begin(), row.end(), x)) return true;
    return false;
}
// END row-matrix

// BEGIN staircase
bool matrix_staircase(const vector<vector<int>>& a, int x) {
    int i = 0, j = (int)a[0].size() - 1;
    while (i < (int)a.size() && j >= 0) {
        if (a[i][j] == x) return true;
        if (a[i][j] > x) --j;
        else ++i;
    }
    return false;
}
// END staircase

// BEGIN two-sorted
ll kth_two_sorted(const vector<int>& a, const vector<int>& b, int k) {
    if (a.size() > b.size()) return kth_two_sorted(b, a, k);
    int m = (int)a.size(), n = (int)b.size();
    int l = max(0, k - n), r = min(k, m);
    while (true) {
        int i = l + (r - l) / 2, j = k - i;
        ll al = i ? a[i - 1] : numeric_limits<ll>::lowest();
        ll ar = i < m ? a[i] : numeric_limits<ll>::max();
        ll bl = j ? b[j - 1] : numeric_limits<ll>::lowest();
        ll br = j < n ? b[j] : numeric_limits<ll>::max();
        if (al > br) r = i - 1;        // a 左侧取多了
        else if (bl > ar) l = i + 1;   // a 左侧取少了
        else return max(al, bl);
    }
}
// END two-sorted

// BEGIN segments
int segments_needed(const vector<int>& a, ll cap) {
    int count = 1;
    ll sum = 0;
    for (int x : a) {
        if (sum + x > cap) { ++count; sum = x; }
        else sum += x;
    }
    return count;
}
ll min_split_cap(const vector<int>& a, int k) {
    ll l = *max_element(a.begin(), a.end());
    ll r = accumulate(a.begin(), a.end(), 0LL);
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (segments_needed(a, m) <= k) r = m;
        else l = m + 1;
    }
    return l;
}
// END segments

// BEGIN spacing
bool can_place(const vector<int>& pos, int k, ll gap) {
    int count = 1;
    ll last = pos[0];
    for (int i = 1; i < (int)pos.size(); ++i) {
        if ((ll)pos[i] - last >= gap) {
            last = pos[i];
            if (++count == k) return true;
        }
    }
    return false;
}
ll max_min_gap(vector<int> pos, int k) {
    sort(pos.begin(), pos.end());
    ll l = 0, r = (ll)pos.back() - pos.front();
    while (l < r) {
        ll m = l + (r - l + 1) / 2;    // 向上取中点
        if (can_place(pos, k, m)) l = m;
        else r = m - 1;
    }
    return l;
}
// END spacing

// BEGIN rate
ll min_rate(const vector<int>& a, ll hours) {
    auto can = [&](ll rate) {
        ll used = 0;
        for (int x : a) used += (x - 1) / rate + 1;
        return used <= hours;
    };
    ll l = 1, r = *max_element(a.begin(), a.end());
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (can(m)) r = m;
        else l = m + 1;
    }
    return l;
}
// END rate

// BEGIN pieces
ll max_piece(const vector<int>& a, ll k) {
    auto can = [&](ll length) {
        ll count = 0;
        for (int x : a) count += x / length;
        return count >= k;
    };
    ll l = 1, r = (ll)*max_element(a.begin(), a.end()) + 1;
    while (l < r) {                    // 找第一个不可行长度
        ll m = l + (r - l) / 2;
        if (can(m)) l = m + 1;
        else r = m;
    }
    return l - 1;                      // 无可行正长度时为 0
}
// END pieces

// BEGIN bags
ll min_bag_limit(const vector<int>& a, ll operations) {
    auto can = [&](ll limit) {
        ll used = 0;
        for (int x : a) used += (x - 1) / limit;
        return used <= operations;
    };
    ll l = 1, r = *max_element(a.begin(), a.end());
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (can(m)) r = m;
        else l = m + 1;
    }
    return l;
}
// END bags

// BEGIN production
ll min_production_time(const vector<int>& times, ll target) {
    auto can = [&](ll time) {
        ll count = 0;
        for (int t : times) {
            count += time / t;
            if (count >= target) return true;
        }
        return false;
    };
    ll l = 1, r = (ll)*min_element(times.begin(), times.end()) * target;
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (can(m)) r = m;
        else l = m + 1;
    }
    return l;
}
// END production

// BEGIN bloom
int min_bloom_day(const vector<int>& days, int bouquets, int size) {
    if ((ll)bouquets * size > (ll)days.size()) return -1;
    auto can = [&](int day) {
        int run = 0, count = 0;
        for (int d : days) {
            if (d > day) run = 0;
            else if (++run == size) { run = 0; ++count; }
        }
        return count >= bouquets;
    };
    int l = *min_element(days.begin(), days.end());
    int r = *max_element(days.begin(), days.end());
    while (l < r) {
        int m = l + (r - l) / 2;
        if (can(m)) r = m;
        else l = m + 1;
    }
    return l;
}
// END bloom

// BEGIN matrix-count
ll matrix_le_count(const vector<vector<int>>& a, ll x) {
    ll count = 0;
    int i = 0, j = (int)a[0].size() - 1;
    while (i < (int)a.size() && j >= 0) {
        if (a[i][j] <= x) { count += j + 1; ++i; }
        else --j;
    }
    return count;
}
ll kth_matrix_value(const vector<vector<int>>& a, ll k) {
    ll l = a[0][0], r = a.back().back();
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (matrix_le_count(a, m) >= k) r = m;
        else l = m + 1;
    }
    return l;
}
// END matrix-count

// BEGIN multiplication-count
ll multiplication_le_count(int rows, int cols, ll x) {
    ll count = 0;
    for (ll i = 1; i <= rows; ++i) count += min((ll)cols, x / i);
    return count;
}
ll kth_multiplication_value(int rows, int cols, ll k) {
    if (rows > cols) swap(rows, cols);
    ll l = 1, r = (ll)rows * cols;
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (multiplication_le_count(rows, cols, m) >= k) r = m;
        else l = m + 1;
    }
    return l;
}
// END multiplication-count

// BEGIN pair-count
ll pair_distance_count(const vector<int>& a, ll d) {
    ll count = 0;
    int l = 0;
    for (int r = 0; r < (int)a.size(); ++r) {
        while ((ll)a[r] - a[l] > d) ++l;
        count += r - l;
    }
    return count;
}
ll kth_pair_distance(vector<int> a, ll k) {
    sort(a.begin(), a.end());
    ll l = 0, r = (ll)a.back() - a.front();
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (pair_distance_count(a, m) >= k) r = m;
        else l = m + 1;
    }
    return l;
}
// END pair-count

// BEGIN sqrt
ll integer_sqrt(ll x) {
    ll l = 0, r = min(x, 3037000499LL); // sqrt(LLONG_MAX) 向下取整
    while (l < r) {
        ll m = l + (r - l + 1) / 2;
        if (m <= x / m) l = m;
        else r = m - 1;
    }
    return l;
}
// END sqrt

// BEGIN expand
template<class F>
ll expand_first(ll cap, F can) {
    ll r = 1;
    while (r < cap && !can(r)) r = r > cap / 2 ? cap : r * 2;
    if (!can(r)) return cap + 1;
    ll l = 0;
    while (l < r) {
        ll m = l + (r - l) / 2;
        if (can(m)) r = m;
        else l = m + 1;
    }
    return l;
}
// END expand

// BEGIN real-boundary
template<class F>
double real_first(double l, double r, F can) {
    for (int i = 0; i < 80; ++i) {
        double m = l + (r - l) / 2;
        if (can(m)) r = m;
        else l = m;
    }
    return r;
}
// END real-boundary

// BEGIN root
template<class F>
double bracket_root(double l, double r, F f) {
    double fl = f(l), fr = f(r);
    if (fl == 0) return l;
    if (fr == 0) return r;
    for (int i = 0; i < 80; ++i) {
        double m = l + (r - l) / 2, fm = f(m);
        if (fm == 0) return m;
        if ((fl < 0) == (fm < 0)) { l = m; fl = fm; }
        else r = m;
    }
    return l + (r - l) / 2;
}
// END root

#include <algorithm>
#include <array>
#include <climits>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace binary_foundations {
using namespace std;
using ll = long long;

// BEGIN fixed-point
int fixed_point_distinct(const vector<int>& a) {
    int l = 0, r = (int)a.size();
    while (l < r) {
        int m = l + (r - l) / 2;
        if ((ll)a[m] >= m) r = m;
        else l = m + 1;
    }
    return l < (int)a.size() && a[l] == l ? l : -1;
}
// END fixed-point

// BEGIN prefix-range
pair<int, int> prefix_range(const vector<string>& words, string_view prefix) {
    auto part = [&](int i) { return string_view(words[i]).substr(0, prefix.size()); };
    int l = 0, r = (int)words.size();
    while (l < r) {
        int m = l + (r - l) / 2;
        if (part(m) < prefix) l = m + 1;
        else r = m;
    }
    int first = l;
    r = (int)words.size();
    while (l < r) {
        int m = l + (r - l) / 2;
        if (part(m) <= prefix) l = m + 1;
        else r = m;
    }
    return {first, l};
}
// END prefix-range

// BEGIN h-index
int h_index_sorted(const vector<int>& citations) {
    int n = (int)citations.size(), l = 0, r = n;
    while (l < r) {
        int m = l + (r - l) / 2;
        if (citations[m] >= n - m) r = m;
        else l = m + 1;
    }
    return n - l;
}
// END h-index

// BEGIN prefix-budget
vector<ll> prefix_sums(const vector<int>& a) {
    vector<ll> sum(a.size() + 1, 0);
    for (int i = 0; i < (int)a.size(); ++i) sum[i + 1] = sum[i] + a[i];
    return sum;
}

// sum[0]=0，原数组非负。找最早使前k项和>=target的k；不存在返回-1。
int first_prefix_at_least(const vector<ll>& sum, ll target) {
    auto it = lower_bound(sum.begin(), sum.end(), target);
    return it == sum.end() ? -1 : (int)(it - sum.begin());
}

// 可任意选元素，只最大化数量：先排序生成最小成本的各长度前缀。
vector<ll> sorted_cost_prefix(vector<int> costs) {
    sort(costs.begin(), costs.end());
    return prefix_sums(costs);
}

// costs非负，budget>=0；等于预算也能取，所以用upper_bound。
int max_items_with_budget(const vector<ll>& sorted_sum, ll budget) {
    return (int)(upper_bound(sorted_sum.begin(), sorted_sum.end(), budget)
                 - sorted_sum.begin()) - 1;
}
// END prefix-budget

// BEGIN prefix-subarray
int min_nonnegative_subarray_len(const vector<int>& a, ll target) {
    vector<ll> sum = prefix_sums(a);
    int n = (int)a.size(), answer = n + 1;
    for (int l = 0; l < n; ++l) {
        auto it = lower_bound(sum.begin() + l + 1, sum.end(), sum[l] + target);
        if (it != sum.end()) answer = min(answer, (int)(it - sum.begin()) - l);
    }
    return answer == n + 1 ? 0 : answer;
}
// END prefix-subarray

// BEGIN lis-length
int lis_length(const vector<int>& a, bool non_decreasing = false) {
    vector<int> tail;
    for (int x : a) {
        auto it = non_decreasing ? upper_bound(tail.begin(), tail.end(), x)
                                 : lower_bound(tail.begin(), tail.end(), x);
        if (it == tail.end()) tail.push_back(x);
        else *it = x;
    }
    return (int)tail.size();
}
// END lis-length

// BEGIN lis-restore
vector<int> lis_indices(const vector<int>& a, bool non_decreasing = false) {
    vector<int> tail, end_index, previous(a.size(), -1);
    for (int i = 0; i < (int)a.size(); ++i) {
        auto it = non_decreasing ? upper_bound(tail.begin(), tail.end(), a[i])
                                 : lower_bound(tail.begin(), tail.end(), a[i]);
        int k = (int)(it - tail.begin());
        if (k > 0) previous[i] = end_index[k - 1];
        if (it == tail.end()) {
            tail.push_back(a[i]);
            end_index.push_back(i);
        } else {
            *it = a[i];
            end_index[k] = i;
        }
    }
    vector<int> answer;
    for (int i = end_index.empty() ? -1 : end_index.back(); i != -1; i = previous[i])
        answer.push_back(i);
    reverse(answer.begin(), answer.end());
    return answer;
}
// END lis-restore

// BEGIN peak-2d
pair<int, int> peak2d(const vector<vector<int>>& a) {
    int rows = (int)a.size(), cols = (int)a[0].size();
    int l = 0, r = cols - 1;
    while (l <= r) {
        int m = l + (r - l) / 2, row = 0;
        for (int i = 1; i < rows; ++i)
            if (a[i][m] > a[row][m]) row = i;
        if (m > 0 && a[row][m - 1] > a[row][m]) r = m - 1;
        else if (m + 1 < cols && a[row][m + 1] > a[row][m]) l = m + 1;
        else return {row, m};
    }
    return {-1, -1};
}
// END peak-2d

// BEGIN subsequence-positions
using Positions = array<vector<int>, 256>;

Positions build_positions(string_view source) {
    Positions pos;
    for (int i = 0; i < (int)source.size(); ++i)
        pos[(unsigned char)source[i]].push_back(i);
    return pos;
}

optional<vector<int>> subsequence_positions(const Positions& pos, string_view query) {
    vector<int> chosen;
    int last = -1;
    for (unsigned char c : query) {
        const auto& positions = pos[c];
        auto it = upper_bound(positions.begin(), positions.end(), last);
        if (it == positions.end()) return nullopt;
        chosen.push_back(last = *it);
    }
    return chosen;
}
// END subsequence-positions

// BEGIN unknown-reader
// read(i)返回optional<ll>；nullopt代表越界，合法值按索引非降。
template<class Reader>
optional<ll> unknown_lower_index(Reader read, ll target, ll index_cap = LLONG_MAX) {
    auto value = read(0);
    if (!value) return nullopt;
    if (*value >= target) return 0;
    ll l = 0, r = 0;
    while (r < index_cap) {
        l = r + 1;
        r = r >= (index_cap - 1) / 2 ? index_cap : 2 * r + 1;
        value = read(r);
        if (!value || *value >= target) break;
    }
    if (value && *value < target) return nullopt;
    while (l < r) {
        ll m = l + (r - l) / 2;
        value = read(m);
        if (!value || *value >= target) r = m;
        else l = m + 1;
    }
    return read(l) ? optional<ll>(l) : nullopt;
}

template<class Reader>
optional<ll> search_unknown(Reader read, ll target, ll index_cap = LLONG_MAX) {
    auto index = unknown_lower_index(read, target, index_cap);
    return index && *read(*index) == target ? index : nullopt;
}
// END unknown-reader

} // namespace binary_foundations

#include <algorithm>
#include <string>
#include <vector>

namespace binary_census_base {
using namespace std;
using ll = long long;

// BEGIN census-nested-digits
// Sk是十进制1..k的拼接，整个序列为S1S2S3...；位置从1开始。
struct NestedDigitSequence {
    vector<ll> digit_prefix{0}, block_prefix{0};

    // 1<=max_position<=2147483647，构建到足以覆盖该位置。
    explicit NestedDigitSequence(ll max_position = 2147483647LL) {
        int width = 1, next_power = 10;
        for (int k = 1; block_prefix.back() < max_position; ++k) {
            if (k == next_power) { ++width; next_power *= 10; }
            digit_prefix.push_back(digit_prefix.back() + width);
            block_prefix.push_back(block_prefix.back() + digit_prefix.back());
        }
    }

    char at(ll position) const { // 1<=position<=构建时的max_position
        auto block = lower_bound(block_prefix.begin() + 1, block_prefix.end(), position);
        int k = (int)(block - block_prefix.begin());
        ll inside = position - block_prefix[k - 1];
        auto end = digit_prefix.begin() + k + 1;
        auto found = lower_bound(digit_prefix.begin() + 1, end, inside);
        int number = (int)(found - digit_prefix.begin());
        int offset = (int)(inside - digit_prefix[number - 1] - 1);
        return to_string(number)[offset];
    }
};
// END census-nested-digits

// BEGIN census-matrix-square
// 非空矩形，各行各列非降；求全部元素都在[low,high]的最大正方形边长。
int largest_square_in_range(const vector<vector<int>>& a, int low, int high) {
    int rows = (int)a.size(), cols = (int)a[0].size(), best = 0;
    for (int r = 0; r < rows; ++r) {
        int c = (int)(lower_bound(a[r].begin(), a[r].end(), low) - a[r].begin());
        while (r + best < rows && c + best < cols && a[r + best][c + best] <= high)
            ++best;
    }
    return best;
}
// END census-matrix-square

} // namespace binary_census_base
