// Research-only adaptation to the Nowcoder NC82 function signature.
// The harness is local, not part of the code a function-mode judge expects.
#include "../../../content/contiguous-ranges/连续片段.cpp"
#include <cassert>
#include <iostream>

class Solution {
public:
    std::vector<int> maxInWindows(std::vector<int>& num, int size) {
        return second_algorithm::contiguous::fixed_window_extreme(num, size);
    }
};

int main() {
    Solution solution;
    std::vector<int> values{2, 3, 4, 2, 6, 2, 5, 1};
    const auto before = values;
    const std::vector<int> expected{4, 4, 6, 6, 6, 5};
    assert(solution.maxInWindows(values, 3) == expected);
    assert(values == before);
    std::vector<int> singleton{-2}, empty;
    assert(solution.maxInWindows(singleton, 1) == singleton);
    assert(solution.maxInWindows(singleton, 0).empty());
    assert(solution.maxInWindows(singleton, 2).empty());
    assert(solution.maxInWindows(empty, 1).empty());
    std::cout << "function_adapter_checks=6\n";
}
