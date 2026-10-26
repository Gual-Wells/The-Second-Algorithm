#include "../../content/binary-search/二分查找.cpp"
#include <cmath>
#include <climits>
#include <functional>
#include <iostream>
#include <random>
#include <string>

long long checked = 0;
void ck(bool yes, const char* label) {
    ++checked;
    if (!yes) { cerr << "FAIL " << label << " after " << checked << '\n'; exit(1); }
}
int brute_segments(const vector<int>& a,ll cap) {
    int best=(int)a.size()+1;
    for(int mask=0;mask<(1<<((int)a.size()-1));++mask){
        int cnt=1;ll sum=0;bool valid=true;
        for(int i=0;i<(int)a.size();++i){
            sum+=a[i];
            if(i+1==(int)a.size()||(mask>>i&1)){if(sum>cap)valid=false;sum=0;if(i+1<(int)a.size())++cnt;}
        }
        if(valid)best=min(best,cnt);
    }
    return best;
}
ll brute_split(const vector<int>& a,int k){
    ll best=numeric_limits<ll>::max();
    for(int mask=0;mask<(1<<((int)a.size()-1));++mask){
        ll sum=0,largest=0;int cnt=1;
        for(int i=0;i<(int)a.size();++i){sum+=a[i];if(i+1==(int)a.size()||(mask>>i&1)){largest=max(largest,sum);sum=0;if(i+1<(int)a.size())++cnt;}}
        if(cnt<=k)best=min(best,largest);
    }
    return best;
}
ll brute_spacing(const vector<int>& a,int k){
    ll best=0;
    for(int mask=0;mask<(1<<(int)a.size());++mask){
        vector<int> chosen;for(int i=0;i<(int)a.size();++i)if(mask>>i&1)chosen.push_back(a[i]);
        if((int)chosen.size()!=k)continue;
        ll d=numeric_limits<ll>::max();for(int i=1;i<k;++i)d=min(d,(ll)chosen[i]-chosen[i-1]);best=max(best,d);
    }
    return best;
}
int brute_bloom(const vector<int>& a,int m,int width){
    if((ll)m*width>(ll)a.size())return -1;
    for(int day=1;day<=*max_element(a.begin(),a.end());++day){
        function<int(int)> best=[&](int i){
            if(i>=(int)a.size())return 0;
            int result=best(i+1);
            if(i+width<=(int)a.size()){
                bool yes=true;for(int j=i;j<i+width;++j)if(a[j]>day)yes=false;
                if(yes)result=max(result,1+best(i+width));
            }
            return result;
        };
        if(best(0)>=m)return day;
    }
    return -1;
}
int main(){
    mt19937_64 rng(20261026);
    for(ll cap=1;cap<=120;++cap)for(ll cut=0;cut<=cap+1;++cut)
        ck(expand_first(cap,[&](ll x){return x>=cut;})==cut,"doubling");
    for(int trial=0;trial<2200;++trial){
        vector<int>a((size_t)(rng()%24));for(int&x:a)x=(int)(rng()%25)-12;sort(a.begin(),a.end());
        int x=(int)(rng()%35)-17,n=(int)a.size();
        ck(lower_index(a,x)==lower_bound(a.begin(),a.end(),x)-a.begin(),"lower");
        ck(upper_index(a,x)==upper_bound(a.begin(),a.end(),x)-a.begin(),"upper");
        if(n){
            int k=(int)(rng()%n)+1;
            int p=closest_window_left(a,k,x);
            vector<int> expected=a;sort(expected.begin(),expected.end(),[&](int v,int w){ll dv=abs((ll)v-x),dw=abs((ll)w-x);return dv!=dw?dv<dw:v<w;});
            expected.resize(k);sort(expected.begin(),expected.end());ck(vector<int>(a.begin()+p,a.begin()+p+k)==expected,"closest window");
            rotate(a.begin(),a.begin()+rng()%a.size(),a.end());
            ck(a[rotated_min_index(a)]==*min_element(a.begin(),a.end()),"rotated min");
            int hit=rotated_search(a,x);ck((hit==-1)==(find(a.begin(),a.end(),x)==a.end()),"rotated existence");
            if(hit!=-1)ck(a[hit]==x,"rotated location");
        }
        vector<int> peak((size_t)(rng()%24)+1);for(int&i:peak)i=(int)(rng()%50);for(size_t i=1;i<peak.size();++i)if(peak[i]==peak[i-1])++peak[i];
        int q=peak_index(peak);ck((q==0||peak[q]>peak[q-1])&&(q+1==(int)peak.size()||peak[q]>peak[q+1]),"local peak");
        vector<int> pairs;int unique=(int)(rng()%12);for(int i=0;i<12;++i){pairs.push_back(i-6);if(i!=unique)pairs.push_back(i-6);}
        ck(single_unpaired(pairs)==unique-6,"unpaired");
        vector<int>b((size_t)(rng()%11)),c((size_t)(rng()%11));for(int&i:b)i=(int)(rng()%30)-15;for(int&i:c)i=(int)(rng()%30)-15;
        sort(b.begin(),b.end());sort(c.begin(),c.end());vector<int> merged=b;merged.insert(merged.end(),c.begin(),c.end());sort(merged.begin(),merged.end());
        for(int rank=1;rank<=(int)merged.size();++rank)ck(kth_two_sorted(b,c,rank)==merged[rank-1],"two-array rank");
        vector<int> missing;int curr=0;for(int i=0;i<(int)(rng()%15);++i){curr+=(int)(rng()%4)+1;missing.push_back(curr);}
        int kth=(int)(rng()%20)+1,want=0;for(int v=1,seen=0;;++v){if(!binary_search(missing.begin(),missing.end(),v))++seen;if(seen==kth){want=v;break;}}
        ck(kth_missing_positive(missing,kth)==want,"missing positive");
    }
    for(int x:{INT_MIN,-1,0,1,INT_MAX}){vector<int>a{INT_MIN,0,0,INT_MAX};ck(lower_index(a,x)==lower_bound(a.begin(),a.end(),x)-a.begin(),"extreme lower");ck(upper_index(a,x)==upper_bound(a.begin(),a.end(),x)-a.begin(),"extreme upper");}
    ck(kth_two_sorted({INT_MIN},{INT_MAX},1)==INT_MIN,"rank min");ck(kth_two_sorted({INT_MIN},{INT_MAX},2)==INT_MAX,"rank max");
    for(int trial=0;trial<800;++trial){
        int m=(int)(rng()%6)+1,n=(int)(rng()%6)+1;vector<vector<int>>a(m,vector<int>(n));
        for(int i=0;i<m;++i)for(int j=0;j<n;++j){int base=-20;if(i)base=max(base,a[i-1][j]);if(j)base=max(base,a[i][j-1]);a[i][j]=base+(int)(rng()%4);}
        vector<int> flat;for(auto&row:a)flat.insert(flat.end(),row.begin(),row.end());sort(flat.begin(),flat.end());
        for(int x=-23;x<=flat.back()+2;++x){ck(matrix_staircase(a,x)==binary_search(flat.begin(),flat.end(),x),"matrix search");ck(matrix_le_count(a,x)==upper_bound(flat.begin(),flat.end(),x)-flat.begin(),"matrix count");}
        int k=(int)(rng()%flat.size())+1;ll result=kth_matrix_value(a,k);ck(result==flat[k-1],"matrix rank");
        vector<vector<int>> global(m,vector<int>(n));for(int i=0;i<m*n;++i)global[i/n][i%n]=flat[i];
        int x=(int)(rng()%30)-20;ck(flat_matrix_search(global,x)==binary_search(flat.begin(),flat.end(),x),"flattened matrix");ck(row_matrix_search(a,x)==binary_search(flat.begin(),flat.end(),x),"row search");
    }
    for(int m=1;m<=12;++m)for(int n=1;n<=12;++n){vector<int>a;for(int i=1;i<=m;++i)for(int j=1;j<=n;++j)a.push_back(i*j);sort(a.begin(),a.end());for(int x=0;x<=m*n+1;++x)ck(multiplication_le_count(m,n,x)==upper_bound(a.begin(),a.end(),x)-a.begin(),"multiplication count");}
    for(int trial=0;trial<900;++trial){
        int n=(int)(rng()%8)+1;vector<int>a(n);for(int&i:a)i=(int)(rng()%12);ll cap=*max_element(a.begin(),a.end())+(ll)(rng()%20);
        ck(segments_needed(a,cap)==brute_segments(a,cap),"segmentation count");int k=(int)(rng()%n)+1;
        ck(min_split_cap(a,k)==brute_split(a,k),"min-max segment sum");
        if(n>=2){sort(a.begin(),a.end());int placed=(int)(rng()%(n-1))+2;ll best=brute_spacing(a,placed);ll d=(ll)(rng()%20);ck(can_place(a,placed,d)==(d<=best),"spacing predicate");ck(max_min_gap(a,placed)==best,"spacing optimum");
            vector<ll>dist;for(int i=0;i<n;++i)for(int j=i+1;j<n;++j)dist.push_back((ll)a[j]-a[i]);sort(dist.begin(),dist.end());ck(pair_distance_count(a,d)==upper_bound(dist.begin(),dist.end(),d)-dist.begin(),"distance count");ll rank=(ll)(rng()%dist.size())+1;ck(kth_pair_distance(a,rank)==dist[rank-1],"distance rank");}
    }
    for(int trial=0;trial<1800;++trial){
        vector<int>a((size_t)(rng()%6)+1);for(int&i:a)i=(int)(rng()%20)+1;ll maxv=*max_element(a.begin(),a.end()),h=(ll)a.size()+(ll)(rng()%40),budget=(ll)(rng()%30),pieces=(ll)(rng()%100)+1;
        ll rate=1;for(;;++rate){ll used=0;for(int v:a)used+=(v-1)/rate+1;if(used<=h)break;}ck(min_rate(a,h)==rate,"minimum rate");
        ll length=0;for(ll L=1;L<=maxv;++L){ll count=0;for(int v:a)count+=v/L;if(count>=pieces)length=L;}ck(max_piece(a,pieces)==length,"max piece");
        ll limit=1;for(;;++limit){ll used=0;for(int v:a)used+=(v-1)/limit;if(used<=budget)break;}ck(min_bag_limit(a,budget)==limit,"bag limit");
        ll target=(ll)(rng()%20)+1,time=1;for(;;++time){ll count=0;for(int v:a)count+=time/v;if(count>=target)break;}ck(min_production_time(a,target)==time,"production");
        int groups=(int)(rng()%5)+1,size=(int)(rng()%4)+1;ck(min_bloom_day(a,groups,size)==brute_bloom(a,groups,size),"adjacent bouquets");
    }
    ck(min_production_time({1},1000000000000000000LL)==1000000000000000000LL,"large time");
    for(ll x:{0LL,1LL,2LL,4LL,1000000000000000000LL}){ll y=integer_sqrt(x);ck((y==0||y<=x/y)&&(y+1>x/(y+1)),"sqrt division");}
    for(int trial=0;trial<600;++trial){double t=(double)(rng()%10000)/1000-5;double r=real_first(-10,10,[&](double x){return x>=t;});ck(r>=t&&abs(r-t)<1e-10,"real boundary");double c=(double)(rng()%10000)/1000-5;double root=bracket_root(-10,10,[&](double x){return x*x*x-c;});ck(abs(root*root*root-c)<1e-9,"continuous root");}
    double root=bracket_root(0,4,[](double x){return (x-1)*(x-2)*(x-3);});ck(abs((root-1)*(root-2)*(root-3))<1e-10,"nonmonotone root");

    for(int trial=0;trial<800;++trial){
        int up=(int)(rng()%12)+1,down=(int)(rng()%12)+1;
        vector<int>a;int v=-30;
        for(int i=0;i<=up;++i){v+=(int)(rng()%4)+1;a.push_back(v);}
        for(int i=0;i<down;++i){v-=(int)(rng()%4)+1;a.push_back(v);}
        for(int x=-40;x<=30;++x){
            auto it=find(a.begin(),a.end(),x);
            ck(mountain_search(a,x)==(it==a.end()?-1:(int)(it-a.begin())),"mountain search");
        }
    }
    for(int rows=1;rows<=10;++rows)for(int cols=1;cols<=10;++cols){
        vector<ll>a;for(int i=1;i<=rows;++i)for(int j=1;j<=cols;++j)a.push_back((ll)i*j);
        sort(a.begin(),a.end());
        for(int k=1;k<=(int)a.size();++k)ck(kth_multiplication_value(rows,cols,k)==a[k-1],"multiplication rank");
    }
    for(ll x=0;x<=20000;++x){
        ll y=integer_sqrt(x);
        ck(y*y<=x&&(y+1)*(y+1)>x,"sqrt all small");
    }
    ck(closest_window_left({-2147483647,2147483647},1,0)==0,"closest extreme tie");
    ck(max_min_gap({INT_MIN,INT_MAX},2)==4294967295LL,"spacing extreme");
    ck(kth_pair_distance({INT_MIN,INT_MAX},1)==4294967295LL,"distance extreme");
    ck(row_matrix_search({{1,8,9},{-4,0,2}},0),"rows not ordered");
    cout<<"PASS "<<checked<<" comparisons; seed=20261026\n";
}
