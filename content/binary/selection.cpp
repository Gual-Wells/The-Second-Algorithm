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
