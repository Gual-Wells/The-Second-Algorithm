// Research-only probes. No undefined-behavior example is executed.
#include "../../../content/contiguous-ranges/连续片段.cpp"
#include <cassert>
#include <functional>
#include <iostream>
#include <iterator>
#include <numeric>
#include <set>
#include <type_traits>

struct ForwardCounter {
    using iterator_category = std::forward_iterator_tag;
    using value_type = int;
    using difference_type = std::ptrdiff_t;
    using pointer = const int*;
    using reference = const int&;
    const int* p = nullptr;
    std::size_t* increments = nullptr;
    reference operator*() const { return *p; }
    pointer operator->() const { return p; }
    ForwardCounter& operator++() { ++p; ++*increments; return *this; }
    ForwardCounter operator++(int) { auto old = *this; ++*this; return old; }
    friend bool operator==(ForwardCounter a, ForwardCounter b) { return a.p == b.p; }
    friend bool operator!=(ForwardCounter a, ForwardCounter b) { return !(a == b); }
};

struct Counted {
    int value = 0;
    inline static std::size_t copies = 0, assignments = 0;
    explicit Counted(int v = 0) : value(v) {}
    Counted(const Counted& other) : value(other.value) { ++copies; }
    Counted(Counted&& other) noexcept : value(other.value) {}
    Counted& operator=(const Counted& other) {
        value = other.value; ++assignments; return *this;
    }
    Counted& operator=(Counted&& other) noexcept {
        value = other.value; ++assignments; return *this;
    }
};

int sum_by_value(std::vector<Counted> a, std::size_t i) {
    return i == a.size() ? 0 : a[i].value + sum_by_value(a, i + 1);
}
int sum_by_borrow(const std::vector<Counted>& a, std::size_t i) {
    return i == a.size() ? 0 : a[i].value + sum_by_borrow(a, i + 1);
}

int main() {
    std::vector<int> ordered(1024);
    std::iota(ordered.begin(), ordered.end(), 0);
    for (int& x : ordered) x *= 2;
    std::size_t random_comparisons = 0, forward_comparisons = 0, steps = 0;
    auto random = std::lower_bound(ordered.begin(), ordered.end(), 1537,
        [&](int a, int b) { ++random_comparisons; return a < b; });
    auto forward = std::lower_bound(
        ForwardCounter{ordered.data(), &steps},
        ForwardCounter{ordered.data() + ordered.size(), &steps}, 1537,
        [&](int a, int b) { ++forward_comparisons; return a < b; });
    assert(random - ordered.begin() == 769 && forward.p - ordered.data() == 769);
    assert(steps >= ordered.size());
    std::cout << "lower_bound_random_comparisons=" << random_comparisons << '\n'
              << "lower_bound_forward_comparisons=" << forward_comparisons << '\n'
              << "lower_bound_forward_increments=" << steps << '\n';

    std::unordered_map<int, int> mutating{{0, 1}}, nonmutating{{0, 1}};
    int sum1 = 0, sum2 = 0;
    for (int key = 1; key <= 1000; ++key) {
        sum1 += mutating[key];
        auto it = nonmutating.find(key);
        if (it != nonmutating.end()) sum2 += it->second;
    }
    assert(sum1 == sum2 && mutating.size() == 1001 && nonmutating.size() == 1);
    std::cout << "missing_queries_bracket_size=" << mutating.size() << '\n'
              << "missing_queries_find_size=" << nonmutating.size() << '\n';

    std::multiset<int> erase_all{3, 3, 3}, erase_one = erase_all;
    erase_all.erase(3);
    erase_one.erase(erase_one.find(3));
    assert(erase_all.empty() && erase_one.size() == 2);
    std::cout << "multiset_erase_key_remaining=" << erase_all.size() << '\n'
              << "multiset_erase_iterator_remaining=" << erase_one.size() << '\n';

    std::vector<Counted> original;
    for (int x = 0; x < 128; ++x) original.emplace_back(x);
    auto repeated = original, compacted = original;
    Counted::assignments = 0;
    for (std::size_t i = 0; i < repeated.size();) {
        if (repeated[i].value % 2 == 0)
            repeated.erase(repeated.begin() + static_cast<std::ptrdiff_t>(i));
        else ++i;
    }
    const auto erase_assignments = Counted::assignments;
    Counted::assignments = 0;
    compacted.erase(std::remove_if(compacted.begin(), compacted.end(),
        [](const Counted& x) { return x.value % 2 == 0; }), compacted.end());
    assert(compacted.size() == repeated.size());
    for (std::size_t i = 0; i < repeated.size(); ++i)
        assert(compacted[i].value == repeated[i].value);
    std::cout << "vector_repeated_erase_assignments=" << erase_assignments << '\n'
              << "vector_compact_assignments=" << Counted::assignments << '\n';

    std::vector<Counted> sequence(64, Counted{1});
    Counted::copies = 0;
    const int copied_sum = sum_by_value(sequence, 0);
    const auto value_copies = Counted::copies;
    Counted::copies = 0;
    const int borrowed_sum = sum_by_borrow(sequence, 0);
    assert(copied_sum == 64 && borrowed_sum == copied_sum && Counted::copies == 0);
    std::cout << "recursive_by_value_element_copies=" << value_copies << '\n'
              << "recursive_by_borrow_element_copies=" << Counted::copies << '\n';

    static_assert(std::is_same_v<decltype(std::accumulate(ordered.begin(), ordered.end(), 0)), int>);
    static_assert(std::is_same_v<decltype(std::accumulate(ordered.begin(), ordered.end(), 0LL)), long long>);
    static_assert(std::is_same_v<decltype(int{} * int{}), int>);
    const int a = 50000, b = 50000;
    const long long product = 1LL * a * b;
    assert(product == 2500000000LL);
    std::cout << "widened_product=" << product << '\n';

    namespace c = second_algorithm::contiguous;
    const auto small = c::count_sum(std::vector<int>(20000, 0), 0);
    const auto large = c::count_sum(std::vector<int>(200000, 0), 0);
    assert(small == 200010000LL && large == 20000100000LL);
    std::cout << "formal_count_n20000=" << small << '\n'
              << "formal_count_n200000=" << large << '\n';
}
