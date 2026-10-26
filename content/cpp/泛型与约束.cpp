#include <algorithm>
#include <array>
#include <chrono>
#include <cstddef>
#include <functional>
#include <memory>
#include <limits>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <tuple>
#include <type_traits>
#include <utility>
#include <vector>
#if __cplusplus >= 202002L
#include <concepts>
#endif

namespace second_algorithm::cpp_generic {

// BEGIN array-bound
template<class T, std::size_t N>
constexpr std::size_t array_bound(T (&)[N]) noexcept { return N; }

template<class T> struct TypeTag {};
template<class T> TypeTag<T> deduce_value(T);
template<class T> TypeTag<T> deduce_reference(T&);
// decltype(deduce_value(array)) is TypeTag<Element*>.
// decltype(deduce_reference(array)) retains Element[N].
// END array-bound

// BEGIN invoke-forward
template<class F, class... Args>
decltype(auto) invoke_forward(F&& f, Args&&... args)
    noexcept(std::is_nothrow_invocable_v<F, Args...>) {
    return std::invoke(std::forward<F>(f), std::forward<Args>(args)...);
}

template<class T, class... Args>
std::unique_ptr<T> make_one(Args&&... args) {
    static_assert(!std::is_array_v<T>, "single object only");
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}
// END invoke-forward

// BEGIN append-pack
template<class Container, class... Args>
void append_many(Container& target, Args&&... args) {
    (static_cast<void>(target.push_back(std::forward<Args>(args))), ...);
}
// END append-pack

// BEGIN logical-folds
template<class Predicate, class... Values>
bool all_satisfy(Predicate&& predicate, const Values&... values) {
    return (static_cast<bool>(std::invoke(predicate, values)) && ...);
}
template<class Predicate, class... Values>
bool any_satisfy(Predicate&& predicate, const Values&... values) {
    return (static_cast<bool>(std::invoke(predicate, values)) || ...);
}
// END logical-folds

// BEGIN value-minimum
template<class Compare, class First, class... Rest>
auto minimum_value(Compare compare, First first, Rest... rest) {
    using Value = std::common_type_t<First, Rest...>;
    Value best = static_cast<Value>(std::move(first));
    [[maybe_unused]] auto consider = [&](Value value) {
        if (std::invoke(compare, value, best)) best = std::move(value);
    };
    (static_cast<void>(consider(static_cast<Value>(std::move(rest)))), ...);
    return best;
}
// END value-minimum

// BEGIN traits
template<class T> struct IsConst : std::false_type {};
template<class T> struct IsConst<const T> : std::true_type {};

template<class T> struct IsArray : std::false_type {};
template<class T, std::size_t N>
struct IsArray<T[N]> : std::true_type {};
template<class T> struct IsArray<T[]> : std::true_type {};

template<class T, bool = std::is_pointer_v<T>>
struct StripPointers { using type = T; };
template<class T>
struct StripPointers<T, true> : StripPointers<std::remove_pointer_t<T>> {};
template<class T> using StripPointersT = typename StripPointers<T>::type;
// END traits

// BEGIN partial-storage
template<class K, class V>
struct KeyValue {
    K key;
    V value;
    KeyValue(K k, V v) : key(std::move(k)), value(std::move(v)) {}
};

template<class K>
struct KeyValue<K, const char*> {
    K key;
    std::string value;  // Own the value, rather than retaining the C string.
    KeyValue(K k, const char* v) : key(std::move(k)), value(v) {}
};
template<class K, class V> KeyValue(K, V) -> KeyValue<K, V>;
// END partial-storage

// BEGIN detected-member
template<class T, class = void>
struct HasConstSize : std::false_type {};
template<class T>
struct HasConstSize<T, std::void_t<decltype(std::declval<const T&>().size())>>
    : std::true_type {};

template<class T>
std::size_t observed_size(const T& value) {
    if constexpr (HasConstSize<T>::value)
        return static_cast<std::size_t>(value.size());
    else
        return 1;
}
// END detected-member

// BEGIN priority-dispatch
template<int N> struct Priority : Priority<N - 1> {};
template<> struct Priority<0> {};

template<class T>
auto priority_impl(T&& value, Priority<3>)
    -> decltype(std::forward<T>(value).first()) {
    return std::forward<T>(value).first();
}
template<class T>
auto priority_impl(T&& value, Priority<2>)
    -> decltype(std::forward<T>(value).second()) {
    return std::forward<T>(value).second();
}
template<class T>
auto priority_impl(T&& value, Priority<1>)
    -> decltype(std::forward<T>(value).third()) {
    return std::forward<T>(value).third();
}
template<class T> int priority_impl(T&&, Priority<0>) { return 4; }

template<class T>
decltype(auto) get_priority(T&& value) {
    return priority_impl(std::forward<T>(value), Priority<3>{});
}
// END priority-dispatch

// BEGIN dependent-names
template<class Store>
typename Store::value_type first_stored_copy(Store& store) {
    return store.template get<0>();
}

template<class T> struct BufferBase {
    std::vector<T> values;
    void add(T value) { values.push_back(std::move(value)); }
};
template<class T> struct Buffer : BufferBase<T> {
    void add_twice(T value) {
        this->add(value);
        this->add(std::move(value));
    }
};
// END dependent-names

// BEGIN adl-swap
template<class T>
void swap_values(T& left, T& right) noexcept(std::is_nothrow_swappable_v<T>) {
    using std::swap;
    swap(left, right);
}
// END adl-swap

// BEGIN compile-time
constexpr unsigned long long fibonacci(unsigned n) {
    if (n > 93) throw std::out_of_range("uint64 Fibonacci index");
    unsigned long long a = 0, b = 1;
    for (unsigned i = 0; i < n; ++i) {
        if (i + 1 == n) return b;
        const auto next = a + b;
        a = b;
        b = next;
    }
    return a;
}
static_assert(fibonacci(10) == 55);
// A constexpr declaration permits constant evaluation; this use requires it.
using FiveSlots = std::array<int, fibonacci(5)>;
// END compile-time

// BEGIN tuple-indices
template<class Tuple, std::size_t... I>
std::string tuple_text_impl(const Tuple& tuple, std::index_sequence<I...>) {
    std::ostringstream out;
    out << '(';
    ((out << (I == 0 ? "" : ", ") << std::get<I>(tuple)), ...);
    out << ')';
    return out.str();
}
template<class... T>
std::string tuple_text(const std::tuple<T...>& tuple) {
    return tuple_text_impl(tuple, std::index_sequence_for<T...>{});
}
// END tuple-indices

// BEGIN static-queue
template<class T, std::size_t N>
class StaticQueue {
    static_assert(N > 0, "positive capacity required");
    std::array<std::optional<T>, N> slots_{};
    std::size_t head_ = 0, size_ = 0;
public:
    StaticQueue() = default;
    StaticQueue(const StaticQueue&) = default;
    StaticQueue(StaticQueue&&) = default;
    // Element-wise assignment could break the coupled slot/head/size invariant
    // if an element assignment throws. This reference interface omits assignment.
    StaticQueue& operator=(const StaticQueue&) = delete;
    StaticQueue& operator=(StaticQueue&&) = delete;
    bool empty() const noexcept { return size_ == 0; }
    bool full() const noexcept { return size_ == N; }
    std::size_t size() const noexcept { return size_; }

    template<class... Args>
    T& emplace(Args&&... args) {
        if (full()) throw std::length_error("queue full");
        auto& slot = slots_[(head_ + size_) % N];
        T& item = slot.emplace(std::forward<Args>(args)...);
        ++size_;  // Commit the count only after construction succeeds.
        return item;
    }
    T& front() {
        if (empty()) throw std::out_of_range("queue empty");
        return *slots_[head_];
    }
    const T& front() const {
        if (empty()) throw std::out_of_range("queue empty");
        return *slots_[head_];
    }
    void pop() {
        if (empty()) throw std::out_of_range("queue empty");
        slots_[head_].reset();
        head_ = (head_ + 1) % N;
        --size_;
    }
    void clear() noexcept {
        for (auto& slot : slots_) slot.reset();
        head_ = size_ = 0;
    }
    template<std::size_t Extra>
    StaticQueue<T, N + Extra> copy_and_expand() const {
        static_assert(Extra > 0, "add at least one slot");
        static_assert(N <= std::numeric_limits<std::size_t>::max() - Extra,
                      "capacity overflow");
        static_assert(std::is_copy_constructible_v<T>, "copying requires copyable elements");
        StaticQueue<T, N + Extra> out;
        for (std::size_t i = 0; i < size_; ++i)
            out.emplace(*slots_[(head_ + i) % N]);
        return out;
    }
};
// END static-queue

// BEGIN measure-call
template<class F, class... Args>
std::chrono::nanoseconds measure_call(F&& f, Args&&... args) {
    const auto start = std::chrono::steady_clock::now();
    std::invoke(std::forward<F>(f), std::forward<Args>(args)...);
    return std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::steady_clock::now() - start);
}
// END measure-call

// BEGIN move-only-callable
inline auto counter_task(int first) {
    return [value = std::make_unique<int>(first)]() mutable {
        return (*value)++;
    };
}
// auto task = counter_task(3); task();  // Owning, move-only concrete type.
// std::function<int()> erased = counter_task(3);  // Not a copyable target.
// END move-only-callable

#if __cplusplus >= 202002L
// BEGIN concepts
template<class T>
concept ConstSized = requires(const T& value) {
    { value.size() } -> std::convertible_to<std::size_t>;
};
template<ConstSized T>
std::size_t constrained_size(const T& value) {
    return static_cast<std::size_t>(value.size());
}

template<class T> concept Integral = std::integral<T>;
template<class T> concept SignedIntegral = Integral<T> && std::signed_integral<T>;
template<Integral T> constexpr int integral_kind(T) { return 1; }
template<SignedIntegral T> constexpr int integral_kind(T) { return 2; }
// END concepts

// BEGIN same-deduction
inline auto add_independent(const auto& a, const auto& b) { return a + b; }
template<class T>
auto add_same(const T& a, const T& b) { return a + b; }
// add_independent(1, 2.5) works; add_same(1, 2.5) has conflicting deduction.
// END same-deduction
#endif

#if defined(__cpp_lib_move_only_function) && __cpp_lib_move_only_function >= 202110L
// BEGIN erased-move-only
inline std::move_only_function<int()> erased_counter(int first) {
    return counter_task(first);
}
// END erased-move-only
#endif

} // namespace second_algorithm::cpp_generic
