#include <algorithm>
#include <array>
#include <cstdint>
#include <deque>
#include <limits>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace second_algorithm::contiguous {
using i64 = long long;

// BEGIN prefix-sum
std::vector<i64> prefix_sum(const std::vector<int>& a) {
    std::vector<i64> p(a.size() + 1, 0);
    for (std::size_t i = 0; i < a.size(); ++i) p[i + 1] = p[i] + a[i];
    return p;
}
i64 interval_sum(const std::vector<i64>& p, int l, int r) {
    return p[r] - p[l];                       // [l,r)
}
// END prefix-sum

// BEGIN prefix-xor
std::vector<unsigned> prefix_xor(const std::vector<int>& a) {
    std::vector<unsigned> p(a.size() + 1, 0);
    for (std::size_t i = 0; i < a.size(); ++i)
        p[i + 1] = p[i] ^ static_cast<unsigned>(a[i]);
    return p;
}
unsigned interval_xor(const std::vector<unsigned>& p, int l, int r) {
    return p[r] ^ p[l];
}
// END prefix-xor

// BEGIN fixed-sum
std::vector<i64> fixed_window_sums(const std::vector<int>& a, int k) {
    const int n = static_cast<int>(a.size());
    if (k <= 0 || k > n) return {};
    std::vector<i64> result;
    result.reserve(n - k + 1);
    i64 sum = 0;
    for (int r = 0; r < n; ++r) {
        sum += a[r];
        if (r >= k) sum -= a[r - k];
        if (r + 1 >= k) result.push_back(sum);
    }
    return result;
}
// END fixed-sum

// BEGIN fixed-distinct
std::vector<int> fixed_window_distinct(const std::vector<int>& a, int k) {
    const int n = static_cast<int>(a.size());
    if (k <= 0 || k > n) return {};
    std::unordered_map<int, int> count;
    std::vector<int> result;
    for (int r = 0; r < n; ++r) {
        ++count[a[r]];
        if (r >= k) {
            auto it = count.find(a[r - k]);
            if (--it->second == 0) count.erase(it);
        }
        if (r + 1 >= k) result.push_back(static_cast<int>(count.size()));
    }
    return result;
}
// END fixed-distinct

// BEGIN fixed-composition
std::optional<i64> max_distinct_window_sum(const std::vector<int>& a, int k) {
    const int n = static_cast<int>(a.size());
    if (k <= 0 || k > n) return std::nullopt;
    std::unordered_map<int, int> count;
    i64 sum = 0;
    std::optional<i64> best;
    for (int r = 0; r < n; ++r) {
        sum += a[r];
        ++count[a[r]];
        if (r >= k) {
            sum -= a[r - k];
            auto it = count.find(a[r - k]);
            if (--it->second == 0) count.erase(it);
        }
        if (r + 1 >= k && static_cast<int>(count.size()) == k)
            if (!best || sum > *best) best = sum;
    }
    return best;
}
// END fixed-composition

// BEGIN fixed-anagrams
std::vector<int> anagram_starts(std::string_view s, std::string_view pattern) {
    const int n = static_cast<int>(s.size());
    const int k = static_cast<int>(pattern.size());
    if (k == 0 || k > n) return {};
    std::array<int, 256> need{};
    for (unsigned char ch : pattern) ++need[ch];
    int missing = k;
    std::vector<int> result;
    for (int r = 0; r < n; ++r) {
        if (--need[static_cast<unsigned char>(s[r])] >= 0) --missing;
        if (r >= k)
            if (++need[static_cast<unsigned char>(s[r - k])] > 0) ++missing;
        if (r + 1 >= k && missing == 0) result.push_back(r - k + 1);
    }
    return result;
}
// END fixed-anagrams

// BEGIN prefix-count
i64 count_sum(const std::vector<int>& a, i64 target) {
    std::unordered_map<i64, i64> frequency;
    frequency[0] = 1;                         // 空前缀，不是空子数组
    i64 p = 0, answer = 0;
    for (int value : a) {
        p += value;
        auto it = frequency.find(p - target);
        if (it != frequency.end()) answer += it->second;
        ++frequency[p];                      // 查询后才记入当前前缀
    }
    return answer;
}
// END prefix-count

// BEGIN prefix-position
int longest_sum(const std::vector<int>& a, i64 target) {
    std::unordered_map<i64, int> first;
    first[0] = 0;
    i64 p = 0;
    int answer = 0;
    for (int r = 1; r <= static_cast<int>(a.size()); ++r) {
        p += a[r - 1];
        auto it = first.find(p - target);
        if (it != first.end()) answer = std::max(answer, r - it->second);
        first.emplace(p, r);                 // 相同状态只留最早位置
    }
    return answer;
}
int shortest_exact_sum(const std::vector<int>& a, i64 target) {
    std::unordered_map<i64, int> last;
    last[0] = 0;
    i64 p = 0;
    int answer = 0;
    for (int r = 1; r <= static_cast<int>(a.size()); ++r) {
        p += a[r - 1];
        auto it = last.find(p - target);
        if (it != last.end()) {
            const int length = r - it->second;
            if (answer == 0 || length < answer) answer = length;
        }
        last[p] = r;                         // 求最短改为最近位置
    }
    return answer;                           // 0 表示没有非空解
}
// END prefix-position

// BEGIN remainder-state
i64 count_divisible_sum(const std::vector<int>& a, int modulus) {
    if (modulus <= 0) return 0;
    std::unordered_map<int, i64> frequency;
    frequency[0] = 1;
    i64 p = 0, answer = 0;
    for (int value : a) {
        p += value;
        int residue = static_cast<int>(p % modulus);
        if (residue < 0) residue += modulus;
        answer += frequency[residue];
        ++frequency[residue];
    }
    return answer;
}
// END remainder-state

// BEGIN balance-state
int longest_balanced_binary(const std::vector<int>& a) {
    std::unordered_map<int, int> first;
    first[0] = 0;
    int balance = 0, answer = 0;
    for (int r = 1; r <= static_cast<int>(a.size()); ++r) {
        balance += a[r - 1] == 0 ? -1 : 1;    // 前提：只有 0、1
        auto [it, inserted] = first.emplace(balance, r);
        if (!inserted) answer = std::max(answer, r - it->second);
    }
    return answer;
}
// END balance-state

// BEGIN longest-distinct
int longest_distinct(const std::vector<int>& a) {
    std::unordered_map<int, int> last;
    int left = 0, answer = 0;
    for (int r = 0; r < static_cast<int>(a.size()); ++r) {
        auto it = last.find(a[r]);
        if (it != last.end()) left = std::max(left, it->second + 1);
        last[a[r]] = r;
        answer = std::max(answer, r - left + 1);
    }
    return answer;
}
// END longest-distinct

// BEGIN at-most-distinct
struct WindowStats { i64 count; int longest; };
WindowStats at_most_distinct(const std::vector<int>& a, int k) {
    if (k <= 0) return {0, 0};
    std::unordered_map<int, int> frequency;
    WindowStats answer{0, 0};
    int left = 0;
    for (int r = 0; r < static_cast<int>(a.size()); ++r) {
        ++frequency[a[r]];
        while (static_cast<int>(frequency.size()) > k) {
            auto it = frequency.find(a[left++]);
            if (--it->second == 0) frequency.erase(it);
        }
        const int length = r - left + 1;
        answer.count += length;              // 所有 [l,r]，left<=l<=r
        answer.longest = std::max(answer.longest, length);
    }
    return answer;
}
i64 exactly_distinct(const std::vector<int>& a, int k) {
    if (k <= 0) return 0;
    return at_most_distinct(a, k).count - at_most_distinct(a, k - 1).count;
}
// END at-most-distinct

// BEGIN nonnegative-sum-count
i64 count_sum_at_most(const std::vector<int>& a, i64 limit) {
    if (limit < 0) return 0;                  // 前提：a[i]>=0
    int left = 0;
    i64 sum = 0, answer = 0;
    for (int r = 0; r < static_cast<int>(a.size()); ++r) {
        sum += a[r];
        while (sum > limit) sum -= a[left++];
        answer += r - left + 1;
    }
    return answer;
}
i64 count_nonnegative_sum(const std::vector<int>& a, i64 target) {
    if (target < 0) return 0;
    return count_sum_at_most(a, target) - count_sum_at_most(a, target - 1);
}
// END nonnegative-sum-count

// BEGIN nonnegative-shortest
int shortest_nonnegative_sum(const std::vector<int>& a, i64 target) {
    // 非空段；target<=0时，非空非负数组的任一单元素已满足。
    if (target <= 0) return a.empty() ? 0 : 1;
    int left = 0, answer = 0;
    i64 sum = 0;
    for (int r = 0; r < static_cast<int>(a.size()); ++r) {
        sum += a[r];
        while (sum >= target) {
            const int length = r - left + 1;
            if (answer == 0 || length < answer) answer = length;
            sum -= a[left++];
        }
    }
    return answer;
}
// END nonnegative-shortest

// BEGIN minimum-cover
std::string minimum_cover(std::string_view s, std::string_view pattern) {
    if (pattern.empty()) return {};
    std::array<int, 256> need{};
    for (unsigned char ch : pattern) ++need[ch];
    int missing = static_cast<int>(pattern.size());
    int left = 0, best_left = -1, best_length = 0;
    for (int r = 0; r < static_cast<int>(s.size()); ++r) {
        if (--need[static_cast<unsigned char>(s[r])] >= 0) --missing;
        while (missing == 0) {
            if (best_left < 0 || r - left + 1 < best_length) {
                best_left = left;
                best_length = r - left + 1;
            }
            if (++need[static_cast<unsigned char>(s[left++])] > 0) ++missing;
        }
    }
    return best_left < 0 ? std::string{} : std::string(s.substr(best_left, best_length));
}
// END minimum-cover

// BEGIN replacement-budget
int longest_replacement(std::string_view s, int budget) {
    if (budget < 0) return 0;
    std::array<int, 26> frequency{};          // 前提：大写英文字母
    int left = 0, answer = 0;
    for (int r = 0; r < static_cast<int>(s.size()); ++r) {
        ++frequency[s[r] - 'A'];
        while (r - left + 1 - *std::max_element(frequency.begin(), frequency.end()) > budget)
            --frequency[s[left++] - 'A'];
        answer = std::max(answer, r - left + 1);
    }
    return answer;
}
// END replacement-budget

// BEGIN positive-product
i64 count_product_below(const std::vector<int>& a, i64 k) {
    if (k <= 1) return 0;                    // 前提：每个 a[i]>=1
    const i64 limit = k - 1;
    i64 product = 1, answer = 0;
    int left = 0;
    for (int r = 0; r < static_cast<int>(a.size()); ++r) {
        const i64 value = a[r];
        while (left < r && product > limit / value) product /= a[left++];
        if (product > limit / value) {       // 单个 value 已不合法
            left = r + 1;
            product = 1;
            continue;
        }
        product *= value;                   // 到这里才乘，不会先溢出
        answer += r - left + 1;
    }
    return answer;
}
// END positive-product

// BEGIN maximum-prefix
struct SumRange { i64 sum; int left, right; }; // [left,right)
std::optional<SumRange> maximum_sum_prefix(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    SumRange answer{std::numeric_limits<i64>::lowest(), 0, 0};
    i64 p = 0, minimum = 0;
    int minimum_position = 0;
    for (int r = 1; r <= static_cast<int>(a.size()); ++r) {
        p += a[r - 1];
        if (p - minimum > answer.sum) answer = {p - minimum, minimum_position, r};
        if (p < minimum) { minimum = p; minimum_position = r; }
    }
    return answer;                          // 全负也返回非空段
}
// END maximum-prefix

// BEGIN maximum-kadane
std::optional<SumRange> maximum_sum_kadane(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    SumRange answer{a[0], 0, 1};
    i64 ending = a[0];
    int start = 0;
    for (int i = 1; i < static_cast<int>(a.size()); ++i) {
        if (ending < 0) { ending = a[i]; start = i; }
        else ending += a[i];
        if (ending > answer.sum) answer = {ending, start, i + 1};
    }
    return answer;
}
// END maximum-kadane

// BEGIN fixed-extreme
std::vector<int> fixed_window_extreme(const std::vector<int>& a, int k,
                                    bool maximum = true) {
    const int n = static_cast<int>(a.size());
    if (k <= 0 || k > n) return {};
    std::deque<int> candidates;              // 下标，不是整个窗口
    std::vector<int> result;
    for (int r = 0; r < n; ++r) {
        while (!candidates.empty() && candidates.front() <= r - k)
            candidates.pop_front();         // 下标过期
        while (!candidates.empty() &&
               (maximum ? a[candidates.back()] <= a[r] : a[candidates.back()] >= a[r]))
            candidates.pop_back();          // 后来的候选更好，且更晚过期
        candidates.push_back(r);
        if (r + 1 >= k) result.push_back(a[candidates.front()]);
    }
    return result;
}
// END fixed-extreme

// BEGIN signed-shortest
int shortest_signed_sum(const std::vector<int>& a, i64 target) {
    const auto p = prefix_sum(a);
    std::deque<int> candidates;
    int answer = 0;
    for (int r = 0; r < static_cast<int>(p.size()); ++r) {
        while (!candidates.empty() && p[r] - p[candidates.front()] >= target) {
            const int length = r - candidates.front();
            if (answer == 0 || length < answer) answer = length;
            candidates.pop_front();         // 同一起点的更晚终点只会更长
        }
        while (!candidates.empty() && p[candidates.back()] >= p[r])
            candidates.pop_back();          // 新起点更晚，且前缀值不更大
        candidates.push_back(r);            // 查询在前，不选空段
    }
    return answer;                          // 0 表示无解；题目要求-1时作返回值转换
}
// END signed-shortest

} // namespace second_algorithm::contiguous
