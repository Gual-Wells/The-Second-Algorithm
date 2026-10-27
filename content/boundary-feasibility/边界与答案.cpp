// C++17 reference implementations. Public functions require the original task
// input contracts described in the chapter; invalid input has no extra policy.
// Define at most one entry selector when compiling/submitting this whole file:
// SECOND_ALGORITHM_LC34, SECOND_ALGORITHM_LC875,
// SECOND_ALGORITHM_FACTORY_MAIN, SECOND_ALGORITHM_DIVISION_MAIN.

// BEGIN headers
#include <algorithm>
#include <array>
#include <iostream>
#include <numeric>
#include <vector>
// END headers

namespace boundary_feasibility {

// BEGIN lower-bound-manual
int lower_bound_manual(const std::vector<int>& values, int target) {
    int left = 0;
    int right = static_cast<int>(values.size());
    while (left < right) {
        const int middle = left + (right - left) / 2;
        if (values[middle] < target) {
            left = middle + 1;
        } else {
            right = middle;
        }
    }
    return left;
}
// END lower-bound-manual

// BEGIN upper-bound-manual
int upper_bound_manual(const std::vector<int>& values, int target) {
    int left = 0;
    int right = static_cast<int>(values.size());
    while (left < right) {
        const int middle = left + (right - left) / 2;
        if (values[middle] <= target) {
            left = middle + 1;
        } else {
            right = middle;
        }
    }
    return left;
}
// END upper-bound-manual

// BEGIN occurrence-manual
std::array<int, 2> occurrence_range_manual(
        const std::vector<int>& values, int target) {
    const int first = lower_bound_manual(values, target);
    const int after = upper_bound_manual(values, target);
    if (first == after) {
        return {-1, -1};
    }
    return {first, after - 1};
}
// END occurrence-manual

// BEGIN occurrence-standard
std::array<int, 2> occurrence_range_standard(
        const std::vector<int>& values, int target) {
    const auto bounds = std::equal_range(values.begin(), values.end(), target);
    if (bounds.first == bounds.second) {
        return {-1, -1};
    }
    const int first = static_cast<int>(bounds.first - values.begin());
    const int after = static_cast<int>(bounds.second - values.begin());
    return {first, after - 1};
}
// END occurrence-standard

// Preconditions: nonempty positive piles, piles.size() <= hours; speed >= 1.
// BEGIN koko-check
bool koko_can_finish(const std::vector<int>& piles, int hours, int speed) {
    long long used_hours = 0;
    for (int pile : piles) {
        used_hours += (1LL * pile + speed - 1) / speed;
        if (used_hours > hours) {
            return false;
        }
    }
    return true;
}
// END koko-check

// BEGIN koko-search
int koko_min_speed(const std::vector<int>& piles, int hours) {
    int left = 1;
    int right = *std::max_element(piles.begin(), piles.end());
    while (left < right) {
        const int middle = left + (right - left) / 2;
        if (koko_can_finish(piles, hours, middle)) {
            right = middle;
        } else {
            left = middle + 1;
        }
    }
    return left;
}
// END koko-search

// Preconditions: nonempty positive periods; target >= 1; time >= 0.
// BEGIN factory-check
bool factory_can_produce(const std::vector<int>& periods,
                         long long target, long long time) {
    long long produced = 0;
    for (int period : periods) {
        const long long made = time / period;
        if (made >= target - produced) {
            return true;
        }
        produced += made;
    }
    return false;
}
// END factory-check

// BEGIN factory-search
long long factory_min_time(const std::vector<int>& periods, long long target) {
    const int fastest = *std::min_element(periods.begin(), periods.end());
    long long left = 0;
    long long right = 1LL * fastest * target;
    while (left < right) {
        const long long middle = left + (right - left) / 2;
        if (factory_can_produce(periods, target, middle)) {
            right = middle;
        } else {
            left = middle + 1;
        }
    }
    return left;
}
// END factory-search

// Preconditions: nonempty positive values; 1 <= max_blocks <= values.size();
// limit >= 0. This checks existence of a division into at most max_blocks.
// BEGIN division-check
bool division_can_split(const std::vector<int>& values,
                        int max_blocks, long long limit) {
    int blocks = 1;
    long long current_sum = 0;
    for (int value : values) {
        if (value > limit) {
            return false;
        }
        if (current_sum + value > limit) {
            ++blocks;
            current_sum = value;
            if (blocks > max_blocks) {
                return false;
            }
        } else {
            current_sum += value;
        }
    }
    return true;
}
// END division-check

// BEGIN division-search
long long division_min_largest_sum(const std::vector<int>& values,
                                   int exact_blocks) {
    long long left = *std::max_element(values.begin(), values.end());
    long long right = std::accumulate(values.begin(), values.end(), 0LL);
    while (left < right) {
        const long long middle = left + (right - left) / 2;
        if (division_can_split(values, exact_blocks, middle)) {
            right = middle;
        } else {
            left = middle + 1;
        }
    }
    return left;
}
// END division-search

}  // namespace boundary_feasibility

#if defined(SECOND_ALGORITHM_LC34)
// BEGIN lc34-adapter
class Solution {
public:
    std::vector<int> searchRange(std::vector<int>& nums, int target) {
        const auto answer = boundary_feasibility::occurrence_range_standard(
            nums, target);
        return {answer[0], answer[1]};
    }
};
// END lc34-adapter
#elif defined(SECOND_ALGORITHM_LC875)
// BEGIN lc875-adapter
class Solution {
public:
    int minEatingSpeed(std::vector<int>& piles, int h) {
        return boundary_feasibility::koko_min_speed(piles, h);
    }
};
// END lc875-adapter
#elif defined(SECOND_ALGORITHM_FACTORY_MAIN)
// BEGIN factory-main
int main() {
    int machine_count;
    long long target;
    std::cin >> machine_count >> target;
    std::vector<int> periods(machine_count);
    for (int& period : periods) {
        std::cin >> period;
    }
    std::cout << boundary_feasibility::factory_min_time(periods, target) << '\n';
    return 0;
}
// END factory-main
#elif defined(SECOND_ALGORITHM_DIVISION_MAIN)
// BEGIN division-main
int main() {
    int count;
    int blocks;
    std::cin >> count >> blocks;
    std::vector<int> values(count);
    for (int& value : values) {
        std::cin >> value;
    }
    std::cout << boundary_feasibility::division_min_largest_sum(values, blocks)
              << '\n';
    return 0;
}
// END division-main
#endif
