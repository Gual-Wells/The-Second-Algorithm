#include <algorithm>
#include <array>
#include <climits>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <numeric>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

// This file was designed from original problem statements and the public API.
// The linear/simulation/cut-set reference models do not use binary search.
#include "../../content/boundary-feasibility/边界与答案.cpp"

namespace {
using Values = std::vector<int>;
namespace subject = boundary_feasibility;

struct Counts {
    long long assertions = 0;
    long long boundary_cases = 0;
    long long koko_arrays = 0;
    long long koko_minimum_calls = 0;
    long long koko_predicate_calls = 0;
    long long factory_arrays = 0;
    long long factory_minimum_calls = 0;
    long long factory_predicate_calls = 0;
    long long division_arrays = 0;
    long long division_minimum_calls = 0;
    long long division_predicate_calls = 0;
} counts;

[[noreturn]] void fail(const char* label, const Values& values,
                      long long first, long long second,
                      long long actual, long long expected) {
    std::cerr << "FAIL " << label << " first=" << first
              << " second=" << second << " actual=" << actual
              << " expected=" << expected << " values=[";
    const std::size_t shown = std::min<std::size_t>(values.size(), 32);
    for (std::size_t i = 0; i < shown; ++i) {
        if (i != 0) std::cerr << ',';
        std::cerr << values[i];
    }
    if (shown < values.size()) std::cerr << ",... size=" << values.size();
    std::cerr << "]\n";
    throw std::runtime_error(label);
}

void check(long long actual, long long expected, const char* label,
           const Values& values, long long first = 0, long long second = 0) {
    ++counts.assertions;
    if (actual != expected) fail(label, values, first, second, actual, expected);
}

template<class Visitor>
void all_arrays(Values& values, int length, int low, int high, Visitor&& visit) {
    if (static_cast<int>(values.size()) == length) {
        visit(values);
        return;
    }
    for (int next = low; next <= high; ++next) {
        values.push_back(next);
        all_arrays(values, length, low, high, visit);
        values.pop_back();
    }
}

void check_boundaries(const Values& values, int target) {
    ++counts.boundary_cases;
    const Values before = values;
    const int n = static_cast<int>(values.size());
    int lower = n;
    int upper = n;
    int first_match = -1;
    int last_match = -1;
    for (int i = 0; i < n; ++i) {
        if (lower == n && values[i] >= target) lower = i;
        if (upper == n && values[i] > target) upper = i;
        if (values[i] == target) {
            if (first_match == -1) first_match = i;
            last_match = i;
        }
    }
    check(subject::lower_bound_manual(values, target), lower,
          "lower_bound", values, target);
    check(subject::upper_bound_manual(values, target), upper,
          "upper_bound", values, target);
    const auto manual = subject::occurrence_range_manual(values, target);
    const auto standard = subject::occurrence_range_standard(values, target);
    check(manual[0], first_match, "manual first", values, target);
    check(manual[1], last_match, "manual last", values, target);
    check(standard[0], first_match, "standard first", values, target);
    check(standard[1], last_match, "standard last", values, target);
    check(values == before, true, "boundary input preserved", values, target);
}

void sorted_arrays(Values& values, int length, int next_value) {
    if (static_cast<int>(values.size()) == length) {
        for (int target = -3; target <= 3; ++target) {
            check_boundaries(values, target);
        }
        return;
    }
    for (int next = next_value; next <= 2; ++next) {
        values.push_back(next);
        sorted_arrays(values, length, next);
        values.pop_back();
    }
}

// Simulate actual hours: each hour works on exactly one current pile.
long long simulated_koko_hours(const Values& piles, int speed) {
    long long hours = 0;
    for (int pile : piles) {
        int remaining = pile;
        while (remaining > 0) {
            remaining -= std::min(remaining, speed);
            ++hours;
        }
    }
    return hours;
}

void check_koko_small(const Values& piles, bool every_hours, std::mt19937& rng) {
    ++counts.koko_arrays;
    const int maximum = *std::max_element(piles.begin(), piles.end());
    const int sum = std::accumulate(piles.begin(), piles.end(), 0);
    const int size = static_cast<int>(piles.size());
    std::vector<long long> simulated(static_cast<std::size_t>(maximum) + 2);
    for (int speed = 1; speed <= maximum + 1; ++speed) {
        simulated[speed] = simulated_koko_hours(piles, speed);
    }
    const int first_hours = every_hours ? size : size + static_cast<int>(rng() % (sum + 2));
    const int last_hours = every_hours ? sum + 1 : first_hours;
    for (int hours = first_hours; hours <= last_hours; ++hours) {
        int optimum = 1;
        while (simulated[optimum] > hours) ++optimum;
        ++counts.koko_minimum_calls;
        check(subject::koko_min_speed(piles, hours), optimum,
              "koko minimum", piles, hours);
        for (int speed = 1; speed <= maximum + 1; ++speed) {
            ++counts.koko_predicate_calls;
            check(subject::koko_can_finish(piles, hours, speed),
                  simulated[speed] <= hours, "koko predicate", piles, hours, speed);
        }
    }
}

// Each machine has an independent countdown. No time/period quotient is used.
std::vector<long long> countdown_factory(const Values& periods, int last_second) {
    Values remaining = periods;
    std::vector<long long> produced(static_cast<std::size_t>(last_second) + 1, 0);
    for (int second = 1; second <= last_second; ++second) {
        produced[second] = produced[second - 1];
        for (std::size_t machine = 0; machine < periods.size(); ++machine) {
            --remaining[machine];
            if (remaining[machine] == 0) {
                ++produced[second];
                remaining[machine] = periods[machine];
            }
        }
    }
    return produced;
}

void check_factory_small(const Values& periods, int max_target, bool every_target,
                         std::mt19937& rng) {
    ++counts.factory_arrays;
    const int fastest = *std::min_element(periods.begin(), periods.end());
    const int first_target = every_target ? 1 : 1 + static_cast<int>(rng() % max_target);
    const int last_target = every_target ? max_target : first_target;
    const int horizon = fastest * last_target + 2;
    const auto produced = countdown_factory(periods, horizon);
    for (int target = first_target; target <= last_target; ++target) {
        int optimum = 0;
        while (produced[optimum] < target) ++optimum;
        ++counts.factory_minimum_calls;
        check(subject::factory_min_time(periods, target), optimum,
              "factory minimum", periods, target);
        for (int second = 0; second <= fastest * target + 2; ++second) {
            ++counts.factory_predicate_calls;
            check(subject::factory_can_produce(periods, target, second),
                  produced[second] >= target, "factory predicate", periods, target, second);
        }
    }
}

// Enumerate every subset of the n-1 gaps. Every selected gap is a real cut;
// therefore all groups are nonempty, contiguous, and the count is exact.
std::vector<long long> cut_set_optima(const Values& values) {
    const int n = static_cast<int>(values.size());
    std::vector<long long> best(static_cast<std::size_t>(n) + 1,
                                std::numeric_limits<long long>::max());
    const std::uint64_t masks = std::uint64_t{1} << (n - 1);
    for (std::uint64_t mask = 0; mask < masks; ++mask) {
        long long block_sum = values[0];
        long long largest = std::numeric_limits<long long>::lowest();
        int groups = 1;
        for (int i = 1; i < n; ++i) {
            if ((mask & (std::uint64_t{1} << (i - 1))) != 0) {
                largest = std::max(largest, block_sum);
                block_sum = values[i];
                ++groups;
            } else {
                block_sum += values[i];
            }
        }
        largest = std::max(largest, block_sum);
        best[groups] = std::min(best[groups], largest);
    }
    return best;
}

void check_division_small(const Values& values, bool every_limit, std::mt19937& rng) {
    ++counts.division_arrays;
    const auto optimum = cut_set_optima(values);
    const int n = static_cast<int>(values.size());
    const int sum = std::accumulate(values.begin(), values.end(), 0);
    for (int exact_groups = 1; exact_groups <= n; ++exact_groups) {
        ++counts.division_minimum_calls;
        check(subject::division_min_largest_sum(values, exact_groups), optimum[exact_groups],
              "division minimum", values, exact_groups);
        if (every_limit) {
            for (int limit = 0; limit <= sum + 1; ++limit) {
                ++counts.division_predicate_calls;
                check(subject::division_can_split(values, exact_groups, limit),
                      optimum[exact_groups] <= limit, "division predicate", values,
                      exact_groups, limit);
            }
        } else {
            const std::array<long long, 5> limits{
                0, optimum[exact_groups] - 1, optimum[exact_groups],
                optimum[exact_groups] + 1, static_cast<long long>(rng() % (sum + 2))};
            for (long long limit : limits) {
                ++counts.division_predicate_calls;
                check(subject::division_can_split(values, exact_groups, limit),
                      optimum[exact_groups] <= limit, "division predicate random", values,
                      exact_groups, limit);
            }
        }
    }
}

void check_large_koko(const Values& piles, int hours, int optimum) {
    ++counts.koko_arrays;
    ++counts.koko_minimum_calls;
    check(subject::koko_min_speed(piles, hours), optimum, "large koko minimum", piles, hours);
    ++counts.koko_predicate_calls;
    check(subject::koko_can_finish(piles, hours, optimum), true,
          "large koko feasible", piles, hours, optimum);
    if (optimum > 1) {
        ++counts.koko_predicate_calls;
        check(subject::koko_can_finish(piles, hours, optimum - 1), false,
              "large koko preceding infeasible", piles, hours, optimum - 1);
    }
}

void check_large_factory(const Values& periods, long long target, long long optimum) {
    ++counts.factory_arrays;
    ++counts.factory_minimum_calls;
    check(subject::factory_min_time(periods, target), optimum,
          "large factory minimum", periods, target);
    ++counts.factory_predicate_calls;
    check(subject::factory_can_produce(periods, target, optimum), true,
          "large factory feasible", periods, target, optimum);
    ++counts.factory_predicate_calls;
    check(subject::factory_can_produce(periods, target, optimum - 1), false,
          "large factory preceding infeasible", periods, target, optimum - 1);
}

void check_large_division(const Values& values, int groups, long long optimum) {
    ++counts.division_arrays;
    ++counts.division_minimum_calls;
    check(subject::division_min_largest_sum(values, groups), optimum,
          "large division minimum", values, groups);
    ++counts.division_predicate_calls;
    check(subject::division_can_split(values, groups, optimum), true,
          "large division feasible", values, groups, optimum);
    ++counts.division_predicate_calls;
    check(subject::division_can_split(values, groups, optimum - 1), false,
          "large division preceding infeasible", values, groups, optimum - 1);
}

void original_examples_and_adversaries(std::mt19937& rng) {
    check_boundaries(Values{5, 7, 7, 8, 8, 10}, 8);
    check_boundaries(Values{5, 7, 7, 8, 8, 10}, 6);
    check_boundaries({}, 0);
    check_koko_small(Values{3, 6, 7, 11}, true, rng);
    check_koko_small(Values{30, 11, 23, 4, 20}, true, rng);
    check_factory_small(Values{3, 2, 5}, 12, true, rng);
    check_division_small(Values{2, 4, 7, 3, 5}, true, rng);
    check_division_small(Values{1, 1, 1, 1}, true, rng);
    check_division_small(Values{1, 100, 1}, true, rng);
    check_division_small(Values{1, 2, 3, 4, 5}, true, rng);
    check_division_small(Values{5, 4, 3, 2, 1}, true, rng);
    // The greedy minimum number of blocks is 2; an exact 3-block division exists.
    check(subject::division_can_split(Values{1, 1, 1, 1}, 3, 2), true,
          "exact k refinement rather than greedy count equality", Values{1, 1, 1, 1}, 3, 2);
    // Mathematical counterexample to extending positive-input reasoning to negatives.
    // This does NOT call the production function outside its original input contract.
    check(cut_set_optima(Values{5, -4})[1], 1,
          "reference-only negative counterexample", Values{5, -4}, 1, 1);
}

void large_hand_derived_cases() {
    for (int target : {-1000000000, -1, 0, 1, 1000000000}) {
        check_boundaries(Values{-1000000000, -1000000000, 0, 1000000000}, target);
    }
    const Values duplicates(100000, 7);
    for (int target : {6, 7, 8}) check_boundaries(duplicates, target);

    check_large_koko(Values{1000000000}, 1, 1000000000);
    check_large_koko(Values{1000000000}, 1000000000, 1);
    check_large_koko(Values{1000000000, 1000000000}, 3, 1000000000);
    check_large_koko(Values{1000000000, 1000000000}, 4, 500000000);
    const Values huge_piles(10000, 1000000000);
    check_large_koko(huge_piles, 10000, 1000000000);
    check_large_koko(huge_piles, 1000000000, 10000);
    ++counts.koko_predicate_calls;
    check(subject::koko_can_finish(huge_piles, 1000000000, 1), false,
          "koko 10^13 hours does not wrap", huge_piles, 1000000000, 1);
    // The predicate contract states any positive int speed; this is not a
    // minimum-answer input and does not alter the original problem contract.
    ++counts.koko_predicate_calls;
    check(subject::koko_can_finish(Values{1}, 1, INT_MAX), true,
          "koko widened intermediate for INT_MAX speed", Values{1}, 1, INT_MAX);
    ++counts.koko_predicate_calls;
    check(subject::koko_can_finish(huge_piles, 10000, INT_MAX), true,
          "koko all piles take one hour at INT_MAX speed", huge_piles, 10000, INT_MAX);

    check_large_factory(Values{1000000000}, 1000000000, 1000000000000000000LL);
    check_large_factory(Values{2, 3}, 5, 6);
    const Values fast_machines(200000, 1);
    check_large_factory(fast_machines, 1000000000, 5000);
    check_large_factory(Values(200000, 1000000000), 1000000000, 5000000000000LL);
    ++counts.factory_predicate_calls;
    check(subject::factory_can_produce(fast_machines, 1000000000, 1000000000000000000LL),
          true, "factory wide predicate saturates 2*10^23", fast_machines,
          1000000000, 1000000000000000000LL);
    ++counts.factory_predicate_calls;
    check(subject::factory_can_produce(Values{1, 1}, 1000000000, LLONG_MAX), true,
          "factory LLONG_MAX predicate avoids two-term overflow", Values{1, 1},
          1000000000, LLONG_MAX);

    const Values large_division(200000, 1000000000);
    check_large_division(large_division, 1, 200000000000000LL);
    check_large_division(large_division, 2, 100000000000000LL);
    check_large_division(large_division, 3, 66667000000000LL);
    check_large_division(large_division, 199999, 2000000000LL);
    check_large_division(large_division, 200000, 1000000000LL);
    check_large_division(Values(200000, 1), 3, 66667);
    check_large_division(Values{1000000000, 1, 1, 1000000000}, 2, 1000000001LL);
    check_large_division(Values{1000000000, 1, 1, 1000000000}, 3, 1000000000LL);
}

void print_counts() {
    std::cout << "seed=0x6B6F6B6F\n"
              << "assertions=" << counts.assertions << '\n'
              << "boundary_cases=" << counts.boundary_cases << '\n'
              << "koko_arrays=" << counts.koko_arrays << '\n'
              << "koko_minimum_calls=" << counts.koko_minimum_calls << '\n'
              << "koko_predicate_calls=" << counts.koko_predicate_calls << '\n'
              << "factory_arrays=" << counts.factory_arrays << '\n'
              << "factory_minimum_calls=" << counts.factory_minimum_calls << '\n'
              << "factory_predicate_calls=" << counts.factory_predicate_calls << '\n'
              << "division_arrays=" << counts.division_arrays << '\n'
              << "division_minimum_calls=" << counts.division_minimum_calls << '\n'
              << "division_predicate_calls=" << counts.division_predicate_calls << '\n'
              << "PASS: independent boundary, hour simulation, machine countdown, exact cut sets\n";
}
} // namespace

int main() {
    try {
        std::mt19937 rng(0x6B6F6B6Fu);
        original_examples_and_adversaries(rng);
        Values current;
        for (int length = 0; length <= 7; ++length) sorted_arrays(current, length, -2);
        for (int length = 1; length <= 5; ++length) {
            all_arrays(current, length, 1, 4,
                       [&](const Values& values) { check_koko_small(values, true, rng); });
        }
        for (int length = 1; length <= 4; ++length) {
            all_arrays(current, length, 1, 4,
                       [&](const Values& values) { check_factory_small(values, 12, true, rng); });
        }
        for (int length = 1; length <= 7; ++length) {
            all_arrays(current, length, 1, 3,
                       [&](const Values& values) { check_division_small(values, true, rng); });
        }
        for (int trial = 0; trial < 600; ++trial) {
            Values values(rng() % 65);
            for (int& value : values) value = static_cast<int>(rng() % 21) - 10;
            std::sort(values.begin(), values.end());
            for (int target : {-11, -1, 0, 1, 11}) check_boundaries(values, target);
        }
        for (int trial = 0; trial < 500; ++trial) {
            Values values(1 + rng() % 12);
            for (int& value : values) value = 1 + static_cast<int>(rng() % 50);
            check_koko_small(values, false, rng);
        }
        for (int trial = 0; trial < 500; ++trial) {
            Values values(1 + rng() % 10);
            for (int& value : values) value = 1 + static_cast<int>(rng() % 30);
            check_factory_small(values, 40, false, rng);
        }
        for (int trial = 0; trial < 600; ++trial) {
            Values values(1 + rng() % 11);
            for (int& value : values) value = 1 + static_cast<int>(rng() % 30);
            check_division_small(values, false, rng);
        }
        large_hand_derived_cases();
        print_counts();
        return EXIT_SUCCESS;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
