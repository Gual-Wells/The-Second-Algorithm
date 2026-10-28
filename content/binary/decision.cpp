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
// END decision-search-core

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
