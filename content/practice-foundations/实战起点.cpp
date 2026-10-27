#include <algorithm>
#include <cstddef>
#include <functional>
#include <iostream>
#include <numeric>
#include <queue>
#include <unordered_map>
#include <vector>

namespace practice {
using i64 = long long;

// BEGIN boundary-result
struct Positions {
    std::size_t first;
    std::size_t last;
}; // Equal values occupy [first,last); first==last means absent.
// END boundary-result

// BEGIN boundary-manual
std::size_t lower_manual(const std::vector<int>& a, int target) {
    std::size_t left = 0, right = a.size();
    while (left < right) {
        const auto mid = left + (right - left) / 2;
        if (a[mid] < target) left = mid + 1;
        else right = mid;
    }
    return left;
}
std::size_t upper_manual(const std::vector<int>& a, int target) {
    std::size_t left = 0, right = a.size();
    while (left < right) {
        const auto mid = left + (right - left) / 2;
        if (a[mid] <= target) left = mid + 1;
        else right = mid;
    }
    return left;
}
Positions equal_positions_manual(const std::vector<int>& a, int target) {
    return {lower_manual(a, target), upper_manual(a, target)};
}
// END boundary-manual

// BEGIN boundary-standard
Positions equal_positions_standard(const std::vector<int>& a, int target) {
    const auto range = std::equal_range(a.begin(), a.end(), target);
    return {static_cast<std::size_t>(range.first - a.begin()),
            static_cast<std::size_t>(range.second - a.begin())};
}
// END boundary-standard

// BEGIN prefix-manual
std::vector<i64> prefix_manual(const std::vector<int>& a) {
    std::vector<i64> p(a.size() + 1, 0);
    for (std::size_t i = 0; i < a.size(); ++i) p[i + 1] = p[i] + a[i];
    return p;
}
// END prefix-manual

// BEGIN prefix-standard
std::vector<i64> prefix_standard(const std::vector<int>& a) {
    std::vector<i64> p(a.size() + 1, 0);
    // partial_sum accumulates in its input value_type, so widen first.
    std::copy(a.begin(), a.end(), p.begin() + 1);
    std::partial_sum(p.begin() + 1, p.end(), p.begin() + 1);
    return p;
}
// END prefix-standard

// BEGIN range-query
i64 interval_sum(const std::vector<i64>& p, std::size_t left, std::size_t right) {
    return p[right] - p[left]; // Requires 0<=left<=right<p.size().
}
// END range-query

// BEGIN exact-count-enumeration
i64 count_sum_enumeration(const std::vector<int>& a, i64 target) {
    i64 answer = 0;
    for (std::size_t left = 0; left < a.size(); ++left) {
        i64 sum = 0;
        for (std::size_t right = left; right < a.size(); ++right) {
            sum += a[right];
            if (sum == target) ++answer;
        }
    }
    return answer;
}
// END exact-count-enumeration

// BEGIN exact-count-hash
i64 count_sum_hash(const std::vector<int>& a, i64 target) {
    std::unordered_map<i64, i64> frequency;
    frequency[0] = 1;
    i64 prefix = 0, answer = 0;
    for (int value : a) {
        prefix += value;
        auto it = frequency.find(prefix - target);
        if (it != frequency.end()) answer += it->second;
        ++frequency[prefix];
    }
    return answer;
}
// END exact-count-hash

// BEGIN exact-lengths
std::size_t longest_sum(const std::vector<int>& a, i64 target) {
    std::unordered_map<i64, std::size_t> first;
    first[0] = 0;
    i64 prefix = 0;
    std::size_t answer = 0;
    for (std::size_t right = 1; right <= a.size(); ++right) {
        prefix += a[right - 1];
        auto it = first.find(prefix - target);
        if (it != first.end()) answer = std::max(answer, right - it->second);
        first.emplace(prefix, right); // Existing keys retain their earliest position.
    }
    return answer;
}
std::size_t shortest_sum(const std::vector<int>& a, i64 target) {
    std::unordered_map<i64, std::size_t> last;
    last[0] = 0;
    i64 prefix = 0;
    std::size_t answer = 0;
    for (std::size_t right = 1; right <= a.size(); ++right) {
        prefix += a[right - 1];
        auto it = last.find(prefix - target);
        if (it != last.end()) {
            const auto length = right - it->second;
            if (answer == 0 || length < answer) answer = length;
        }
        last[prefix] = right; // The next query needs the most recent position.
    }
    return answer;
}
// END exact-lengths

// BEGIN max-heap-manual
class MaxHeap {
    std::vector<int> data_;
    void sift_down(std::size_t parent) {
        while (parent < data_.size() / 2) {
            auto child = parent * 2 + 1;
            if (child + 1 < data_.size() && data_[child] < data_[child + 1]) ++child;
            if (data_[parent] >= data_[child]) return;
            const int saved = data_[parent];
            data_[parent] = data_[child];
            data_[child] = saved;
            parent = child;
        }
    }
public:
    MaxHeap() = default;
    // count<=input.size(); copying these elements gives this heap its own storage.
    MaxHeap(const std::vector<int>& input, std::size_t count)
        : data_(input.begin(), input.begin() + static_cast<std::ptrdiff_t>(count)) {
        for (auto parent = data_.size() / 2; parent > 0; --parent) sift_down(parent - 1);
    }
    bool empty() const { return data_.empty(); }
    std::size_t size() const { return data_.size(); }
    int top() const { return data_.front(); } // Requires !empty().
    void push(int value) {
        data_.push_back(value);
        auto child = data_.size() - 1;
        while (child > 0) {
            const auto parent = (child - 1) / 2;
            if (data_[parent] >= data_[child]) break;
            const int saved = data_[parent];
            data_[parent] = data_[child];
            data_[child] = saved;
            child = parent;
        }
    }
    void replace_top(int value) { // Requires !empty().
        data_[0] = value;
        sift_down(0);
    }
    void pop() { // Requires !empty(); removal does not return the old top.
        data_[0] = data_.back();
        data_.pop_back();
        if (!data_.empty()) sift_down(0);
    }
};
// END max-heap-manual

// BEGIN topk-manual
std::vector<int> smallest_manual(const std::vector<int>& a, std::size_t k) {
    if (k == 0 || k > a.size()) return {};
    MaxHeap heap(a, k);
    for (std::size_t i = k; i < a.size(); ++i) {
        if (a[i] < heap.top()) heap.replace_top(a[i]);
    }
    std::vector<int> answer(k);
    for (auto remaining = k; remaining > 0; --remaining) {
        answer[remaining - 1] = heap.top();
        heap.pop();
    }
    return answer;
}
// END topk-manual

// BEGIN topk-priority-queue
std::vector<int> smallest_priority(const std::vector<int>& a, std::size_t k) {
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
// END topk-priority-queue

// BEGIN heap-range-operations
std::vector<int> add_then_remove_largest(std::vector<int> values, int added) {
    std::make_heap(values.begin(), values.end());
    values.push_back(added);
    std::push_heap(values.begin(), values.end());
    std::pop_heap(values.begin(), values.end());
    values.pop_back();
    return values; // A heap, not a fully sorted vector.
}
// END heap-range-operations

// BEGIN comparator-object
struct LaterNumber {
    bool operator()(int left, int right) const { return left > right; }
};
int smallest_queue_value(const std::vector<int>& values) { // Requires nonempty input.
    std::priority_queue<int, std::vector<int>, LaterNumber> heap(values.begin(), values.end());
    return heap.top();
}
// END comparator-object

// BEGIN topk-selection
std::vector<int> smallest_selection(const std::vector<int>& a, std::size_t k) {
    if (k == 0 || k > a.size()) return {};
    auto work = a; // Copy: nth_element and sort will modify this range.
    if (k < work.size())
        std::nth_element(work.begin(), work.begin() + static_cast<std::ptrdiff_t>(k), work.end());
    work.resize(k);
    std::sort(work.begin(), work.end());
    return work;
}
// END topk-selection
} // namespace practice

// BEGIN core-entry
class Solution {
public:
    std::vector<int> smallestK(std::vector<int>& numbers, int k) {
        if (k < 0) return {};
        return practice::smallest_priority(numbers, static_cast<std::size_t>(k));
    }
};
// END core-entry

#ifdef PRACTICE_FOUNDATIONS_STANDALONE
// BEGIN acm-entry
int main() {
    int n, k;
    if (!(std::cin >> n >> k)) return 0;
    if (n < 0 || k < 0) return 1;
    std::vector<int> numbers(static_cast<std::size_t>(n));
    for (int& value : numbers) if (!(std::cin >> value)) return 1;
    const auto answer = practice::smallest_priority(numbers, static_cast<std::size_t>(k));
    for (std::size_t i = 0; i < answer.size(); ++i) {
        if (i != 0) std::cout << ' ';
        std::cout << answer[i];
    }
    std::cout << '\n';
}
// END acm-entry
#endif
