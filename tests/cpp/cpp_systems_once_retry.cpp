#include "../../content/cpp/线程与同步.cpp"
#include <iostream>

// Separate process: some implementations fail to unwind call_once correctly.
// tools/verify_cpp_systems.py --once-retry gives this probe a bounded timeout.
int main() {
    second_algorithm::cpp_systems::OnceValue<int> value;
    int attempts = 0;
    bool caught = false;
    try {
        (void)value.get([&]() -> int {
            ++attempts;
            throw std::runtime_error("initialization failed");
        });
    } catch (const std::runtime_error&) { caught = true; }
    const int answer = value.get([&] { ++attempts; return 31; });
    if (!caught || attempts != 2 || answer != 31) return 1;
    std::cout << "call_once exception retry: passed\n";
}
