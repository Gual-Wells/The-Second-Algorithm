#include <algorithm>
#include <cmath>
#include <deque>
#include <functional>
#include <limits>
#include <numeric>
#include <queue>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace binary_composed {
using i64 = long long;
using i128 = __int128_t;
using std::vector;

// BEGIN max_min_segments
// a[i]>=0，分成恰好 k 个非空连续段，1<=k<=n。
i64 maxMinSegmentSum(const vector<i64>& a, int k) {
    i64 lo = 0, hi = std::accumulate(a.begin(), a.end(), 0LL) / k;
    auto enough = [&](i64 target) {
        int groups = 0;
        i64 sum = 0;
        for (i64 x : a) {
            sum += x;
            if (sum >= target) {
                ++groups;
                sum = 0;
            }
        }
        return groups >= k;
    };
    while (lo < hi) {
        i64 mid = lo + (hi - lo + 1) / 2;
        if (enough(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END max_min_segments

// BEGIN median_budget
// n 为奇数，只能加一，总预算 budget>=0。
i64 maxMedian(vector<i64> a, i64 budget) {
    std::sort(a.begin(), a.end());
    int start = static_cast<int>(a.size()) / 2;
    i64 lo = a[start], hi = lo + budget;
    auto affordable = [&](i64 target) {
        i64 left = budget;
        for (int i = start; i < static_cast<int>(a.size()); ++i) {
            i64 need = std::max(0LL, target - a[i]);
            if (need > left) return false;
            left -= need;
        }
        return true;
    };
    while (lo < hi) {
        i64 mid = lo + (hi - lo + 1) / 2;
        if (affordable(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END median_budget

// BEGIN removal_prefix
// removable 中位置互异，p 起初是 s 的子序列。
int maxRemovals(const std::string& s, const std::string& p,
                const vector<int>& removable) {
    int m = static_cast<int>(removable.size());
    vector<int> when(s.size(), m);
    for (int t = 0; t < m; ++t) when[removable[t]] = t;
    auto survives = [&](int k) {
        int j = 0;
        for (int i = 0; i < static_cast<int>(s.size())
                        && j < static_cast<int>(p.size()); ++i)
            if (when[i] >= k && s[i] == p[j]) ++j;
        return j == static_cast<int>(p.size());
    };
    int lo = 0, hi = m;
    while (lo < hi) {
        int mid = lo + (hi - lo + 1) / 2;
        if (survives(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END removal_prefix

// BEGIN nailing_planks
// Codility 原题：所有坐标在 [1,2*m]；A、B 长度相同，A[i]<=B[i]。
int minNails(const vector<int>& a, const vector<int>& b, const vector<int>& nails) {
    int m = static_cast<int>(nails.size());
    auto covered = [&](int k) {
        vector<int> prefix(2 * m + 1, 0);
        for (int i = 0; i < k; ++i) prefix[nails[i]] = 1;
        for (int i = 1; i <= 2 * m; ++i) prefix[i] += prefix[i - 1];
        for (int i = 0; i < static_cast<int>(a.size()); ++i)
            if (prefix[b[i]] == prefix[a[i] - 1]) return false;
        return true;
    };
    if (!covered(m)) return -1;
    int lo = 1, hi = m;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (covered(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END nailing_planks

// BEGIN average_range
// 存在长度在[L,U]内、平均值>=target的子段。允许原数组为负。
bool averageAtLeast(const vector<double>& a, int L, int U, double target) {
    int n = static_cast<int>(a.size());
    vector<double> prefix(n + 1, 0);
    for (int i = 0; i < n; ++i) prefix[i + 1] = prefix[i] + a[i] - target;
    std::deque<int> q;
    for (int r = L; r <= n; ++r) {
        int enter = r - L;
        while (!q.empty() && prefix[q.back()] >= prefix[enter]) q.pop_back();
        q.push_back(enter);
        while (q.front() < r - U) q.pop_front();
        if (prefix[r] >= prefix[q.front()]) return true;
    }
    return false;
}

double maxAverage(const vector<double>& a, int L, int U) {
    double lo = *std::min_element(a.begin(), a.end());
    double hi = *std::max_element(a.begin(), a.end());
    for (int t = 0; t < 70; ++t) {
        double mid = lo + (hi - lo) / 2;
        if (averageAtLeast(a, L, U, mid)) lo = mid;
        else hi = mid;
    }
    return lo;
}
// END average_range

// BEGIN lower_median_subarray
// 长度至少 k；偶数长度采用下中位数。
int maxLowerMedian(const vector<int>& a, int k) {
    auto possible = [&](int target) {
        int n = static_cast<int>(a.size()), minimum = 0;
        vector<int> prefix(n + 1, 0);
        for (int i = 0; i < n; ++i)
            prefix[i + 1] = prefix[i] + (a[i] >= target ? 1 : -1);
        for (int r = k; r <= n; ++r) {
            minimum = std::min(minimum, prefix[r - k]);
            if (prefix[r] - minimum > 0) return true;
        }
        return false;
    };
    int lo = *std::min_element(a.begin(), a.end());
    int hi = *std::max_element(a.begin(), a.end());
    while (lo < hi) {
        int mid = static_cast<int>(static_cast<i64>(lo)
                                  + (static_cast<i64>(hi) - lo + 1) / 2);
        if (possible(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END lower_median_subarray

// BEGIN threshold_bfs
// LC1631：阈值作用在相邻边的高度差，不能替换成点高度<=T。
int minimumEffort(const vector<vector<int>>& h) {
    int n = static_cast<int>(h.size()), m = static_cast<int>(h[0].size());
    auto reachable = [&](int limit) {
        vector<vector<char>> seen(n, vector<char>(m, 0));
        std::queue<std::pair<int,int>> q;
        q.push({0, 0}); seen[0][0] = 1;
        const int dr[] = {-1, 1, 0, 0}, dc[] = {0, 0, -1, 1};
        while (!q.empty()) {
            auto [r, c] = q.front(); q.pop();
            if (r == n - 1 && c == m - 1) return true;
            for (int d = 0; d < 4; ++d) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= n || nc < 0 || nc >= m || seen[nr][nc]) continue;
                if (std::abs(h[r][c] - h[nr][nc]) > limit) continue;
                seen[nr][nc] = 1; q.push({nr, nc});
            }
        }
        return false;
    };
    int lo = 0, hi = 0;
    for (const auto& row : h) for (int x : row) hi = std::max(hi, x);
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (reachable(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END threshold_bfs

// BEGIN nonadjacent
int minimumCapability(const vector<int>& a, int k) {
    auto enough = [&](int limit) {
        int count = 0;
        for (int i = 0; i < static_cast<int>(a.size()); ++i)
            if (a[i] <= limit) { ++count; ++i; }
        return count >= k;
    };
    int lo = *std::min_element(a.begin(), a.end());
    int hi = *std::max_element(a.begin(), a.end());
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (enough(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END nonadjacent

// BEGIN pill_matching
int maxAssigned(vector<int> tasks, vector<int> workers, int pills, int boost) {
    std::sort(tasks.begin(), tasks.end());
    std::sort(workers.begin(), workers.end());
    auto possible = [&](int k) {
        std::multiset<int> available(workers.end() - k, workers.end());
        int left = pills;
        for (int i = k - 1; i >= 0; --i) {
            auto strongest = std::prev(available.end());
            if (*strongest >= tasks[i]) available.erase(strongest);
            else {
                if (left == 0) return false;
                auto it = available.lower_bound(tasks[i] - boost);
                if (it == available.end()) return false;
                available.erase(it); --left;
            }
        }
        return true;
    };
    int lo = 0, hi = std::min(tasks.size(), workers.size());
    while (lo < hi) {
        int mid = lo + (hi - lo + 1) / 2;
        if (possible(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END pill_matching

// BEGIN line_cover
i64 minCoverRadius(vector<i64> points, int shots) {
    std::sort(points.begin(), points.end());
    auto enough = [&](i64 radius) {
        int used = 0, i = 0, n = static_cast<int>(points.size());
        while (i < n) {
            i64 right = points[i] + 2 * radius;
            ++used;
            while (i < n && points[i] <= right) ++i;
        }
        return used <= shots;
    };
    i64 lo = 0, hi = points.back() - points.front();
    while (lo < hi) {
        i64 mid = lo + (hi - lo) / 2;
        if (enough(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

i64 minBusWait(vector<i64> arrival, int buses, int capacity) {
    std::sort(arrival.begin(), arrival.end());
    auto enough = [&](i64 wait) {
        int used = 0, first = 0, n = static_cast<int>(arrival.size());
        while (first < n) {
            int end = first;
            while (end < n && end - first < capacity
                   && arrival[end] - arrival[first] <= wait) ++end;
            first = end; ++used;
        }
        return used <= buses;
    };
    i64 lo = 0, hi = arrival.back() - arrival.front();
    while (lo < hi) {
        i64 mid = lo + (hi - lo) / 2;
        if (enough(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END line_cover

// BEGIN interval_spacing
// 非交叠闭区间内的整数点；至少能放下 cows>=2 个不同点；坐标[0,1e18]。
i64 maxIntervalGap(vector<std::pair<i64,i64>> ranges, i64 cows) {
    std::sort(ranges.begin(), ranges.end());
    auto enough = [&](i64 gap) {
        i64 count = 0, last = 0;
        for (auto [l, r] : ranges) {
            i64 first = count == 0 ? l : std::max(l, last + gap);
            if (first > r) continue;
            i64 take = std::min(cows - count, 1 + (r - first) / gap);
            last = first + (take - 1) * gap;
            count += take;
            if (count == cows) return true;
        }
        return false;
    };
    i64 lo = 0, hi = (ranges.back().second - ranges.front().first) / (cows - 1);
    while (lo < hi) {
        i64 mid = lo + (hi - lo + 1) / 2; // mid>=1，不会除0
        if (enough(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END interval_spacing

// BEGIN packmen
int packmenTime(const std::string& field) {
    vector<int> targets, people;
    for (int i = 0; i < static_cast<int>(field.size()); ++i) {
        if (field[i] == '*') targets.push_back(i);
        if (field[i] == 'P') people.push_back(i);
    }
    auto enough = [&](int time) {
        int j = 0;
        for (int p : people) {
            if (j == static_cast<int>(targets.size())) return true;
            int reach = p + time;
            if (targets[j] < p) {
                int d = p - targets[j];
                if (d > time) return false;
                reach = p + std::max(time - 2 * d, (time - d) / 2);
            }
            while (j < static_cast<int>(targets.size()) && targets[j] <= reach) ++j;
        }
        return j == static_cast<int>(targets.size());
    };
    int lo = 0, hi = 2 * static_cast<int>(field.size());
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (enough(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END packmen

// BEGIN parallel_slots
// 固定出场次序；一有空槽立刻开下一项；给定每项均能在deadline内结束。
int minimumSlots(const vector<int>& duration, i64 deadline) {
    auto enough = [&](int slots) {
        std::priority_queue<i64, vector<i64>, std::greater<i64>> finish;
        for (int d : duration) {
            i64 start = 0;
            if (static_cast<int>(finish.size()) == slots) {
                start = finish.top(); finish.pop();
            }
            if (start + d > deadline) return false;
            finish.push(start + d);
        }
        return true;
    };
    int lo = 1, hi = duration.size();
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (enough(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END parallel_slots

// BEGIN periodic_wind
// CF1117C原约束；风/自控均每次最多一个单位，自控允许原地。
i64 magicShip(i64 sx, i64 sy, i64 tx, i64 ty, const std::string& wind) {
    int n = wind.size();
    vector<i64> px(n + 1, 0), py(n + 1, 0);
    for (int i = 0; i < n; ++i) {
        px[i + 1] = px[i] + (wind[i] == 'R') - (wind[i] == 'L');
        py[i + 1] = py[i] + (wind[i] == 'U') - (wind[i] == 'D');
    }
    auto possible = [&](i64 t) {
        i128 x = static_cast<i128>(sx) + static_cast<i128>(t / n) * px[n] + px[t % n];
        i128 y = static_cast<i128>(sy) + static_cast<i128>(t / n) * py[n] + py[t % n];
        i128 dx = x - tx, dy = y - ty;
        if (dx < 0) dx = -dx;
        if (dy < 0) dy = -dy;
        return dx + dy <= t;
    };
    // n<=1e5,初终点坐标[0,1e9]；可达时1e18足够，且中间值用128位。
    i64 lo = 0, hi = 1000000000000000000LL;
    if (!possible(hi)) return -1;
    while (lo < hi) {
        i64 mid = lo + (hi - lo) / 2;
        if (possible(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END periodic_wind

// BEGIN interval_intersection
// 正速度；可达区间随时间扩张。
double meetingTime(const vector<double>& x, const vector<double>& speed) {
    auto possible = [&](double t) {
        double left = -std::numeric_limits<double>::infinity();
        double right = std::numeric_limits<double>::infinity();
        for (int i = 0; i < static_cast<int>(x.size()); ++i) {
            left = std::max(left, x[i] - speed[i] * t);
            right = std::min(right, x[i] + speed[i] * t);
        }
        return left <= right;
    };
    double lo = 0, hi = 1;
    while (!possible(hi)) hi *= 2;
    for (int i = 0; i < 90; ++i) {
        double mid = lo + (hi - lo) / 2;
        if (possible(mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}

// 正分母的数学floor/ceil，a可以为负。C++ / 向零截断，需补偿。
i128 floorDiv(i128 a, i128 b) { return a / b - (a % b < 0); }
i128 ceilDiv(i128 a, i128 b) { return a / b + (a % b > 0); }

struct Order { i64 a, b, limit; };
i64 bakeryUpgrades(i64 tc, i64 tm, const vector<Order>& orders) {
    auto possible = [&](i64 budget) {
        i128 sum = static_cast<i128>(tc) + tm - budget;
        i128 lo = std::max<i128>(1, sum - tm);
        i128 hi = std::min<i128>(tc, sum - 1);
        for (auto o : orders) {
            i128 coeff = static_cast<i128>(o.a) - o.b;
            i128 rhs = static_cast<i128>(o.limit) - static_cast<i128>(o.b) * sum;
            if (coeff > 0) hi = std::min(hi, floorDiv(rhs, coeff));
            else if (coeff < 0) lo = std::max(lo, ceilDiv(-rhs, -coeff));
            else if (rhs < 0) return false;
        }
        return lo <= hi;
    };
    i64 lo = 0, hi = tc + tm - 2;
    while (lo < hi) {
        i64 mid = lo + (hi - lo) / 2;
        if (possible(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END interval_intersection

// BEGIN signed_product_rank
// 非空有序有符号数组，每个乘积及k能放进i64；不做带符号除法。
i64 countProductsLE(const vector<i64>& a, const vector<i64>& b, i64 limit) {
    i64 count = 0;
    for (i64 x : a) {
        int lo = 0, hi = b.size();
        if (x >= 0) {
            while (lo < hi) {
                int mid = lo + (hi - lo) / 2;
                if (static_cast<i128>(x) * b[mid] <= limit) lo = mid + 1;
                else hi = mid;
            }
            count += lo;
        } else {
            while (lo < hi) {
                int mid = lo + (hi - lo) / 2;
                if (static_cast<i128>(x) * b[mid] <= limit) hi = mid;
                else lo = mid + 1;
            }
            count += static_cast<i64>(b.size()) - lo;
        }
    }
    return count;
}

i64 kthProduct(const vector<i64>& a, const vector<i64>& b, i64 k) {
    i64 corners[] = {a.front()*b.front(), a.front()*b.back(),
                     a.back()*b.front(), a.back()*b.back()};
    i64 lo = *std::min_element(corners, corners + 4);
    i64 hi = *std::max_element(corners, corners + 4);
    while (lo < hi) {
        i64 mid = static_cast<i64>(static_cast<i128>(lo)
                                  + (static_cast<i128>(hi) - lo) / 2);
        if (countProductsLE(a, b, mid) >= k) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END signed_product_rank

// BEGIN pair_sum_rank
// 两个非空有序数组的下标对，可有重复值；每个两数和及k能放进i64。
i64 kthPairSum(const vector<i64>& a, const vector<i64>& b, i64 k) {
    auto countLE = [&](i64 limit) {
        i64 count = 0;
        int j = static_cast<int>(b.size()) - 1;
        for (i64 x : a) {
            while (j >= 0 && x + b[j] > limit) --j;
            count += j + 1;
        }
        return count;
    };
    i64 lo = a.front() + b.front(), hi = a.back() + b.back();
    while (lo < hi) {
        i64 mid = static_cast<i64>(static_cast<i128>(lo)
                                  + (static_cast<i128>(hi) - lo) / 2);
        if (countLE(mid) >= k) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END pair_sum_rank

// BEGIN top_pair_sum
// ABC149E：取M个最大有序对和，(i,j)/(j,i)分别计，允许i=j。
i64 topPairSum(vector<i64> a, i64 wanted) {
    std::sort(a.begin(), a.end());
    int n = a.size();
    vector<i64> prefix(n + 1, 0);
    for (int i = 0; i < n; ++i) prefix[i + 1] = prefix[i] + a[i];
    auto countAndSum = [&](i64 limit) {
        i64 count = 0, total = 0;
        int j = n;
        for (i64 x : a) {
            while (j > 0 && x + a[j - 1] >= limit) --j;
            count += n - j;
            total += (n - j) * x + prefix[n] - prefix[j];
        }
        return std::pair<i64,i64>{count, total};
    };
    i64 lo = 2 * a.front(), hi = 2 * a.back();
    while (lo < hi) {
        i64 mid = lo + (hi - lo + 1) / 2;
        if (countAndSum(mid).first >= wanted) lo = mid;
        else hi = mid - 1;
    }
    auto [count, total] = countAndSum(lo);
    return total - (count - wanted) * lo;
}
// END top_pair_sum

// BEGIN unique_duplicate
// n+1个数取值[1,n]，只有一个不同的重复值；不修改数组，O(1)空间。
int duplicateByCounting(const vector<int>& a) {
    int lo = 1, hi = static_cast<int>(a.size()) - 1;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2, count = 0;
        for (int x : a) count += x <= mid;
        if (count > mid) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END unique_duplicate

} // namespace binary_composed

#include <algorithm>
#include <functional>
#include <limits>
#include <queue>
#include <string>
#include <utility>
#include <vector>

namespace binary_challenge {
using i64 = long long;
using std::vector;

// BEGIN challenge_adjacent_cover
// a.size()>=2。选集必须覆盖每对相邻下标；空集因而不合法。
bool coveredAverageAtLeast(const vector<int>& a, long double target) {
    long double take = a[0] - target, skip = 0;
    for (int i = 1; i < static_cast<int>(a.size()); ++i) {
        long double nextTake = std::max(take, skip) + a[i] - target;
        skip = take;  // 本项不取，则上一项必须取。
        take = nextTake;
    }
    return std::max(take, skip) >= 0;
}

long double maxCoveredAverage(const vector<int>& a) {
    auto bounds = std::minmax_element(a.begin(), a.end());
    long double lo = *bounds.first, hi = *bounds.second;
    // 原题值域不超过1e9、误差要求1e-3；70次远小于所需区间宽度。
    for (int round = 0; round < 70; ++round) {
        long double mid = (lo + hi) / 2;
        if (coveredAverageAtLeast(a, mid)) lo = mid;
        else hi = mid;
    }
    return lo;
}

bool coveredLowerMedianAtLeast(const vector<int>& a, int target) {
    int take = a[0] >= target ? 1 : -1, skip = 0;
    for (int i = 1; i < static_cast<int>(a.size()); ++i) {
        int nextTake = std::max(take, skip) + (a[i] >= target ? 1 : -1);
        skip = take;
        take = nextTake;
    }
    return std::max(take, skip) > 0;  // 下中位数要求严格多数。
}

int maxCoveredLowerMedian(const vector<int>& a) {
    auto bounds = std::minmax_element(a.begin(), a.end());
    int lo = *bounds.first, hi = *bounds.second;
    while (lo < hi) {
        int mid = lo + (hi - lo + 1) / 2;
        if (coveredLowerMedianAtLeast(a, mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END challenge_adjacent_cover

// BEGIN challenge_window_median
// a为n*n矩阵，1<=k<=n，返回所有k*k窗口中最小的下中位数。
bool squareMedianAtMost(const vector<vector<int>>& a, int k, int target) {
    int n = static_cast<int>(a.size());
    vector<vector<int>> prefix(n + 1, vector<int>(n + 1));
    for (int r = 0; r < n; ++r) {
        for (int c = 0; c < n; ++c) {
            prefix[r + 1][c + 1] = prefix[r][c + 1] + prefix[r + 1][c]
                - prefix[r][c] + (a[r][c] <= target);
        }
    }
    int need = (k * k + 1) / 2;  // ceil(k²/2)，偶数时取下中位数。
    for (int r = k; r <= n; ++r) {
        for (int c = k; c <= n; ++c) {
            int count = prefix[r][c] - prefix[r - k][c]
                - prefix[r][c - k] + prefix[r - k][c - k];
            if (count >= need) return true;
        }
    }
    return false;
}

int minSquareLowerMedian(const vector<vector<int>>& a, int k) {
    int lo = a[0][0], hi = a[0][0];
    for (const auto& row : a) {
        for (int value : row) {
            lo = std::min(lo, value);
            hi = std::max(hi, value);
        }
    }
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (squareMedianAtMost(a, k, mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END challenge_window_median

// BEGIN challenge_weighted_grid
// grid中恰有一个S和一个G；进入#花wallCost，进入其他格花1。
i64 shortestWallTime(const vector<std::string>& grid, i64 wallCost) {
    int h = static_cast<int>(grid.size()), w = static_cast<int>(grid[0].size());
    int start = -1, goal = -1;
    for (int r = 0; r < h; ++r) {
        for (int c = 0; c < w; ++c) {
            if (grid[r][c] == 'S') start = r * w + c;
            if (grid[r][c] == 'G') goal = r * w + c;
        }
    }
    const i64 inf = std::numeric_limits<i64>::max() / 4;
    vector<i64> distance(h * w, inf);
    using State = std::pair<i64, int>;
    std::priority_queue<State, vector<State>, std::greater<State>> heap;
    distance[start] = 0;
    heap.push({0, start});
    const int dr[] = {-1, 1, 0, 0}, dc[] = {0, 0, -1, 1};
    while (!heap.empty()) {
        auto [time, v] = heap.top();
        heap.pop();
        if (time != distance[v]) continue;
        if (v == goal) return time;
        int r = v / w, c = v % w;
        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
            int to = nr * w + nc;
            i64 candidate = time + (grid[nr][nc] == '#' ? wallCost : 1);
            if (candidate < distance[to]) {
                distance[to] = candidate;
                heap.push({candidate, to});
            }
        }
    }
    return distance[goal];
}

// 原题保证wallCost=1可行，且任何S->G路径都必须进入黑格。
i64 maxWallCost(const vector<std::string>& grid, i64 timeLimit) {
    i64 lo = 1, hi = timeLimit;
    while (lo < hi) {
        i64 mid = lo + (hi - lo + 1) / 2;
        if (shortestWallTime(grid, mid) <= timeLimit) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
// END challenge_weighted_grid

// BEGIN challenge_prefix_topology
// 顶点用0..n-1；原题的1..n输入输出在边界处减/加1。
struct ObservationGraph {
    vector<vector<int>> edges;
    vector<int> indegree;
};

ObservationGraph observationGraph(int n, const vector<vector<int>>& observations,
                                  int prefix) {
    ObservationGraph graph{vector<vector<int>>(n), vector<int>(n)};
    for (int i = 0; i < prefix; ++i) {
        for (int j = 1; j < static_cast<int>(observations[i].size()); ++j) {
            int from = observations[i][j - 1], to = observations[i][j];
            graph.edges[from].push_back(to);
            ++graph.indegree[to];  // 重复边保持入度增减一致。
        }
    }
    return graph;
}

bool observationPrefixAcyclic(int n, const vector<vector<int>>& observations,
                              int prefix) {
    auto graph = observationGraph(n, observations, prefix);
    std::queue<int> ready;
    for (int v = 0; v < n; ++v) {
        if (graph.indegree[v] == 0) ready.push(v);
    }
    int count = 0;
    while (!ready.empty()) {
        int v = ready.front();
        ready.pop();
        ++count;
        for (int to : graph.edges[v]) {
            if (--graph.indegree[to] == 0) ready.push(to);
        }
    }
    return count == n;
}

struct PrefixOrder {
    int prefix;
    vector<int> order;
};

PrefixOrder longestObservationPrefix(int n, const vector<vector<int>>& observations) {
    int lo = 0, hi = static_cast<int>(observations.size());
    while (lo < hi) {
        int mid = lo + (hi - lo + 1) / 2;
        if (observationPrefixAcyclic(n, observations, mid)) lo = mid;
        else hi = mid - 1;
    }
    auto graph = observationGraph(n, observations, lo);
    std::priority_queue<int, vector<int>, std::greater<int>> ready;
    for (int v = 0; v < n; ++v) {
        if (graph.indegree[v] == 0) ready.push(v);
    }
    vector<int> order;
    while (!ready.empty()) {
        int v = ready.top();
        ready.pop();
        order.push_back(v);
        for (int to : graph.edges[v]) {
            if (--graph.indegree[to] == 0) ready.push(to);
        }
    }
    return {lo, std::move(order)};
}
// END challenge_prefix_topology

// BEGIN challenge_unordered_product
// ABC155D：单数组中i<j的积；相同值的不同下标分别计，无自身配对。
struct SignedPairProducts {
    vector<i64> negativeAbs, positive;
    i64 zeros = 0, n;
    explicit SignedPairProducts(const vector<i64>& a) : n(a.size()) {
        for (i64 x : a) {
            if (x < 0) negativeAbs.push_back(-x);
            else if (x > 0) positive.push_back(x);
            else ++zeros;
        }
        std::sort(negativeAbs.begin(), negativeAbs.end());
        std::sort(positive.begin(), positive.end());
    }
    static i64 sameSignPairs(const vector<i64>& values, i64 limit) {
        i64 count = 0;
        int j = static_cast<int>(values.size()) - 1;
        for (int i = 0; i < static_cast<int>(values.size()); ++i) {
            while (j > i && values[i] * values[j] > limit) --j;
            if (j <= i) break;
            count += j - i;
        }
        return count;
    }
    i64 countAtMost(i64 limit) const {
        if (limit < 0) {
            i64 count = 0;
            int j = static_cast<int>(positive.size());
            for (i64 magnitude : negativeAbs) {
                while (j > 0 && magnitude * positive[j - 1] >= -limit) --j;
                count += static_cast<i64>(positive.size()) - j;
            }
            return count;
        }
        i64 differentSigns = static_cast<i64>(negativeAbs.size()) * positive.size();
        i64 involvingZero = zeros * (n - zeros) + zeros * (zeros - 1) / 2;
        return differentSigns + involvingZero
            + sameSignPairs(negativeAbs, limit) + sameSignPairs(positive, limit);
    }
};

i64 kthUnorderedProduct(const vector<i64>& a, i64 k) {
    SignedPairProducts pairs(a);
    // 原题|a[i]|<=1e9，因此所有积均在此范围内，差值也不溢出i64。
    i64 lo = -1000000000000000000LL, hi = 1000000000000000000LL;
    while (lo < hi) {
        i64 mid = lo + (hi - lo) / 2;
        if (pairs.countAtMost(mid) >= k) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
// END challenge_unordered_product

// BEGIN challenge_descending_rewards
// ABC216E：每项产生a,a-1,...,1的正收益，至多取k次；原题k<=2e9。
i64 amusementReward(const vector<i64>& a, i64 k) {
    i64 totalCount = 0, hi = 0;
    for (i64 x : a) { totalCount += x; hi = std::max(hi, x); }
    i64 wanted = std::min(k, totalCount);
    auto countAbove = [&](i64 threshold) {
        i64 count = 0;
        for (i64 x : a) count += std::max(0LL, x - threshold);
        return count;
    };
    i64 lo = 0;
    while (lo < hi) {
        i64 mid = lo + (hi - lo) / 2;
        if (countAbove(mid) <= wanted) hi = mid;
        else lo = mid + 1;
    }
    i64 count = 0, reward = 0;
    for (i64 x : a) if (x > lo) {
        i64 amount = x - lo;
        count += amount;
        reward += (x + lo + 1) * amount / 2; // lo+1..x
    }
    return reward + (wanted - count) * lo;
}
// END challenge_descending_rewards

}  // namespace binary_challenge


#include <algorithm>
#include <vector>

namespace binary_census {
using i64 = long long;
using std::vector;

// BEGIN census_slalom
struct Gate { i64 x, y; }; // 门的可通过横区间为[x,x+width]，y严格递增。

// 固定正下滑速度speed；横坐标乘speed后，所有端点/扩张量恰好都是整数。
bool canSlalom(const vector<Gate>& gates, i64 width, i64 horizontalSpeed, i64 speed) {
    i64 left = gates[0].x * speed;
    i64 right = (gates[0].x + width) * speed;
    for (int i = 1; i < static_cast<int>(gates.size()); ++i) {
        i64 expansion = horizontalSpeed * (gates[i].y - gates[i - 1].y);
        left = std::max(left - expansion, gates[i].x * speed);
        right = std::min(right + expansion, (gates[i].x + width) * speed);
        if (left > right) return false;
    }
    return true;
}

// 原题只能从给定的滑雪板速度中选；无可行者返回-1，即IMPOSSIBLE。
i64 fastestSlalom(const vector<Gate>& gates, i64 width, i64 horizontalSpeed,
                  vector<i64> speeds) {
    std::sort(speeds.begin(), speeds.end());
    int lo = 0, hi = static_cast<int>(speeds.size());
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (canSlalom(gates, width, horizontalSpeed, speeds[mid])) lo = mid + 1;
        else hi = mid;
    }
    return lo == 0 ? -1 : speeds[lo - 1];
}
// END census_slalom
} // namespace binary_census

#include <algorithm>

namespace binary_tariff {
using i64 = long long;

// BEGIN final_tariff
// 按用量递进计费，不能用整段的最高费率乘全部用量。
i64 electricityBill(i64 consumption) {
    const i64 width[] = {100, 9900, 990000};
    const i64 rate[] = {2, 3, 5};
    i64 bill = 0;
    for (int i = 0; i < 3; ++i) {
        i64 take = std::min(consumption, width[i]);
        bill += take * rate[i];
        consumption -= take;
    }
    return bill + consumption * 7;
}

// 原题保证jointBill确实由整数总用量产生，故到达所在费率段时可整除。
i64 consumptionFromBill(i64 jointBill) {
    const i64 width[] = {100, 9900, 990000};
    const i64 rate[] = {2, 3, 5};
    i64 consumption = 0;
    for (int i = 0; i < 3; ++i) {
        i64 cost = width[i] * rate[i];
        if (jointBill <= cost) return consumption + jointBill / rate[i];
        consumption += width[i];
        jointBill -= cost;
    }
    return consumption + jointBill / 7;
}

// UVa12190：A=f(x+y)，B=f(y)-f(x)，并保证唯一解且x<=y。
i64 smallerElectricityBill(i64 A, i64 B) {
    i64 total = consumptionFromBill(A);
    i64 lo = 0, hi = total / 2;
    while (lo < hi) {
        i64 mid = lo + (hi - lo) / 2;
        i64 difference = electricityBill(total - mid) - electricityBill(mid);
        if (difference > B) lo = mid + 1;
        else hi = mid;
    }
    return electricityBill(lo);
}
// END final_tariff
} // namespace binary_tariff
