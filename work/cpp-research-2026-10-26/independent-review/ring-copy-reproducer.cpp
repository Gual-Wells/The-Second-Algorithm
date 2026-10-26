#include "../../../content/cpp/容器与范围.cpp"
#include <cassert>
#include <iostream>

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

int main() {
    using Ring = second_algorithm::containers::overwrite_ring<Tracked>;
    Ring source(3), target(3);
    source.push(Tracked(1)); source.push(Tracked(2)); source.push(Tracked(3));
    source.pop(); source.pop(); source.push(Tracked(4));
    // source active indices {2,0}; head 2, used 2.
    target.push(Tracked(7)); target.push(Tracked(8));
    // target active indices {0,1}; head 0, used 2.
    assert(Tracked::alive == 4);
    Tracked::fail_copy = true;
    bool caught = false;
    try { target = source; } catch (int) { caught = true; }
    assert(caught);
    // Do not dereference an inactive optional: observe only counts and size.
    std::cout << "alive=" << Tracked::alive << " logical_total="
              << source.size() + target.size() << '\n';
    assert(Tracked::alive == static_cast<int>(source.size() + target.size()));
}
