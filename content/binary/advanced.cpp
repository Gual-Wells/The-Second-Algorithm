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
