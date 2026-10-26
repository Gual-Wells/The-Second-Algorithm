"""Independent small-instance checks for the frozen challenge derivations.
No catalog/content imports. Python standard library only. Not production solutions.
"""
from bisect import bisect_left, bisect_right
from itertools import combinations, permutations
from math import exp, sin, cos, tan
from random import Random
import json

rng = Random(20261026)
checks = {}

def pair_count(a, x):
    neg = sorted(v for v in a if v < 0)
    pos = sorted(v for v in a if v > 0)
    z = a.count(0)
    if x < 0:
        j = ans = 0
        for v in neg:
            while j < len(pos) and v*pos[j] > x:
                j += 1
            ans += len(pos)-j
        return ans
    ans = len(neg)*len(pos) + z*(len(a)-z) + z*(z-1)//2
    for b in (pos, sorted(-v for v in neg)):
        l, r = 0, len(b)-1
        while l < r:
            if b[l]*b[r] <= x:
                ans += r-l
                l += 1
            else:
                r -= 1
    return ans

for _ in range(500):
    a = [rng.randint(-6,6) for _ in range(rng.randint(2,10))]
    for x in range(-37,38):
        assert pair_count(a,x) == sum(u*v <= x for u,v in combinations(a,2))
checks["signed_pair_count"] = "500 arrays x 75 thresholds: passed"

def selection_dp(b):
    take, skip = b[0], 0
    for v in b[1:]:
        take, skip = max(take,skip)+v, take
    return max(take,skip)

for _ in range(300):
    n = rng.randint(2,9)
    a = [rng.randint(1,9) for _ in range(n)]
    masks = [s for s in range(1<<n) if all((s>>i&1) or (s>>(i+1)&1) for i in range(n-1))]
    for x in range(1,11):
        b = [1 if v >= x else -1 for v in a]
        brute_median = any(sorted(a[i] for i in range(n) if s>>i&1)[((s.bit_count()+1)//2)-1] >= x for s in masks)
        assert (selection_dp(b)>0) == brute_median
        b = [v-x for v in a]
        brute_average = any(sum(a[i]-x for i in range(n) if s>>i&1)>=0 for s in masks)
        assert (selection_dp(b)>=0) == brute_average
checks["adjacent_cover_dp"] = "300 arrays x 10 thresholds: passed against all valid subsets"

def amusement(a,k):
    k = min(k,sum(a))
    lo,hi = 0,max(a)
    while lo < hi:
        mid=(lo+hi)//2
        if sum(max(v-mid,0) for v in a) <= k:
            hi=mid
        else:
            lo=mid+1
    t=lo
    count=sum(max(v-t,0) for v in a)
    return sum((v+t+1)*(v-t)//2 for v in a if v>t)+(k-count)*t

for _ in range(500):
    a=[rng.randint(1,12) for _ in range(rng.randint(1,8))]
    k=rng.randint(0,100)
    expanded=sorted([v for top in a for v in range(1,top+1)],reverse=True)
    assert amusement(a,k)==sum(expanded[:k])
checks["cutoff_aggregate"] = "500 cases: passed against materialized sorted rewards"

def assign(a,w,k,p,b):
    tasks=sorted(a)[:k]
    workers=sorted(w)[len(w)-k:] if k else []
    for task in reversed(tasks):
        if workers[-1] >= task:
            workers.pop()
        else:
            j=bisect_left(workers,task-b)
            if p==0 or j==len(workers):
                return False
            workers.pop(j)
            p-=1
    return True

def assign_brute(a,w,k,p,b):
    for aa in combinations(a,k):
        for ww in permutations(w,k):
            need=0
            for t,v in zip(aa,ww):
                if v<t:
                    if v+b<t:
                        break
                    need+=1
            else:
                if need<=p:
                    return True
    return k==0

for _ in range(250):
    a=[rng.randint(0,8) for _ in range(rng.randint(1,5))]
    w=[rng.randint(0,8) for _ in range(rng.randint(1,5))]
    p=rng.randint(0,len(w)); b=rng.randint(0,5)
    for k in range(min(len(a),len(w))+1):
        assert assign(a,w,k,p,b)==assign_brute(a,w,k,p,b),(a,w,k,p,b)
checks["assignment_greedy"] = "250 cases, every k: passed against all task subsets and worker permutations"

def talent(items,W,q):
    dp=[None]*(W+1); dp[0]=0
    for w,t in items:
        nxt=dp[:]
        for s,v in enumerate(dp):
            if v is not None:
                ns=min(W,s+w); nv=v+1000*t-q*w
                if nxt[ns] is None or nv>nxt[ns]:
                    nxt[ns]=nv
        dp=nxt
    return dp[W] is not None and dp[W]>=0

for _ in range(200):
    items=[(rng.randint(1,15),rng.randint(1,10)) for _ in range(rng.randint(1,8))]
    W=rng.randint(1,min(20,sum(w for w,t in items)))
    for q in [0,1,100,499,1000,2000,5000,10000]:
        brute=False
        for s in range(1<<len(items)):
            sw=sum(w for i,(w,t) in enumerate(items) if s>>i&1)
            st=sum(t for i,(w,t) in enumerate(items) if s>>i&1)
            brute |= sw>=W and 1000*st-q*sw>=0
        assert talent(items,W,q)==brute
checks["ratio_clipped_knapsack"] = "200 cases x 8 q values: passed against all subsets"

def left_ok(a,x,R):
    i=bisect_left(a,x-R)
    if i==len(a) or a[i]>x+R:
        return False
    r=R-2
    while i>0:
        old=i; cur=a[i]
        while i>0 and cur-a[i-1]<=r:
            i-=1
        if i==old:
            return False
        r-=2
    return True

def angry(a,R):
    lo,hi=a[0],a[-1]
    while lo<hi:
        mid=(lo+hi+1)//2
        if left_ok(a,mid,R):
            lo=mid
        else:
            hi=mid-1
    return left_ok([-v for v in a[::-1]],-lo,R)

def angry_at(a,x,R):
    active={i for i,v in enumerate(a) if abs(v-x)<=R}
    seen=active.copy(); r=R-2
    while active and r>=0:
        nxt={i for i,v in enumerate(a) if i not in seen and any(abs(v-a[j])<=r for j in active)}
        seen |= nxt; active=nxt; r-=2
    return len(seen)==len(a)

for _ in range(300):
    a=sorted(2*v for v in rng.sample(range(13),rng.randint(2,7)))
    for R in range(a[-1]-a[0]+1):
        brute=any(angry_at(a,x,R) for x in range(a[0],a[-1]+1))
        assert angry(a,R)==brute,(a,R,brute)
        left=[left_ok(a,x,R) for x in range(a[0],a[-1]+1)]
        assert left==sorted(left,reverse=True),(a,R,left)
checks["chain_radius_nested_search"] = "300 coordinate sets, every half-unit R and landing point: passed against simultaneous explosion simulation"

def peak(a):
    m,n=len(a),len(a[0]); lo,hi=0,n-1
    while lo<=hi:
        mid=(lo+hi)//2
        r=max(range(m),key=lambda r:a[r][mid])
        v=a[r][mid]
        if mid+1<n and a[r][mid+1]>v:
            lo=mid+1
        elif mid>0 and a[r][mid-1]>v:
            hi=mid-1
        else:
            return r,mid
    raise AssertionError("no peak")

for _ in range(500):
    m,n=rng.randint(1,15),rng.randint(1,15)
    values=rng.sample(range(1,100001),m*n)
    a=[values[i*n:(i+1)*n] for i in range(m)]
    i,j=peak(a)
    assert all(a[i][j]>a[r][c] for r,c in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)) if 0<=r<m and 0<=c<n)
checks["two_dimensional_peak"] = "500 distinct-valued random matrices incl. 1-row/1-col: passed local peak verification"

coeffs=[(0,0,0,0,-2,1),(1,0,0,0,-1,2),(1,-1,1,-1,-1,1),(0,0,0,0,0,0),(0,0,0,0,0,1)]
roots=[]
for p,q,r,s,t,u in coeffs:
    def f(x): return p*exp(-x)+q*sin(x)+r*cos(x)+s*tan(x)+t*x*x+u
    if f(0)<0 or f(1)>0: roots.append(None); continue
    lo,hi=0.,1.
    for _ in range(60):
        mid=(lo+hi)/2
        if f(mid)>=0: lo=mid
        else: hi=mid
    roots.append((lo+hi)/2)
assert round(roots[0],4)==0.7071 and roots[1] is None and round(roots[2],4)==0.7554
assert roots[3] is not None and roots[4] is None
checks["continuous_root"] = "3 official samples plus constant zero/nonzero: passed; endpoint and monotonicity proof recorded in analysis"

print(json.dumps({"seed":20261026,"checks":checks,"note":"These verify selected derivations on small instances, not all constraints or full code implementations."},ensure_ascii=False,indent=2))

