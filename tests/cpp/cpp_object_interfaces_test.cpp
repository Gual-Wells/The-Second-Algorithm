#include "../../content/cpp-object-interfaces/对象如何传递.cpp"
#include <cassert>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <new>

namespace oi = second_algorithm::object_interfaces;
namespace allocation_probe {
bool fail_next_array = false;
}
#if defined(__GNUC__) || defined(__clang__)
#define PROBE_NOINLINE __attribute__((noinline))
#else
#define PROBE_NOINLINE
#endif
#if defined(__GNUC__) && !defined(__clang__)
#define PROBE_OPAQUE __attribute__((noipa))
#elif defined(__clang__)
#define PROBE_OPAQUE __attribute__((noinline))
#elif defined(_MSC_VER)
#define PROBE_OPAQUE __declspec(noinline)
#else
#define PROBE_OPAQUE
#endif
PROBE_NOINLINE
void* operator new[](std::size_t size) {
    if (allocation_probe::fail_next_array) {
        allocation_probe::fail_next_array = false;
        throw std::bad_alloc();
    }
    if (void* p = std::malloc(size ? size : 1)) {
        return p;
    }
    throw std::bad_alloc();
}
PROBE_NOINLINE
void operator delete[](void* p) noexcept {
    std::free(p);
}
void operator delete[](void* p, std::size_t) noexcept { ::operator delete[](p); }

template<class Error, class F> bool throws(F f) {
    try { f(); } catch (const Error&) { return true; }
    return false;
}
// Keep both failure-injected operations opaque to their callers. The owned
// allocation escapes through the returned value or the caller's target, so
// caller-side knowledge cannot discard the operation being tested.
PROBE_OPAQUE oi::IntBuffer copy_buffer(const oi::IntBuffer& source) {
    return oi::IntBuffer(source);
}
PROBE_OPAQUE void assign_buffer(oi::IntBuffer& target,
                                const oi::IntBuffer& source) {
    target = source;
}

void value_and_interface_checks() {
    oi::Record first{"original", {1, 2}, 0};
    auto second = oi::copy_and_edit(first, "copy");
    second.values[0] = 8;
    assert(first.name == "original" && first.values[0] == 1);
    assert(oi::value_count(first) == 2 && oi::optional_value_count(nullptr) == 0);
    oi::append_value(first, 3);
    assert(first.values.size() == 3);
    auto owner = oi::make_record("transfer");
    auto&& bound = std::move(owner);
    assert(owner && bound.get() == owner.get()); // Reference binding has not moved.
    auto taken = oi::bind_only(std::move(owner));
    assert(!owner && taken && taken->name == "transfer");
    oi::replace_record(taken, "replacement");
    assert(taken->name == "replacement");
    assert(oi::consume_record(std::move(taken)) == "replacement" && !taken);
    assert(throws<std::invalid_argument>([] { oi::consume_record({}); }));
    assert(oi::inspect_reset_release() == 16 && oi::const_owner_example() == 4);
    auto base = oi::make_polymorphic_record();
    assert(base->value() == 7);
}

void buffer_checks() {
    {
        oi::IntBuffer a(3);
        a.at(0) = 1; a.at(1) = 2; a.at(2) = 3;
        oi::IntBuffer copy(a);
        copy.at(0) = 9;
        assert(a.at(0) == 1 && copy.at(0) == 9);
        oi::IntBuffer target(2);
        target.at(0) = 7; target.at(1) = 8;
        allocation_probe::fail_next_array = true;
        assert(throws<std::bad_alloc>([&] { assign_buffer(target, a); }));
        assert(target.size() == 2 && target.at(0) == 7 && target.at(1) == 8);
        assert(a.size() == 3 && a.at(2) == 3);
        allocation_probe::fail_next_array = true;
        assert(throws<std::bad_alloc>([&] { (void)copy_buffer(a); }));
        target = a;
        assert(target.size() == 3 && target.at(2) == 3);
        target = target;
        assert(target.at(0) == 1);
        oi::IntBuffer moved(std::move(target));
        assert(target.size() == 0 && moved.size() == 3 && moved.at(2) == 3);
        assert(throws<std::out_of_range>([&] { (void)target.at(0); }));
        auto* same = &moved;
        moved = std::move(*same);
        assert(moved.size() == 3 && moved.at(2) == 3);
        oi::IntBuffer assigned(1);
        assigned = std::move(moved);
        assert(moved.size() == 0 && assigned.size() == 3);
        moved = oi::IntBuffer(2);
        assert(moved.size() == 2 && moved.at(0) == 0);
        oi::IntBuffer empty;
        oi::IntBuffer empty_copy(empty);
        assigned = empty;
        assert(assigned.size() == 0 && empty_copy.size() == 0);
        const oi::IntBuffer stable = oi::filled(4, 6);
        auto from_const = oi::copy_from_const(stable);
        from_const.at(0) = 7;
        assert(stable.at(0) == 6 && from_const.at(0) == 7);
        auto zeros = oi::zeros(5);
        for (std::size_t i = 0; i < zeros.size(); ++i) assert(zeros.at(i) == 0);
    }
    static_assert(std::is_constructible_v<oi::CopyFallback, oi::CopyFallback&&>);
    static_assert(!std::is_constructible_v<oi::MoveDeleted, oi::MoveDeleted&&>);
    static_assert(std::is_constructible_v<oi::DefaultedMove, oi::DefaultedMove&&>);
    oi::CopyFallback copy_only;
    auto copied = oi::copy_from_rvalue(copy_only);
    (void)copied;
    oi::DefaultedMove fallback_source;
    oi::DefaultedMove fallback(std::move(fallback_source));
    (void)fallback;
}

struct RiskyCopyable {
    inline static int copies = 0, moves = 0;
    RiskyCopyable() = default;
    RiskyCopyable(const RiskyCopyable&) { ++copies; }
    RiskyCopyable(RiskyCopyable&&) noexcept(false) { ++moves; }
};
struct RiskyMoveOnly {
    inline static int moves = 0;
    RiskyMoveOnly() = default;
    RiskyMoveOnly(const RiskyMoveOnly&) = delete;
    RiskyMoveOnly(RiskyMoveOnly&&) noexcept(false) { ++moves; }
};
void relocation_checks() {
    RiskyCopyable source;
    auto copy = oi::relocate_one(source);
    assert(RiskyCopyable::copies == 1 && RiskyCopyable::moves == 0);
    RiskyMoveOnly only;
    auto move = oi::relocate_one(only);
    assert(RiskyMoveOnly::moves == 1);
    (void)copy; (void)move;
}

void borrow_checks() {
    std::string text("ab\0cd", 5);
    auto prefix = oi::prefix_view(text, 3);
    assert(prefix.size() == 3 && prefix[2] == '\0');
    text[0] = 'X';
    assert(prefix[0] == 'X'); // Storage remains valid; the view observes characters.
    std::string output;
    oi::append_exact(output, prefix);
    assert(output == std::string("Xb\0", 3));
    oi::append_exact(output, {});
    assert(output.size() == 3);
    assert(oi::prefix_view({}, 5).empty());
    assert(oi::prefix_owned(std::string("temporary"), 4) == "temp");
    oi::Message persistent("value");
    const auto& reference = persistent.text();
    auto value = persistent.text();
    value[0] = 'V';
    assert(reference == "value" && value == "Value");
    const oi::Message frozen("const");
    auto copied = std::move(frozen).text();
    assert(copied == "const" && frozen.text() == "const");
    auto independent = oi::Message("temporary").text();
    assert(independent == "temporary");
    static_assert(std::is_same_v<decltype(std::declval<oi::Message&>().text()), const std::string&>);
    static_assert(std::is_same_v<decltype(std::declval<oi::Message&&>().text()), std::string>);
    static_assert(std::is_same_v<decltype(std::declval<const oi::Message&&>().text()), std::string>);
}

void shared_checks() {
    auto record = std::make_shared<oi::Record>();
    record->name = "kept"; record->values = {1, 2}; record->revision = 4;
    std::weak_ptr<oi::Record> observer = record;
    oi::RecordKeeper keeper;
    keeper.retain_if(record, false);
    assert(record.use_count() == 1);
    keeper.retain_if(record, true);
    assert(record.use_count() == 2 && keeper.size() == 2);
    keeper.clear();
    auto revision = oi::share_revision(record);
    assert(oi::same_owner(record, revision));
    *revision = 5;
    assert(record->revision == 5);
    record.reset();
    assert(!observer.expired() && oi::observed_name(observer) == "kept");
    revision.reset();
    assert(observer.expired() && !oi::observed_name(observer));
    assert(throws<std::invalid_argument>([] { oi::share_revision({}); }));
    auto transferred = std::make_shared<oi::Record>();
    transferred->values = {4};
    keeper.retain(std::move(transferred));
    assert(!transferred && keeper.size() == 1);
}

void resource_checks() {
    namespace fs = std::filesystem;
    const auto directory = fs::current_path() / ".local/cpp-object-test-owned";
    fs::create_directories(directory);
    const auto path = (directory / "data.txt").string();
    {
        auto file = oi::open_file(path.c_str(), "wb");
        assert(std::fputs("data", file.get()) >= 0);
        oi::close_checked(file);
        assert(!file);
        oi::close_checked(file);
    }
    std::ifstream input(path);
    std::string contents;
    input >> contents;
    assert(contents == "data");
    input.close();
    assert(throws<std::runtime_error>([&] {
        oi::open_file((directory / "missing" / "no.txt").string().c_str(), "wb");
    }));
    fs::remove(path); fs::remove(directory);
}

int main() {
    value_and_interface_checks(); buffer_checks(); relocation_checks();
    borrow_checks(); shared_checks(); resource_checks();
    std::cout << "object interfaces: value, ownership, borrowing, exception and resource checks passed\n";
}
