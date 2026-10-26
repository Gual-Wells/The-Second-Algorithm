#include <algorithm>
#include <limits>
#include <numeric>
#include <utility>
#include <vector>
using namespace std;

namespace binary_advanced {
// BEGIN fenwick-rank
struct FrequencyTree {
    int n;
    vector<long long> bit;
    explicit FrequencyTree(int size) : n(size), bit(n + 1) {}
    void add(int p, long long delta) { // 坐标 0-based；修改后每项频数仍须非负
        for (++p; p <= n; p += p & -p) bit[p] += delta;
    }
    long long prefix(int end) const { // [0,end)
        long long sum = 0;
        for (; end; end -= end & -end) sum += bit[end];
        return sum;
    }
    int kth(long long k) const { // 排名 1-based；不存在返回 n
        if (k <= 0 || k > prefix(n)) return n;
        int p = 0, step = 1;
        while (step <= n / 2) step *= 2;
        for (; step; step /= 2) {
            int next = p + step;
            if (next <= n && bit[next] < k) {
                p = next;
                k -= bit[next];
            }
        }
        return p; // p 是前缀中不足 k 的元素数，也是答案的 0-based 下标
    }
};
// END fenwick-rank

// BEGIN segment-first
struct MaxTree {
    int n, size = 1;
    vector<int> tree;
    explicit MaxTree(const vector<int>& a) : n((int)a.size()) {
        while (size < n) size *= 2;
        tree.assign(2 * size, numeric_limits<int>::min());
        copy(a.begin(), a.end(), tree.begin() + size);
        for (int p = size - 1; p; --p) tree[p] = max(tree[2*p], tree[2*p+1]);
    }
    void set(int p, int x) {
        tree[p += size] = x;
        while (p /= 2) tree[p] = max(tree[2*p], tree[2*p+1]);
    }
    int first_at_least(int from, int x, int p, int l, int r) const {
        if (r <= from || l >= n || tree[p] < x) return n;
        if (r - l == 1) return l;
        int m = l + (r - l) / 2;
        int left = first_at_least(from, x, 2*p, l, m);
        return left != n ? left : first_at_least(from, x, 2*p+1, m, r);
    }
    int first_at_least(int from, int x) const { // [from,n) 第一个 >=x；无解 n
        return first_at_least(from, x, 1, 0, size);
    }
};
// END segment-first

// BEGIN parallel-prefix
struct DSU {
    vector<int> parent, size;
    explicit DSU(int n) : parent(n), size(n, 1) {
        iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) { return parent[x] == x ? x : parent[x] = find(parent[x]); }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (size[a] < size[b]) swap(a, b);
        parent[b] = a; size[a] += size[b];
    }
};

// edges[t] 是第 t+1 次加边；所有端点 0-based。
// check(dsu,query) 必须在加边前缀增长时从假变真；不得修改 dsu 的图状态。
template<class Query, class Check>
vector<int> first_prefix_batch(int n, const vector<pair<int,int>>& edges,
                              const vector<Query>& queries, Check check) {
    int m = (int)edges.size(), q = (int)queries.size();
    vector<int> lo(q, 0), hi(q, m + 1); // m+1 表示直到全部操作也不满足
    while (true) {
        vector<vector<int>> bucket(m + 1);
        bool pending = false;
        for (int i = 0; i < q; ++i) if (lo[i] < hi[i]) {
            pending = true;
            int mid = lo[i] + (hi[i] - lo[i]) / 2;
            bucket[mid].push_back(i); // mid 永远 <=m，故不检查虚拟 m+1
        }
        if (!pending) break;
        DSU dsu(n);
        for (int t = 0; t <= m; ++t) {
            if (t) dsu.unite(edges[t-1].first, edges[t-1].second);
            for (int i : bucket[t]) {
                if (check(dsu, queries[i])) hi[i] = t;
                else lo[i] = t + 1;
            }
        }
    }
    for (int& x : lo) if (x == m + 1) x = -1;
    return lo;
}
// CSES New Roads：
// auto ans = first_prefix_batch(n, edges, pairs, [](DSU& d, auto p) {
//     return d.find(p.first) == d.find(p.second);
// });
// AGC002 D，query 为 {x,y,z}：
// int a=d.find(query.x), b=d.find(query.y);
// return d.size[a] + (a==b ? 0 : d.size[b]) >= query.z;
// END parallel-prefix
} // namespace binary_advanced
