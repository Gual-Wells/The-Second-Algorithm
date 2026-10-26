#include "../../content/binary-search/组合判定.cpp"
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <numeric>
#include <random>

using namespace binary_challenge;
std::mt19937 rng(20261026);
int ri(int l,int r){return l+static_cast<int>(rng()%(r-l+1));}
i64 checks=0;
void verify(bool ok,const char* label){++checks;if(!ok){std::cerr<<"FAIL "<<label<<'\n';std::exit(1);}}

std::pair<long double,int> subsetCoverOracle(const vector<int>& a) {
    int n=a.size(),bestMedian=-1;long double bestAverage=-1;
    for(int mask=1;mask<(1<<n);++mask) {
        bool legal=true;
        for(int i=0;i+1<n;++i)if(((mask>>i)&3)==0)legal=false;
        if(!legal)continue;
        vector<int>selected;i64 sum=0;
        for(int i=0;i<n;++i)if(mask>>i&1){selected.push_back(a[i]);sum+=a[i];}
        std::sort(selected.begin(),selected.end());
        bestAverage=std::max(bestAverage,static_cast<long double>(sum)/selected.size());
        bestMedian=std::max(bestMedian,selected[(selected.size()-1)/2]);
    }
    return {bestAverage,bestMedian};
}

int pondOracle(const vector<vector<int>>& a,int k) {
    int n=a.size(),best=1000000000;
    for(int r=0;r+k<=n;++r)for(int c=0;c+k<=n;++c) {
        vector<int>window;
        for(int i=r;i<r+k;++i)for(int j=c;j<c+k;++j)window.push_back(a[i][j]);
        std::sort(window.begin(),window.end());best=std::min(best,window[(k*k-1)/2]);
    }
    return best;
}

// 与实现的Dijkstra独立：反复松弛所有有向网格边。
i64 wallBellmanFord(const vector<std::string>& grid,int cost) {
    int h=grid.size(),w=grid[0].size(),start=-1,goal=-1;
    for(int r=0;r<h;++r)for(int c=0;c<w;++c){if(grid[r][c]=='S')start=r*w+c;if(grid[r][c]=='G')goal=r*w+c;}
    vector<i64>d(h*w,1000000000000LL);d[start]=0;
    for(int pass=0;pass<h*w-1;++pass) {
        bool changed=false;
        for(int r=0;r<h;++r)for(int c=0;c<w;++c) {
            const int dr[]={-1,1,0,0},dc[]={0,0,-1,1};
            for(int z=0;z<4;++z) {
                int nr=r+dr[z],nc=c+dc[z];if(nr<0||nr>=h||nc<0||nc>=w)continue;
                i64 proposal=d[r*w+c]+(grid[nr][nc]=='#'?cost:1);
                if(proposal<d[nr*w+nc]){d[nr*w+nc]=proposal;changed=true;}
            }
        }
        if(!changed)break;
    }
    return d[goal];
}

// 按字典序枚举所有全排列，直接检查每条观察的相对次序。
vector<int> permutationOracle(int n,const vector<vector<int>>& observations,int prefix) {
    vector<int>order(n);std::iota(order.begin(),order.end(),0);
    do {
        vector<int>position(n);
        for(int i=0;i<n;++i)position[order[i]]=i;
        bool valid=true;
        for(int i=0;i<prefix;++i)for(int j=1;j<static_cast<int>(observations[i].size());++j)
            if(position[observations[i][j-1]]>=position[observations[i][j]])valid=false;
        if(valid)return order;
    } while(std::next_permutation(order.begin(),order.end()));
    return {};
}

int main() {
    for(int run=0;run<400;++run) {
        vector<int>a(ri(2,9));for(int&x:a)x=ri(1,20);
        auto [avg,median]=subsetCoverOracle(a);
        verify(std::abs(maxCoveredAverage(a)-avg)<1e-7L,"adjacent coverage average vs all subsets");
        verify(maxCoveredLowerMedian(a)==median,"adjacent coverage median vs all subsets");
        for(int x=0;x<=21;++x) {
            verify(coveredAverageAtLeast(a,x)==(avg>=x),"coverage average threshold");
            verify(coveredLowerMedianAtLeast(a,x)==(median>=x),"coverage lower-median strict threshold");
        }
    }
    verify(!coveredAverageAtLeast({100,1,1,100},80),"middle pair cannot both be skipped");
    verify(maxCoveredLowerMedian({2,1,2,1,1,10})==2,"ABC236 sample median");
    verify(std::abs(maxCoveredAverage({2,1,2,1,1,10})-4)<1e-9L,"ABC236 sample average");
    for(int run=0;run<200;++run) {
        int n=ri(1,5);vector<vector<int>>a(n,vector<int>(n));
        for(auto&row:a)for(int&x:row)x=ri(0,15);
        for(int k=1;k<=n;++k) {
            int expected=pondOracle(a,k);
            verify(minSquareLowerMedian(a,k)==expected,"window median vs actual window sort");
            for(int x=0;x<=16;++x)verify(squareMedianAtMost(a,k,x)==(expected<=x),"window count boundary and duplicates");
        }
    }
    verify(minSquareLowerMedian({{1,2},{100,101}},2)==2,"even window lower median");
    verify(minSquareLowerMedian({{1,1,100},{100,100,100},{100,100,100}},2)==1,"spatially close small values");
    verify(minSquareLowerMedian({{1,100,100},{100,100,100},{100,100,1}},2)==100,"same global values far apart");
    for(int run=0;run<150;++run) {
        int h=ri(3,4),w=ri(2,4);vector<std::string>grid(h,std::string(w,'.'));
        for(auto&row:grid)for(char&c:row)if(ri(0,2)==0)c='#';
        for(int c=0;c<w;++c)grid[1][c]='#'; // 黑格屏障：每条S->G路径均经过黑格。
        grid[0][0]='S';grid[h-1][w-1]='G';int limit=ri(h+w-2,25),expected=1;
        for(int cost=1;cost<=limit;++cost) {
            i64 time=wallBellmanFord(grid,cost);
            verify(shortestWallTime(grid,cost)==time,"weighted-grid Dijkstra vs Bellman-Ford");
            if(time<=limit)expected=cost;
        }
        verify(maxWallCost(grid,limit)==expected,"wall-cost last feasible vs full parameter enumeration");
    }
    verify(shortestWallTime({"S#G","..."},1)==2,"path with wall is initially shortest");
    verify(shortestWallTime({"S#G","..."},5)==4,"optimal path changes with parameter");
    verify(shortestWallTime({"S#G"},5)==6,"charge entering wall and entering G");
    for(int run=0;run<170;++run) {
        int n=ri(1,6),m=ri(0,7);vector<vector<int>>observations;
        for(int i=0;i<m;++i) {
            vector<int>o(n);std::iota(o.begin(),o.end(),0);std::shuffle(o.begin(),o.end(),rng);o.resize(ri(1,n));observations.push_back(o);
        }
        int expected=0;vector<int>order;
        for(int prefix=0;prefix<=m;++prefix) {
            auto possible=permutationOracle(n,observations,prefix);
            verify(observationPrefixAcyclic(n,observations,prefix)==!possible.empty(),"prefix DAG vs all permutations");
            if(!possible.empty()){expected=prefix;order=possible;}
        }
        auto actual=longestObservationPrefix(n,observations);
        verify(actual.prefix==expected,"longest consistent observation prefix");
        verify(actual.order==order,"lexicographically least full order vs permutations");
    }
    auto cycle=longestObservationPrefix(4,{{0,1},{1,2},{2,0}});
    verify(cycle.prefix==2&&cycle.order==vector<int>({0,1,2,3}),"cycle prefix and isolated vertex");
    auto duplicates=longestObservationPrefix(3,{{0,1},{0,1},{1,2}});
    verify(duplicates.prefix==3&&duplicates.order==vector<int>({0,1,2}),"repeated edges indegree accounting");
    for(int run=0;run<400;++run) {
        int n=ri(2,9);vector<i64>a(n),pairs;
        for(i64&x:a)x=ri(-9,9);
        for(int i=0;i<n;++i)for(int j=i+1;j<n;++j)pairs.push_back(a[i]*a[j]);
        std::sort(pairs.begin(),pairs.end());SignedPairProducts counter(a);
        for(int x=-90;x<=90;++x)verify(counter.countAtMost(x)==std::upper_bound(pairs.begin(),pairs.end(),x)-pairs.begin(),"unordered signed count vs distinct-index pair enumeration");
        for(int k=1;k<=static_cast<int>(pairs.size());++k)verify(kthUnorderedProduct(a,k)==pairs[k-1],"unordered kth product vs sorted pairs");
        vector<i64>rides(n),rewards;
        for(i64&x:rides){x=ri(1,9);for(int y=x;y>=1;--y)rewards.push_back(y);}
        std::sort(rewards.rbegin(),rewards.rend());i64 total=0;
        for(int k=0;k<=static_cast<int>(rewards.size())+3;++k) {
            if(k>0&&k<=static_cast<int>(rewards.size()))total+=rewards[k-1];
            verify(amusementReward(rides,k)==total,"descending reward columns vs explicit full sort");
        }
    }
    verify(SignedPairProducts({-3,0,2,2}).countAtMost(0)==5,"ordered-vs-unordered distinguishing case");
    verify(kthUnorderedProduct({-1000000000LL,-1000000000LL,1000000000LL},1)==-1000000000000000000LL,"negative product extreme");
    verify(kthUnorderedProduct({-1000000000LL,-1000000000LL,1000000000LL},3)==1000000000000000000LL,"positive product extreme");
    verify(SignedPairProducts(vector<i64>(200000,0)).countAtMost(0)==19999900000LL,"pair count needs64 bits");
    verify(amusementReward({3,3},3)==8,"reward tie boundary");
    verify(amusementReward({2,3},2021)==9,"at-most K stops after positive rewards");
    verify(amusementReward({2000000000LL},2000000000LL)==2000000001000000000LL,"arithmetic reward64-bit extreme");
    std::cout<<"PASS "<<checks<<" independent C++ checks; seed=20261026\n";
}
