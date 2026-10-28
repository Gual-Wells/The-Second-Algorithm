"""Encode the actually read primary sources summarized in root-extraction.md."""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[2]; W=R/'work/first-chapter-20261028'
data=[]
def add(id,source,urls,mechanism,conditions,variants,cross=[]):
    data.append(dict(id=id,source='source:'+source,locator='; '.join(urls),readState='analyzed',note='work/first-chapter-20261028/root-extraction.md',disposition='included',reason='原题合同与方法已实际分析，提供不能被同构归并吞掉的机制或条件。',mechanism=mechanism,conditions=conditions,variants=variants,crossParadigms=cross,exerciseUrls=urls if source in {'leetcode','luogu','atcoder','cses'} else []))
L='https://leetcode.com/problems/'
add('root-boundary','leetcode',[L+'find-first-and-last-position-of-element-in-sorted-array/',L+'search-insert-position/',L+'time-based-key-value-store/'],'首次>=与首次>组成相等段、计数和前驱；记录查找保留时间序。','有序/对固定谓词分区；end不可解引用；时间记录追加有序。','严格/非严格、空表、前驱无解、异构比较方向。')
add('root-api','leetcode',[L+'first-bad-version/'],'在不可物化的谓词域定位首次真，必要时倍增建立界。','判定稳定且单调，已知可表示cap；无真需明确返回政策。','接口成本、未知上界、全真/全假和倍增溢出。')
add('root-deficit','leetcode',[L+'kth-missing-positive-number/'],'值与下标差揭示累计缺口；p+k恢复缺失数。','正整数严格升序；差分非降，不是严格增。','固定点与缺失数；重复时单调证明可能失效。')
add('root-weighted','leetcode',[L+'random-pick-with-weight/'],'均匀整数票号逆查累计权重。','正权重及总和可表示；票号合同与lower/upper边界一致。','静态前缀与后续动态前缀秩的对照。',['前缀和','随机采样'])
add('root-pigeonhole','leetcode',[L+'find-the-duplicate-number/'],'值域计数与容量异常作为保留重复/缺失的证书。','重复题n+1个数在1..n且唯一重复；缺失题总条数小于域容量。','单调前缀判定与一般区间抽屉证书、重复/缺失对照。',['抽屉原理'])
add('root-rotated','leetcode',[L+'search-in-rotated-sorted-array-ii/',L+'find-minimum-in-rotated-sorted-array-ii/'],'借一侧有序定位目标或保留最小值；相等时只能安全缩边。','非降数组旋转；重复消除区分证据，最坏线性。','互异与重复、成员和最小值，不对整段直接binary_search。')
add('root-paired','leetcode',[L+'single-element-in-a-sorted-array/'],'配对下标奇偶的首次破坏。','唯一单次、其余恰双次、有序且奇数长度。','中点对齐与m^1等价性，频次条件改变不可照搬。')
add('root-peak','leetcode',[L+'find-peak-element/',L+'find-a-peak-element-ii/'],'保留一个局部峰的存在性，二维以中列最大值建立横向证书。','邻值不同；外围低于实际数据；二维正值与矩形。','任意局部峰/单峰/二维；斜率序列并不全局单调。',['分治存在性证明'])
add('root-matrix-lookup','leetcode',[L+'search-a-2d-matrix/',L+'search-a-2d-matrix-ii/'],'全局有序虚拟展平与仅行列有序逐行二分的不同合同。','行间隔离才允许扁平搜索；仅行列序有阶梯替代。','随机访问下标、逐行lower_bound、阶梯算法比较。',['二维偏序'])
add('root-isqrt','leetcode',[L+'sqrtx/'],'最大m满足m²<=x，乘法改除法避免溢出。','非负有界整数；处理0并避免除0；明确64位扩展范围。','上下中点、平方边界、Windows long非64位。')
add('root-continuous','luogu',['https://www.luogu.com.cn/problem/P1024'],'连续异号夹逼保留某根存在；原题单位扫描保证三根分别定位。','连续；端点/根间距/范围假设来自原题；有符号比较不用乘积。','非单调函数仍可求某根；偶重根与多根不能无假设找全。',['数值分析'])
add('root-prefix-orders','luogu',['https://www.luogu.com.cn/problem/P1083'],'前缀订单失败单调；差分重建容量判定。','非负需求；按原次序接单；n,m<=1e6，累计64位。','首失败与全成功，差分扫描设施partial_sum。',['差分','前缀和'])
add('root-matching','luogu',['https://www.luogu.com.cn/problem/P4251'],'第k大阈值转为低权边匹配至少n-k+1。','完整矩阵且n<=m，剩余匹配可补齐；不能用局部贪心。','增广路判定、值域离散化与性能预算。',['二分图匹配'])
add('root-cpp-contracts','cpp-draft',['https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search','https://timsong-cpp.github.io/cppwp/n4659/alg.partitions','https://timsong-cpp.github.io/cppwp/n4659/alg.nth.element','https://timsong-cpp.github.io/cppwp/n4659/vector.capacity'],'固定C++17分区/比较/迭代器/重排/失效合同，区分库层次。','调用者负责前提；比较次数不等于移动总成本；标准版本不可误标。','异构比较、端点、reserve非resize、nth_element重排。',['C++实现'])
add('root-strings','leetcode',[L+'search-suggestions-system/'],'字典序中前缀匹配形成连续区间，边界定位后取有限建议。','预排序且词条稳定；一次比较有字符代价。','全部前缀范围与至多三条建议；不把后缀索引建造混成库查找。',['字符串','排序'])
add('root-convex','atcoder',['https://atcoder.jp/contests/abc296/tasks/abc296_g'],'凸多边形射线序中二分扇区再判第三边。','严格凸、逆时针、坐标abs<=1e9；边界射线单独处理。','IN/ON/OUT、顶点与射线外延；凹形不适用。',['计算几何'])
add('root-eggdrop','leetcode',[L+'super-egg-drop/description/'],'反转为给定次数可覆盖楼层，再二分最少次数。','资源会破损；k<=100,n<=1e4，组合项饱和判定。','楼层不能按普通二分免费试探；覆盖DP与组合计数等价。',['动态规划','组合计数'])
add('root-lca','cses',['https://cses.fi/problemset/task/1688/'],'等深后同步提升，保留尚未会合的最大距离。','有根树；本题parent[i]<i；n/q<=2e5。','精确k跳是支撑；LCA和阈值祖先才有搜索证书。',['树','倍增'])
(W/'root-materials.json').write_text(json.dumps(dict(materials=data),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('Encoded',len(data),'actually analyzed primary-source material units.')
