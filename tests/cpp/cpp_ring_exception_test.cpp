#include "../../content/cpp/容器与范围.cpp"
#include <cassert>
#include <cmath>
#include <limits>
#include <vector>

namespace {
struct Tracked {
    inline static int alive = 0;
    inline static bool fail_copy = false;
    int value;
    explicit Tracked(int x) : value(x) { ++alive; }
    Tracked(const Tracked& other) : value(other.value) {
        if (fail_copy && value == 3) throw 3;
        ++alive;
    }
    Tracked(Tracked&& other) noexcept : value(other.value) { ++alive; }
    Tracked& operator=(const Tracked& other) { value = other.value; return *this; }
    ~Tracked() { --alive; }
};
using Ring = second_algorithm::containers::overwrite_ring<Tracked>;
std::vector<int> values(const Ring& ring) {
    std::vector<int> result;
    for (const auto& item : ring) result.push_back(item.value);
    return result;
}
}

int main() {
    {
        Ring source(3), target(3);
        source.push(Tracked(1)); source.push(Tracked(2)); source.push(Tracked(3));
        source.pop(); source.pop(); source.push(Tracked(4));
        target.push(Tracked(7)); target.push(Tracked(8));
        assert(Tracked::alive == 4);
        Tracked::fail_copy = true;
        bool caught = false;
        try { target = source; } catch (int) { caught = true; }
        assert(caught);
        // Check counts before dereferencing: the pre-fix bug destroys an
        // active target slot but leaves the old logical size/head in place.
        assert(Tracked::alive == static_cast<int>(source.size() + target.size()));
        assert((values(source) == std::vector<int>{3, 4}));
        assert((values(target) == std::vector<int>{7, 8}));
        Tracked::fail_copy = false;
        target = source;
        assert((values(target) == std::vector<int>{3, 4}));
        assert(Tracked::alive == 4);
        target = target;
        assert((values(target) == std::vector<int>{3, 4}));
        target.push(Tracked(5)); target.push(Tracked(6));
        assert((values(target) == std::vector<int>{4, 5, 6}));
        assert((values(source) == std::vector<int>{3, 4}));
        Ring moved(std::move(target));
        assert(target.empty() && target.capacity() == 0);
        target = source;
        assert((values(target) == std::vector<int>{3, 4}));
        assert((values(moved) == std::vector<int>{4, 5, 6}));
    }
    assert(Tracked::alive == 0);

    // Validate the comparator's relation before using it in a sorting API.
    // Do not call sort with the known-invalid ordinary < relation on NaNs.
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double infinity = std::numeric_limits<double>::infinity();
    std::vector<double> numbers{nan, 2, -0.0, -infinity, 0.0, infinity, nan, -1};
    auto less = second_algorithm::containers::nan_last_less;
    auto equivalent = [&](double a, double b) { return !less(a, b) && !less(b, a); };
    for (double a : numbers) {
        assert(!less(a, a));
        for (double b : numbers) {
            assert(!less(a, b) || !less(b, a));
            for (double c : numbers) {
                assert(!(less(a, b) && less(b, c)) || less(a, c));
                assert(!(equivalent(a, b) && equivalent(b, c)) || equivalent(a, c));
            }
        }
    }
    std::sort(numbers.begin(), numbers.end(), less);
    assert(numbers.front() == -infinity);
    assert(numbers[5] == infinity && std::isnan(numbers[6]) && std::isnan(numbers[7]));
#if __cplusplus >= 202002L
    std::vector<int> base{1, 2, 3, 4};
    int predicate_calls = 0;
    auto filtered = base | std::views::filter([&](int value) {
        ++predicate_calls;
        return value == 3;
    });
    assert(predicate_calls == 0);
    assert(*filtered.begin() == 3 && predicate_calls == 3);
    assert(*filtered.begin() == 3 && predicate_calls == 3);
    auto rebuilt = base | std::views::filter([&](int value) {
        ++predicate_calls;
        return value == 3;
    });
    assert(*rebuilt.begin() == 3 && predicate_calls == 6);
#endif
}
