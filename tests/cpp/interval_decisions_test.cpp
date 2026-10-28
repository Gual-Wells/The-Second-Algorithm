#include <algorithm>
#include <chrono>
#include <cstdint>
#include <functional>
#include <iostream>
#include <limits>
#include <numeric>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "../../content/interval-decisions/区间上的取舍.cpp"

namespace independent_test {
namespace id = interval_decisions;
using id::EndpointPolicy;
using id::Interval;
using i64 = long long;
using Mask = std::uint64_t;

std::size_t cases = 0;
std::size_t exhaustive_cases = 0;
std::size_t random_cases = 0;
std::string context;

[[noreturn]] void fail(const std::string& message) {
    throw std::runtime_error(context + ": " + message);
}

void require(bool condition, const std::string& message) {
    if (!condition) fail(message);
}

int bits(Mask mask) {
    int result = 0;
    while (mask != 0) {
        mask &= mask - 1;
        ++result;
    }
    return result;
}

bool same_intervals(const std::vector<Interval>& a,
                    const std::vector<Interval>& b) {
    if (a.size() != b.size()) return false;
    for (std::size_t i = 0; i < a.size(); ++i)
        if (a[i].start != b[i].start || a[i].end != b[i].end) return false;
    return true;
}

bool before(i64 end, i64 start, EndpointPolicy policy) {
    return policy == EndpointPolicy::Closed ? end < start : end <= start;
}

bool compatible(const Interval& a, const Interval& b, EndpointPolicy policy) {
    return before(a.end, b.start, policy) || before(b.end, a.start, policy);
}

bool present(const Interval& range, i64 coordinate, EndpointPolicy policy) {
    return range.start <= coordinate &&
           (policy == EndpointPolicy::Closed ? coordinate <= range.end
                                              : coordinate < range.end);
}

std::string describe(const std::vector<Interval>& ranges, EndpointPolicy policy) {
    std::ostringstream out;
    out << (policy == EndpointPolicy::Closed ? "Closed" : "HalfOpen") << " {";
    for (const auto& range : ranges) out << '[' << range.start << ',' << range.end << "] ";
    return out.str() + '}';
}

// A graph model, rather than the implementation's sorted merge scan.
std::vector<Interval> union_oracle(const std::vector<Interval>& ranges) {
    const int n = static_cast<int>(ranges.size());
    std::vector<int> visited(n, 0);
    std::vector<Interval> result;
    for (int initial = 0; initial < n; ++initial) {
        if (visited[initial]) continue;
        std::vector<int> pending{initial};
        visited[initial] = 1;
        Interval component = ranges[initial];
        while (!pending.empty()) {
            const int i = pending.back();
            pending.pop_back();
            component.start = std::min(component.start, ranges[i].start);
            component.end = std::max(component.end, ranges[i].end);
            for (int j = 0; j < n; ++j) {
                const bool intersects = ranges[i].start <= ranges[j].end &&
                                        ranges[j].start <= ranges[i].end;
                if (!visited[j] && intersects) {
                    visited[j] = 1;
                    pending.push_back(j);
                }
            }
        }
        result.push_back(component);
    }
    std::sort(result.begin(), result.end(), [](const Interval& a, const Interval& b) {
        return a.start < b.start;
    });
    return result;
}

int depth_oracle(const std::vector<Interval>& ranges, Mask chosen,
                 EndpointPolicy policy) {
    int best = 0;
    // With positive-length half-open ranges or nonempty closed ranges,
    // a maximum depth occurs at an input endpoint. No event ordering is used.
    for (const auto& probe : ranges) {
        for (i64 coordinate : {probe.start, probe.end}) {
            int count = 0;
            for (std::size_t i = 0; i < ranges.size(); ++i)
                if ((chosen & (Mask{1} << i)) && present(ranges[i], coordinate, policy))
                    ++count;
            best = std::max(best, count);
        }
    }
    return best;
}

bool compatible_subset(const std::vector<Interval>& ranges, Mask chosen,
                       EndpointPolicy policy) {
    for (std::size_t i = 0; i < ranges.size(); ++i)
        if (chosen & (Mask{1} << i))
            for (std::size_t j = i + 1; j < ranges.size(); ++j)
                if ((chosen & (Mask{1} << j)) && !compatible(ranges[i], ranges[j], policy))
                    return false;
    return true;
}

Mask witness_mask(const std::vector<int>& chosen, std::size_t n,
                  const std::string& api) {
    Mask result = 0;
    for (int index : chosen) {
        require(index >= 0 && static_cast<std::size_t>(index) < n, api + " original ID out of range");
        const Mask bit = Mask{1} << index;
        require((result & bit) == 0, api + " duplicate original ID");
        result |= bit;
    }
    return result;
}

void allocation_witness(const std::vector<Interval>& ranges,
                        EndpointPolicy policy, const id::Allocation& allocation,
                        int optimum, const std::string& api) {
    require(allocation.rooms == optimum, api + " nonminimal room count");
    require(allocation.room_for.size() == ranges.size(), api + " missing original-order allocation");
    for (std::size_t i = 0; i < ranges.size(); ++i) {
        require(allocation.room_for[i] >= 1 && allocation.room_for[i] <= allocation.rooms,
                api + " room ID outside 1..rooms");
        for (std::size_t j = i + 1; j < ranges.size(); ++j)
            if (allocation.room_for[i] == allocation.room_for[j])
                require(compatible(ranges[i], ranges[j], policy), api + " same room conflicts");
    }
}

int stabbing_oracle(const std::vector<Interval>& ranges) {
    if (ranges.empty()) return 0;
    std::vector<i64> coordinates;
    for (const auto& range : ranges) {
        coordinates.push_back(range.start);
        coordinates.push_back(range.end);
    }
    std::sort(coordinates.begin(), coordinates.end());
    coordinates.erase(std::unique(coordinates.begin(), coordinates.end()), coordinates.end());
    int best = static_cast<int>(ranges.size());
    for (Mask mask = 0; mask < (Mask{1} << coordinates.size()); ++mask) {
        const int count = bits(mask);
        if (count >= best) continue;
        bool all_hit = true;
        for (const auto& range : ranges) {
            bool hit = false;
            for (std::size_t j = 0; j < coordinates.size(); ++j)
                if ((mask & (Mask{1} << j)) && range.start <= coordinates[j] && coordinates[j] <= range.end)
                    hit = true;
            if (!hit) { all_hit = false; break; }
        }
        if (all_hit) best = count;
    }
    return best;
}

bool covers_target(const std::vector<Interval>& ranges, Mask chosen, i64 target) {
    std::vector<i64> boundaries{0, 2 * target};
    for (const auto& range : ranges)
        for (i64 coordinate : {range.start, range.end})
            if (0 <= coordinate && coordinate <= target) boundaries.push_back(2 * coordinate);
    std::sort(boundaries.begin(), boundaries.end());
    boundaries.erase(std::unique(boundaries.begin(), boundaries.end()), boundaries.end());
    std::vector<i64> probes = boundaries;
    for (std::size_t i = 1; i < boundaries.size(); ++i)
        probes.push_back((boundaries[i - 1] + boundaries[i]) / 2);
    // On each elementary open cell membership is constant. Probe the cell and
    // its boundaries, in doubled integer coordinates, without a greedy scan.
    for (i64 coordinate : probes) {
        bool hit = false;
        for (std::size_t i = 0; i < ranges.size(); ++i)
            if ((chosen & (Mask{1} << i)) &&
                2 * ranges[i].start <= coordinate && coordinate <= 2 * ranges[i].end)
                hit = true;
        if (!hit) return false;
    }
    return true;
}

int cover_oracle(const std::vector<Interval>& ranges, i64 target) {
    int best = static_cast<int>(ranges.size()) + 1;
    for (Mask mask = 0; mask < (Mask{1} << ranges.size()); ++mask)
        if (bits(mask) < best && covers_target(ranges, mask, target)) best = bits(mask);
    return best == static_cast<int>(ranges.size()) + 1 ? -1 : best;
}

void prefix_case(const std::vector<i64>& ends) {
    const auto original = ends;
    std::vector<i64> starts{-1000000000LL, -3, -1, 0, 1, 2, 4, 1000000000LL};
    starts.insert(starts.end(), ends.begin(), ends.end());
    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen})
        for (int count = 0; count <= static_cast<int>(ends.size()); ++count)
            for (i64 start : starts) {
                int expected = 0;
                for (int i = 0; i < count; ++i) if (before(ends[i], start, policy)) ++expected;
                require(id::compatible_prefix_manual(ends, count, start, policy) == expected,
                        "compatible_prefix_manual vs linear count");
                require(id::compatible_prefix_standard(ends, count, start, policy) == expected,
                        "compatible_prefix_standard vs linear count");
            }
    require(ends == original, "prefix lookup modified input");
}

void check_case(const std::vector<Interval>& ranges, EndpointPolicy policy,
                const std::vector<i64>& rewards) {
    context = "case " + std::to_string(cases) + ' ' + describe(ranges, policy);
    ++cases;
    const auto original = ranges;
    require(ranges.size() < 20, "small oracle called at unsupported size");
    require(rewards.size() == ranges.size(), "test reward mismatch");
    const int n = static_cast<int>(ranges.size());
    const Mask limit = Mask{1} << n;
    const Mask all = limit - 1;

    const auto expected_union = union_oracle(ranges);
    require(same_intervals(id::merge_closed(ranges), expected_union), "merge_closed vs graph components");
    const auto disjoint_snapshot = expected_union;
    for (const Interval added : std::vector<Interval>{{-2, -2}, {-1, 1}, {2, 4}, {-1000000000LL, 1000000000LL}}) {
        auto combined = expected_union;
        combined.push_back(added);
        require(same_intervals(id::insert_closed(expected_union, added), union_oracle(combined)),
                "insert_closed vs graph union");
    }
    require(same_intervals(expected_union, disjoint_snapshot), "insert_closed modified caller");

    bool unique_ranges = true;
    for (int i = 0; i < n; ++i)
        for (int j = i + 1; j < n; ++j)
            if (ranges[i].start == ranges[j].start && ranges[i].end == ranges[j].end) unique_ranges = false;
    if (unique_ranges) {
        const auto flags = id::containment_flags(ranges);
        require(flags.contains.size() == ranges.size() && flags.contained.size() == ranges.size(),
                "containment_flags size/original-order output");
        for (int i = 0; i < n; ++i) {
            int contains = 0, contained = 0;
            for (int j = 0; j < n; ++j) if (i != j) {
                if (ranges[i].start <= ranges[j].start && ranges[j].end <= ranges[i].end) contains = 1;
                if (ranges[j].start <= ranges[i].start && ranges[i].end <= ranges[j].end) contained = 1;
            }
            require(flags.contains[i] == contains && flags.contained[i] == contained,
                    "containment_flags vs pairwise comparison");
        }
    }

    std::vector<id::LoadInterval> loads;
    for (int i = 0; i < n; ++i)
        loads.push_back({ranges[i].start, ranges[i].end, i % 3 == 0 ? 1000000000LL : i + 1LL});
    const auto loads_snapshot = loads;
    i64 expected_peak = 0;
    for (const auto& probe : ranges) for (i64 coordinate : {probe.start, probe.end}) {
        i64 total = 0;
        for (int i = 0; i < n; ++i) if (present(ranges[i], coordinate, policy)) total += loads[i].load;
        expected_peak = std::max(expected_peak, total);
    }
    require(id::peak_load(loads, policy) == expected_peak, "peak_load vs direct endpoint membership");
    for (int i = 0; i < n; ++i)
        require(loads[i].start == loads_snapshot[i].start && loads[i].end == loads_snapshot[i].end &&
                    loads[i].load == loads_snapshot[i].load, "peak_load modified caller");

    const int room_optimum = depth_oracle(ranges, all, policy);
    allocation_witness(ranges, policy, id::allocate_manual(ranges, policy), room_optimum, "allocate_manual");
    allocation_witness(ranges, policy, id::allocate_standard(ranges, policy), room_optimum, "allocate_standard");
    allocation_witness(ranges, policy, id::allocate_heap_algorithms(ranges, policy), room_optimum, "allocate_heap_algorithms");

    int activity_optimum = 0;
    std::vector<int> resource_optimum(n + 1, 0);
    i64 reward_optimum = 0;
    std::vector<i64> budget_optimum(n + 1, 0);
    for (Mask mask = 0; mask < limit; ++mask) {
        const int count = bits(mask);
        const int depth = depth_oracle(ranges, mask, policy);
        for (int k = depth; k <= n; ++k) resource_optimum[k] = std::max(resource_optimum[k], count);
        if (compatible_subset(ranges, mask, policy)) {
            activity_optimum = std::max(activity_optimum, count);
            i64 total = 0;
            i64 bounded_total = 0;
            for (int i = 0; i < n; ++i) if (mask & (Mask{1} << i)) total += rewards[i];
            for (int i = 0; i < n; ++i)
                if (mask & (Mask{1} << i)) bounded_total += std::min(rewards[i], 1000000LL);
            reward_optimum = std::max(reward_optimum, total);
            for (int budget = count; budget <= n; ++budget)
                budget_optimum[budget] = std::max(budget_optimum[budget], bounded_total);
        }
    }
    const auto activities = id::choose_activities(ranges, policy);
    const Mask activity_mask = witness_mask(activities, ranges.size(), "choose_activities");
    require(static_cast<int>(activities.size()) == activity_optimum, "choose_activities nonmaximal count");
    require(compatible_subset(ranges, activity_mask, policy), "choose_activities conflicts");
    for (int k = 0; k <= n; ++k) {
        const auto chosen = id::choose_k_resources(ranges, k, policy);
        const Mask mask = witness_mask(chosen, ranges.size(), "choose_k_resources");
        require(depth_oracle(ranges, mask, policy) <= k, "choose_k_resources infeasible subset");
        require(static_cast<int>(chosen.size()) == resource_optimum[k], "choose_k_resources nonmaximal count at k=" + std::to_string(k));
    }

    const auto points = id::stabbing_points(ranges);
    require(static_cast<int>(points.size()) == stabbing_oracle(ranges), "stabbing_points nonminimal count");
    for (const auto& range : ranges) {
        bool hit = false;
        for (i64 point : points) if (range.start <= point && point <= range.end) hit = true;
        require(hit, "stabbing_points missed a closed range");
    }

    for (i64 target : {1LL, 3LL}) {
        const int optimum = cover_oracle(ranges, target);
        const auto result = id::minimum_cover(ranges, target);
        const Mask mask = witness_mask(result.chosen, ranges.size(), "minimum_cover");
        require(result.possible == (optimum >= 0), "minimum_cover wrong possible flag");
        if (result.possible) {
            require(static_cast<int>(result.chosen.size()) == optimum, "minimum_cover nonminimal count");
            require(covers_target(ranges, mask, target), "minimum_cover witness leaves a gap");
        } else require(result.chosen.empty(), "minimum_cover failure must have no partial witness");
    }

    std::vector<id::Job> jobs;
    for (int i = 0; i < n; ++i) jobs.push_back({ranges[i].start, ranges[i].end, rewards[i]});
    const auto jobs_snapshot = jobs;
    for (int implementation = 0; implementation < 2; ++implementation) {
        const std::string api = implementation == 0 ? "weighted_manual" : "weighted_standard";
        const auto plan = implementation == 0 ? id::weighted_manual(jobs, policy) : id::weighted_standard(jobs, policy);
        const Mask mask = witness_mask(plan.chosen, ranges.size(), api);
        require(compatible_subset(ranges, mask, policy), api + " witness conflicts");
        i64 witness_reward = 0;
        for (int index : plan.chosen) witness_reward += jobs[index].reward;
        require(plan.reward == witness_reward, api + " reward differs from original-ID witness");
        require(plan.reward == reward_optimum, api + " reward differs from subset optimum");
    }
    auto bounded_jobs = jobs;
    // Preserve the new original-task value limit without weakening the
    // existing unbounded-reward overflow checks.
    for (auto& job : bounded_jobs) job.reward = std::min(job.reward, 1000000LL);
    const auto bounded_snapshot = bounded_jobs;
    for (int budget = 0; budget <= n; ++budget)
        require(id::bounded_weighted(bounded_jobs, budget, policy) == budget_optimum[budget],
                "bounded_weighted vs compatible subset at budget=" + std::to_string(budget));
    for (int i = 0; i < n; ++i)
        require(bounded_jobs[i].start == bounded_snapshot[i].start && bounded_jobs[i].end == bounded_snapshot[i].end &&
                    bounded_jobs[i].reward == bounded_snapshot[i].reward, "bounded_weighted modified caller");
    for (int i = 0; i < n; ++i)
        require(jobs[i].start == jobs_snapshot[i].start && jobs[i].end == jobs_snapshot[i].end &&
                    jobs[i].reward == jobs_snapshot[i].reward, "weighted function modified caller");

    const std::vector<i64> queries{2, -3, 0, 2, 1000000000LL, -1000000000LL, 1, -1, 4};
    const auto query_snapshot = queries;
    const auto answers = id::minimum_query_lengths(ranges, queries);
    require(answers.size() == queries.size(), "minimum_query_lengths missing answers");
    for (std::size_t q = 0; q < queries.size(); ++q) {
        i64 expected = -1;
        for (const auto& range : ranges) if (range.start <= queries[q] && queries[q] <= range.end) {
            const i64 length = range.end - range.start + 1;
            if (expected == -1 || length < expected) expected = length;
        }
        require(answers[q] == expected, "minimum_query_lengths wrong original query index=" + std::to_string(q));
    }
    require(queries == query_snapshot, "query function modified caller queries");
    std::vector<i64> ends;
    for (const auto& range : ranges) ends.push_back(range.end);
    std::sort(ends.begin(), ends.end());
    prefix_case(ends);
    require(same_intervals(ranges, original), "function modified caller intervals");
}

void exhaustive() {
    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen}) {
        std::vector<Interval> choices;
        for (i64 start = -1; start <= 2; ++start)
            for (i64 end = start; end <= 2; ++end)
                if (policy == EndpointPolicy::Closed || start < end) choices.push_back({start, end});
        std::vector<Interval> selected;
        std::function<void(int)> visit = [&](int first) {
            auto ranges = selected;
            // Enumerate every multiset through size five. Deterministic rotations
            // and reversals prevent input index from coinciding with sorted rank.
            if (!ranges.empty()) std::rotate(ranges.begin(), ranges.begin() + cases % ranges.size(), ranges.end());
            if (cases % 2 != 0) std::reverse(ranges.begin(), ranges.end());
            std::vector<i64> rewards;
            for (std::size_t i = 0; i < ranges.size(); ++i) {
                const i64 pattern[] = {0, 1, 9, 2, 1000000000LL};
                rewards.push_back(pattern[(i + cases) % 5]);
            }
            check_case(ranges, policy, rewards);
            ++exhaustive_cases;
            if (selected.size() == 5) return;
            for (int i = first; i < static_cast<int>(choices.size()); ++i) {
                selected.push_back(choices[i]);
                visit(i);
                selected.pop_back();
            }
        };
        visit(0);
    }
}

void targeted() {
    check_case({{1, 2}, {2, 3}}, EndpointPolicy::Closed, {2, 3});
    check_case({{1, 2}, {2, 3}}, EndpointPolicy::HalfOpen, {2, 3});
    check_case({{4, 4}, {4, 4}, {3, 4}, {4, 5}}, EndpointPolicy::Closed, {0, 9, 6, 5});
    check_case({{0, 1}, {0, 4}, {5, 6}, {2, 7}}, EndpointPolicy::HalfOpen, {1, 1, 1, 1});
    check_case({{0, 1}, {0, 4}, {5, 6}, {2, 7}}, EndpointPolicy::Closed, {1, 1, 1, 1});
    check_case({{0, 1}, {0, 4}, {1, 2}, {2, 3}, {3, 5}}, EndpointPolicy::Closed, {1, 1, 1, 1, 1});
    check_case({{0, 2}, {2, 4}, {0, 4}}, EndpointPolicy::HalfOpen, {2, 2, 3});
    check_case({{-1000000000LL, 1000000000LL}, {1000000000LL, 1000000000LL},
                {-1000000000LL, -1000000000LL}, {0, 0}}, EndpointPolicy::Closed,
               {1000000000LL, 1000000000LL, 1000000000LL, 1000000000LL});
    check_case({{-1000000000LL, -1}, {-1, 0}, {0, 1000000000LL}}, EndpointPolicy::HalfOpen,
               {1000000000LL, 1000000000LL, 1000000000LL});
    // At budget one, using the current DP row as the predecessor row would
    // illegally accumulate all three compatible jobs.
    check_case({{0, 0}, {1, 1}, {2, 2}}, EndpointPolicy::Closed, {4, 5, 6});
    check_case({{0, 1}, {1, 2}, {2, 3}}, EndpointPolicy::HalfOpen, {4, 5, 6});
    // At most k jobs: these conflicts make an exactly-k state infeasible.
    check_case({{0, 4}, {0, 4}, {1, 3}}, EndpointPolicy::Closed, {7, 2, 5});
    check_case({{0, 4}, {0, 4}, {1, 3}}, EndpointPolicy::HalfOpen, {7, 2, 5});
    prefix_case({-1000000000LL, -1, -1, 0, 0, 0, 2, 1000000000LL});
    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen}) {
        require(id::bounded_weighted({}, 0, policy) == 0, "empty budget jobs k=0");
        require(id::bounded_weighted({}, 1, policy) == 0, "empty budget jobs positive budget");
        require(id::bounded_weighted({{0, 1, 99}}, 0, policy) == 0, "nonempty budget jobs k=0");
    }
    require(id::minimum_query_lengths({}, {}).empty(), "empty ranges and empty queries");
    require(id::minimum_query_lengths({{0, 0}, {-1, 2}}, {}).empty(), "nonempty ranges and empty queries");
    // LC452 permits the full signed 32-bit coordinate range. This API only
    // compares endpoints and is tested under that original-task exception.
    const std::vector<Interval> arrow_extremes{{-2147483648LL, -2147483647LL},
                                             {2147483646LL, 2147483647LL}, {-1, 0}, {0, 1}};
    const auto arrows = id::stabbing_points(arrow_extremes);
    require(static_cast<int>(arrows.size()) == stabbing_oracle(arrow_extremes), "LC452 full int32 extrema optimum");
    for (const auto& range : arrow_extremes)
        require(std::any_of(arrows.begin(), arrows.end(), [&](i64 point) {
                    return range.start <= point && point <= range.end;
                }), "LC452 full int32 extrema witness");
}

void randomized() {
    std::mt19937_64 rng(0xD17EC71020261028ULL);
    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen})
        for (int repetition = 0; repetition < 900; ++repetition) {
            const int n = static_cast<int>(rng() % 10);
            std::vector<Interval> ranges;
            std::vector<i64> rewards;
            for (int i = 0; i < n; ++i) {
                i64 start = static_cast<i64>(rng() % 9) - 4;
                i64 end = static_cast<i64>(rng() % 9) - 4;
                if (start > end) std::swap(start, end);
                if (policy == EndpointPolicy::HalfOpen && start == end) ++end;
                ranges.push_back({start, end});
                rewards.push_back(repetition % 19 == 0 ? 1000000000LL : static_cast<i64>(rng() % 21));
            }
            check_case(ranges, policy, rewards);
            ++random_cases;
        }
}

void scale_cases() {
    context = "scale n=200000";
    const int n = 200000;
    const auto all_original_ids = [n](const std::vector<int>& chosen, const std::string& api) {
        require(chosen.size() == static_cast<std::size_t>(n), api + " missing large original IDs");
        std::vector<int> seen(n, 0);
        for (int index : chosen)
            require(index >= 0 && index < n && seen[index]++ == 0, api + " invalid/duplicate large original ID");
    };
    std::vector<Interval> disjoint;
    std::vector<id::Job> jobs;
    std::vector<id::LoadInterval> loads;
    std::vector<i64> queries;
    for (int i = 0; i < n; ++i) {
        const i64 start = 3LL * (n - 1 - i); // reverse original order
        disjoint.push_back({start, start + 1});
        jobs.push_back({start, start + 1, 1000000000LL});
        loads.push_back({-1000000000LL, 1000000000LL, 1000000000LL});
        queries.push_back(start);
    }
    require(id::merge_closed(disjoint).size() == disjoint.size(), "large merge lost components");
    auto sorted = disjoint;
    std::reverse(sorted.begin(), sorted.end());
    const auto inserted = id::insert_closed(sorted, {-1, 3LL * n});
    require(inserted.size() == 1 && inserted[0].start == -1 && inserted[0].end == 3LL * n,
            "large insert did not span all components");
    const auto flags = id::containment_flags(disjoint);
    require(flags.contains.size() == disjoint.size() && flags.contained.size() == disjoint.size(), "large containment shape");
    require(std::all_of(flags.contains.begin(), flags.contains.end(), [](int value) { return value == 0; }) &&
                std::all_of(flags.contained.begin(), flags.contained.end(), [](int value) { return value == 0; }),
            "large disjoint containment");
    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen}) {
        for (const auto& allocation : {id::allocate_manual(disjoint, policy),
                                       id::allocate_standard(disjoint, policy),
                                       id::allocate_heap_algorithms(disjoint, policy)}) {
            require(allocation.rooms == 1 && allocation.room_for.size() == disjoint.size(), "large allocation count/shape");
            require(std::all_of(allocation.room_for.begin(), allocation.room_for.end(), [](int room) { return room == 1; }),
                    "large allocation original-ID room");
        }
        all_original_ids(id::choose_activities(disjoint, policy), "large disjoint activities");
        require(id::choose_k_resources(disjoint, 0, policy).empty(), "large zero resources");
        all_original_ids(id::choose_k_resources(disjoint, 4, policy), "large disjoint fixed resources");
        for (const auto& plan : {id::weighted_manual(jobs, policy), id::weighted_standard(jobs, policy)}) {
            require(plan.reward == 200000000000000LL, "large 64-bit reward");
            all_original_ids(plan.chosen, "large weighted plan");
        }
        require(id::peak_load(loads, policy) == 200000000000000LL, "large 64-bit peak load");
    }
    require(id::stabbing_points(disjoint).size() == disjoint.size(), "large stabbing count");
    const auto cover = id::minimum_cover(disjoint, 3LL * n);
    require(!cover.possible && cover.chosen.empty(), "large cover gap/failure witness");
    const auto answers = id::minimum_query_lengths(disjoint, queries);
    require(answers.size() == queries.size() &&
                std::all_of(answers.begin(), answers.end(), [](i64 value) { return value == 2; }), "large offline query");
    const auto wide = id::minimum_query_lengths({{-1000000000LL, 1000000000LL}}, {-1000000000LL, 0, 1000000000LL});
    require(wide == std::vector<i64>({2000000001LL, 2000000001LL, 2000000001LL}), "wide closed integer length");

    const std::vector<Interval> identical(n, {0, 1});
    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen})
        for (const auto& allocation : {id::allocate_manual(identical, policy),
                                       id::allocate_standard(identical, policy),
                                       id::allocate_heap_algorithms(identical, policy)}) {
            require(allocation.rooms == n && allocation.room_for.size() == identical.size(), "large overlap room count");
            std::vector<int> seen(n + 1, 0);
            for (int room : allocation.room_for) {
                require(room >= 1 && room <= n && seen[room]++ == 0, "large overlap room ID reused");
            }
        }
}

void budget_scale_cases() {
    context = "bounded_weighted budget scale";
    std::vector<id::Job> many_jobs;
    many_jobs.reserve(1000000);
    for (int i = 0; i < 1000000; ++i) {
        const i64 start = 3LL * (999999 - i);
        many_jobs.push_back({start, start + 1, i + 1LL});
    }
    // n*k = 10^6, with n above the other helpers' 200000 contract.
    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen})
        require(id::bounded_weighted(many_jobs, 1, policy) == 1000000LL,
                "n=1000000 k=1 must return maximum single reward");

    for (EndpointPolicy policy : {EndpointPolicy::Closed, EndpointPolicy::HalfOpen}) {
        std::vector<id::Job> disjoint, conflicts;
        for (int i = 0; i < 1000; ++i) {
            const i64 start = 2LL * (999 - i);
            disjoint.push_back({start, policy == EndpointPolicy::Closed ? start : start + 1, 1000000LL});
            conflicts.push_back({0, 2, i + 1LL});
        }
        require(id::bounded_weighted(disjoint, 1000, policy) == 1000000000LL,
                "n=1000 k=1000 compatible budget scale");
        require(id::bounded_weighted(conflicts, 1000, policy) == 1000LL,
                "n=1000 k=1000 at-most conflict scale");
    }
}

} // namespace independent_test

int main() {
    using namespace independent_test;
    try {
        auto start = std::chrono::steady_clock::now();
        targeted();
        exhaustive();
        randomized();
        const auto small_end = std::chrono::steady_clock::now();
        scale_cases();
        budget_scale_cases();
        const auto end = std::chrono::steady_clock::now();
        std::cout << "PASS interval_decisions: " << cases << " small-model cases ("
                  << exhaustive_cases << " exhaustive multisets, " << random_cases
                  << " seeded random, " << (cases - exhaustive_cases - random_cases)
                  << " targeted); all APIs checked; n=200000 scale families passed.\n"
                  << "Standalone empty-query and LC452 full int32 endpoint checks passed.\n"
                  << "bounded_weighted: every small-case budget, empty/k=0, and n*k=1000000 scale families passed.\n"
                  << "Small-model time: " << std::chrono::duration<double>(small_end - start).count()
                  << " s; scale time: " << std::chrono::duration<double>(end - small_end).count() << " s.\n";
    } catch (const std::exception& error) {
        std::cerr << "FAIL interval_decisions: " << error.what() << '\n';
        return 1;
    }
}
