# 整数随机分布与可复现性

`uniform_int_distribution<long long>(a,b)` 的合同是闭区间[a,b]内各整数等概率，要求a≤b。生成器通过引用传入，调用会推进其状态。它适合把均匀整数票号映射到累计权重，避免直接取模产生的余数偏差。

固定seed便于本机重复实验；`mt19937_64`不是密码学随机源，`random_device`也不能按名字就保证所有实现都有真实硬件熵。反复用当前秒数重置引擎可能重复得到相同输出，通常应在对象/任务开始时初始化一次再复用。

不同标准库对分布到引擎输出的映射不必相同，不能把同seed的采样序列当跨库文件格式。确定性正确性优先测试“每个合法票号落到哪个区间”，随机抽样频率只是额外观察。

依据：[C++17 uniform_int_distribution](https://timsong-cpp.github.io/cppwp/n4659/rand.dist.uni.int)、[随机数生成](https://timsong-cpp.github.io/cppwp/n4659/rand)。
