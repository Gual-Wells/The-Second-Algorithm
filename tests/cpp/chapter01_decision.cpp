#include "../../content/binary/decision.cpp"
#include <chrono>
#include <iostream>
#include <random>
#include <stdexcept>
#include <string>

using namespace binary_decision;

namespace {
long long checks = 0;
void require(bool condition, const std::string& name) {
    ++checks;
    if (!condition) throw std::runtime_error(name);
}
void close(long double actual, long double expected, const std::string& name) {
    require(std::fabs(actual - expected) < 1e-7L, name);
}
int bits(unsigned mask) {
    int result = 0;
    while (mask) { result += mask & 1U; mask >>= 1U; }
    return result;
}

i64 capacity_oracle(const std::vector<i64>& a, int k) {
    i64 best = std::accumulate(a.begin(), a.end(), 0LL);
    for (unsigned mask = 0; mask < (1U << (a.size() - 1)); ++mask) {
        if (bits(mask) != k - 1) continue;
        i64 sum = 0, largest = 0;
        for (std::size_t i = 0; i < a.size(); ++i) {
            sum += a[i];
            if (i + 1 == a.size() || (mask & (1U << i))) {
                largest = std::max(largest, sum); sum = 0;
            }
        }
        best = std::min(best, largest);
    }
    return best;
}
i64 spacing_oracle(std::vector<i64> a, int choose) {
    std::sort(a.begin(), a.end());
    i64 best = 0;
    for (unsigned mask = 0; mask < (1U << a.size()); ++mask) {
        if (bits(mask) != choose) continue;
        i64 last = -10000000000LL, gap = 10000000000LL;
        for (std::size_t i = 0; i < a.size(); ++i) if (mask & (1U << i)) {
            if (last != -10000000000LL) gap = std::min(gap, a[i] - last);
            last = a[i];
        }
        best = std::max(best, gap);
    }
    return best;
}
i64 production_oracle(const std::vector<i64>& times, i64 target) {
    for (i64 time = 0;; ++time) {
        i64 total = 0;
        for (i64 t : times) total += time / t;
        if (total >= target) return time;
    }
}
int simulation_oracle(const std::vector<i64>& duration, i64 deadline) {
    for (int k = 1; k <= static_cast<int>(duration.size()); ++k) {
        std::vector<i64> finish(k, 0);
        for (i64 d : duration) {
            int earliest = 0;
            for (int j = 1; j < k; ++j) if (finish[j] < finish[earliest]) earliest = j;
            finish[earliest] += d;
        }
        if (*std::max_element(finish.begin(), finish.end()) <= deadline) return k;
    }
    throw std::runtime_error("simulation oracle invalid input");
}
int effort_oracle(const std::vector<std::vector<int>>& a) {
    const int r = static_cast<int>(a.size()), c = static_cast<int>(a[0].size()), n = r*c;
    std::vector<std::vector<int>> d(n, std::vector<int>(n, 1000000000));
    for (int i = 0; i < n; ++i) d[i][i] = 0;
    for (int i = 0; i < r; ++i) for (int j = 0; j < c; ++j) {
        if (i + 1 < r) d[i*c+j][(i+1)*c+j] = d[(i+1)*c+j][i*c+j] = std::abs(a[i][j]-a[i+1][j]);
        if (j + 1 < c) d[i*c+j][i*c+j+1] = d[i*c+j+1][i*c+j] = std::abs(a[i][j]-a[i][j+1]);
    }
    // min/max 半环 Floyd；不使用二分或 BFS 检查器。
    for (int k = 0; k < n; ++k) for (int i = 0; i < n; ++i) for (int j = 0; j < n; ++j)
        d[i][j] = std::min(d[i][j], std::max(d[i][k], d[k][j]));
    return d[0][n-1];
}
int nails_oracle(const std::vector<int>& left, const std::vector<int>& right,
                 const std::vector<int>& nails) {
    for (int t = 1; t <= static_cast<int>(nails.size()); ++t) {
        bool all = true;
        for (std::size_t j = 0; j < left.size(); ++j) {
            bool found = false;
            for (int i = 0; i < t; ++i) if (left[j] <= nails[i] && nails[i] <= right[j]) found = true;
            all = all && found;
        }
        if (all) return t;
    }
    return -1;
}
int orders_oracle(std::vector<i64> remaining, const std::vector<Order>& orders) {
    for (std::size_t i = 0; i < orders.size(); ++i) {
        for (int day = orders[i].left; day < orders[i].right; ++day) {
            remaining[day] -= orders[i].demand;
            if (remaining[day] < 0) return static_cast<int>(i + 1);
        }
    }
    return 0;
}
int matching_oracle(const std::vector<std::vector<int>>& a, int k) {
    const int n = static_cast<int>(a.size()), m = static_cast<int>(a[0].size());
    int best = 1000000000;
    std::vector<int> selected;
    auto enumerate = [&](auto&& self, int r, unsigned used) -> void {
        if (r == n) {
            auto values = selected;
            std::sort(values.begin(), values.end(), std::greater<int>{});
            best = std::min(best, values[k-1]);
            return;
        }
        for (int c = 0; c < m; ++c) if (!(used & (1U << c))) {
            selected.push_back(a[r][c]);
            self(self, r + 1, used | (1U << c));
            selected.pop_back();
        }
    };
    enumerate(enumerate, 0, 0);
    return best;
}
void validate_assignment(const std::vector<std::vector<int>>& a, int k, const MatchAnswer& answer) {
    std::vector<int> chosen;
    std::vector<bool> used(a[0].size(), false);
    require(answer.column.size() == a.size(), "matching assignment rows");
    for (std::size_t row = 0; row < a.size(); ++row) {
        int c = answer.column[row];
        require(c >= 0 && c < static_cast<int>(a[0].size()) && !used[c], "matching assignment distinct columns");
        used[c] = true;
        chosen.push_back(a[row][c]);
    }
    std::sort(chosen.begin(), chosen.end(), std::greater<int>{});
    require(chosen[k-1] == answer.threshold, "matching completion objective");
}
long double average_oracle(const std::vector<i64>& a, int shortest, int longest) {
    long double best = -1e100L;
    for (std::size_t left = 0; left < a.size(); ++left) {
        i64 sum = 0;
        for (std::size_t right = left; right < a.size(); ++right) {
            sum += a[right];
            const int length = static_cast<int>(right - left + 1);
            if (shortest <= length && length <= longest)
                best = std::max(best, static_cast<long double>(sum) / length);
        }
    }
    return best;
}
long double remaining_oracle(const std::vector<i64>& a) {
    const i64 total = std::accumulate(a.begin(), a.end(), 0LL);
    long double best = 1e100L;
    for (std::size_t left = 1; left + 1 < a.size(); ++left) {
        i64 removed = 0;
        for (std::size_t right = left; right + 1 < a.size(); ++right) {
            removed += a[right];
            best = std::min(best, static_cast<long double>(total-removed) / (a.size()-(right-left+1)));
        }
    }
    return best;
}
long double ratio_oracle(const std::vector<Ingredient>& items, int choose) {
    long double best = 0;
    for (unsigned mask = 0; mask < (1U << items.size()); ++mask) if (bits(mask) == choose) {
        i64 value = 0, cost = 0;
        for (std::size_t i = 0; i < items.size(); ++i) if (mask & (1U << i)) {
            value += items[i].value; cost += items[i].cost;
        }
        best = std::max(best, static_cast<long double>(value) / cost);
    }
    return best;
}
} // namespace

int main() {
    std::mt19937 random(20261028);
    for (int trial = 0; trial < 350; ++trial) {
        int n = 1 + random()%8, k = 1 + random()%n;
        std::vector<i64> a(n);
        for (auto& x : a) x = random()%8;
        const auto expected = capacity_oracle(a, k);
        require(capacity_manual(a,k) == expected, "capacity cut enumeration");
        const auto bounds = capacity_bounds_standard(a);
        require(bounds.first == *std::max_element(a.begin(),a.end()) && bounds.second == std::accumulate(a.begin(),a.end(),0LL), "capacity facilities bounds");

        n = 2 + random()%7; k = 2 + random()%(n-1);
        a.resize(n); a[0] = 1;
        for (int i=1;i<n;++i) a[i]=a[i-1]+1+random()%6;
        const auto gap = spacing_oracle(a,k);
        require(spacing_sorted_manual(a,k) == gap, "spacing subset oracle");
        std::shuffle(a.begin(),a.end(),random);
        const auto original=a;
        require(spacing_standard(a,k) == gap && a==original, "spacing facilities preserve caller");

        n = 1 + random()%6; a.resize(n);
        for (auto& x:a) x=1+random()%8;
        const i64 target=1+random()%25;
        require(production_manual(a,target)==production_oracle(a,target), "production time scan");
        require(production_upper_standard(a,target)==*std::min_element(a.begin(),a.end())*target, "production bound facility");
        const i64 maximum=*std::max_element(a.begin(),a.end());
        const i64 sum=std::accumulate(a.begin(),a.end(),0LL);
        const i64 deadline=maximum+random()%(sum-maximum+1);
        const int slots=simulation_oracle(a,deadline);
        require(stage_slots_manual(a,deadline)==slots, "hand heap linear event oracle");
        require(stage_slots_standard(a,deadline)==slots, "priority queue linear event oracle");

        const int r=1+random()%4,c=1+random()%4;
        std::vector<std::vector<int>> grid(r,std::vector<int>(c));
        for(auto& row:grid)for(auto& value:row)value=1+random()%10;
        const int effort=effort_oracle(grid);
        require(path_effort_manual(grid)==effort, "array BFS minimax Floyd");
        require(path_effort_standard(grid)==effort, "std queue minimax Floyd");

        const int boards=1+random()%6, m=1+random()%7;
        std::vector<int> left(boards),right(boards),nails(m);
        for(int i=0;i<boards;++i){left[i]=1+random()%(2*m);right[i]=1+random()%(2*m);if(left[i]>right[i])std::swap(left[i],right[i]);}
        for(auto& x:nails)x=1+random()%(2*m);
        const int earliest=nails_oracle(left,right,nails);
        require(first_nails_manual(left,right,nails)==earliest,"nails direct membership oracle");
        require(first_nails_standard(left,right,nails)==earliest,"nails partial_sum oracle");
        const int days=1+random()%7;
        std::vector<i64> capacities(days);
        for(auto& x:capacities)x=random()%15;
        std::vector<Order> orders;
        for(int j=0;j<m;++j){int l=random()%days,rr=random()%days;if(l>rr)std::swap(l,rr);orders.push_back({i64(random()%8),l,rr+1});}
        const int failure=orders_oracle(capacities,orders);
        require(first_failed_order_manual(capacities,orders)==failure,"orders direct daily subtraction");
        require(first_failed_order_standard(capacities,orders)==failure,"orders partial_sum equal oracle");
        const auto diff=order_difference(days,orders,m);
        require(std::accumulate(diff.begin(),diff.end(),0LL)==0,"difference tail closure");

        const int rows=1+random()%4, columns=rows+random()%(6-rows);
        std::vector<std::vector<int>> matrix(rows,std::vector<int>(columns));
        for(auto& row:matrix)for(auto& value:row)value=1+random()%15;
        const int rank=1+random()%rows;
        const int limit=matching_oracle(matrix,rank);
        require(matching_threshold_manual(matrix,rank)==limit,"matching injective assignment oracle");
        const auto answer=matching_standard(matrix,rank);
        require(answer.threshold==limit,"compressed matching assignment oracle");
        validate_assignment(matrix,rank,answer);
        require(matching_size(threshold_matching(matrix,limit,rows-rank+1))>=rows-rank+1,"matching feasibility witness");

        n=1+random()%8;a.resize(n);
        for(auto& x:a)x=i64(random()%21)-10;
        int shortest=1+random()%n,longest=shortest+random()%(n-shortest+1);
        const auto average=average_oracle(a,shortest,longest);
        close(max_average_manual(a,shortest,longest),average,"bounded average subarray enumeration");
        close(max_average_standard(a,shortest,longest),average,"deque bounded average oracle");
        const auto shifted=shifted_values_standard(a,1.25L);
        for(int i=0;i<n;++i)close(shifted[i],a[i]-1.25L,"transform facility actual values");
        n=3+random()%6;a.resize(n);
        for(auto& x:a)x=1+random()%20;
        close(min_remaining_average_manual(a),remaining_oracle(a),"sabotage nonempty deletion enumeration");

        n=1+random()%8;k=1+random()%n;
        std::vector<Ingredient> items(n);
        for(auto& item:items)item={i64(1+random()%30),i64(1+random()%20)};
        const auto ratio=ratio_oracle(items,k);
        close(ratio_manual(items,k),ratio,"ratio subset oracle hand sort");
        close(ratio_standard(items,k),ratio,"ratio subset oracle nth_element");
    }

    // 定点反例：窗口过期、空删除、贪心争列、同一调用多次重建状态。
    close(max_average_manual({10,-100,9},2,2),-45,"expired minimum prefix manual");
    close(max_average_standard({10,-100,9},2,2),-45,"expired minimum prefix deque");
    close(min_remaining_average_manual({10,1,10}),10,"forced nonempty internal deletion");
    close(min_remaining_average_manual({5,1,7,8,2}),8.0L/3,"sabotage official sample");
    const std::vector<Ingredient> counterexample={{100,1},{900,100},{8,1}};
    close(ratio_manual(counterexample,2),54,"individual ratios invalid greedy manual");
    close(ratio_standard(counterexample,2),54,"individual ratios invalid greedy standard");
    require(matching_threshold_manual({{1,1},{1,9}},1)==1,"augmenting reroute required");
    require(first_nails_manual({1},{1},{2})==-1,"nail impossible sentinel");
    require(first_nails_standard({1},{1},{1})==1,"nail endpoint");
    require(first_failed_order_manual({0},{{0,0,1}})==0,"zero demand all succeed");
    require(first_failed_order_standard({0},{{1,0,1}})==1,"first order fails");

    std::vector<i64> large(200000,1000000000LL);
    require(capacity_manual(large,1)==200000000000000LL,"capacity 64 bit sum");
    require(capacity_bounds_standard(large).second==200000000000000LL,"capacity standard 64 bit accumulator");
    require(production_manual({1000000000LL},1000000000LL)==1000000000000000000LL,"production 1e18 boundary");
    std::fill(large.begin(),large.end(),1);
    require(production_manual(large,1000000000LL)==5000,"production remaining-target saturation");
    require(spacing_standard({1,1000000000LL},2)==999999999,"spacing large coordinate");
    std::vector<i64> dance(10000,100000);
    require(stage_slots_manual(dance,1000000)==1000,"hand heap large event simulation");
    require(stage_slots_standard(dance,1000000)==1000,"std heap large event simulation");
    std::vector<i64> classrooms(1000000,1000000000LL);
    std::vector<Order> many_orders(1000000,{1000000000LL,0,1000000});
    require(first_failed_order_manual(classrooms,many_orders)==2,"million orders 1e15 demand manual");
    require(first_failed_order_standard(classrooms,many_orders)==2,"million orders 1e15 demand standard");
    std::vector<i64> constant(100000,10000);
    close(max_average_manual(constant,100000,100000),10000,"large fixed length average");
    close(max_average_standard(constant,1,100000),10000,"large deque average");
    close(min_remaining_average_manual(constant),10000,"large sabotage nonempty");

    // 250 阶实测，既含完整低权匹配，也含 need=1 后任意补全。
    std::vector<std::vector<int>> stress(250,std::vector<int>(250));
    for(int r=0;r<250;++r)for(int c=0;c<250;++c)stress[r][c]=1+(r*37+c*17)%997;
    const auto begin=std::chrono::steady_clock::now();
    const auto stress_answer=matching_standard(stress,1);
    validate_assignment(stress,1,stress_answer);
    const auto milliseconds=std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()-begin).count();
    const auto few_low=matching_standard(stress,250);
    validate_assignment(stress,250,few_low);
    std::cout << "decision checks=" << checks << "; matching250_ms=" << milliseconds
              << "; threshold=" << stress_answer.threshold << '\n';
}
