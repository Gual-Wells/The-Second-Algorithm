// Research prototype: paired implementations, shared task contracts.
// Hand-written means implementing the target algorithm, not replacing vector storage.
#include <algorithm>
#include <cassert>
#include <cstddef>
#include <functional>
#include <iostream>
#include <limits>
#include <numeric>
#include <queue>
#include <vector>

using i64 = long long;

// BEGIN bound-handwritten
std::size_t lower_position_manual(const std::vector<int>& a, int target) {
    std::size_t left = 0, right = a.size();
    while (left < right) {
        const auto mid = left + (right - left) / 2;
        if (a[mid] < target) left = mid + 1;
        else right = mid;
    }
    return left;
}
// END bound-handwritten

// BEGIN bound-standard
std::size_t lower_position_standard(const std::vector<int>& a, int target) {
    return static_cast<std::size_t>(
        std::lower_bound(a.begin(), a.end(), target) - a.begin());
}
// END bound-standard

// BEGIN prefix-handwritten
std::vector<i64> prefix_manual(const std::vector<int>& a) {
    std::vector<i64> p(a.size() + 1, 0);
    for (std::size_t i = 0; i < a.size(); ++i) p[i + 1] = p[i] + a[i];
    return p;
}
// END prefix-handwritten

// BEGIN prefix-standard
std::vector<i64> prefix_standard(const std::vector<int>& a) {
    std::vector<i64> p(a.size() + 1, 0);
    // Widen stored inputs first: partial_sum's accumulator follows input value_type.
    std::copy(a.begin(), a.end(), p.begin() + 1);
    std::partial_sum(p.begin() + 1, p.end(), p.begin() + 1);
    return p;
}
// END prefix-standard

// BEGIN topk-handwritten
void sift_down(std::vector<int>& heap, std::size_t parent) {
    while (parent < heap.size() / 2) {
        auto child = parent * 2 + 1;
        if (child + 1 < heap.size() && heap[child] < heap[child + 1]) ++child;
        if (heap[parent] >= heap[child]) return;
        const int old = heap[parent];
        heap[parent] = heap[child];
        heap[child] = old;
        parent = child;
    }
}
std::vector<int> smallest_manual(const std::vector<int>& a, std::size_t k) {
    if (k == 0 || k > a.size()) return {};
    std::vector<int> heap(a.begin(), a.begin() + static_cast<std::ptrdiff_t>(k));
    for (auto parent = heap.size() / 2; parent > 0; --parent) sift_down(heap, parent - 1);
    for (std::size_t i = k; i < a.size(); ++i) {
        if (a[i] < heap.front()) { heap.front() = a[i]; sift_down(heap, 0); }
    }
    std::vector<int> answer(k);
    for (auto remaining = k; remaining > 0; --remaining) {
        answer[remaining - 1] = heap.front();
        heap.front() = heap.back();
        heap.pop_back();
        if (!heap.empty()) sift_down(heap, 0);
    }
    return answer;
}
// END topk-handwritten

// BEGIN topk-standard-heap
std::vector<int> smallest_standard_heap(const std::vector<int>& a, std::size_t k) {
    if (k == 0 || k > a.size()) return {};
    std::priority_queue<int> heap(a.begin(), a.begin() + static_cast<std::ptrdiff_t>(k));
    for (std::size_t i = k; i < a.size(); ++i) {
        if (a[i] < heap.top()) { heap.pop(); heap.push(a[i]); }
    }
    std::vector<int> answer(k);
    for (auto remaining = k; remaining > 0; --remaining) {
        answer[remaining - 1] = heap.top();
        heap.pop();
    }
    return answer;
}
// END topk-standard-heap

// BEGIN topk-standard-selection
std::vector<int> smallest_standard_selection(const std::vector<int>& a, std::size_t k) {
    if (k == 0 || k > a.size()) return {};
    auto work = a;
    if (k < work.size())
        std::nth_element(work.begin(), work.begin() + static_cast<std::ptrdiff_t>(k), work.end());
    work.resize(k);
    std::sort(work.begin(), work.end());
    return work;
}
// END topk-standard-selection

// Independent small-input oracle: insertion sort, no heap or partition algorithm.
std::vector<int> reference_order(const std::vector<int>& a) {
    std::vector<int> out;
    for (int value : a) {
        out.push_back(value);
        auto i = out.size() - 1;
        while (i > 0 && out[i - 1] > value) { out[i] = out[i - 1]; --i; }
        out[i] = value;
    }
    return out;
}

unsigned long long bound_checks = 0, prefix_checks = 0, topk_checks = 0, arrays = 0;
void check_array(const std::vector<int>& a) {
    ++arrays;
    const auto before = a;
    const auto sorted = reference_order(a);
    for (int target = -3; target <= 3; ++target) {
        std::size_t expected = 0;
        while (expected < sorted.size() && sorted[expected] < target) ++expected;
        assert(lower_position_manual(sorted, target) == expected);
        assert(lower_position_standard(sorted, target) == expected);
        bound_checks += 2;
    }
    std::vector<i64> expected_prefix(a.size() + 1, 0);
    for (std::size_t end = 1; end <= a.size(); ++end)
        for (std::size_t i = 0; i < end; ++i) expected_prefix[end] += a[i];
    assert(prefix_manual(a) == expected_prefix);
    assert(prefix_standard(a) == expected_prefix);
    prefix_checks += 2;
    for (std::size_t k = 0; k <= a.size() + 1; ++k) {
        auto expected = sorted;
        if (k > a.size()) expected.clear();
        else expected.resize(k);
        assert(smallest_manual(a, k) == expected);
        assert(smallest_standard_heap(a, k) == expected);
        assert(smallest_standard_selection(a, k) == expected);
        topk_checks += 3;
    }
    assert(a == before);
}

int main() {
    std::vector<int> a;
    auto enumerate = [&](auto&& self) -> void {
        check_array(a);
        if (a.size() == 7) return;
        for (int value : {-2, 0, 2}) { a.push_back(value); self(self); a.pop_back(); }
    };
    enumerate(enumerate);
    check_array({std::numeric_limits<int>::max(), std::numeric_limits<int>::max(),
                 std::numeric_limits<int>::min(), 0, -1});
    check_array({2000000000, 2000000000});
    std::cout << "arrays=" << arrays << '\n'
              << "bound_checks=" << bound_checks << '\n'
              << "prefix_checks=" << prefix_checks << '\n'
              << "topk_checks=" << topk_checks << '\n';
}
