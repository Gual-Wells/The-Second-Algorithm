// C++17 reference. Define one INTERVAL_* entry macro for a standalone platform submission.
// Legal task inputs only; see the adjacent chapter for endpoint and size contracts.
// BEGIN headers
#include <algorithm>
#include <functional>
#include <iostream>
#include <queue>
#include <set>
#include <utility>
#include <vector>
// END headers

namespace interval_decisions {
// BEGIN types
enum class EndpointPolicy { HalfOpen, Closed };
struct Interval { long long start, end; };
struct LoadInterval { long long start, end, load; };
struct Job { long long start, end, reward; };
struct Allocation { int rooms; std::vector<int> room_for; };
struct CoverResult { bool possible; std::vector<int> chosen; };
struct Plan { long long reward; std::vector<int> chosen; };
struct Containment { std::vector<int> contains, contained; };
// END types

// BEGIN orders
bool compatible(long long end, long long start, EndpointPolicy policy) {
    return policy == EndpointPolicy::HalfOpen ? end <= start : end < start;
}
struct IndexedInterval { Interval range; int id; };
std::vector<IndexedInterval> indexed_ranges(const std::vector<Interval>& ranges) {
    std::vector<IndexedInterval> result;
    result.reserve(ranges.size());
    for (int i = 0; i < static_cast<int>(ranges.size()); ++i)
        result.push_back({ranges[i], i});
    return result;
}
bool by_start(const IndexedInterval& a, const IndexedInterval& b) {
    if (a.range.start != b.range.start) return a.range.start < b.range.start;
    if (a.range.end != b.range.end) return a.range.end > b.range.end;
    return a.id < b.id;
}
bool by_end(const IndexedInterval& a, const IndexedInterval& b) {
    if (a.range.end != b.range.end) return a.range.end < b.range.end;
    if (a.range.start != b.range.start) return a.range.start < b.range.start;
    return a.id < b.id;
}
// END orders

// BEGIN merge_closed
std::vector<Interval> merge_closed(std::vector<Interval> ranges) {
    std::sort(ranges.begin(), ranges.end(), [](const Interval& a, const Interval& b) {
        if (a.start != b.start) return a.start < b.start;
        return a.end < b.end;
    });
    std::vector<Interval> result;
    for (const Interval& current : ranges) {
        if (result.empty() || result.back().end < current.start)
            result.push_back(current);
        else
            result.back().end = std::max(result.back().end, current.end);
    }
    return result;
}
// END merge_closed

// BEGIN insert_closed
std::vector<Interval> insert_closed(const std::vector<Interval>& disjoint, Interval added) {
    std::vector<Interval> result;
    int i = 0, n = static_cast<int>(disjoint.size());
    while (i < n && disjoint[i].end < added.start) result.push_back(disjoint[i++]);
    while (i < n && disjoint[i].start <= added.end) {
        added.start = std::min(added.start, disjoint[i].start);
        added.end = std::max(added.end, disjoint[i].end);
        ++i;
    }
    result.push_back(added);
    while (i < n) result.push_back(disjoint[i++]);
    return result;
}
// END insert_closed

// BEGIN containment_flags
Containment containment_flags(const std::vector<Interval>& ranges) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_start);
    const int n = static_cast<int>(ordered.size());
    Containment result{std::vector<int>(n, 0), std::vector<int>(n, 0)};
    if (n == 0) return result;
    long long largest = ordered.front().range.end;
    for (int i = 1; i < n; ++i) {
        result.contained[ordered[i].id] = ordered[i].range.end <= largest;
        largest = std::max(largest, ordered[i].range.end);
    }
    long long smallest = ordered.back().range.end;
    for (int i = n - 2; i >= 0; --i) {
        result.contains[ordered[i].id] = ordered[i].range.end >= smallest;
        smallest = std::min(smallest, ordered[i].range.end);
    }
    return result;
}
// END containment_flags

// BEGIN peak_load
long long peak_load(const std::vector<LoadInterval>& ranges, EndpointPolicy policy) {
    std::vector<std::pair<long long, long long>> events;
    events.reserve(2 * ranges.size());
    for (const LoadInterval& range : ranges) {
        events.push_back({range.start, range.load});
        events.push_back({range.end, -range.load});
    }
    std::sort(events.begin(), events.end(), [policy](const auto& a, const auto& b) {
        if (a.first != b.first) return a.first < b.first;
        return policy == EndpointPolicy::Closed ? a.second > b.second : a.second < b.second;
    });
    long long current = 0, peak = 0;
    for (const auto& event : events) {
        current += event.second;
        peak = std::max(peak, current);
    }
    return peak;
}
// END peak_load

// BEGIN release_min_heap
using Release = std::pair<long long, int>;
class ReleaseMinHeap {
    std::vector<Release> data;
public:
    bool empty() const { return data.empty(); }
    Release top() const { return data.front(); } // requires !empty()
    void push(Release value) {
        data.push_back(value);
        int child = static_cast<int>(data.size()) - 1;
        while (child > 0) {
            int parent = (child - 1) / 2;
            if (!(data[child] < data[parent])) break;
            std::swap(data[child], data[parent]);
            child = parent;
        }
    }
    void pop() { // requires !empty()
        data.front() = data.back();
        data.pop_back();
        int parent = 0, n = static_cast<int>(data.size());
        while (2 * parent + 1 < n) {
            int child = 2 * parent + 1;
            if (child + 1 < n && data[child + 1] < data[child]) ++child;
            if (!(data[child] < data[parent])) break;
            std::swap(data[child], data[parent]);
            parent = child;
        }
    }
};
// END release_min_heap

// BEGIN allocate_manual
Allocation allocate_manual(const std::vector<Interval>& ranges, EndpointPolicy policy) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_start);
    Allocation result{0, std::vector<int>(ranges.size())};
    ReleaseMinHeap releases;
    for (const IndexedInterval& current : ordered) {
        int room;
        if (!releases.empty() && compatible(releases.top().first, current.range.start, policy)) {
            room = releases.top().second;
            releases.pop();
        } else room = ++result.rooms;
        result.room_for[current.id] = room;
        releases.push({current.range.end, room});
    }
    return result;
}
// END allocate_manual

// BEGIN allocate_standard
Allocation allocate_standard(const std::vector<Interval>& ranges, EndpointPolicy policy) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_start);
    Allocation result{0, std::vector<int>(ranges.size())};
    std::priority_queue<Release, std::vector<Release>, std::greater<Release>> releases;
    for (const IndexedInterval& current : ordered) {
        int room;
        if (!releases.empty() && compatible(releases.top().first, current.range.start, policy)) {
            room = releases.top().second;
            releases.pop();
        } else room = ++result.rooms;
        result.room_for[current.id] = room;
        releases.push({current.range.end, room});
    }
    return result;
}
// END allocate_standard

// BEGIN allocate_heap_algorithms
Allocation allocate_heap_algorithms(const std::vector<Interval>& ranges, EndpointPolicy policy) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_start);
    Allocation result{0, std::vector<int>(ranges.size())};
    std::vector<Release> releases;
    const std::greater<Release> later;
    for (const IndexedInterval& current : ordered) {
        int room;
        if (!releases.empty() && compatible(releases.front().first, current.range.start, policy)) {
            room = releases.front().second;
            std::pop_heap(releases.begin(), releases.end(), later);
            releases.pop_back();
        } else room = ++result.rooms;
        result.room_for[current.id] = room;
        releases.push_back({current.range.end, room});
        std::push_heap(releases.begin(), releases.end(), later);
    }
    return result;
}
// END allocate_heap_algorithms

// BEGIN choose_activities
std::vector<int> choose_activities(const std::vector<Interval>& ranges, EndpointPolicy policy) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_end);
    std::vector<int> chosen;
    long long last_end = 0; // read only after chosen becomes nonempty
    for (const IndexedInterval& current : ordered) {
        if (chosen.empty() || compatible(last_end, current.range.start, policy)) {
            chosen.push_back(current.id);
            last_end = current.range.end;
        }
    }
    return chosen;
}
// END choose_activities

// BEGIN stabbing_points
std::vector<long long> stabbing_points(std::vector<Interval> ranges) {
    std::sort(ranges.begin(), ranges.end(), [](const Interval& a, const Interval& b) {
        return a.end < b.end;
    });
    std::vector<long long> points;
    for (const Interval& current : ranges)
        if (points.empty() || points.back() < current.start) points.push_back(current.end);
    return points;
}
// END stabbing_points

// BEGIN minimum_cover
CoverResult minimum_cover(const std::vector<Interval>& ranges, long long target) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_start);
    std::vector<int> chosen;
    long long covered = 0;
    int next = 0, n = static_cast<int>(ordered.size());
    while (covered < target) {
        long long farthest = covered;
        int selected = -1;
        while (next < n && ordered[next].range.start <= covered) {
            if (ordered[next].range.end > farthest) {
                farthest = ordered[next].range.end;
                selected = ordered[next].id;
            }
            ++next;
        }
        if (selected == -1) return {false, {}};
        chosen.push_back(selected);
        covered = farthest;
    }
    return {true, chosen};
}
// END minimum_cover

// BEGIN choose_k_resources
std::vector<int> choose_k_resources(const std::vector<Interval>& ranges, int k, EndpointPolicy policy) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_end);
    std::multiset<long long> releases;
    std::vector<int> chosen;
    for (const IndexedInterval& current : ordered) {
        auto after = policy == EndpointPolicy::HalfOpen
            ? releases.upper_bound(current.range.start) : releases.lower_bound(current.range.start);
        if (after != releases.begin()) {
            --after;
            releases.erase(after);
        } else if (static_cast<int>(releases.size()) >= k) continue;
        releases.insert(current.range.end);
        chosen.push_back(current.id);
    }
    return chosen;
}
// END choose_k_resources

// BEGIN compatible_prefix_manual
int compatible_prefix_manual(const std::vector<long long>& ends, int count,
                             long long start, EndpointPolicy policy) {
    int left = 0, right = count;
    while (left < right) {
        int middle = left + (right - left) / 2;
        if (compatible(ends[middle], start, policy)) left = middle + 1;
        else right = middle;
    }
    return left;
}
// END compatible_prefix_manual

// BEGIN compatible_prefix_standard
int compatible_prefix_standard(const std::vector<long long>& ends, int count,
                               long long start, EndpointPolicy policy) {
    auto after = policy == EndpointPolicy::HalfOpen
        ? std::upper_bound(ends.begin(), ends.begin() + count, start)
        : std::lower_bound(ends.begin(), ends.begin() + count, start);
    return static_cast<int>(after - ends.begin());
}
// END compatible_prefix_standard

// BEGIN weighted_core
Plan weighted_core(const std::vector<Job>& jobs, EndpointPolicy policy, bool library_search) {
    struct IndexedJob { Job job; int id; };
    std::vector<IndexedJob> ordered;
    for (int i = 0; i < static_cast<int>(jobs.size()); ++i) ordered.push_back({jobs[i], i});
    std::sort(ordered.begin(), ordered.end(), [](const IndexedJob& a, const IndexedJob& b) {
        if (a.job.end != b.job.end) return a.job.end < b.job.end;
        if (a.job.start != b.job.start) return a.job.start < b.job.start;
        return a.id < b.id;
    });
    const int n = static_cast<int>(ordered.size());
    std::vector<long long> ends;
    for (const IndexedJob& current : ordered) ends.push_back(current.job.end);
    std::vector<long long> best(n + 1, 0);
    std::vector<int> predecessor(n + 1, 0), take(n + 1, 0);
    for (int i = 1; i <= n; ++i) {
        const Job& current = ordered[i - 1].job;
        const int p = library_search
            ? compatible_prefix_standard(ends, i - 1, current.start, policy)
            : compatible_prefix_manual(ends, i - 1, current.start, policy);
        predecessor[i] = p;
        const long long with_current = best[p] + current.reward;
        best[i] = best[i - 1];
        if (with_current > best[i]) {
            best[i] = with_current;
            take[i] = 1;
        }
    }
    std::vector<int> chosen;
    for (int i = n; i > 0; ) {
        if (take[i]) {
            chosen.push_back(ordered[i - 1].id);
            i = predecessor[i];
        } else --i;
    }
    std::reverse(chosen.begin(), chosen.end());
    return {best[n], chosen};
}
// END weighted_core

// BEGIN weighted_manual
Plan weighted_manual(const std::vector<Job>& jobs, EndpointPolicy policy) {
    return weighted_core(jobs, policy, false);
}
// END weighted_manual

// BEGIN weighted_standard
Plan weighted_standard(const std::vector<Job>& jobs, EndpointPolicy policy) {
    return weighted_core(jobs, policy, true);
}
// END weighted_standard

// BEGIN bounded_weighted
long long bounded_weighted(const std::vector<Job>& jobs, int max_jobs, EndpointPolicy policy) {
    std::vector<Job> ordered = jobs;
    std::sort(ordered.begin(), ordered.end(), [](const Job& a, const Job& b) {
        if (a.end != b.end) return a.end < b.end;
        return a.start < b.start;
    });
    const int n = static_cast<int>(ordered.size());
    std::vector<long long> ends;
    for (const Job& job : ordered) ends.push_back(job.end);
    std::vector<int> predecessor(n, 0);
    for (int i = 0; i < n; ++i)
        predecessor[i] = compatible_prefix_standard(ends, i, ordered[i].start, policy);
    std::vector<long long> previous(n + 1, 0), current(n + 1, 0);
    const int limit = std::min(max_jobs, n);
    for (int budget = 1; budget <= limit; ++budget) {
        current[0] = 0;
        for (int i = 1; i <= n; ++i)
            current[i] = std::max(current[i - 1], ordered[i - 1].reward + previous[predecessor[i - 1]]);
        previous.swap(current);
    }
    return previous[n];
}
// END bounded_weighted

// BEGIN minimum_query_lengths
std::vector<long long> minimum_query_lengths(const std::vector<Interval>& ranges,
                                           const std::vector<long long>& queries) {
    auto ordered = indexed_ranges(ranges);
    std::sort(ordered.begin(), ordered.end(), by_start);
    std::vector<std::pair<long long, int>> points;
    for (int i = 0; i < static_cast<int>(queries.size()); ++i) points.push_back({queries[i], i});
    std::sort(points.begin(), points.end());
    using Candidate = std::pair<long long, long long>; // (integer length, right endpoint)
    std::priority_queue<Candidate, std::vector<Candidate>, std::greater<Candidate>> candidates;
    std::vector<long long> answer(queries.size(), -1);
    int next = 0, n = static_cast<int>(ordered.size());
    for (const auto& point : points) {
        while (next < n && ordered[next].range.start <= point.first) {
            const Interval& range = ordered[next++].range;
            candidates.push({range.end - range.start + 1, range.end});
        }
        while (!candidates.empty() && candidates.top().second < point.first) candidates.pop();
        if (!candidates.empty()) answer[point.second] = candidates.top().first;
    }
    return answer;
}
// END minimum_query_lengths
} // namespace interval_decisions

// Exactly one selected entry is compiled. The reference functions above stay identical.
#if defined(INTERVAL_MOVIE)
int main() {
    int n; std::cin >> n;
    std::vector<interval_decisions::Interval> movies(n);
    for (auto& movie : movies) std::cin >> movie.start >> movie.end;
    std::cout << interval_decisions::choose_activities(movies, interval_decisions::EndpointPolicy::HalfOpen).size() << '\n';
}
#elif defined(INTERVAL_ROOMS)
// BEGIN room_main
int main() {
    int n; std::cin >> n;
    std::vector<interval_decisions::Interval> stays(n);
    for (auto& stay : stays) std::cin >> stay.start >> stay.end;
    const auto result = interval_decisions::allocate_standard(stays, interval_decisions::EndpointPolicy::Closed);
    std::cout << result.rooms << '\n';
    for (int room : result.room_for) std::cout << room << ' ';
    std::cout << '\n';
}
// END room_main
#elif defined(INTERVAL_PROJECTS)
// BEGIN projects_main
int main() {
    int n; std::cin >> n;
    std::vector<interval_decisions::Job> projects(n);
    for (auto& project : projects) std::cin >> project.start >> project.end >> project.reward;
    std::cout << interval_decisions::weighted_standard(projects, interval_decisions::EndpointPolicy::Closed).reward << '\n';
}
// END projects_main
#elif defined(INTERVAL_CUSTOMERS)
int main() {
    int n; std::cin >> n;
    std::vector<interval_decisions::LoadInterval> visits(n);
    for (auto& visit : visits) {
        std::cin >> visit.start >> visit.end;
        visit.load = 1;
    }
    std::cout << interval_decisions::peak_load(visits, interval_decisions::EndpointPolicy::HalfOpen) << '\n';
}
#elif defined(INTERVAL_MOVIE_II)
// BEGIN movie2_main
int main() {
    int n, k; std::cin >> n >> k;
    std::vector<interval_decisions::Interval> movies(n);
    for (auto& movie : movies) std::cin >> movie.start >> movie.end;
    std::cout << interval_decisions::choose_k_resources(movies, k, interval_decisions::EndpointPolicy::HalfOpen).size() << '\n';
}
// END movie2_main
#elif defined(INTERVAL_NESTED)
int main() {
    int n; std::cin >> n;
    std::vector<interval_decisions::Interval> ranges(n);
    for (auto& range : ranges) std::cin >> range.start >> range.end;
    const auto result = interval_decisions::containment_flags(ranges);
    for (int flag : result.contains) std::cout << flag << ' ';
    std::cout << '\n';
    for (int flag : result.contained) std::cout << flag << ' ';
    std::cout << '\n';
}
#elif defined(INTERVAL_LC56)
class Solution {
public:
    std::vector<std::vector<int>> merge(std::vector<std::vector<int>>& intervals) {
        std::vector<interval_decisions::Interval> ranges;
        for (const auto& row : intervals) ranges.push_back({row[0], row[1]});
        std::vector<std::vector<int>> result;
        for (const auto& range : interval_decisions::merge_closed(ranges))
            result.push_back({static_cast<int>(range.start), static_cast<int>(range.end)});
        return result;
    }
};
#elif defined(INTERVAL_LC57)
class Solution {
public:
    std::vector<std::vector<int>> insert(std::vector<std::vector<int>>& intervals, std::vector<int>& added) {
        std::vector<interval_decisions::Interval> ranges;
        for (const auto& row : intervals) ranges.push_back({row[0], row[1]});
        std::vector<std::vector<int>> result;
        for (const auto& range : interval_decisions::insert_closed(ranges, {added[0], added[1]}))
            result.push_back({static_cast<int>(range.start), static_cast<int>(range.end)});
        return result;
    }
};
#elif defined(INTERVAL_LC435)
class Solution {
public:
    int eraseOverlapIntervals(std::vector<std::vector<int>>& intervals) {
        std::vector<interval_decisions::Interval> ranges;
        for (const auto& row : intervals) ranges.push_back({row[0], row[1]});
        return static_cast<int>(ranges.size() - interval_decisions::choose_activities(ranges, interval_decisions::EndpointPolicy::HalfOpen).size());
    }
};
#elif defined(INTERVAL_LC452)
class Solution {
public:
    int findMinArrowShots(std::vector<std::vector<int>>& points) {
        std::vector<interval_decisions::Interval> ranges;
        for (const auto& row : points) ranges.push_back({row[0], row[1]});
        return static_cast<int>(interval_decisions::stabbing_points(ranges).size());
    }
};
#elif defined(INTERVAL_LC1024)
class Solution {
public:
    int videoStitching(std::vector<std::vector<int>>& clips, int time) {
        std::vector<interval_decisions::Interval> ranges;
        for (const auto& row : clips) ranges.push_back({row[0], row[1]});
        const auto result = interval_decisions::minimum_cover(ranges, time);
        return result.possible ? static_cast<int>(result.chosen.size()) : -1;
    }
};
#elif defined(INTERVAL_LC1235)
// BEGIN lc1235_adapter
class Solution {
public:
    int jobScheduling(std::vector<int>& startTime, std::vector<int>& endTime, std::vector<int>& profit) {
        std::vector<interval_decisions::Job> jobs;
        for (int i = 0; i < static_cast<int>(profit.size()); ++i)
            jobs.push_back({startTime[i], endTime[i], profit[i]});
        return static_cast<int>(interval_decisions::weighted_standard(jobs, interval_decisions::EndpointPolicy::HalfOpen).reward);
    }
};
// END lc1235_adapter
#elif defined(INTERVAL_LC1851)
class Solution {
public:
    std::vector<int> minInterval(std::vector<std::vector<int>>& intervals, std::vector<int>& queries) {
        std::vector<interval_decisions::Interval> ranges;
        for (const auto& row : intervals) ranges.push_back({row[0], row[1]});
        std::vector<long long> wide_queries(queries.begin(), queries.end());
        const auto wide_result = interval_decisions::minimum_query_lengths(ranges, wide_queries);
        return std::vector<int>(wide_result.begin(), wide_result.end());
    }
};
#elif defined(INTERVAL_LC1094)
class Solution {
public:
    bool carPooling(std::vector<std::vector<int>>& trips, int capacity) {
        std::vector<interval_decisions::LoadInterval> loads;
        for (const auto& trip : trips) loads.push_back({trip[1], trip[2], trip[0]});
        return interval_decisions::peak_load(loads, interval_decisions::EndpointPolicy::HalfOpen) <= capacity;
    }
};
#elif defined(INTERVAL_LC1751)
class Solution {
public:
    int maxValue(std::vector<std::vector<int>>& events, int k) {
        std::vector<interval_decisions::Job> jobs;
        for (const auto& event : events) jobs.push_back({event[0], event[1], event[2]});
        return static_cast<int>(interval_decisions::bounded_weighted(jobs, k, interval_decisions::EndpointPolicy::Closed));
    }
};
#endif
