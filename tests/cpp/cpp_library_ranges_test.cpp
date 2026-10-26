#include "../../content/cpp/容器与范围.cpp"
#include <cassert>
#include <iostream>

#if __cplusplus < 202002L
int main() { std::cout << "ranges checks skipped: require C++20 or later\n"; }
#else
#include <concepts>
namespace c = second_algorithm::containers;
static_assert(std::forward_iterator<c::overwrite_ring<int>::const_iterator>);
static_assert(!std::random_access_iterator<c::overwrite_ring<int>::const_iterator>);
int main() {
    std::vector<int> values{-2, 1, 4, 5};
    assert((c::even_squares(values) == std::vector<long long>{4, 16}));
    assert(c::even_squares(std::span<const int>{}).empty());
    c::zero_out(values);
    assert((values == std::vector<int>{0, 0, 0, 0}));
    auto selected = values | std::views::filter([](int x) { return x % 2 == 0; });
    values[0] = 6; // 第一次 begin 之前修改，且仍满足谓词
    assert(*selected.begin() == 6);
    static_assert(!std::ranges::random_access_range<decltype(selected)>);
#if __cplusplus >= 202302L
    auto owner = c::owning_numbers();
    assert(*owner.begin() == 3);
    static_assert(!std::ranges::borrowed_range<decltype(owner)>);
    std::vector<int> sequence{1, 2, 3, 4, 5};
    int windows = 0;
    for (auto [a, b] : c::adjacent_pairs(sequence)) {
        assert(b == a + 1); ++windows;
    }
    assert(windows == 4);
#endif
    std::cout << "C++20/23 ranges semantic checks passed\n";
}

#endif
