#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <optional>
#include <ostream>
#include <stdexcept>
#include <string_view>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

namespace second_algorithm::cpp_systems {

// BEGIN joining-thread
class JoiningThread {
    std::thread thread_;
public:
    explicit JoiningThread(std::thread thread) noexcept
        : thread_(std::move(thread)) {}
    JoiningThread(const JoiningThread&) = delete;
    JoiningThread& operator=(const JoiningThread&) = delete;
    ~JoiningThread() {
        if (thread_.joinable()) thread_.join();
    }
};
// END joining-thread

// BEGIN run-and-join
template<class F>
auto run_and_join(F&& function) -> std::invoke_result_t<std::decay_t<F>&> {
    using R = std::invoke_result_t<std::decay_t<F>&>;
    std::packaged_task<R()> task(std::forward<F>(function));
    auto result = task.get_future();
    JoiningThread worker{std::thread(std::move(task))};
    return result.get();
}
// END run-and-join

// BEGIN future-state
enum class FutureState { invalid, deferred, pending, ready };

template<class T>
FutureState inspect(const std::future<T>& result) {
    if (!result.valid()) return FutureState::invalid;
    switch (result.wait_for(std::chrono::milliseconds{0})) {
        case std::future_status::deferred: return FutureState::deferred;
        case std::future_status::timeout:  return FutureState::pending;
        case std::future_status::ready:    return FutureState::ready;
    }
    throw std::logic_error("unexpected future status");
}
// END future-state

// BEGIN explicit-async
inline std::pair<int, int> minmax_two_tasks(const std::vector<int>& values) {
    if (values.empty()) throw std::invalid_argument("empty range");
    auto minimum = std::async(std::launch::async, [&values] {
        return *std::min_element(values.begin(), values.end());
    });
    const int maximum = *std::max_element(values.begin(), values.end());
    return {minimum.get(), maximum};
}
// END explicit-async

// BEGIN once-cell
template<class T>
class OnceValue {
    std::once_flag flag_;
    std::unique_ptr<T> value_;
public:
    template<class Factory>
    const T& get(Factory&& factory) {
        std::call_once(flag_, [&] {
            auto candidate = std::make_unique<T>(std::invoke(factory));
            value_ = std::move(candidate);
        });
        return *value_;
    }
};
// END once-cell

// BEGIN two-lock-swap
struct LockedValues {
    std::mutex mutex;
    std::vector<int> values;
};

inline void swap_values(LockedValues& a, LockedValues& b) {
    if (&a == &b) return;
    std::scoped_lock lock(a.mutex, b.mutex);
    a.values.swap(b.values);
}
// END two-lock-swap

// BEGIN closing-queue
template<class T>
class ClosingQueue {
    static_assert(std::is_nothrow_move_constructible_v<T>,
                  "pop requires a non-throwing move");
    std::mutex mutex_;
    std::condition_variable changed_;
    std::deque<T> queue_;
    bool closed_ = false;
public:
    bool push(T value) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (closed_) return false;
            queue_.push_back(std::move(value));
        }
        changed_.notify_one();
        return true;
    }

    std::optional<T> pop() {
        std::unique_lock<std::mutex> lock(mutex_);
        changed_.wait(lock, [&] { return closed_ || !queue_.empty(); });
        if (queue_.empty()) return std::nullopt;
        T value = std::move(queue_.front());
        queue_.pop_front();
        return std::optional<T>(std::move(value));
    }

    void close() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            closed_ = true;
        }
        changed_.notify_all();
    }
};
// END closing-queue

// BEGIN local-count
template<class InputIt, class Predicate>
void count_matches(InputIt first, InputIt last, Predicate predicate,
                   std::atomic<std::size_t>& total) {
    std::size_t local = 0;
    for (; first != last; ++first) {
        if (std::invoke(predicate, *first)) ++local;
    }
    total.fetch_add(local, std::memory_order_relaxed);
}
// END local-count

// BEGIN one-shot-publish
class OneShotMessage {
    int payload_ = 0;
    std::atomic<bool> ready_{false};
public:
    // One producer calls publish exactly once; no later payload modification.
    void publish(int value) {
        payload_ = value;
        ready_.store(true, std::memory_order_release);
    }

    int receive() const {
        while (!ready_.load(std::memory_order_acquire)) {
            std::this_thread::yield();
        }
        return payload_;
    }
};
// END one-shot-publish

// BEGIN atomic-min
inline void atomic_min(std::atomic<int>& current, int candidate) noexcept {
    int old = current.load(std::memory_order_relaxed);
    while (candidate < old &&
           !current.compare_exchange_weak(old, candidate,
                                          std::memory_order_relaxed,
                                          std::memory_order_relaxed)) {
        // A failed CAS has already refreshed old.
    }
}
// END atomic-min

// BEGIN parallel-min
inline std::optional<int> parallel_min(const std::vector<int>& values,
                                       std::size_t max_workers = 0,
                                       std::size_t min_block = 1024) {
    if (values.empty()) return std::nullopt;
    min_block = std::max<std::size_t>(1, min_block);
    if (max_workers == 0) {
        max_workers = std::max(1u, std::thread::hardware_concurrency());
    }
    const std::size_t workers = std::min(
        max_workers, 1 + (values.size() - 1) / min_block);
    std::vector<int> results(workers);
    std::vector<std::thread> threads;
    threads.reserve(workers - 1);
    struct JoinAll {
        std::vector<std::thread>& threads;
        ~JoinAll() {
            for (auto& thread : threads) {
                if (thread.joinable()) thread.join();
            }
        }
    } joiner{threads};

    const std::size_t base = values.size() / workers;
    const std::size_t extra = values.size() % workers;
    std::size_t first = 0;
    for (std::size_t id = 0; id < workers; ++id) {
        const std::size_t last = first + base + (id < extra ? 1 : 0);
        auto work = [&, first, last, id] {
            results[id] = *std::min_element(values.begin() + first,
                                           values.begin() + last);
        };
        if (id + 1 == workers) work();
        else threads.emplace_back(work);
        first = last;
    }
    for (auto& thread : threads) thread.join();
    return *std::min_element(results.begin(), results.end());
}
// END parallel-min

// BEGIN record-logger
class RecordLogger {
    std::mutex mutex_;
    std::ostream& output_;
public:
    explicit RecordLogger(std::ostream& output) : output_(output) {}

    void log(std::string_view message) {
        std::lock_guard<std::mutex> lock(mutex_);
        output_ << message << '\n';
    }
};
// END record-logger

} // namespace second_algorithm::cpp_systems
