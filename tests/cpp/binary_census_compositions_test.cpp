#include "../../content/binary-search/组合判定.cpp"
#include <cstdlib>
#include <iostream>
#include <set>
#include <random>
using namespace binary_census;

long long checks=0;
void verify(bool ok,const char*label){++checks;if(!ok){std::cerr<<"FAIL "<<label<<'\n';std::exit(1);}}

// 只用于小参数；逐个枚举每道门的整数横坐标与前驱可达位置。
// 测试构造horizontalSpeed能被每种speed整除，使连续可达端点也为整数。
bool integerPositionOracle(const vector<Gate>&g,i64 width,i64 horizontal,i64 speed) {
    std::set<i64> positions;
    for(i64 x=g[0].x;x<=g[0].x+width;++x)positions.insert(x);
    for(int i=1;i<static_cast<int>(g.size());++i) {
        i64 allowance=horizontal*(g[i].y-g[i-1].y)/speed;
        std::set<i64>next;
        for(i64 x=g[i].x;x<=g[i].x+width;++x)
            for(i64 before:positions)if(std::abs(x-before)<=allowance){next.insert(x);break;}
        positions=std::move(next);
    }
    return !positions.empty();
}

// 有分数横移时，在乘speed的有限格点上逐位置枚举，独立于区间端点递推。
bool scaledPositionOracle(const vector<Gate>&g,i64 width,i64 horizontal,i64 speed) {
    std::set<i64>positions;
    for(i64 x=g[0].x*speed;x<=(g[0].x+width)*speed;++x)positions.insert(x);
    for(int i=1;i<static_cast<int>(g.size());++i) {
        i64 allowance=horizontal*(g[i].y-g[i-1].y);
        std::set<i64>next;
        for(i64 x=g[i].x*speed;x<=(g[i].x+width)*speed;++x)
            for(i64 before:positions)if(std::abs(x-before)<=allowance){next.insert(x);break;}
        positions=std::move(next);
    }
    return !positions.empty();
}

int main(){
    std::mt19937 rng(20261026);auto ri=[&](int l,int r){return l+static_cast<int>(rng()%(r-l+1));};
    vector<Gate>sample{{1,1},{5,2},{1,3}};
    verify(fastestSlalom(sample,3,2,{3,2,1})==2,"official sample1");
    verify(fastestSlalom(sample,3,2,{3})==-1,"official sample2");
    for(int run=0;run<500;++run){
        int n=ri(1,7),width=ri(1,4);vector<Gate>g;int y=0;
        for(int i=0;i<n;++i){y+=ri(1,3);g.push_back({ri(1,12),y});}
        vector<i64>speeds{6,2,1,3,2};i64 expected=-1;
        for(i64 s:speeds){bool ok=integerPositionOracle(g,width,6,s);verify(canSlalom(g,width,6,s)==ok,"integer reachable positions vs interval propagation");if(ok)expected=std::max(expected,s);}
        verify(fastestSlalom(g,width,6,speeds)==expected,"discrete speed choice vs all candidates");
        for(i64 s:vector<i64>{2,3,5})verify(canSlalom(g,width,1,s)==scaledPositionOracle(g,width,1,s),"fractional movement exact scaled grid");
    }
    verify(canSlalom({{1,1},{2,2}},1,1,1),"exact gate endpoint contact");
    verify(!canSlalom({{1,1},{4,2}},1,1,1),"disjoint after insufficient expansion");
    verify(fastestSlalom({{100000000,1},{1,100000000}},100000000,1000000,{1000000})==1000000,"original parameter product bounds");
    verify(fastestSlalom({{1,1}},1,1,{1,1000000,1000000})==1000000,"single gate all speeds feasible and duplicate speeds");
    std::cout<<"PASS "<<checks<<" Slalom independent checks; seed=20261026\n";
}
