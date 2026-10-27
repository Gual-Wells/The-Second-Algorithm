// Research-only stdin/stdout adapter for the formal count_sum kernel.
// Input contract follows CSES 1661. This is not an online-judge submission.
#include "../../../content/contiguous-ranges/连续片段.cpp"
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int n;
    long long target;
    if (!(std::cin >> n >> target)) return 0;
    std::vector<int> values(n);
    for (int& value : values) std::cin >> value;
    std::cout << second_algorithm::contiguous::count_sum(values, target) << '\n';
}
