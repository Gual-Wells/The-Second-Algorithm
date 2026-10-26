#include "../../content/cpp/类型与调用.cpp"
#include "../../content/cpp/对象与资源.cpp"
#include <cassert>
#include <climits>
#include <cstring>
#include <iostream>
#include <typeinfo>

namespace c = second_algorithm::calls;
namespace o = second_algorithm::objects;

static_assert(std::is_same_v<decltype(c::copy_first(std::declval<std::vector<int>&>())), int>);
static_assert(std::is_same_v<decltype(c::borrow_first(std::declval<std::vector<int>&>())), int&>);
static_assert(std::is_same_v<decltype(std::declval<c::Text&>().data()), std::string&>);
static_assert(std::is_same_v<decltype(std::declval<const c::Text&>().data()), const std::string&>);
static_assert(std::is_same_v<decltype(std::declval<c::Text&&>().data()), std::string>);
static_assert(std::is_same_v<decltype(std::declval<const c::Text&&>().data()), std::string>);
static_assert(std::is_same_v<decltype(++std::declval<c::IPv4&>()), c::IPv4&>);
static_assert(std::is_same_v<decltype(std::declval<c::IPv4&>()++), c::IPv4>);

// 允许在数组构造或第 k 次元素复制时抛异常，检查实际存活资源与原目标值。
struct ThrowCell {
    static inline int live = 0;
    static inline int defaults_left = -1;
    static inline int copies_left = -1;
    int value = 0;
    ThrowCell() {
        if (defaults_left == 0) throw std::runtime_error("default construction injected");
        if (defaults_left > 0) --defaults_left;
        ++live;
    }
    ThrowCell(const ThrowCell& x) : value(x.value) {
        check_copy();
        ++live;
    }
    ThrowCell& operator=(const ThrowCell& x) {
        check_copy();
        value = x.value;
        return *this;
    }
    static void check_copy() {
        if (copies_left == 0) throw std::runtime_error("copy injected");
        if (copies_left > 0) --copies_left;
    }
    ~ThrowCell() noexcept { --live; }
};
static_assert(std::is_nothrow_move_constructible_v<o::Buffer<ThrowCell>>);
static_assert(std::is_nothrow_move_assignable_v<o::Buffer<ThrowCell>>);

template<class Exception, class F>
void expect_throw(F operation) {
    bool caught = false;
    try { operation(); }
    catch (const Exception&) { caught = true; }
    assert(caught);
}

void test_types_and_calls() {
    c::initialization_examples();
    c::deduction_examples();
    c::decltype_examples();
    assert(std::vector<int>(3, 7) == std::vector<int>({7, 7, 7}));
    std::vector<int> listed{3, 7};
    assert(listed.size() == 2 && listed[0] == 3 && listed[1] == 7);
    auto owned = c::make_owned_values();
    assert(owned.size() == 2 && *owned[0] == 10 && *owned[1] == 20);
    assert(c::select(0) == 1 && c::select(nullptr) == 2);
    assert(c::has_items(c::Count{2}) && !c::has_items(c::Count{0}));
    assert(c::exact_index(3) == 3);

    std::vector<int> values{4, 5};
    auto saved = c::copy_first(values);
    auto& borrowed = c::borrow_first(values);
    borrowed = 9;
    assert(saved == 4 && values.front() == 9);
    c::Text text("abc");
    auto independent = text.data();
    text.data()[0] = 'z';
    assert(independent == "abc" && text.data() == "zbc");
    auto retained = c::Text("temporary").data();
    assert(retained == "temporary");
    const c::Text read_only("constant");
    auto copied_const_rvalue = std::move(read_only).data();
    assert(copied_const_rvalue == "constant" && read_only.data() == "constant");
    c::borrowing_examples();
    std::string owner = "abcd";
    auto prefix = c::prefix(owner, 2);
    owner[0] = 'z'; // 不重分配，不使视图失效
    assert(prefix == "zb");
    int audits = 0;
    c::Batch default_batch(audits);
    c::Batch custom_batch(8, audits);
    assert(audits == 2 && default_batch.size() == 4 && custom_batch.size() == 8);
}

void test_numeric_boundaries() {
    assert(c::product(70000, 70000) == 4900000000LL);
    assert(!c::valid_index(-1, 8));
    assert(!c::valid_index(0, 0));
    assert(c::valid_index(7, 8) && !c::valid_index(8, 8));
    assert(c::nonnegative_mod(-3, 5) == 2);
    assert(c::nonnegative_mod(INT_MIN, INT_MAX) == INT_MAX - 1);
    assert(c::nonnegative_mod(INT_MAX - 1, INT_MAX) == INT_MAX - 1);
    assert(c::is_odd(-3) && !c::is_odd(-2) && c::is_odd(3));
    expect_throw<std::invalid_argument>([] { (void)c::nonnegative_mod(1, 0); });
    assert(c::bit_mask(63) == 0x8000000000000000ULL);
    assert(c::low_bits(0) == 0 && c::low_bits(1) == 1);
    assert(c::low_bits(64) == UINT64_MAX);
    expect_throw<std::out_of_range>([] { (void)c::bit_mask(64); });
    expect_throw<std::out_of_range>([] { (void)c::low_bits(65); });
    int next = 0;
    assert(c::next_pair(next) == std::make_pair(0, 1));
    assert(next == 2);
    assert((c::braced_next(next) == std::array<int, 2>{2, 3}));
}

void test_ipv4() {
    const c::IPv4 original(9, 8, 7, 6);
    for (const char* invalid : {"", "1.2", "1x2.3.4", "300.2.3.4", "-1.2.3.4",
                                "1.2.3.256", "99999999999999999999.2.3.4"}) {
        auto target = original;
        std::istringstream input(invalid);
        input >> target;
        assert(input.fail() && target == original);
    }
    std::istringstream good("192.168.1.20 tail");
    c::IPv4 address;
    good >> address;
    assert(!good.fail() && address.value() == 0xC0A80114u);
    std::string tail;
    good >> tail;
    assert(tail == "tail");
    std::ostringstream out;
    out << address;
    assert(out.str() == "192.168.1.20");
    assert(c::parse_ipv4_record("1.2.3.4  \n").value() == c::IPv4(1, 2, 3, 4));
    assert(!c::parse_ipv4_record("1.2.3.4junk"));
    assert(!c::parse_ipv4_record("1.2.3.4 5.6.7.8"));
    expect_throw<std::out_of_range>([] { (void)c::IPv4(256, 1, 2, 3); });
    auto target = original;
    std::istringstream exception_input("1.2.bad.4");
    exception_input.exceptions(std::ios::failbit | std::ios::badbit);
    expect_throw<std::ios_base::failure>([&] { exception_input >> target; });
    assert(target == original);

    c::IPv4 n(0u);
    auto old = n++;
    assert(old.value() == 0 && n.value() == 1);
    auto* same = &(++n);
    assert(same == &n && n.value() == 2);
    std::vector<std::uint32_t> visited;
    c::for_each_address(c::IPv4(UINT32_MAX - 1), c::IPv4(UINT32_MAX),
                        [&](c::IPv4 a) { visited.push_back(a.value()); });
    assert((visited == std::vector<std::uint32_t>{UINT32_MAX - 1, UINT32_MAX}));
    visited.clear();
    c::for_each_address(c::IPv4(UINT32_MAX), c::IPv4(UINT32_MAX),
                        [&](c::IPv4 a) { visited.push_back(a.value()); });
    assert(visited.size() == 1 && visited[0] == UINT32_MAX);
    expect_throw<std::invalid_argument>([] {
        c::for_each_address(c::IPv4(2u), c::IPv4(1u), [](c::IPv4) {});
    });
}

void test_copy_move_failures() {
    assert(ThrowCell::live == 0);
    ThrowCell::defaults_left = 2;
    expect_throw<std::runtime_error>([] { o::Buffer<ThrowCell> partial(5); });
    assert(ThrowCell::live == 0); // new[] 的部分构造也没有泄漏
    ThrowCell::defaults_left = -1;
    {
        o::Buffer<ThrowCell> source(3), target(2);
        source[0].value = 10; source[1].value = 20; source[2].value = 30;
        target[0].value = 7; target[1].value = 8;
        assert(ThrowCell::live == 5);
        ThrowCell::copies_left = 1;
        expect_throw<std::runtime_error>([&] { target = source; });
        assert(target.size() == 2 && target[0].value == 7 && target[1].value == 8);
        assert(source[0].value == 10 && source[2].value == 30 && ThrowCell::live == 5);
        ThrowCell::copies_left = 0;
        expect_throw<std::runtime_error>([&] { o::Buffer<ThrowCell> failed(source); });
        assert(ThrowCell::live == 5);
        ThrowCell::copies_left = -1;
        target = source;
        assert(target.size() == 3 && target[2].value == 30 && ThrowCell::live == 6);
        target[0].value = 99;
        assert(source[0].value == 10); // 独立副本
        target = target;
        assert(target[0].value == 99);
        o::Buffer<ThrowCell> moved(std::move(target));
        assert(target.size() == 0 && moved.size() == 3 && moved[0].value == 99);
        auto& self = moved;
        moved = std::move(self);
        assert(moved.size() == 3 && moved[0].value == 99);
        source = std::move(moved);
        assert(moved.size() == 0 && source[0].value == 99 && ThrowCell::live == 3);
        o::Buffer<ThrowCell> empty;
        source = empty;
        assert(source.size() == 0 && ThrowCell::live == 0);
    }
    assert(ThrowCell::live == 0);

    o::TransferCounts counts;
    o::TracedValue original(counts, 7);
    std::vector<o::TracedValue> results;
    results.reserve(2);
    o::take_rvalue(std::move(original), results);
    assert(counts.copies == 1 && counts.moves == 1);
    assert(original.value() == -1 && results[0].value() == 7 && results[1].value() == 7);
    const o::TracedValue constant(counts, 8);
    o::TracedValue copied(std::move(constant));
    assert(counts.copies == 2 && copied.value() == 8 && constant.value() == 8);
    o::relocation_examples();
    auto immovable = o::make_immovable();
    (void)immovable;
    assert(o::make_label() == "ready");
}

int c_success(char** output) {
    *output = static_cast<char*>(std::malloc(4));
    if (!*output) return 1;
    std::memcpy(*output, "yes", 4);
    return 0;
}
int c_partial_failure(char** output) {
    *output = static_cast<char*>(std::malloc(4));
    return 1; // 适配契约允许失败时交回可释放资源
}

void test_owners() {
    auto item = o::make_item(3);
    assert(o::inspect(*item) == 3 && o::inspect_optional(item.get()) == 3);
    assert(o::inspect_optional(nullptr) == -1);
    o::replace(item, 4);
    assert(item->value == 4);
    assert(o::consume(std::move(item)) == 4 && !item);
    assert(o::ownership_operations() == 7);
    auto zeros = o::make_zero_array(3);
    assert(zeros[0] == 0 && zeros[2] == 0);
    auto text = o::acquire_c_text(c_success);
    assert(std::strcmp(text.get(), "yes") == 0);
    expect_throw<std::runtime_error>([] { (void)o::acquire_c_text(c_partial_failure); });
    const char* path = ".local/cpp-core-probes/close-check.txt";
    auto file = o::open_file(path, "wb");
    assert(std::fputs("data", file.get()) >= 0);
    o::checked_close(file);
    assert(!file);
    o::checked_close(file); // 已空时无操作
    assert(std::remove(path) == 0);

    auto doc = std::make_shared<o::Document>(o::Document{"title", 6});
    std::weak_ptr<o::Document> watch_doc = doc;
    auto version = o::share_version(doc);
    assert(o::same_owner(doc, version));
    assert(!o::same_owner(doc, std::make_shared<o::Document>()));
    doc.reset();
    assert(!watch_doc.expired() && *version == 6);
    version.reset();
    assert(watch_doc.expired());
    expect_throw<std::invalid_argument>([] { (void)o::share_version({}); });
    auto root = std::make_shared<o::Node>();
    root->value = 8;
    auto child = o::attach(root, 2);
    assert(o::parent_value(*child) == 8);
    std::weak_ptr<o::Node> watch_child = child;
    root.reset();
    assert(child->parent.expired() && o::parent_value(*child) == -1);
    child.reset();
    assert(watch_child.expired());
    auto session = o::Session::create();
    auto shared_session = session->share();
    assert(o::same_owner(session, shared_session));
    auto weak_session = session->observe();
    session.reset(); shared_session.reset();
    assert(weak_session.expired());
    struct Unowned : std::enable_shared_from_this<Unowned> {};
    Unowned unowned;
    assert(unowned.weak_from_this().expired());
    expect_throw<std::bad_weak_ptr>([&] { (void)unowned.shared_from_this(); });

    auto retained = o::make_item(9);
    std::shared_ptr<o::Item> shared_item(std::move(retained));
    o::Retainer retainer;
    assert(retainer.inspect_or_keep(shared_item, false) == 9 && shared_item.use_count() == 1);
    retainer.inspect_or_keep(shared_item, true);
    assert(shared_item.use_count() == 2);
    retainer.clear();
    assert(shared_item.use_count() == 1);
    retainer.set(std::move(shared_item));
    assert(!shared_item);
}

void test_polymorphism_and_exceptions() {
    o::RenderJob render;
    assert(o::by_value(render) == "base" && o::by_reference(render) == "render");
    auto clone = render.clone();
    assert(clone->kind() == "render");
    int destroyed = 0;
    struct CountedJob : o::Job {
        int& count;
        explicit CountedJob(int& c) : count(c) {}
        ~CountedJob() override { ++count; }
    };
    { std::unique_ptr<o::Job> owned = std::make_unique<CountedJob>(destroyed); }
    assert(destroyed == 1);
    o::DispatchTrace trace;
    { o::DispatchDerived object(trace); }
    assert((trace.calls == std::array<char, 4>{'B', 'D', 'D', 'B'}));
    assert(trace.size == 4);
    o::LifeCounts life;
    expect_throw<std::runtime_error>([&] { o::ConstructorProbe failed(life, true); });
    assert(life.live == 0 && life.outer_destroyed == 0);
    { o::ConstructorProbe good(life, false); assert(life.live == 1); }
    assert(life.live == 0 && life.outer_destroyed == 1);
    assert(o::classify_error() == 7);
    bool retained_type = false;
    try { o::preserve_error(); }
    catch (const o::DomainError& e) { retained_type = e.code == 7; }
    assert(retained_type);
}

int main() {
    test_types_and_calls();
    test_numeric_boundaries();
    test_ipv4();
    test_copy_move_failures();
    test_owners();
    test_polymorphism_and_exceptions();
    std::cout << "cpp_core_test: passed (C++17)\n";
}
