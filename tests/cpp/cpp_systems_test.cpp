#include "../../content/cpp/线程与同步.cpp"
#include <array>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <set>
#include <sstream>
#include <string>

namespace cs = second_algorithm::cpp_systems;

static std::size_t checks = 0;
static void check(bool condition, const char* label) {
    ++checks;
    if (!condition) {
        std::cerr << "FAIL cpp systems: " << label << '\n';
        std::exit(1);
    }
}

int main() {
    int completed = 0;
    try {
        cs::JoiningThread worker{std::thread([&] { completed = 42; })};
        throw std::runtime_error("leave scope");
    } catch (const std::runtime_error&) {}
    check(completed == 42, "join during stack unwinding");
    check(cs::run_and_join([p = std::make_unique<int>(17)] { return *p; }) == 17,
          "move-only worker closure");
    cs::run_and_join([&] { completed = 23; });
    check(completed == 23, "void task result");
    bool transported = false;
    try {
        cs::run_and_join([]() -> int { throw std::runtime_error("worker"); });
    } catch (const std::runtime_error& e) {
        transported = std::string(e.what()) == "worker";
    }
    check(transported, "worker exception transported through future");

    std::promise<int> promise;
    auto result = promise.get_future();
    check(cs::inspect(result) == cs::FutureState::pending, "pending future");
    promise.set_value(7);
    check(cs::inspect(result) == cs::FutureState::ready, "ready future");
    check(result.get() == 7, "future value");
    check(cs::inspect(result) == cs::FutureState::invalid, "consumed future");
    int invoked = 0;
    auto deferred = std::async(std::launch::deferred, [&] { ++invoked; return 9; });
    check(cs::inspect(deferred) == cs::FutureState::deferred && invoked == 0,
          "timed inspection does not run deferred task");
    check(deferred.get() == 9 && invoked == 1, "get runs deferred task");
    check(cs::minmax_two_tasks({4, -9, 2, 12}) == std::make_pair(-9, 12),
          "explicit async work");
    bool empty_extrema = false;
    try { (void)cs::minmax_two_tasks({}); }
    catch (const std::invalid_argument&) { empty_extrema = true; }
    check(empty_extrema, "empty extrema contract");

    cs::OnceValue<int> once;
    std::atomic<int> factory_calls{0};
    std::array<int, 4> initialized{};
    std::vector<std::thread> initializers;
    for (std::size_t i = 0; i < initialized.size(); ++i) {
        initializers.emplace_back([&, i] {
            initialized[i] = once.get([&] {
                factory_calls.fetch_add(1);
                return 31;
            });
        });
    }
    for (auto& t : initializers) t.join();
    check(factory_calls.load() == 1, "once commits initialization once");
    for (int value : initialized) check(value == 31, "once publishes initialized value");

    cs::LockedValues a, b;
    a.values = {1, 2}; b.values = {3};
    cs::swap_values(a, a);
    check(a.values == std::vector<int>({1, 2}), "same-object double-lock avoided");
    std::thread swapper1([&] { for (int i = 0; i < 1001; ++i) cs::swap_values(a, b); });
    std::thread swapper2([&] { for (int i = 0; i < 1001; ++i) cs::swap_values(b, a); });
    swapper1.join(); swapper2.join();
    check(a.values == std::vector<int>({1, 2}) && b.values == std::vector<int>({3}),
          "opposite-order swaps complete and preserve data");

    cs::ClosingQueue<std::unique_ptr<int>> resources;
    check(resources.push(std::make_unique<int>(3)), "queue accepts first resource");
    check(resources.push(std::make_unique<int>(4)), "queue accepts second resource");
    resources.close(); resources.close();
    auto first = resources.pop(); auto second = resources.pop();
    check(first && **first == 3 && second && **second == 4, "close drains FIFO");
    check(!resources.pop(), "closed empty queue is terminal");
    auto rejected = std::make_unique<int>(5);
    check(!resources.push(std::move(rejected)) && !rejected,
          "by-value rejection contract consumes moved argument");

    cs::ClosingQueue<int> already_closed;
    already_closed.close();
    auto immediate = std::async(std::launch::async, [&] { return already_closed.pop(); });
    check(!immediate.get(), "close before wait does not need retained notification");
    cs::ClosingQueue<int> waiting;
    std::promise<void> entered;
    auto entered_future = entered.get_future();
    auto awakened = std::async(std::launch::async, [&] {
        entered.set_value();
        return waiting.pop();
    });
    entered_future.get();
    waiting.close();
    check(!awakened.get(), "close releases empty consumer");

    constexpr int producers_count = 4;
    constexpr int per_producer = 600;
    constexpr int total_items = producers_count * per_producer;
    cs::ClosingQueue<int> queue;
    std::vector<std::atomic<int>> seen(total_items);
    for (auto& value : seen) value.store(0);
    std::atomic<bool> invalid_item{false};
    std::atomic<bool> rejected_item{false};
    std::vector<std::thread> consumers, producers;
    for (int i = 0; i < 3; ++i) {
        consumers.emplace_back([&] {
            while (auto item = queue.pop()) {
                if (*item < 0 || *item >= total_items) invalid_item.store(true);
                else seen[static_cast<std::size_t>(*item)].fetch_add(1);
            }
        });
    }
    for (int id = 0; id < producers_count; ++id) {
        producers.emplace_back([&, id] {
            for (int i = 0; i < per_producer; ++i) {
                if (!queue.push(id * per_producer + i)) rejected_item.store(true);
            }
        });
    }
    for (auto& t : producers) t.join();
    queue.close();
    for (auto& t : consumers) t.join();
    check(!invalid_item.load() && !rejected_item.load(), "MPMC valid item domain");
    for (const auto& count : seen) check(count.load() == 1, "MPMC each item exactly once");

    std::vector<int> values(500);
    std::size_t expected_count = 0;
    for (std::size_t i = 0; i < values.size(); ++i) {
        values[i] = static_cast<int>(i % 7);
        if (values[i] % 3 == 0) ++expected_count;
    }
    std::atomic<std::size_t> count{0};
    std::thread counter1([&] {
        cs::count_matches(values.begin(), values.begin() + 200,
                          [](int x) { return x % 3 == 0; }, count);
    });
    std::thread counter2([&] {
        cs::count_matches(values.begin() + 200, values.end(),
                          [](int x) { return x % 3 == 0; }, count);
    });
    counter1.join(); counter2.join();
    check(count.load() == expected_count, "local counts merged atomically");

    for (int iteration = 0; iteration < 6; ++iteration) {
        cs::OneShotMessage message;
        std::array<int, 2> received{};
        std::thread reader1([&] { received[0] = message.receive(); });
        std::thread reader2([&] { received[1] = message.receive(); });
        message.publish(100 + iteration);
        reader1.join(); reader2.join();
        check(received[0] == 100 + iteration && received[1] == 100 + iteration,
              "release acquire publishes ordinary payload");
    }
    std::atomic<int> minimum{99};
    std::thread min1([&] { for (int v : {8, 4, -7, 12}) cs::atomic_min(minimum, v); });
    std::thread min2([&] { for (int v : {-3, -50, 0, 100}) cs::atomic_min(minimum, v); });
    min1.join(); min2.join();
    check(minimum.load() == -50, "CAS minimum updates");
    cs::atomic_min(minimum, std::numeric_limits<int>::min());
    cs::atomic_min(minimum, std::numeric_limits<int>::max());
    check(minimum.load() == std::numeric_limits<int>::min(), "CAS boundary and no-op");

    for (std::size_t n = 0; n <= 63; ++n) {
        std::vector<int> data(n);
        std::optional<int> oracle;
        for (std::size_t i = 0; i < n; ++i) {
            data[i] = static_cast<int>((i * 37 + n * 11) % 97) - 48;
            if (!oracle || data[i] < *oracle) oracle = data[i];
        }
        check(cs::parallel_min(data, 3, 5) == oracle, "uneven partition agrees with scalar scan");
    }
    check(cs::parallel_min({5, 1, 4}, 1000, 0) == std::optional<int>(1),
          "worker count clamped and zero grain normalized");
    check(cs::parallel_min({2, -1}, 0) == std::optional<int>(-1), "hardware hint path");

    std::ostringstream output;
    cs::RecordLogger logger(output);
    std::vector<std::thread> writers;
    for (int id = 0; id < 4; ++id) {
        writers.emplace_back([&, id] {
            for (int i = 0; i < 100; ++i) {
                logger.log(std::to_string(id) + ":" + std::to_string(i));
            }
        });
    }
    for (auto& t : writers) t.join();
    std::set<std::string> records;
    std::istringstream input(output.str());
    std::string line;
    int lines = 0;
    while (std::getline(input, line)) { records.insert(line); ++lines; }
    check(lines == 400 && records.size() == 400, "logger preserves whole records");
    for (int id = 0; id < 4; ++id) {
        for (int i = 0; i < 100; ++i) {
            check(records.count(std::to_string(id) + ":" + std::to_string(i)) == 1,
                  "every log record present");
        }
    }
    std::cout << "cpp systems checks: " << checks << '\n';
}
