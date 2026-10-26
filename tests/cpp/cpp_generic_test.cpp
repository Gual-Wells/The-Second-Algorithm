#include "../../content/cpp/泛型与约束.cpp"
#include <cassert>
#include <deque>
#include <random>

namespace g = second_algorithm::cpp_generic;

struct RefCall {
    int value = 7;
    int& operator()(int&) & noexcept { return value; }
    int operator()(int&) && { return 9; }
};
struct PriorityExample {
    int first() const { return 1; }
    int second() const { return 2; }
};
struct OnlySecond { int second() && { return 2; } };
namespace custom {
struct Swappable { int value; };
inline int swaps = 0;
void swap(Swappable& a, Swappable& b) noexcept {
    ++swaps;
    std::swap(a.value, b.value);
}
}
struct Item {
    inline static int alive = 0;
    inline static int copies_left = -1;
    int value;
    explicit Item(int v) : value(v) {
        if (v == -1) throw std::runtime_error("injected construction");
        ++alive;
    }
    Item(const Item& other) : value(other.value) {
        if (copies_left == 0) throw std::runtime_error("injected copy");
        if (copies_left > 0) --copies_left;
        ++alive;
    }
    Item(Item&& other) noexcept : value(other.value) { ++alive; other.value = 0; }
    Item& operator=(const Item&) = delete;
    ~Item() { --alive; }
};

int main() {
    int a[3]{};
    static_assert(g::array_bound(a) == 3);
    static_assert(std::is_same_v<decltype(g::deduce_value(a)), g::TypeTag<int*>>);
    static_assert(std::is_same_v<decltype(g::deduce_reference(a)), g::TypeTag<int[3]>>);
    static_assert(g::IsConst<const int>::value && !g::IsConst<const int*>::value);
    static_assert(g::IsArray<int[]>::value && g::IsArray<int[2]>::value);
    static_assert(std::is_same_v<g::StripPointersT<const int* const*>, const int>);
    RefCall call;
    int x = 0;
    static_assert(std::is_same_v<decltype(g::invoke_forward(call, x)), int&>);
    static_assert(noexcept(g::invoke_forward(call, x)));
    g::invoke_forward(call, x) = 11;
    assert(call.value == 11 && g::invoke_forward(RefCall{}, x) == 9);
    auto owned = g::make_one<std::unique_ptr<int>>(std::make_unique<int>(4));
    assert(**owned == 4);
    std::vector<std::unique_ptr<int>> values;
    g::append_many(values);
    g::append_many(values, std::make_unique<int>(2), std::make_unique<int>(3));
    assert(values.size() == 2 && *values[1] == 3);
    int calls = 0;
    auto positive = [&](int v) { ++calls; return v > 0; };
    assert(g::all_satisfy(positive) && !g::any_satisfy(positive) && calls == 0);
    assert(!g::all_satisfy(positive, 1, 0, 2) && calls == 2);
    calls = 0;
    assert(g::any_satisfy(positive, 0, 1, 2) && calls == 2);
    assert(g::minimum_value(std::less<>{}, 6) == 6);
    assert(g::minimum_value(std::less<>{}, 7, 2.5, 3) == 2.5);
    char text[] = "owned";
    g::KeyValue kv(1, static_cast<const char*>(text));
    text[0] = 'X';
    assert(kv.value == "owned");
    assert(g::observed_size(3) == 1 && g::observed_size(std::string("abc")) == 3);
    assert(g::get_priority(PriorityExample{}) == 1);
    assert(g::get_priority(OnlySecond{}) == 2 && g::get_priority(3) == 4);
    custom::Swappable left{1}, right{2};
    g::swap_values(left, right);
    assert(left.value == 2 && right.value == 1 && custom::swaps == 1);
    assert(g::fibonacci(0) == 0 && g::fibonacci(1) == 1);
    assert(g::fibonacci(93) == 12200160415121876738ULL);
    bool caught = false;
    try { (void)g::fibonacci(94); } catch (const std::out_of_range&) { caught = true; }
    assert(caught);
    assert(g::tuple_text(std::tuple<>{}) == "()");
    assert(g::tuple_text(std::make_tuple(1, "two", 3)) == "(1, two, 3)");
    {
        g::StaticQueue<int, 7> queue;
        std::deque<int> model;
        std::mt19937 random(1729);
        for (int i = 0; i < 4000; ++i) {
            const auto op = random() % 6;
            if (op < 3 && model.size() < 7) {
                const int value = static_cast<int>(random() % 1000);
                queue.emplace(value); model.push_back(value);
            } else if (op == 3 && !model.empty()) {
                assert(queue.front() == model.front()); queue.pop(); model.pop_front();
            } else if (op == 4) {
                auto expanded = queue.copy_and_expand<2>();
                for (int value : model) { assert(expanded.front() == value); expanded.pop(); }
                assert(expanded.empty());
            } else if (op == 5) { queue.clear(); model.clear(); }
            assert(queue.size() == model.size() && queue.empty() == model.empty());
            if (!model.empty()) assert(queue.front() == model.front());
        }
        queue.clear();
        caught = false;
        try { queue.pop(); } catch (const std::out_of_range&) { caught = true; }
        assert(caught);
        for (int i = 0; i < 7; ++i) queue.emplace(i);
        caught = false;
        try { queue.emplace(8); } catch (const std::length_error&) { caught = true; }
        assert(caught && queue.size() == 7 && queue.front() == 0);
    }
    {
        g::StaticQueue<std::unique_ptr<int>, 2> q;
        q.emplace(std::make_unique<int>(3));
        auto moved = std::move(q);
        assert(*moved.front() == 3 && q.size() == 1 && !q.front());
        q.pop();
    }
    {
        g::StaticQueue<Item, 3> q;
        q.emplace(1); q.emplace(2); q.pop(); q.emplace(3);
        caught = false;
        try { q.emplace(-1); } catch (const std::runtime_error&) { caught = true; }
        assert(caught && q.size() == 2 && q.front().value == 2 && Item::alive == 2);
        Item::copies_left = 1;
        caught = false;
        try { (void)q.copy_and_expand<2>(); } catch (const std::runtime_error&) { caught = true; }
        assert(caught && q.size() == 2 && q.front().value == 2 && Item::alive == 2);
        Item::copies_left = -1;
        q.clear();
        assert(Item::alive == 0);
    }
    auto task = g::counter_task(3);
    assert(task() == 3 && task() == 4);
    auto elapsed = g::measure_call([](int& value) { ++value; }, x);
    assert(x == 1 && elapsed.count() >= 0);
#if __cplusplus >= 202002L
    static_assert(g::ConstSized<std::vector<int>> && !g::ConstSized<int>);
    static_assert(g::integral_kind(2) == 2 && g::integral_kind(2u) == 1);
    assert(g::constrained_size(values) == 2 && g::add_independent(1, 2.5) == 3.5);
#endif
#if defined(__cpp_lib_move_only_function) && __cpp_lib_move_only_function >= 202110L
    auto erased = g::erased_counter(8);
    assert(erased() == 8 && erased() == 9);
#endif
}
