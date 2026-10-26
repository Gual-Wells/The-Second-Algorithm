#include <algorithm>
#include <cassert>
#include <iostream>
#include <ranges>
#include <span>
#include <string_view>
#include <type_traits>
#include <vector>

int main() {
    std::vector<bool> bits{false};
    auto proxy = bits[0];
    bool snapshot = bits[0];
    proxy = true;
    assert(bits[0] && !snapshot);
    static_assert(!std::is_same_v<decltype(proxy), bool>);

    std::vector<int> base{2, 3, 4};
    auto evens = base | std::views::filter([](int v) { return v % 2 == 0; });
    base[0] = 6; // Before begin()/iteration; all retained values satisfy predicate.
    assert(*evens.begin() == 6);
    static_assert(std::ranges::view<decltype(evens)>);
    static_assert(!std::ranges::random_access_range<decltype(evens)>);

    // Current library includes the corrected owning-view design.
    auto owner = std::views::all(std::vector<int>{8, 9});
    static_assert(std::ranges::view<decltype(owner)>);
    static_assert(!std::ranges::borrowed_range<decltype(owner)>);
    static_assert(std::ranges::borrowed_range<std::string_view>);
    static_assert(std::same_as<decltype(std::ranges::find(std::vector<int>{1, 2}, 2)),
                               std::ranges::dangling>);
    assert(*owner.begin() == 8);

    std::span<int> view(base);
    view[1] = 7;
    assert(base[1] == 7 && view.size() == base.size());
    const auto constant_view = view;
    constant_view[1] = 11; // const span<T> does not make T const.
    assert(base[1] == 11);
    std::cout << "views checks passed; compiler/library version and DR state matter\n";
}
