#include <cstdlib>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

#if (defined(INTERVAL_LC56) + defined(INTERVAL_LC57) + defined(INTERVAL_LC435) + \
     defined(INTERVAL_LC452) + defined(INTERVAL_LC1024) + defined(INTERVAL_LC1235) + \
     defined(INTERVAL_LC1851) + defined(INTERVAL_LC1094) + defined(INTERVAL_LC1751)) != 1
#error Define exactly one supported INTERVAL_LC entry macro.
#endif

#include "../../content/interval-decisions/区间上的取舍.cpp"

namespace {
int checks = 0;
template <class T>
void equal_to(const T& actual, const T& expected, const char* label) {
    ++checks;
    if (!(actual == expected)) throw std::runtime_error(label);
}
using Rows = std::vector<std::vector<int>>;
using Ints = std::vector<int>;

void run_adapter() {
    Solution solution;
#if defined(INTERVAL_LC56)
    const auto check = [&](Rows input, Rows expected, const char* label) {
        const Rows original = input;
        Rows actual = solution.merge(input);
        std::sort(actual.begin(), actual.end());
        std::sort(expected.begin(), expected.end());
        equal_to(actual, expected, label);
        equal_to(input, original, "merge changed the caller's input");
    };
    check({{1,3},{2,6},{8,10},{15,18}}, {{1,6},{8,10},{15,18}}, "LC56 official example");
    check({{1,4},{4,5}}, {{1,5}}, "LC56 touching closed endpoints");
    check({{4,7},{1,4}}, {{1,7}}, "LC56 unsorted input");
    check({{1,10},{2,3},{4,5}}, {{1,10}}, "LC56 nested ranges must not shrink the union");
    check({{5,5},{5,5},{0,0}}, {{0,0},{5,5}}, "LC56 repeated singleton intervals");
    check({{0,10000}}, {{0,10000}}, "LC56 coordinate bound");
#elif defined(INTERVAL_LC57)
    const auto check = [&](Rows input, Ints added, const Rows& expected, const char* label) {
        const Rows original = input;
        const Ints original_added = added;
        equal_to(solution.insert(input, added), expected, label);
        equal_to(input, original, "insert changed the caller's intervals");
        equal_to(added, original_added, "insert changed newInterval");
    };
    check({{1,3},{6,9}}, {2,5}, {{1,5},{6,9}}, "LC57 official example");
    check({{1,2},{3,5},{6,7},{8,10},{12,16}}, {4,8}, {{1,2},{3,10},{12,16}}, "LC57 bridge multiple ranges");
    check({}, {5,7}, {{5,7}}, "LC57 legal empty input");
    check({{3,5}}, {0,1}, {{0,1},{3,5}}, "LC57 insert before");
    check({{3,5}}, {7,100000}, {{3,5},{7,100000}}, "LC57 insert after and coordinate bound");
    check({{1,9}}, {3,4}, {{1,9}}, "LC57 inserted range already contained");
    check({{1,2},{5,6}}, {2,5}, {{1,6}}, "LC57 closed touching bridge");
    check({{0,0},{2,2}}, {1,1}, {{0,0},{1,1},{2,2}}, "LC57 singleton in a genuine gap");
#elif defined(INTERVAL_LC435)
    const auto check = [&](Rows input, int expected, const char* label) {
        const Rows original = input;
        equal_to(solution.eraseOverlapIntervals(input), expected, label);
        equal_to(input, original, "eraseOverlapIntervals changed input");
    };
    check({{1,2},{2,3},{3,4},{1,3}}, 1, "LC435 official example");
    check({{1,2},{1,2},{1,2}}, 2, "LC435 duplicate jobs remain distinct");
    check({{1,2},{2,3}}, 0, "LC435 touching intervals compatible");
    check({{1,100},{2,3},{3,4},{4,5}}, 1, "LC435 earliest start is not the choice");
    check({{-50000,-49999},{-49999,0},{0,50000}}, 0, "LC435 signed boundary and chained endpoints");
    check({{-50000,50000}}, 0, "LC435 one range");
#elif defined(INTERVAL_LC452)
    const auto check = [&](Rows input, int expected, const char* label) {
        const Rows original = input;
        equal_to(solution.findMinArrowShots(input), expected, label);
        equal_to(input, original, "findMinArrowShots changed input");
    };
    check({{10,16},{2,8},{1,6},{7,12}}, 2, "LC452 official example");
    check({{1,2},{3,4},{5,6},{7,8}}, 4, "LC452 disjoint balloons");
    check({{1,2},{2,3},{3,4},{4,5}}, 2, "LC452 closed endpoint hit");
    check({{1,3},{2,5},{4,6}}, 2, "LC452 connected union need not have one stabbing point");
    check({{1,9},{1,9},{2,3}}, 1, "LC452 duplicate and nested balloons");
    const int low = std::numeric_limits<int>::min();
    const int high = std::numeric_limits<int>::max();
    check({{low,low+1},{high-1,high}}, 2, "LC452 full signed endpoint range");
    check({{low,high},{low,-1},{-1,high}}, 1, "LC452 no overflowing endpoint subtraction");
#elif defined(INTERVAL_LC1024)
    const auto check = [&](Rows input, int time, int expected, const char* label) {
        const Rows original = input;
        equal_to(solution.videoStitching(input, time), expected, label);
        equal_to(input, original, "videoStitching changed input");
    };
    check({{0,2},{4,6},{8,10},{1,9},{1,5},{5,9}}, 10, 3, "LC1024 official example");
    check({{0,1},{1,2}}, 5, -1, "LC1024 uncovered suffix");
    check({{0,1},{0,3},{1,2},{2,3}}, 3, 1, "LC1024 inspect all candidates before committing");
    check({{0,1},{2,3}}, 3, -1, "LC1024 interior gap");
    check({{1,3},{2,5}}, 5, -1, "LC1024 uncovered start");
    check({{0,0},{0,1},{1,1},{1,2}}, 2, 2, "LC1024 zero length clips cannot advance");
    check({{0,100}}, 100, 1, "LC1024 coordinate and target bound");
#elif defined(INTERVAL_LC1235)
    const auto check = [&](Ints start, Ints end, Ints profit, int expected, const char* label) {
        const Ints old_start = start, old_end = end, old_profit = profit;
        equal_to(solution.jobScheduling(start, end, profit), expected, label);
        equal_to(start, old_start, "jobScheduling changed startTime");
        equal_to(end, old_end, "jobScheduling changed endTime");
        equal_to(profit, old_profit, "jobScheduling changed profit");
    };
    check({1,2,3,3}, {3,4,5,6}, {50,10,40,70}, 120, "LC1235 official example");
    check({1,2,3,4,6}, {3,5,10,6,9}, {20,20,100,70,60}, 150, "LC1235 official mixed example");
    check({1,1,1}, {2,3,4}, {5,6,4}, 6, "LC1235 same start");
    check({1,3,1}, {3,5,5}, {1,1,10}, 10, "LC1235 cardinality greedy is insufficient");
    check({1,5,2}, {3,6,7}, {5,6,20}, 20, "LC1235 predecessor index need not increase");
    check({3,1}, {5,3}, {7,6}, 13, "LC1235 equal end/start is compatible and input unsorted");
    check({1}, {1000000000}, {10000}, 10000, "LC1235 largest endpoint");
    Ints starts(50000), ends(50000), rewards(50000,10000);
    for (int i = 0; i < 50000; ++i) { starts[i] = 2*i+1; ends[i] = 2*i+2; }
    check(starts, ends, rewards, 500000000, "LC1235 maximum n and total reward bound");
#elif defined(INTERVAL_LC1751)
    const auto check = [&](Rows input, int k, int expected, const char* label) {
        const Rows original = input;
        equal_to(solution.maxValue(input, k), expected, label);
        equal_to(input, original, "maxValue changed events");
    };
    check({{1,2,4},{3,4,3},{2,3,1}}, 2, 7, "LC1751 official example one");
    check({{1,2,4},{3,4,3},{2,3,10}}, 2, 10, "LC1751 at most k does not require k events");
    check({{1,1,1},{2,2,2},{3,3,3},{4,4,4}}, 3, 9, "LC1751 official singleton example");
    check({{1,2,6},{2,3,10},{3,4,6}}, 2, 12, "LC1751 touching days conflict");
    check({{1,1,4},{1,1,10},{2,2,7}}, 2, 17, "LC1751 same-day alternative and next-day compatibility");
    check({{5,5,20},{1,1,30},{3,3,40}}, 1, 40, "LC1751 one-event budget and unsorted input");
    check({{1,1000000000,1000000}}, 1, 1000000, "LC1751 maximum endpoint and individual value");
    Rows maximum_budget;
    for (int i = 1; i <= 1000; ++i) maximum_budget.push_back({i,i,1000000});
    check(maximum_budget, 1000, 1000000000, "LC1751 maximum legal budget and int-safe total");
#elif defined(INTERVAL_LC1851)
    const auto check = [&](Rows input, Ints queries, const Ints& expected, const char* label) {
        const Rows original = input;
        const Ints original_queries = queries;
        equal_to(solution.minInterval(input, queries), expected, label);
        equal_to(input, original, "minInterval changed intervals");
        equal_to(queries, original_queries, "minInterval changed query order");
    };
    check({{1,4},{2,4},{3,6},{4,4}}, {2,3,4,5}, {3,3,1,4}, "LC1851 official example");
    check({{2,3},{2,5},{1,8},{20,25}}, {2,19,5,22}, {2,-1,4,6}, "LC1851 official absent query");
    check({{1,2},{1,100},{3,3}}, {3,2,100,101,3}, {1,2,100,-1,1}, "LC1851 expiry and repeated unsorted queries");
    check({{7,7},{7,7}}, {8,7,6}, {-1,1,-1}, "LC1851 repeated singleton intervals");
    check({{1,10000000}}, {10000000,1}, {10000000,10000000}, "LC1851 inclusive integer length bound");
#elif defined(INTERVAL_LC1094)
    const auto check = [&](Rows input, int capacity, bool expected, const char* label) {
        const Rows original = input;
        equal_to(solution.carPooling(input, capacity), expected, label);
        equal_to(input, original, "carPooling changed trips");
    };
    check({{2,1,5},{3,3,7}}, 4, false, "LC1094 official insufficient capacity");
    check({{2,1,5},{3,3,7}}, 5, true, "LC1094 exact capacity");
    check({{3,5,7},{2,1,5}}, 3, true, "LC1094 drop before pickup at equal coordinate");
    check({{4,0,1},{4,1,2},{4,2,3}}, 4, true, "LC1094 repeated capacity reuse");
    check({{100,0,1000}}, 99, false, "LC1094 coordinate extremes and one trip");
    Rows maximum_trips(1000, Ints{100,0,1000});
    check(maximum_trips, 100000, true, "LC1094 maximum total load fits capacity");
    check(maximum_trips, 99999, false, "LC1094 maximum total load exceeds capacity");
#endif
}
} // namespace

int main() {
    try {
        run_adapter();
        std::cout << "adapter checks passed: " << checks << '\n';
        return EXIT_SUCCESS;
    } catch (const std::exception& error) {
        std::cerr << "adapter check failed: " << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
