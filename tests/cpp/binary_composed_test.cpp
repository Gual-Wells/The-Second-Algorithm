#include "../../content/binary-search/组合判定.cpp"
#include <cassert>
#include <iostream>
#include <random>
#include <tuple>

using namespace binary_composed;
std::mt19937 rng(20261026);
int ri(int l, int r) { return l + static_cast<int>(rng() % (r-l+1)); }
long long checks = 0;
void verify(bool ok, const char* name) {
    ++checks;
    if (!ok) { std::cerr << "FAILED: " << name << "\n"; std::exit(1); }
}

i64 brutePartition(const vector<i64>& a, int k, bool minimizeMaximum) {
    i64 best = minimizeMaximum ? (1LL<<60) : -(1LL<<60);
    int n = a.size();
    for (int mask=0; mask<(1<<(n-1)); ++mask) {
        if (__builtin_popcount(static_cast<unsigned>(mask)) != k-1) continue;
        i64 sum=0, value=minimizeMaximum ? -(1LL<<60) : (1LL<<60);
        for (int i=0; i<n; ++i) {
            sum += a[i];
            if (i==n-1 || (mask>>i&1)) {
                value = minimizeMaximum ? std::max(value,sum) : std::min(value,sum);
                sum=0;
            }
        }
        best = minimizeMaximum ? std::min(best,value) : std::max(best,value);
    }
    return best;
}

i64 bruteMedian(vector<i64> a, int budget) {
    i64 best=-(1LL<<60);
    std::function<void(int,int)> visit = [&](int pos,int left) {
        if (pos==static_cast<int>(a.size())) {
            auto b=a; std::sort(b.begin(),b.end()); best=std::max(best,b[b.size()/2]); return;
        }
        for(int x=0;x<=left;++x) { a[pos]+=x; visit(pos+1,left-x); a[pos]-=x; }
    };
    visit(0,budget); return best;
}

int bruteMatching(const vector<int>& tasks,const vector<int>& workers,int pills,int boost) {
    int n=tasks.size(),m=workers.size();
    vector<vector<vector<int>>> memo(n+1,vector<vector<int>>(1<<m,vector<int>(pills+1,-1)));
    std::function<int(int,int,int)> solve=[&](int i,int mask,int p) {
        if(i==n) return 0;
        int& ans=memo[i][mask][p]; if(ans!=-1) return ans;
        ans=solve(i+1,mask,p);
        for(int j=0;j<m;++j) if(!(mask>>j&1)) {
            if(workers[j]>=tasks[i]) ans=std::max(ans,1+solve(i+1,mask|(1<<j),p));
            if(p && workers[j]+boost>=tasks[i]) ans=std::max(ans,1+solve(i+1,mask|(1<<j),p-1));
        }
        return ans;
    };
    return solve(0,0,pills);
}

int brutePackmen(const std::string& s) {
    vector<int> p,t;
    for(int i=0;i<static_cast<int>(s.size());++i) {if(s[i]=='P')p.push_back(i);if(s[i]=='*')t.push_back(i);}
    vector<int> l(p.size(),100),r(p.size(),-1);
    int best=100;
    std::function<void(int)> dfs=[&](int i) {
        if(i==static_cast<int>(t.size())) {
            int time=0;
            for(int j=0;j<static_cast<int>(p.size());++j) if(r[j]>=0) {
                int left=std::max(0,p[j]-l[j]),right=std::max(0,r[j]-p[j]);
                time=std::max(time,std::min(2*left+right,left+2*right));
            }
            best=std::min(best,time);return;
        }
        for(int j=0;j<static_cast<int>(p.size());++j) {
            int oldl=l[j],oldr=r[j];l[j]=std::min(l[j],t[i]);r[j]=std::max(r[j],t[i]);
            dfs(i+1);l[j]=oldl;r[j]=oldr;
        }
    };
    dfs(0);return best;
}

i64 bruteCover(vector<i64> p,int k) {
    std::sort(p.begin(),p.end());int n=p.size();i64 best=1LL<<60;
    for(int mask=0;mask<(1<<(n-1));++mask) {
        if(__builtin_popcount(static_cast<unsigned>(mask))+1>k)continue;
        int first=0;i64 radius=0;
        for(int i=0;i<n;++i)if(i==n-1||(mask>>i&1)) {
            radius=std::max(radius,(p[i]-p[first]+1)/2);first=i+1;
        }
        best=std::min(best,radius);
    }
    return best;
}

i64 bruteBus(vector<i64> a,int buses,int cap) {
    std::sort(a.begin(),a.end());int n=a.size();i64 best=1LL<<60;
    for(int mask=0;mask<(1<<(n-1));++mask) {
        if(__builtin_popcount(static_cast<unsigned>(mask))+1>buses)continue;
        int first=0;i64 wait=0;bool ok=true;
        for(int i=0;i<n;++i)if(i==n-1||(mask>>i&1)) {
            if(i-first+1>cap)ok=false;
            wait=std::max(wait,a[i]-a[first]);first=i+1;
        }
        if(ok)best=std::min(best,wait);
    }
    return best;
}

i64 bruteSpacing(const vector<std::pair<i64,i64>>& ranges,int cows) {
    vector<int> points;
    for(auto [l,r]:ranges)for(int x=l;x<=r;++x)points.push_back(x);
    i64 best=0;
    for(int mask=0;mask<(1<<points.size());++mask) {
        if(__builtin_popcount(static_cast<unsigned>(mask))!=cows)continue;
        int prev=-1000,gap=1000;
        for(int i=0;i<static_cast<int>(points.size());++i)if(mask>>i&1) {
            gap=std::min(gap,points[i]-prev);prev=points[i];
        }
        best=std::max(best,static_cast<i64>(gap));
    }
    return best;
}

int referenceEffort(const vector<vector<int>>& a) {
    int n=a.size(),m=a[0].size();vector<int>d(n*m,1000000000);d[0]=0;
    using State=std::pair<int,int>;
    std::priority_queue<State,vector<State>,std::greater<State>>q;q.push({0,0});
    while(!q.empty()) {
        auto [cost,u]=q.top();q.pop();if(cost!=d[u])continue;
        int r=u/m,c=u%m;const int dr[]={-1,1,0,0},dc[]={0,0,-1,1};
        for(int z=0;z<4;++z) {
            int nr=r+dr[z],nc=c+dc[z];if(nr<0||nr>=n||nc<0||nc>=m)continue;
            int v=nr*m+nc,nd=std::max(cost,std::abs(a[r][c]-a[nr][nc]));
            if(nd<d[v]){d[v]=nd;q.push({nd,v});}
        }
    }
    return d.back();
}

int bruteWind(int sx,int sy,int tx,int ty,const std::string& wind,int days) {
    std::set<std::pair<int,int>> current{{sx,sy}};
    for(int t=0;t<=days;++t) {
        if(current.count({tx,ty}))return t;
        std::set<std::pair<int,int>> next;
        char w=wind[t%wind.size()];int wx=(w=='R')-(w=='L'),wy=(w=='U')-(w=='D');
        const int dx[]={0,-1,1,0,0},dy[]={0,0,0,-1,1};
        for(auto [x,y]:current)for(int z=0;z<5;++z)next.insert({x+wx+dx[z],y+wy+dy[z]});
        current=std::move(next);
    }
    return -1;
}

void numericalAndRanks() {
    for(int run=0;run<350;++run) {
        int n=ri(1,8),L=ri(1,n),U=ri(L,n);vector<double>a(n);vector<int>v(n);
        for(int i=0;i<n;++i)a[i]=v[i]=ri(-5,8);
        double best=-1e100;int med=-100;
        for(int l=0;l<n;++l)for(int r=l;r<n;++r) {
            int len=r-l+1;
            if(len>=L&&len<=U)best=std::max(best,std::accumulate(a.begin()+l,a.begin()+r+1,0.0)/len);
            if(len>=L){vector<int>b(v.begin()+l,v.begin()+r+1);std::sort(b.begin(),b.end());med=std::max(med,b[(len-1)/2]);}
        }
        verify(std::abs(maxAverage(a,L,U)-best)<1e-7,"average L,U vs all subarrays");
        verify(maxLowerMedian(v,L)==med,"lower median vs all sorted subarrays");
        for(int t=-6;t<=9;++t)verify(averageAtLeast(a,L,U,t)==(best>=t),"average predicate exact integer thresholds");
    }
    for(int run=0;run<350;++run) {
        int n=ri(1,7),m=ri(1,7);vector<i64>a(n),b(m),products,sums;
        for(auto&x:a)x=ri(-7,7);
        for(auto&x:b)x=ri(-7,7);
        std::sort(a.begin(),a.end());std::sort(b.begin(),b.end());
        for(i64 x:a)for(i64 y:b){products.push_back(x*y);sums.push_back(x+y);}
        std::sort(products.begin(),products.end());std::sort(sums.begin(),sums.end());
        for(int k=1;k<=n*m;++k) {
            verify(kthProduct(a,b,k)==products[k-1],"signed products vs Cartesian sort");
            verify(kthPairSum(a,b,k)==sums[k-1],"pair sums vs Cartesian sort");
        }
        for(int t=-50;t<=50;++t)verify(countProductsLE(a,b,t)==std::upper_bound(products.begin(),products.end(),t)-products.begin(),"product count vs sorted reference");
        vector<i64>ordered;
        for(i64 x:a)for(i64 y:a)ordered.push_back(x+y);
        std::sort(ordered.rbegin(),ordered.rend());i64 total=0;
        for(int k=1;k<=n*n;++k){total+=ordered[k-1];verify(topPairSum(a,k)==total,"top M ordered pairs and duplicate threshold correction");}
    }
    verify(kthProduct({-100000,0,100000},{-100000,0,100000},1)==-10000000000LL,"64-bit product bound");
    verify(kthProduct({-100000,0,100000},{-100000,0,100000},9)==10000000000LL,"64-bit product upper bound");
}

int main() {
    for(int run=0;run<350;++run) {
        int n=ri(1,8);vector<i64>a(n);for(auto&x:a)x=ri(0,9);
        for(int k=1;k<=n;++k)verify(maxMinSegmentSum(a,k)==brutePartition(a,k,false),"max-min nonnegative partition vs cut enumeration");
        verify(minCoverRadius(a,ri(1,n))>=0,"cover nonnegative bound");
    }
    for(int run=0;run<100;++run) {
        vector<i64>a(2*ri(0,2)+1);for(auto&x:a)x=ri(-3,6);int budget=ri(0,5);
        verify(maxMedian(a,budget)==bruteMedian(a,budget),"budget median vs increment-distribution enumeration");
    }
    for(int run=0;run<250;++run) {
        int n=ri(1,8),m=ri(1,8);vector<int>a(n),b(n),nails(m);
        for(int i=0;i<n;++i){a[i]=ri(1,2*m);b[i]=ri(a[i],2*m);}
        for(auto&x:nails)x=ri(1,2*m);
        int expected=-1;
        for(int k=1;k<=m;++k){bool all=true;for(int j=0;j<n;++j){bool hit=false;for(int t=0;t<k;++t)hit|=a[j]<=nails[t]&&nails[t]<=b[j];all&=hit;}if(all){expected=k;break;}}
        verify(minNails(a,b,nails)==expected,"nails vs sequential interval-hit enumeration");
        std::string s;for(int i=0;i<n;++i)s+=static_cast<char>('a'+ri(0,2));
        std::string p;for(char c:s)if(ri(0,1))p+=c;
        vector<int>order(n);std::iota(order.begin(),order.end(),0);std::shuffle(order.begin(),order.end(),rng);order.resize(ri(0,n));
        int removable=0;
        for(int k=0;k<=static_cast<int>(order.size());++k){auto modified=s;for(int t=0;t<k;++t)modified[order[t]]='#';int pos=0;for(char c:modified)if(pos<static_cast<int>(p.size())&&c==p[pos])++pos;if(pos==static_cast<int>(p.size()))removable=k;}
        verify(maxRemovals(s,p,order)==removable,"removal timestamps vs rebuilt deletion prefixes");
    }
    for(int run=0;run<400;++run) {
        int n=ri(1,8);vector<int>a(n);for(auto&x:a)x=ri(0,12);int k=ri(1,(n+1)/2),best=100;
        for(int mask=1;mask<(1<<n);++mask)if(!(mask&(mask<<1))&&__builtin_popcount(static_cast<unsigned>(mask))>=k){int value=0;for(int i=0;i<n;++i)if(mask>>i&1)value=std::max(value,a[i]);best=std::min(best,value);}
        verify(minimumCapability(a,k)==best,"nonadjacent capability vs subsets");
        int m=ri(1,5),nt=ri(1,5),pills=ri(0,m),boost=ri(0,5);vector<int>tasks(nt),workers(m);
        for(auto&x:tasks)x=ri(0,10);
        for(auto&x:workers)x=ri(0,10);
        verify(maxAssigned(tasks,workers,pills,boost)==bruteMatching(tasks,workers,pills,boost),"pill matching vs subset assignment DP");
    }
    verify(maxAssigned({6,8},{5,7},1,3)==2,"strongest-pill counterexample");
    for(int run=0;run<220;++run) {
        int n=ri(1,8),k=ri(1,n),cap=ri(1,n);vector<i64>a(n);for(auto&x:a)x=ri(0,20);
        verify(minCoverRadius(a,k)==bruteCover(a,k),"line coverage vs partition enumeration");
        int buses=ri((n+cap-1)/cap,n);
        verify(minBusWait(a,buses,cap)==bruteBus(a,buses,cap),"bus wait vs partition enumeration");
        int len=ri(2,8);std::string field(len,'.');int people=ri(1,std::min(3,len-1));
        vector<int>order(len);std::iota(order.begin(),order.end(),0);std::shuffle(order.begin(),order.end(),rng);
        for(int i=0;i<people;++i)field[order[i]]='P';
        for(int i=people;i<len;++i)if(ri(0,1)||i==people)field[order[i]]='*';
        verify(packmenTime(field)==brutePackmen(field),"Packmen vs exhaustive target assignment and route cost");
        vector<std::pair<i64,i64>>ranges;int at=0;
        for(int j=0;j<ri(1,3);++j){int l=at+ri(0,1),r=std::min(l+ri(0,2),11);if(l>11)break;ranges.push_back({l,r});at=r+2;if(at>11)break;}
        int available=0;for(auto [l,r]:ranges)available+=r-l+1;
        if(available>=2){int cows=ri(2,available);verify(maxIntervalGap(ranges,cows)==bruteSpacing(ranges,cows),"interval spacing vs integer subset enumeration");}
    }
    verify(maxIntervalGap({{0,1000000000000000000LL}},3)==500000000000000000LL,"large interval batch count");
    for(int run=0;run<200;++run) {
        int n=ri(1,4),m=ri(1,4);vector<vector<int>>h(n,vector<int>(m));for(auto&row:h)for(auto&x:row)x=ri(1,20);
        verify(minimumEffort(h)==referenceEffort(h),"BFS threshold vs minimax Dijkstra");
        int tc=ri(1,8),tm=ri(1,8),orders=ri(1,5);vector<Order>request;
        for(int i=0;i<orders;++i){int a=ri(1,6),b=ri(1,6);request.push_back({a,b,ri(a+b,a*tc+b*tm+5)});}
        int best=tc+tm-2;
        for(int x=1;x<=tc;++x)for(int y=1;y<=tm;++y){bool ok=true;for(auto o:request)ok&=o.a*x+o.b*y<=o.limit;if(ok)best=std::min(best,tc+tm-x-y);}
        verify(bakeryUpgrades(tc,tm,request)==best,"signed interval bounds vs all final oven durations");
        vector<int>duration(ri(1,8));for(auto&x:duration)x=ri(1,10);int deadline=ri(*std::max_element(duration.begin(),duration.end()),50),expected=duration.size();
        for(int slots=1;slots<=static_cast<int>(duration.size());++slots){vector<i64>load(slots,0);for(int d:duration){auto it=std::min_element(load.begin(),load.end());*it+=d;}if(*std::max_element(load.begin(),load.end())<=deadline){expected=slots;break;}}
        verify(minimumSlots(duration,deadline)==expected,"heap simulation vs direct event-array simulation");
    }
    for(int a=-17;a<=17;++a)for(int b=1;b<=7;++b) {
        verify(floorDiv(a,b)==static_cast<int>(std::floor(static_cast<double>(a)/b)),"mathematical floor division");
        verify(ceilDiv(a,b)==static_cast<int>(std::ceil(static_cast<double>(a)/b)),"mathematical ceiling division");
    }
    verify(std::abs(meetingTime({7,1,3},{1,2,1})-2.0)<1e-8,"continuous intersection official sample");
    verify(std::abs(meetingTime({5,10,3,2},{2,3,2,4})-1.4)<1e-8,"continuous intersection sample2");
    for(int run=0;run<80;++run) {
        int n=ri(1,4);std::string wind;const std::string dirs="UDLR";for(int i=0;i<n;++i)wind+=dirs[ri(0,3)];
        int tx=ri(-3,3),ty=ri(-3,3),ref=bruteWind(0,0,tx,ty,wind,12);i64 actual=magicShip(0,0,tx,ty,wind);
        verify(ref==-1 ? (actual==-1||actual>12) : actual==ref,"periodic reachability vs explicit daily state BFS");
    }
    verify(magicShip(0,0,1,0,"L")==-1,"permanent opposing wind unreachable");
    for(int n=1;n<=20;++n)for(int dup=1;dup<=n;++dup) {
        vector<int>a;for(int x=1;x<=n;++x)a.push_back(x);a.push_back(dup);std::shuffle(a.begin(),a.end(),rng);
        verify(duplicateByCounting(a)==dup,"unique duplicate across all values");
    }
    verify(duplicateByCounting({3,3,3,3,3})==3,"single repeated value with missing other values");
    numericalAndRanks();
    verify(kthProduct({-5000000000000000000LL,5000000000000000000LL},{1},1)==-5000000000000000000LL,"wide signed product midpoint");
    verify(kthProduct({-5000000000000000000LL,5000000000000000000LL},{1},2)==5000000000000000000LL,"wide signed product upper");
    verify(kthPairSum({-5000000000000000000LL,5000000000000000000LL},{0},1)==-5000000000000000000LL,"wide signed sum midpoint");
    verify(maxLowerMedian({std::numeric_limits<int>::min(),std::numeric_limits<int>::max()},1)==std::numeric_limits<int>::max(),"full int median midpoint");
    std::cout << "PASS " << checks << " checks; seed=20261026; independent enumeration/reference algorithms\n";
}
