#include <algorithm>
#include <cmath>
#include <array>
#include <cstddef>
#include <functional>
#include <iterator>
#include <map>
#include <memory>
#include <optional>
#include <queue>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <unordered_map>
#include <utility>
#include <vector>
#if __cplusplus >= 202002L
#include <ranges>
#include <span>
#endif

namespace second_algorithm::containers {

// BEGIN capacity-fill
inline std::vector<long long> squares(int count) {
    if (count < 0) throw std::invalid_argument("negative count");
    std::vector<long long> result;
    result.reserve(static_cast<std::size_t>(count)); // 尚无元素
    for (int i = 0; i < count; ++i) result.push_back(1LL * i * i);
    return result;
}
inline std::vector<int> zero_buffer(std::size_t count) {
    return std::vector<int>(count);                  // 已有 count 个 0
}
// END capacity-fill

// BEGIN erase-range
template<class T, class Predicate>
std::size_t erase_matching(std::vector<T>& values, Predicate predicate) {
    const auto old_size = values.size();
    auto new_end = std::remove_if(values.begin(), values.end(), predicate);
    values.erase(new_end, values.end());
    return old_size - values.size();
}
inline void erase_negative_one_by_one(std::vector<int>& values) {
    for (auto it = values.begin(); it != values.end();) {
        if (*it < 0) it = values.erase(it); // erase 返回有效的下一位置
        else ++it;
    }
}
// END erase-range

// BEGIN map-access
inline std::map<std::string, std::size_t>
frequencies(const std::vector<std::string>& words) {
    std::map<std::string, std::size_t> counts;
    for (const auto& word : words) ++counts[word]; // 缺失时构造 0
    return counts;
}
inline std::optional<int> lookup(const std::map<std::string, int>& values,
                                 const std::string& key) {
    auto it = values.find(key);                  // 不插入；一次查找
    if (it == values.end()) return std::nullopt;
    return it->second;
}
inline bool install_once(std::map<int, std::unique_ptr<int>>& values,
                         int key, std::unique_ptr<int>& candidate) {
    auto [it, inserted] = values.try_emplace(key, std::move(candidate));
    (void)it;
    return inserted; // 已有 key 时 candidate 不被移动
}
inline void replace_value(std::map<std::string, int>& values,
                          std::string key, int value) {
    values.insert_or_assign(std::move(key), value); // 缺失则插，已有则赋值
}
// END map-access

// BEGIN custom-key
struct Point {
    int x, y;
    friend bool operator==(const Point& a, const Point& b) noexcept {
        return a.x == b.x && a.y == b.y;
    }
};
struct PointHash {
    std::size_t operator()(const Point& p) const noexcept {
        auto h1 = std::hash<int>{}(p.x), h2 = std::hash<int>{}(p.y);
        return h1 ^ (h2 + std::size_t{0x9e3779b9} + (h1 << 6) + (h1 >> 2));
    }
};
using PointCounts = std::unordered_map<Point, std::size_t, PointHash>;
// END custom-key

// BEGIN order-records
struct Job { int priority; std::string name; };
inline void order_jobs(std::vector<Job>& jobs) {
    std::sort(jobs.begin(), jobs.end(), [](const Job& a, const Job& b) {
        if (a.priority != b.priority) return a.priority > b.priority;
        return a.name < b.name; // 同优先级按名字升序
    });
}
inline void stable_priority(std::vector<Job>& jobs) {
    std::stable_sort(jobs.begin(), jobs.end(), [](const Job& a, const Job& b) {
        return a.priority > b.priority; // 同优先级保持原相对顺序
    });
}
inline bool nan_last_less(double a, double b) {
    if (std::isnan(a)) return false;
    if (std::isnan(b)) return true;
    return a < b;
}
// END order-records

// BEGIN selected-order
template<class T, class Compare = std::less<T>>
std::vector<T> first_k_sorted(std::vector<T> values, std::size_t k,
                               Compare compare = {}) {
    k = std::min(k, values.size());
    std::partial_sort(values.begin(), values.begin() + k, values.end(), compare);
    values.erase(values.begin() + k, values.end()); // 不额外要求 T 能默认构造
    return values;
}
inline int kth_value(std::vector<int> values, std::size_t k) {
    if (k >= values.size()) throw std::out_of_range("k"); // k 从 0 开始
    std::nth_element(values.begin(), values.begin() + k, values.end());
    return values[k]; // 左右两侧分别满足分区条件，不承诺各自有序
}
// END selected-order

// BEGIN sorted-set-difference
template<class T, class Compare = std::less<T>>
std::vector<T> multiset_difference(const std::vector<T>& a,
                                   const std::vector<T>& b,
                                   Compare compare = {}) {
    // 前提：a、b 都按 compare 排好序；保留 max(count_a-count_b, 0) 份
    std::vector<T> result;
    std::set_difference(a.begin(), a.end(), b.begin(), b.end(),
                        std::back_inserter(result), compare);
    return result;
}
// END sorted-set-difference

// BEGIN zip-output
template<class Input1, class Input2, class Output>
Output zip_to(Input1 first1, Input1 last1, Input2 first2, Input2 last2,
              Output out) {
    using A = typename std::iterator_traits<Input1>::value_type;
    using B = typename std::iterator_traits<Input2>::value_type;
    for (; first1 != last1 && first2 != last2; ++first1, ++first2)
        *out++ = std::pair<A, B>(*first1, *first2);
    return out; // 在较短范围结束；输出空间须足够，或用 back_inserter
}
template<class Input, class Output>
Output disjoint_pairs_to(Input first, Input last, Output out) {
    using T = typename std::iterator_traits<Input>::value_type;
    while (first != last) {
        T a = *first; ++first; // 保存值，不能保存单遍输入的别名
        if (first == last) break; // 本接口选择忽略奇数末项
        T b = *first; ++first;
        *out++ = std::pair<T, T>(std::move(a), std::move(b));
    }
    return out;
}
// END zip-output

// BEGIN projection
template<class Input, class Function>
auto select_values(Input first, Input last, Function function) {
    using Result = std::decay_t<std::invoke_result_t<Function&, decltype(*first)>>;
    std::vector<Result> result;
    for (; first != last; ++first)
        result.push_back(std::invoke(function, *first));
    return result; // 返回引用也会复制成 Result；不预先遍历计算 distance
}
// END projection

// BEGIN contiguous-interface
inline std::optional<int> maximum_buffer(const int* data, std::size_t count) {
    if (count == 0) return std::nullopt; // 空范围不解引用 data
    int best = data[0];
    for (std::size_t i = 1; i < count; ++i) best = std::max(best, data[i]);
    return best;
}
inline std::optional<int> maximum_values(const std::vector<int>& values) {
    return maximum_buffer(values.data(), values.size());
}
// END contiguous-interface

// BEGIN proxy-reference
inline bool proxy_example() {
    std::vector<bool> bits{false};
    auto alias = bits[0];       // vector<bool>::reference，仍指向原元素
    bool snapshot = bits[0];    // 真正的 bool 值
    alias = true;
    return bits[0] && !snapshot;
}
// END proxy-reference

#if __cplusplus >= 202002L
// BEGIN span-and-lazy
inline void zero_out(std::span<int> values) { // C++20，借用可写连续元素
    for (int& value : values) value = 0;
}
inline std::vector<long long> even_squares(std::span<const int> values) {
    auto selected = values
        | std::views::filter([](int x) { return x % 2 == 0; })
        | std::views::transform([](int x) { return 1LL * x * x; });
    std::vector<long long> result;
    for (auto value : selected) result.push_back(value); // 在这里求值
    return result;
}
// END span-and-lazy

// BEGIN borrowed-result
static_assert(std::ranges::borrowed_range<std::string_view>);
static_assert(std::same_as<
    decltype(std::ranges::find(std::vector<int>{1, 2}, 2)),
    std::ranges::dangling>);
// string_view 自身销毁不移除原字符；但原字符的所有者仍必须存活。
// END borrowed-result
#endif

#if __cplusplus >= 202302L
// BEGIN owning-view
inline auto owning_numbers() { // C++23；现代 C++20 库也可能通过修正提供
    return std::views::all(std::vector<int>{3, 4, 5}); // owning_view 接管 vector
}
inline auto adjacent_pairs(std::span<const int> values) {
    return values | std::views::adjacent<2>; // (0,1)、(1,2)…，不是两两分组
}
// END owning-view
#endif

// BEGIN heap-adaptor
struct Pending { int priority; std::size_t sequence; std::string payload; };
struct Later {
    bool operator()(const Pending& a, const Pending& b) const noexcept {
        return std::tie(a.priority, a.sequence) > std::tie(b.priority, b.sequence);
    }
};
using ReadyQueue = std::priority_queue<Pending, std::vector<Pending>, Later>;
// 最小 priority 最先出；相同 priority 按 sequence 从小到大。
// priority_queue 本身不为“相等优先级”保证稳定性，sequence 是显式决胜项。
// END heap-adaptor

// BEGIN overwrite-ring
template<class T>
class overwrite_ring {
    static_assert(std::is_nothrow_move_constructible_v<T>,
                  "this implementation requires nothrow move construction");
    std::vector<std::optional<T>> slots_;
    std::size_t head_ = 0, used_ = 0;
    const T& at_rank(std::size_t rank) const {
        return *slots_[(head_ + rank) % slots_.size()];
    }
public:
    explicit overwrite_ring(std::size_t capacity) : slots_(capacity) {
        if (capacity == 0) throw std::invalid_argument("zero capacity");
    }
    overwrite_ring(const overwrite_ring&) = default;
    overwrite_ring& operator=(const overwrite_ring& other) {
        if (this != &other) {
            overwrite_ring prepared(other);
            slots_.swap(prepared.slots_);
            std::swap(head_, prepared.head_);
            std::swap(used_, prepared.used_);
        }
        return *this;
    }
    overwrite_ring(overwrite_ring&& other) noexcept
        : slots_(std::move(other.slots_)), head_(other.head_), used_(other.used_) {
        other.slots_.clear(); other.head_ = other.used_ = 0;
    }
    overwrite_ring& operator=(overwrite_ring&& other) noexcept {
        if (this != &other) {
            slots_ = std::move(other.slots_); head_ = other.head_; used_ = other.used_;
            other.slots_.clear(); other.head_ = other.used_ = 0;
        }
        return *this;
    }
    std::size_t size() const noexcept { return used_; }
    std::size_t capacity() const noexcept { return slots_.size(); }
    bool empty() const noexcept { return used_ == 0; }
    void push(T value) {
        if (slots_.empty()) throw std::logic_error("moved-from ring");
        const auto index = (head_ + used_) % capacity();
        slots_[index].emplace(std::move(value));
        if (used_ == capacity()) head_ = (head_ + 1) % capacity();
        else ++used_;
    }
    std::optional<T> pop() {
        if (empty()) return std::nullopt;
        std::optional<T> result(std::move(*slots_[head_]));
        slots_[head_].reset();
        head_ = (head_ + 1) % capacity(); --used_;
        return result;
    }
    void clear() noexcept {
        for (auto& slot : slots_) slot.reset();
        head_ = used_ = 0;
    }
    class const_iterator {
        const overwrite_ring* owner_ = nullptr;
        std::size_t rank_ = 0;
    public:
        using iterator_category = std::forward_iterator_tag;
        using value_type = T;
        using difference_type = std::ptrdiff_t;
        using reference = const T&;
        using pointer = const T*;
        const_iterator() = default;
        const_iterator(const overwrite_ring* owner, std::size_t rank)
            : owner_(owner), rank_(rank) {}
        reference operator*() const { return owner_->at_rank(rank_); }
        pointer operator->() const { return std::addressof(**this); }
        const_iterator& operator++() { ++rank_; return *this; }
        const_iterator operator++(int) { auto old = *this; ++*this; return old; }
        friend bool operator==(const const_iterator& a, const const_iterator& b) {
            return a.owner_ == b.owner_ && a.rank_ == b.rank_;
        }
        friend bool operator!=(const const_iterator& a, const const_iterator& b) {
            return !(a == b);
        }
    };
    const_iterator begin() const { return {this, 0}; }
    const_iterator end() const { return {this, used_}; }
    // 所有修改操作都使本实现原有迭代器失效；只提供只读 forward 迭代。
};
// END overwrite-ring

} // namespace second_algorithm::containers
