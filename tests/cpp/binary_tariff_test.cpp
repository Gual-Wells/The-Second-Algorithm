#include "../../content/binary-search/组合判定.cpp"
#include <cstdlib>
#include <iostream>
#include <vector>
using namespace binary_tariff;

long long checks = 0;
void verify(bool ok, const char* label) {
    ++checks;
    if (!ok) { std::cerr << "FAIL " << label << '\n'; std::exit(1); }
}

// 小用量独立oracle：实际逐单位收取它所属费率，不用分段减法实现。
i64 unitPriceBill(i64 c) {
    i64 total = 0;
    for (i64 unit = 1; unit <= c; ++unit)
        total += unit <= 100 ? 2 : unit <= 10000 ? 3 : unit <= 1000000 ? 5 : 7;
    return total;
}

int main() {
    std::vector<i64> small(801);
    for (int c = 0; c <= 800; ++c) {
        small[c] = unitPriceBill(c);
        verify(electricityBill(c) == small[c], "tier bill vs per-unit accumulation");
        verify(consumptionFromBill(small[c]) == c, "joint bill inverse exact integer consumption");
    }
    // 真正枚举所有小用量分配，A始终由总用量计费，而非两份账单相加。
    for (int total = 0; total <= 800; ++total)
        for (int own = 0; 2 * own <= total; ++own)
            verify(smallerElectricityBill(small[total], small[total-own]-small[own]) == small[own],
                   "all small total-consumption splits");

    const i64 c[] = {0,1,99,100,101,9999,10000,10001,999999,1000000,1000001};
    const i64 b[] = {0,2,198,200,203,29897,29900,29905,4979895,4979900,4979907};
    for (int i = 0; i < 11; ++i) {
        verify(electricityBill(c[i]) == b[i], "exact tariff-boundary expected bill");
        verify(consumptionFromBill(b[i]) == c[i], "exact tariff-boundary inverse");
    }
    // 两家分居不同费率层；预期分别由上面固定已知金额得出。
    for (int i = 0; i < 11; ++i)
        for (int j = i; j < 11; ++j)
            verify(smallerElectricityBill(electricityBill(c[i]+c[j]), b[j]-b[i]) == b[i],
                   "cross-tier consumption pairs");
    verify(smallerElectricityBill(1100,300) == 350, "official sample1");
    verify(smallerElectricityBill(35515,27615) == 2900, "official sample2");
    verify(electricityBill(400) != electricityBill(150)+electricityBill(250), "A is not sum of separate bills");
    std::cout << "PASS " << checks << " tariff checks; exhaustive small consumptions and tier boundaries\n";
}
