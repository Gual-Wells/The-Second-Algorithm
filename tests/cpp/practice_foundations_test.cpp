#include "../../content/practice-foundations/实战起点.cpp"
#include <cstdlib>
#include <limits>

namespace {
unsigned long long checks = 0;
unsigned long long arrays = 0;

void require(bool condition, const char* context) {
    ++checks;
    if (!condition) {
        std::cerr << "failed: " << context << '\n';
        std::abort();
    }
}

// Independent ordering reference: insertion into a sorted prefix, no heap/selection.
std::vector<int> reference_order(const std::vector<int>& a) {
    std::vector<int> out;
    for (int value : a) {
        out.push_back(value);
        auto position = out.size() - 1;
        while (position > 0 && out[position - 1] > value) {
            out[position] = out[position - 1];
            --position;
        }
        out[position] = value;
    }
    return out;
}

struct SegmentReference {
    practice::i64 count = 0;
    std::size_t longest = 0, shortest = 0;
};
SegmentReference reference_segments(const std::vector<int>& a, practice::i64 target) {
    SegmentReference answer;
    for (std::size_t left = 0; left < a.size(); ++left) {
        for (std::size_t right = left + 1; right <= a.size(); ++right) {
            // Recompute each interval, independently of prefix state or the tested loops.
            practice::i64 sum = 0;
            for (auto i = left; i < right; ++i) sum += a[i];
            if (sum == target) {
                ++answer.count;
                const auto length = right - left;
                if (length > answer.longest) answer.longest = length;
                if (answer.shortest == 0 || length < answer.shortest) answer.shortest = length;
            }
        }
    }
    return answer;
}

void check_array(const std::vector<int>& a) {
    ++arrays;
    const auto before = a;
    const auto sorted = reference_order(a);
    const int lo = std::numeric_limits<int>::min();
    const int hi = std::numeric_limits<int>::max();
    for (int target : {-3, -2, -1, 0, 1, 2, 3, lo, hi}) {
        std::size_t first = 0;
        while (first < sorted.size() && sorted[first] < target) ++first;
        auto last = first;
        while (last < sorted.size() && sorted[last] == target) ++last;
        const auto manual = practice::equal_positions_manual(sorted, target);
        const auto standard = practice::equal_positions_standard(sorted, target);
        require(manual.first == first && manual.last == last, "manual boundaries");
        require(standard.first == first && standard.last == last, "standard boundaries");
    }

    std::vector<practice::i64> expected_prefix(a.size() + 1, 0);
    for (std::size_t end = 1; end <= a.size(); ++end)
        for (std::size_t i = 0; i < end; ++i) expected_prefix[end] += a[i];
    const auto manual_prefix = practice::prefix_manual(a);
    const auto standard_prefix = practice::prefix_standard(a);
    require(manual_prefix == expected_prefix, "manual prefix");
    require(standard_prefix == expected_prefix, "widened standard prefix");
    for (std::size_t left = 0; left <= a.size(); ++left) {
        for (std::size_t right = left; right <= a.size(); ++right) {
            practice::i64 sum = 0;
            for (auto i = left; i < right; ++i) sum += a[i];
            require(practice::interval_sum(manual_prefix, left, right) == sum,
                    "manual-prefix interval");
            require(practice::interval_sum(standard_prefix, left, right) == sum,
                    "standard-prefix interval");
        }
    }

    for (practice::i64 target : std::vector<practice::i64>{
             -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5,
             lo, hi, 4294967294LL, -4294967296LL}) {
        const auto expected = reference_segments(a, target);
        require(practice::count_sum_enumeration(a, target) == expected.count,
                "interval enumeration count");
        require(practice::count_sum_hash(a, target) == expected.count,
                "historical frequency count");
        require(practice::longest_sum(a, target) == expected.longest,
                "earliest-prefix length");
        require(practice::shortest_sum(a, target) == expected.shortest,
                "latest-prefix length");
    }
    for (std::size_t k = 0; k <= a.size() + 1; ++k) {
        auto expected = sorted;
        if (k > a.size()) expected.clear();
        else expected.resize(k);
        require(practice::smallest_manual(a, k) == expected, "manual-heap smallest k");
        require(practice::smallest_priority(a, k) == expected, "priority_queue smallest k");
        require(practice::smallest_selection(a, k) == expected, "partition-sort smallest k");
    }
    if (!a.empty()) {
        require(practice::smallest_queue_value(a) == sorted.front(), "comparator direction");
    }
    require(a == before, "all public tasks preserve input");
}

void check_heap_state(const practice::MaxHeap& heap, const std::vector<int>& model) {
    require(heap.size() == model.size(), "heap/model size");
    require(heap.empty() == model.empty(), "heap/model emptiness");
    if (!model.empty()) {
        int maximum = model[0];
        for (int value : model) if (value > maximum) maximum = value;
        require(heap.top() == maximum, "heap/model top");
    }
}

void check_heap_operations() {
    practice::MaxHeap heap;
    std::vector<int> model;
    unsigned state = 20261028U;
    for (unsigned step = 0; step < 6000; ++step) {
        state = state * 1664525U + 1013904223U;
        const auto operation = state % 4;
        const int value = static_cast<int>((state >> 8) % 101) - 50;
        if (model.empty() || operation < 2) {
            heap.push(value);
            model.push_back(value);
        } else {
            std::size_t best = 0;
            for (std::size_t i = 1; i < model.size(); ++i)
                if (model[i] > model[best]) best = i;
            if (operation == 2) {
                heap.pop();
                model.erase(model.begin() + static_cast<std::ptrdiff_t>(best));
            } else {
                heap.replace_top(value); // Covers replacement both below and above old top.
                model[best] = value;
            }
        }
        check_heap_state(heap, model);
    }
    while (!model.empty()) {
        check_heap_state(heap, model);
        std::size_t best = 0;
        for (std::size_t i = 1; i < model.size(); ++i)
            if (model[i] > model[best]) best = i;
        heap.pop();
        model.erase(model.begin() + static_cast<std::ptrdiff_t>(best));
    }
    check_heap_state(heap, model);

    for (const std::vector<int>& values : std::vector<std::vector<int>>{
             {}, {7}, {3, 1, 4, 4, -5}, {std::numeric_limits<int>::min()}}) {
        for (int added : {-6, 0, 8, std::numeric_limits<int>::max()}) {
            auto expected = values;
            expected.push_back(added);
            expected = reference_order(expected);
            expected.pop_back();
            const auto result = practice::add_then_remove_largest(values, added);
            require(reference_order(result) == expected, "range heap add/remove contents");
            require(std::is_heap(result.begin(), result.end()), "range heap restored");
        }
    }
}
} // namespace

int main() {
    std::vector<int> a;
    auto enumerate = [&](auto&& self) -> void {
        check_array(a);
        if (a.size() == 7) return;
        for (int value : {-2, 0, 2}) {
            a.push_back(value);
            self(self);
            a.pop_back();
        }
    };
    enumerate(enumerate);
    const auto lo = std::numeric_limits<int>::min();
    const auto hi = std::numeric_limits<int>::max();
    check_array({lo, hi, lo, hi, 0, -1, 1});
    check_array({hi, hi});
    check_array({lo, lo});
    check_array({2000000000, 2000000000});
    check_heap_operations();

    const std::vector<int> zeros(200000, 0);
    require(practice::count_sum_hash(zeros, 0) == 20000100000LL, "64-bit interval count");
    require(practice::longest_sum(zeros, 0) == zeros.size(), "large longest zero sum");
    require(practice::shortest_sum(zeros, 0) == 1, "large shortest is nonempty");
    Solution adapter;
    std::vector<int> numbers{4, 1, 1, -2};
    require(adapter.smallestK(numbers, 3) == std::vector<int>({-2, 1, 1}), "core-code adapter");
    require(adapter.smallestK(numbers, -1).empty(), "signed k adapter");
    std::cout << "practice_foundations arrays=" << arrays << " checks=" << checks << '\n';
}
