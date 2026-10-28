#include "../../content/binary/advanced.cpp"
#include <cassert>
#include <iostream>
#include <random>

using namespace binary_advanced;
std::mt19937 rng(20261028);
int roll(int n) { return static_cast<int>(rng()%static_cast<unsigned>(n)); }

void test_frequency() {
    for (int trial=0; trial<180; ++trial) {
        int n=1+roll(45);
        FrequencyTree tree(n);
        std::vector<i64> f(n,0);
        for (int step=0; step<90; ++step) {
            int p=roll(n); i64 value=roll(6);
            tree.add(p,value-f[p]); f[p]=value;
            i64 total=std::accumulate(f.begin(),f.end(),i64{0});
            for (i64 k=0; k<=total+1; ++k) {
                int expected=n; i64 sum=0;
                if (k>0) for(int i=0;i<n;++i) if((sum+=f[i])>=k){expected=i;break;}
                assert(tree.kth(k)==expected);
                assert(kth_with_prefix(f,k)==expected);
            }
            for (int end=0;end<=n;++end)
                assert(tree.prefix(end)==std::accumulate(f.begin(),f.begin()+end,i64{0}));
        }
        std::vector<i64> values(n);std::iota(values.begin(),values.end(),i64{17});
        auto remaining=values;std::vector<int> ranks;std::vector<i64> expected;
        for(int left=n;left>0;--left){int rank=1+roll(left);ranks.push_back(rank);
            expected.push_back(remaining[rank-1]);remaining.erase(remaining.begin()+rank-1);}
        assert(remove_by_rank(values,ranks)==expected);
    }
    FrequencyTree empty(0);assert(empty.kth(1)==0);
    FrequencyTree large(200000);
    for(int i=0;i<200000;++i) large.add(i,1);
    assert(large.kth(200000)==199999);
    large.add(199999,-1);assert(large.kth(200000)==200000);
}
void test_summary() {
    for(int trial=0;trial<250;++trial){
        int n=1+roll(50);std::vector<i64>a(n);for(auto&x:a)x=roll(31)-15;
        MaxTree tree(a);
        for(int step=0;step<100;++step){
            int p=roll(n);i64 v=roll(41)-20;a[p]=v;tree.set(p,v);
            int start=roll(n+1);i64 threshold=roll(45)-22;
            int expected=n;for(int i=start;i<n;++i)if(a[i]>=threshold){expected=i;break;}
            assert(tree.first_at_least(start,threshold)==expected);
            assert(first_at_least_linear(a,start,threshold)==expected);
            int l=roll(n+1),r=roll(n+1);if(l>r)std::swap(l,r);
            i64 best=std::numeric_limits<i64>::lowest();for(int i=l;i<r;++i)best=std::max(best,a[i]);
            assert(tree.range_max(l,r)==best);
        }
        assert(tree.first_at_least(0,std::numeric_limits<i64>::lowest())==0);
        assert(tree.first_at_least(0,std::numeric_limits<i64>::max())==n);
    }
    MaxTree empty({});assert(empty.first_at_least(0,0)==0);
    std::vector<i64> large(200000,1);MaxTree big(large);
    big.set(199999,2);assert(big.first_at_least(0,2)==199999);
}
int plain_lca(const std::vector<int>&p,int a,int b){
    std::vector<unsigned char> mark(p.size(),0);
    for(;;a=p[a]){mark[a]=1;if(a==p[a])break;}
    while(!mark[b]) b=p[b];
    return b;
}
void test_ancestors(){
    for(int trial=0;trial<200;++trial){
        int n=1+roll(60);std::vector<int>p(n,0);std::vector<i64>w(n,0);
        for(int i=1;i<n;++i){p[i]=roll(i);w[i]=w[p[i]]+roll(4);}
        Ancestors tree(p);
        for(int a=0;a<n;++a)for(int b=0;b<n;++b){int expected=plain_lca(p,a,b);
            assert(tree.lca(a,b)==expected);assert(lca_with_find(p,a,b)==expected);}
        for(int v=0;v<n;++v){int a=v;
            for(int k=0;k<=n+1;++k){assert(tree.kth(v,k)==a);if(a!=-1)a=(a==0?-1:p[a]);}
            assert(tree.kth(v,1000000000LL)==-1);}
        std::vector<std::pair<int,i64>>q;
        for(int i=0;i<150;++i)q.push_back({roll(n),roll(30)-2});
        auto got=threshold_ancestor_queries(p,w,q);
        for(int i=0;i<static_cast<int>(q.size());++i){int expected=-1,v=q[i].first;
            for(;;v=p[v]){if(w[v]>=q[i].second)expected=v;if(v==0)break;}
            assert(got[i]==expected);}
    }
    int n=200000;std::vector<int>chain(n);for(int i=1;i<n;++i)chain[i]=i-1;
    Ancestors big(chain);assert(big.lca(n-1,n/2)==n/2);assert(big.kth(n-1,n-1)==0);
    std::vector<i64>w(n);std::iota(w.begin(),w.end(),i64{0});
    assert(threshold_ancestor_queries(chain,w,{{n-1,n/2},{0,1},{0,0}})==std::vector<int>({n/2,-1,0}));
}
int cyclic_oracle(const std::vector<i64>&a,i64 cap){
    int n=static_cast<int>(a.size()),answer=n;
    for(int start=0;start<n;++start){
        std::vector<int>dp(n+1,n+1);dp[0]=0;
        for(int i=1;i<=n;++i){i64 sum=0;
            for(int j=i-1;j>=0;--j){sum+=a[(start+j)%n];if(sum<=cap)dp[i]=std::min(dp[i],dp[j]+1);}}
        answer=std::min(answer,dp[n]);
    }return answer;
}
void test_cyclic(){
    for(int trial=0;trial<2500;++trial){int n=1+roll(11);std::vector<i64>a(n);
        for(auto&x:a) x=1+roll(9);
        i64 cap=*std::max_element(a.begin(),a.end())+roll(35);
        int expected=cyclic_oracle(a,cap);
        assert(min_cyclic_parts(a,cap)==expected);assert(min_cyclic_parts_with_bounds(a,cap)==expected);}
    assert(min_cyclic_parts({2,2,2,1,3,1,2,1},5)==3);
    std::vector<i64>large(200000,1);
    assert(min_cyclic_parts(large,1)==200000);
    assert(min_cyclic_parts_with_bounds(large,1000000000000000000LL)==1);
}
int first_day_oracle(int n,const std::vector<std::pair<int,int>>&edges,int a,int b){
    for(int day=0;day<=static_cast<int>(edges.size());++day){
        std::vector<std::vector<int>>g(n);
        for(int i=0;i<day;++i){g[edges[i].first].push_back(edges[i].second);g[edges[i].second].push_back(edges[i].first);}
        std::vector<int>pending{a};std::vector<unsigned char>seen(n,0);seen[a]=1;
        for(std::size_t head=0;head<pending.size();++head)
            for(int v:g[pending[head]])if(!seen[v]){seen[v]=1;pending.push_back(v);}
        if(seen[b])return day;
    }return -1;
}
void test_pbs(){
    DisjointSet ds(3);ds.unite(0,1);assert(ds.find(0)==ds.find(1));assert(ds.find(0)!=ds.find(2));
    for(int trial=0;trial<350;++trial){int n=1+roll(9),m=roll(22);
        std::vector<std::pair<int,int>>e,q;
        for(int i=0;i<m;++i)e.push_back({roll(n),roll(n)});
        for(int a=0;a<n;++a)for(int b=0;b<n;++b)q.push_back({a,b});
        auto got=first_connection_days(n,e,q);
        for(int i=0;i<static_cast<int>(q.size());++i)assert(got[i]==first_day_oracle(n,e,q[i].first,q[i].second));}
    assert(first_connection_days(2,{},{{0,0},{0,1}})==std::vector<int>({0,-1}));
    std::vector<std::pair<int,int>>e;for(int i=1;i<200000;++i)e.push_back({i-1,i});
    assert(first_connection_days(200000,e,{{0,199999},{0,0},{10,20}})==std::vector<int>({199999,0,20}));
}
std::vector<i64> kth_oracle(std::vector<i64>a,const std::vector<RangeOperation>&ops){
    std::vector<i64>answer;
    for(auto op:ops){if(op.kind==RangeOperation::Kind::assign)a[op.left]=op.value;
        else{std::vector<i64>part(a.begin()+op.left,a.begin()+op.right+1);std::sort(part.begin(),part.end());answer.push_back(part[op.k-1]);}}
    return answer;
}
void test_dynamic_kth(){
    using K=RangeOperation::Kind;
    for(int trial=0;trial<500;++trial){int n=1+roll(25);std::vector<i64>a(n);for(auto&x:a)x=roll(17)-8;
        std::vector<RangeOperation>ops;
        for(int step=0;step<100;++step){if(roll(3)==0)ops.push_back({K::assign,roll(n),0,0,roll(25)-12});
            else{int l=roll(n),r=roll(n);if(l>r)std::swap(l,r);ops.push_back({K::query,l,r,1+roll(r-l+1),0});}}
        assert(dynamic_range_kth(a,ops)==kth_oracle(a,ops));
        auto v=compressed_values(a,ops);for(auto x:a)assert(v[value_rank(v,x)]==x);
    }
    std::vector<i64>a{5,5,-1,9};
    std::vector<RangeOperation>ops{{K::query,0,3,3,0},{K::assign,0,0,0,-10},{K::query,0,3,3,0},
        {K::assign,0,0,0,-10},{K::assign,1,0,0,-10},{K::query,0,2,2,0},
        {K::assign,3,0,0,std::numeric_limits<i64>::max()},{K::query,1,3,3,0},
        {K::assign,2,0,0,std::numeric_limits<i64>::lowest()},{K::query,0,3,1,0}};
    assert(dynamic_range_kth(a,ops)==kth_oracle(a,ops));
    assert(dynamic_range_kth({7},{{K::assign,0,0,0,7}}).empty());
    assert(dynamic_range_kth({-3,-3},{{K::query,0,1,1,0},{K::query,0,1,2,0}})==std::vector<i64>({-3,-3}));
    std::vector<i64> large(100000);std::iota(large.begin(),large.end(),i64{0});
    std::vector<RangeOperation> many;
    for(int i=0;i<50000;++i){many.push_back({K::assign,i,0,0,100000+i});many.push_back({K::query,0,99999,1,0});}
    auto actual=dynamic_range_kth(large,many);assert(actual.size()==50000);
    for(int i=0;i<50000;++i)assert(actual[i]==i+1);
}
std::vector<i64> allocation_dp(const std::vector<i64>&a){
    std::vector<i64>dp(1,0);
    for(i64 value:a){std::vector<i64>next(dp.size()+value,std::numeric_limits<i64>::lowest()/4);
        for(int old=0;old<static_cast<int>(dp.size());++old)for(i64 used=0;used<=value;++used)
            next[old+used]=std::max(next[old+used],dp[old]+used*(2*value-used+1)/2);
        dp=std::move(next);}
    return dp;
}
void test_penalty(){
    std::uint64_t arrays=0,cases=0;
    for(int n=1;n<=4;++n){int possibilities=1;for(int i=0;i<n;++i)possibilities*=6;
        for(int code=0;code<possibilities;++code){int x=code;std::vector<i64>a(n);for(auto&v:a){v=1+x%6;x/=6;}
            ++arrays;auto dp=allocation_dp(a);i64 total=std::accumulate(a.begin(),a.end(),i64{0});
            for(i64 k=0;k<=total+2;++k){auto got=maximize_fun(a,k);i64 best=0;
                for(i64 used=0;used<=std::min(k,total);++used)best=std::max(best,dp[used]);
                assert(got.value==best);assert(fun_with_priority_queue(a,k)==best);
                if(k>0){assert(got.strict_count<got.used_count);assert(got.used_count<=got.strict_count+got.equal_count);
                    assert(got.value==got.penalized_value+got.cutoff*got.used_count);
                    i64 penalized=std::numeric_limits<i64>::lowest(),fewest=total+1,most=-1;
                    for(i64 used=0;used<=total;++used){i64 candidate=dp[used]-got.cutoff*used;
                        if(candidate>penalized){penalized=candidate;fewest=most=used;}
                        else if(candidate==penalized)most=used;}
                    assert(got.penalized_value==penalized);
                    assert(got.strict_count==fewest);assert(got.strict_count+got.equal_count==most);
                }
                ++cases;
            }
        }
    }
    assert(maximize_fun({5,5},3).value==14);assert(maximize_fun({2,3},2021).value==9);
    std::vector<i64>large(100000,2000000000LL);
    assert(maximize_fun(large,1).value==2000000000LL);
    i64 each=20000,A=2000000000LL;
    assert(maximize_fun(large,2000000000LL).value==100000LL*(each*(2*A-each+1)/2));
    assert(maximize_fun({A},A).value==A*(A+1)/2);
    std::cout<<"allocation arrays="<<arrays<<" budgets="<<cases<<'\n';
}
int main(){
    test_frequency();test_summary();test_ancestors();test_cyclic();test_pbs();test_dynamic_kth();test_penalty();
    std::cout<<"chapter01 advanced: all independent oracles passed\n";
}
