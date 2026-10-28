#include "../../content/binary/selection.cpp"
#include <climits>
#include <cstdlib>
#include <iostream>
#include <set>

using namespace binary_selection;
std::mt19937 rng(102803);
int rnd(int n) { return static_cast<int>(rng()%static_cast<unsigned>(n)); }

std::pair<int,i64> brute_lis(const std::vector<int>& a,bool weak) {
    int best=0; i64 count=0;
    for (unsigned mask=1;mask<(1U<<a.size());++mask) {
        bool ok=true,started=false;int last=0,len=0;
        for (unsigned i=0;i<a.size();++i) if (mask&(1U<<i)) {
            if (started && (weak ? last>a[i] : last>=a[i])) ok=false;
            started=true;last=a[i];++len;
        }
        if (ok) { if (len>best) { best=len;count=1; } else if (len==best) ++count; }
    }
    return {best,count};
}
void check_chain(const std::vector<int>& a,const std::vector<int>& ids,bool weak,int length) {
    assert(static_cast<int>(ids.size())==length);
    for (unsigned i=0;i<ids.size();++i) {
        assert(ids[i]>=0 && ids[i]<static_cast<int>(a.size()));
        if (i) { assert(ids[i-1]<ids[i]); assert(weak ? a[ids[i-1]]<=a[ids[i]] : a[ids[i-1]]<a[ids[i]]); }
    }
}
i64 brute_jobs(const std::vector<Job>& jobs,bool touch) {
    i64 best=0;
    for (unsigned mask=0;mask<(1U<<jobs.size());++mask) {
        std::vector<Job> selected; i64 value=0;
        for (unsigned i=0;i<jobs.size();++i) if (mask&(1U<<i)) { selected.push_back(jobs[i]);value+=jobs[i].reward; }
        std::sort(selected.begin(),selected.end(),[](Job a,Job b) { return a.start!=b.start ? a.start<b.start : a.end<b.end; });
        bool ok=true;
        for (unsigned i=1;i<selected.size();++i)
            if (touch ? selected[i-1].end>selected[i].start : selected[i-1].end>=selected[i].start) ok=false;
        if (ok) best=std::max(best,value);
    }
    return best;
}
int main() {
    std::size_t checks=0;
    // 唯一重复的频次可大于2；其余值可缺失。
    for (int n=1;n<=7;++n) for (int d=1;d<=n;++d)
        for (int mask=0;mask<(1<<n);++mask) {
            std::vector<int> a;
            for (int v=1;v<=n;++v) if (v!=d && (mask&(1<<(v-1)))) a.push_back(v);
            while (a.size()<static_cast<unsigned>(n+1)) a.push_back(d);
            std::shuffle(a.begin(),a.end(),rng);
            assert(duplicate_manual(a)==d);assert(duplicate_standard(a)==d);++checks;
        }
    for (unsigned universe=1;universe<=33;++universe) for (int trial=0;trial<50;++trial) {
        std::vector<std::uint32_t> values;
        const auto len=static_cast<unsigned>(rnd(static_cast<int>(universe)));
        for (unsigned i=0;i<len;++i) values.push_back(static_cast<std::uint32_t>(rnd(static_cast<int>(universe))));
        const auto missing=missing_domain(values,universe);
        assert(missing<universe && std::find(values.begin(),values.end(),missing)==values.end());++checks;
    }
    assert(missing_domain({},1ULL<<32)==0);
    std::mt19937_64 engine(20261028);
    for (int trial=0;trial<400;++trial) {
        std::vector<int> weights(1+rnd(9));
        for (auto& w:weights) w=rnd(5); // 合法零权重扩展，总权重强制为正
        weights[0]+=1;
        const auto p=cumulative_manual(weights), q=cumulative_standard(weights);
        assert(p==q);
        std::vector<int> counts(weights.size());
        for (i64 ticket=1;ticket<=p.back();++ticket) {
            i64 sum=0;int expected=0;
            while ((sum+=weights[expected])<ticket) ++expected;
            assert(ticket_manual(p,ticket)==expected);assert(ticket_standard(q,ticket)==expected);
            ++counts[expected];++checks;
        }
        assert(counts==weights);
        for (int j=0;j<20;++j) {const int i=sample_index(q,engine);assert(i>=0 && i<static_cast<int>(weights.size()) && weights[i]>0);}
    }
    assert(cumulative_standard({INT_MAX,INT_MAX}).back()==2LL*INT_MAX);
    for (int trial=0;trial<220;++trial) {
        const int r=1+rnd(6),c=1+rnd(6);
        std::vector<std::vector<int>> a(r,std::vector<int>(c));std::vector<int> flat;
        for (int i=0;i<r;++i) for (int j=0;j<c;++j) {
            a[i][j]=std::max(i?a[i-1][j]:-20,j?a[i][j-1]:-20)+rnd(4);
            flat.push_back(a[i][j]);
        }
        std::sort(flat.begin(),flat.end());
        for (int k=1;k<=r*c;++k) {assert(matrix_kth_manual(a,k)==flat[k-1]);assert(matrix_kth_standard(a,k)==flat[k-1]);++checks;}
    }
    for (int trial=0;trial<320;++trial) {
        std::vector<int> a(2+rnd(10));for(auto&v:a)v=rnd(15)-7;
        std::vector<i64> distances;
        for(unsigned i=0;i<a.size();++i)for(unsigned j=i+1;j<a.size();++j) distances.push_back(std::abs(static_cast<i64>(a[i])-a[j]));
        std::sort(distances.begin(),distances.end());
        for(int k=1;k<=static_cast<int>(distances.size());++k){assert(pair_distance_manual(a,k)==distances[k-1]);assert(pair_distance_standard(a,k)==distances[k-1]);++checks;}
    }
    assert(pair_distance_manual({INT_MIN,INT_MAX},1)==4294967295LL);
    assert(pair_distance_standard({INT_MIN,INT_MAX},1)==4294967295LL);
    for(int m=1;m<=16;++m)for(int n=1;n<=16;++n){
        std::vector<int>a;for(int i=1;i<=m;++i)for(int j=1;j<=n;++j)a.push_back(i*j);
        std::sort(a.begin(),a.end());
        for(int k=1;k<=m*n;++k){assert(multiplication_kth_manual(m,n,k)==a[k-1]);assert(multiplication_count_manual(m,n,a[k-1])>=k);++checks;}
    }
    assert(multiplication_kth_manual(30000,30000,900000000)==900000000);
    assert(multiplication_kth_manual(30000,30000,1)==1);
    for(int cols=1;cols<=16;++cols) for(int row=1;row<=16;++row)
        for(i64 x=0;x<=256;++x) {
            i64 expected=0;
            for(int col=1;col<=cols;++col) expected+=1LL*row*col<=x;
            assert(multiplication_row_standard(cols,x,row)==expected);
        }
    for(int trial=0;trial<400;++trial){
        std::vector<int>a(rnd(9)),b(rnd(9));if(a.empty()&&b.empty())b.push_back(0);
        for(auto&v:a)v=rnd(9)-4;
        for(auto&v:b)v=rnd(9)-4;
        std::sort(a.begin(),a.end());std::sort(b.begin(),b.end());
        auto flat=a;flat.insert(flat.end(),b.begin(),b.end());std::sort(flat.begin(),flat.end());
        for(int k=1;k<=static_cast<int>(flat.size());++k){assert(two_array_kth(a,b,k)==flat[k-1]);assert(two_array_merge(a,b,k)==flat[k-1]);++checks;}
        const auto n=flat.size();const double median=n%2 ? flat[n/2] : (static_cast<i64>(flat[n/2-1])+flat[n/2])/2.0;
        assert(two_array_median(a,b)==median);
    }
    assert(two_array_median({INT_MAX},{INT_MAX})==INT_MAX);
    assert(two_array_median({INT_MIN},{INT_MIN})==INT_MIN);
    for(int n=0;n<=7;++n){
        int count=1;for(int i=0;i<n;++i)count*=3;
        for(int mask=0;mask<count;++mask){
            int code=mask;std::vector<int>a(n);for(auto&v:a){v=code%3-1;code/=3;}
            const auto strong=brute_lis(a,false),weak=brute_lis(a,true);
            check_chain(a,lis_manual(a),false,strong.first);check_chain(a,lis_standard(a),false,strong.first);
            check_chain(a,lis_manual(a,true),true,weak.first);check_chain(a,lis_standard(a,true),true,weak.first);
            assert(lis_count(a)==strong.second);++checks;
        }
    }
    for(int trial=0;trial<160;++trial){
        std::vector<std::pair<int,int>> e(1+rnd(8));for(auto&v:e)v={1+rnd(5),1+rnd(5)};
        int expected=0;
        for(unsigned mask=1;mask<(1U<<e.size());++mask){
            std::vector<std::pair<int,int>> v;for(unsigned i=0;i<e.size();++i)if(mask&(1U<<i))v.push_back(e[i]);
            std::sort(v.begin(),v.end());bool ok=true;
            for(unsigned i=1;i<v.size();++i)if(v[i-1].first>=v[i].first||v[i-1].second>=v[i].second)ok=false;
            if(ok)expected=std::max(expected,static_cast<int>(v.size()));
        }
        assert(envelopes_standard(e)==expected);++checks;
    }
    // 最终唯一长链，并不约束较短、不被延伸的中间状态计数。
    std::vector<int> huge_short_counts;
    for(int group=0;group<80;++group){huge_short_counts.push_back(1000+group);huge_short_counts.push_back(1000+group);}
    for(int value=-81;value<0;++value)huge_short_counts.push_back(value);
    assert(lis_count(huge_short_counts)==1);
    std::vector<int> legal_large_count;
    for(int group=0;group<19;++group)for(int copy=0;copy<3;++copy)legal_large_count.push_back(group);
    assert(lis_count(legal_large_count)==1162261467LL);
    std::vector<int> capped_terminal_count;
    for(int group=0;group<63;++group)for(int copy=0;copy<2;++copy)capped_terminal_count.push_back(group);
    assert(lis_count(capped_terminal_count)==std::numeric_limits<i64>::max());
    for(bool touch:{false,true})for(int trial=0;trial<300;++trial){
        std::vector<Job> jobs(rnd(10));for(auto&j:jobs){j.start=rnd(9);j.end=j.start+(touch?1:0)+rnd(4);j.reward=1+rnd(20);}
        const auto expected=brute_jobs(jobs,touch);
        assert(jobs_manual(jobs,touch)==expected);assert(jobs_standard(jobs,touch)==expected);++checks;
    }
    assert(jobs_manual({{1,2,5},{2,3,7}},false)==7);
    assert(jobs_standard({{1,2,5},{2,3,7}},true)==12);
    assert(jobs_manual({{1,1,1000000000},{2,2,1000000000},{3,3,1000000000}})==3000000000LL);
    const int maxfloor=35;
    std::vector<std::vector<int>> dp(7,std::vector<int>(maxfloor+1));
    for(int f=1;f<=maxfloor;++f)dp[1][f]=f;
    for(int e=2;e<=6;++e)for(int f=1;f<=maxfloor;++f){
        dp[e][f]=f;
        for(int drop=1;drop<=f;++drop)dp[e][f]=std::min(dp[e][f],1+std::max(dp[e-1][drop-1],dp[e][f-drop]));
    }
    for(int e=1;e<=6;++e)for(int f=0;f<=maxfloor;++f){assert(egg_moves_manual(e,f)==dp[e][f]);assert(egg_moves_coverage(e,f)==dp[e][f]);++checks;}
    for(int e:{1,2,3,10,100})for(int f:{1,2,1000,10000})assert(egg_moves_manual(e,f)==egg_moves_coverage(e,f));
    assert(egg_moves_manual(1,10000)==10000);assert(egg_moves_manual(2,10000)==141);
    std::cout<<"selection: "<<checks<<" independent cases passed\n";
}
