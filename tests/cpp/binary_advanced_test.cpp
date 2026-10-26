#include "../../content/binary-search/进阶扩展.cpp"
#include <cstdlib>
#include <iostream>
#include <queue>
#include <random>
using namespace binary_advanced;
long long checks = 0;
void ck(bool yes, const char* label) {
    ++checks;
    if (!yes) { cerr << "FAIL " << label << '\n'; exit(1); }
}
vector<int> reachable(int n, const vector<pair<int,int>>& edges, int t, int s) {
    vector<vector<int>> g(n);
    for (int i=0;i<t;++i) { auto [u,v]=edges[i];g[u].push_back(v);g[v].push_back(u); }
    vector<int> seen(n);seen[s]=1;queue<int> q;q.push(s);
    while (!q.empty()) { int u=q.front();q.pop();for(int v:g[u])if(!seen[v]){seen[v]=1;q.push(v);} }
    return seen;
}
struct Rally { int x,y,z; };
int main() {
    mt19937 rng(20261026);
    for (int trial=0;trial<200;++trial) {
        int n=(int)(rng()%35)+1;FrequencyTree f(n);vector<int>a(n);
        for(int it=0;it<100;++it) {
            int p=(int)(rng()%n),delta=(rng()%2||a[p]==0)?1:-1;a[p]+=delta;f.add(p,delta);
            vector<int> expanded;for(int j=0;j<n;++j)for(int k=0;k<a[j];++k)expanded.push_back(j);
            for(int k=0;k<=(int)expanded.size()+1;++k)
                ck(f.kth(k)==(k>0&&k<=(int)expanded.size()?expanded[k-1]:n),"Fenwick rank");
        }
        MaxTree tree(a);
        for(int it=0;it<100;++it){
            int p=(int)(rng()%n),x=(int)(rng()%31)-15;a[p]=x;tree.set(p,x);
            int from=(int)(rng()%(n+1)),threshold=(int)(rng()%35)-17,answer=n;
            for(int j=from;j<n;++j)if(a[j]>=threshold){answer=j;break;}
            ck(tree.first_at_least(from,threshold)==answer,"MaxTree first");
        }
    }
    for(int trial=0;trial<200;++trial){
        int n=1+(int)(rng()%10),m=(int)(rng()%20);vector<pair<int,int>> edges;
        for(int i=0;i<m;++i)edges.push_back({(int)(rng()%n),(int)(rng()%n)});
        vector<pair<int,int>> qs;vector<Rally> rallies;
        for(int x=0;x<n;++x)for(int y=0;y<n;++y){qs.push_back({x,y});rallies.push_back({x,y,1+(int)(rng()%n)});}
        auto ans=first_prefix_batch(n,edges,qs,[](DSU&d,auto p){return d.find(p.first)==d.find(p.second);});
        auto rs=first_prefix_batch(n,edges,rallies,[](DSU&d,Rally p){int a=d.find(p.x),b=d.find(p.y);return d.size[a]+(a==b?0:d.size[b])>=p.z;});
        for(int i=0;i<(int)qs.size();++i){int expected=-1,rExpected=-1;
            for(int t=0;t<=m;++t){
                auto a=reachable(n,edges,t,qs[i].first),b=reachable(n,edges,t,qs[i].second);
                if(expected<0&&a[qs[i].second])expected=t;
                int total=0;for(int v=0;v<n;++v)total+=a[v]||b[v];
                if(rExpected<0&&total>=rallies[i].z)rExpected=t;
            }
            ck(ans[i]==expected,"PBS first connection");ck(rs[i]==rExpected,"PBS union size");
        }
    }
    MaxTree empty({});ck(empty.first_at_least(0,0)==0,"empty MaxTree");
    FrequencyTree emptyFrequency(0);ck(emptyFrequency.kth(1)==0,"empty Fenwick");
    cout << checks << " independent comparisons passed\n";
}
