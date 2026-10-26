#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <ios>
#include <memory>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

namespace second_algorithm::objects {

// BEGIN rule-zero
struct Record {
    std::string label;
    std::vector<int> values;
    // 容器已经管理资源；默认复制形成独立值，默认移动交给成员完成。
};
struct CopyOnly {
    CopyOnly() = default;
    CopyOnly(const CopyOnly&) = default;
    ~CopyOnly() {} // 用户声明析构函数，不再隐式生成移动构造函数
};
struct BlockedMove {
    BlockedMove() = default;
    BlockedMove(const BlockedMove&) = default;
    BlockedMove(BlockedMove&&) = delete;
};
struct FallbackCopy {
    BlockedMove member;
    FallbackCopy() = default;
    FallbackCopy(const FallbackCopy&) = default;
    FallbackCopy(FallbackCopy&&) = default; // 因成员而被隐式删除；重载决议忽略它
};
static_assert(std::is_move_constructible_v<CopyOnly>); // 实际可由 const& 复制构造
static_assert(!std::is_move_constructible_v<BlockedMove>);
static_assert(std::is_move_constructible_v<FallbackCopy>); // 复制回退
// END rule-zero

// BEGIN owning-buffer
template<class T>
class Buffer {
    std::size_t size_ = 0;
    std::unique_ptr<T[]> data_;
public:
    Buffer() = default;
    explicit Buffer(std::size_t n)
        : size_(n), data_(n ? std::make_unique<T[]>(n) : nullptr) {}
    Buffer(const Buffer& other) : Buffer(other.size_) {
        if (size_ != 0) std::copy_n(other.data_.get(), size_, data_.get());
    }
    Buffer& operator=(const Buffer& other) {
        Buffer prepared(other); // 分配、元素复制可抛异常；此时尚未修改 *this
        swap(prepared);         // 无异常提交；旧数据随 prepared 销毁
        return *this;
    }
    Buffer(Buffer&& other) noexcept
        : size_(std::exchange(other.size_, 0)), data_(std::move(other.data_)) {}
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            data_ = std::move(other.data_); // 先释放原来持有的数组
            size_ = std::exchange(other.size_, 0);
        }
        return *this;
    }
    void swap(Buffer& other) noexcept {
        using std::swap;
        swap(size_, other.size_);
        data_.swap(other.data_);
    }
    std::size_t size() const noexcept { return size_; }
    T& operator[](std::size_t i) noexcept { return data_[i]; } // i < size()
    const T& operator[](std::size_t i) const noexcept { return data_[i]; }
};
// END owning-buffer

// BEGIN move-cast
struct TransferCounts { int copies = 0; int moves = 0; };
class TracedValue {
    TransferCounts* counts_;
    int value_;
public:
    TracedValue(TransferCounts& counts, int value) : counts_(&counts), value_(value) {}
    TracedValue(const TracedValue& other) : counts_(other.counts_), value_(other.value_) {
        ++counts_->copies;
    }
    TracedValue(TracedValue&& other) noexcept
        : counts_(other.counts_), value_(std::exchange(other.value_, -1)) {
        ++counts_->moves;
    }
    int value() const noexcept { return value_; }
};
inline void take_rvalue(TracedValue&& input, std::vector<TracedValue>& out) {
    out.push_back(input);            // input 是左值：复制
    out.push_back(std::move(input)); // 显式交出：移动
}
// const TracedValue c(...); TracedValue x(std::move(c)); 仍调用 const& 复制。
// 单独写 std::move(c) 不构造、不释放，也不搬运任何资源。
// END move-cast

// BEGIN vector-relocation
struct CopyableThrowingMove {
    TransferCounts* counts;
    int value;
    CopyableThrowingMove(TransferCounts& c, int v) : counts(&c), value(v) {}
    CopyableThrowingMove(const CopyableThrowingMove& x) : counts(x.counts), value(x.value) {
        ++counts->copies;
    }
    CopyableThrowingMove(CopyableThrowingMove&& x) noexcept(false)
        : counts(x.counts), value(x.value) { ++counts->moves; }
};
struct MoveOnlyThrowingMove {
    std::unique_ptr<int> value;
    explicit MoveOnlyThrowingMove(int n) : value(std::make_unique<int>(n)) {}
    MoveOnlyThrowingMove(const MoveOnlyThrowingMove&) = delete;
    MoveOnlyThrowingMove(MoveOnlyThrowingMove&& x) noexcept(false) {
        if (x.value && *x.value < 0) throw std::runtime_error("move rejected");
        value = std::move(x.value);
    }
};
inline void relocation_examples() {
    TransferCounts counts;
    std::vector<CopyableThrowingMove> a;
    a.emplace_back(counts, 1);
    a.reserve(a.capacity() + 1); // 此类可复制，复制可保留原数组直到整体成功
    std::vector<MoveOnlyThrowingMove> b;
    b.emplace_back(1);
    b.reserve(b.capacity() + 1); // 没有复制候选，可能抛异常的移动仍可使用
}
// END vector-relocation

// BEGIN value-return
struct Immovable {
    Immovable() = default;
    Immovable(const Immovable&) = delete;
    Immovable(Immovable&&) = delete;
};
inline Immovable make_immovable() { return Immovable{}; } // C++17 直接构造结果
inline std::string make_label() {
    std::string result = "ready";
    return result; // 允许 NRVO；未采用时再按返回语句规则考虑移动
    // return std::move(result); 会阻止这个 NRVO 候选。
}
// END value-return

// BEGIN owner-interfaces
struct Item { int value = 0; };
inline int inspect(const Item& item) noexcept { return item.value; } // 必有对象，只借用
inline int inspect_optional(const Item* item) noexcept { return item ? item->value : -1; }
inline std::unique_ptr<Item> make_item(int value) {
    return std::make_unique<Item>(Item{value});
}
inline int consume(std::unique_ptr<Item> owned) {
    return owned ? owned->value : -1; // 本调用取得独占所有权
}
inline void replace(std::unique_ptr<Item>& owned, int value) {
    auto next = make_item(value);
    owned = std::move(next); // 先创建成功，再替换
}
// END owner-interfaces

// BEGIN get-reset-release
inline int ownership_operations() {
    auto owner = make_item(3);
    Item* observer = owner.get(); // 不转移；只在 owner 未释放/替换时有效
    int saved = observer->value;
    owner.reset(new Item{4});     // 删除旧 Item；observer 此后不可再解引用
    Item* raw = owner.release();  // 不删除，owner 变空
    std::unique_ptr<Item> adopted(raw); // 将释放责任立即交给新 owner
    // owner.reset(owner.get());  // 错误：会删除仍被记录的同一对象
    return saved + adopted->value;
}
// END get-reset-release

// BEGIN custom-deleter
struct FileCloser {
    void operator()(std::FILE* file) const noexcept {
        if (file) std::fclose(file); // 析构路径只清理；错误报告走显式接口
    }
};
using File = std::unique_ptr<std::FILE, FileCloser>;
inline File open_file(const char* path, const char* mode) {
    File file(std::fopen(path, mode));
    if (!file) throw std::runtime_error("open failed");
    return file;
}
inline void checked_close(File& file) {
    std::FILE* raw = file.release(); // fclose 无论成功与否都不应再次关闭
    if (raw && std::fclose(raw) != 0) throw std::ios_base::failure("close failed");
}
// END custom-deleter

// BEGIN array-owner
inline std::unique_ptr<int[]> make_zero_array(std::size_t n) {
    return std::make_unique<int[]>(n); // 值初始化，元素为 0；配套 delete[]
}
// unique_ptr<int>(new int[n]) 错误：单对象 delete 与 new[] 不匹配。
// 有大小、复制和插入需求时直接选择 vector<int>，不要重复实现容器。
// END array-owner

// BEGIN c-output-owner
using CString = std::unique_ptr<char, decltype(&std::free)>;
inline CString acquire_c_text(int (*acquire)(char**)) {
    // 本例 API 契约：写入 nullptr 或可由 free 释放的指针，失败时也满足此约定。
    char* raw = nullptr;
    int status = acquire(&raw);
    CString owned(raw, &std::free); // 立刻接管，随后抛异常也清理
    if (status != 0) throw std::runtime_error("C API failed");
    return owned;
}
// 不能把 unique_ptr<T>* 强转成 T**。C++23 out_ptr/inout_ptr 是另一种适配接口。
// END c-output-owner

// BEGIN shared-alias
struct Document { std::string title; int version; };
inline std::shared_ptr<int> share_version(std::shared_ptr<Document> owner) {
    if (!owner) throw std::invalid_argument("document required");
    return std::shared_ptr<int>(owner, &owner->version); // 指向成员，共享 Document 所有权
}
template<class A, class B>
bool same_owner(const std::shared_ptr<A>& a, const std::shared_ptr<B>& b) noexcept {
    return !a.owner_before(b) && !b.owner_before(a);
}
// shared_ptr<int>(owner.get()) 不是共享原控制块，会造成重复释放。
// get() 比较的是存储指针；same_owner 比较的是控制块关系。
// END shared-alias

// BEGIN weak-owner
struct Node {
    int value = 0;
    std::vector<std::shared_ptr<Node>> children;
    std::weak_ptr<Node> parent;
};
inline std::shared_ptr<Node> attach(const std::shared_ptr<Node>& parent, int value) {
    auto child = std::make_shared<Node>();
    child->value = value;
    child->parent = parent; // 反向边不延长父节点寿命，避免拥有环
    parent->children.push_back(child);
    return child;
}
inline int parent_value(const Node& node) {
    if (auto owner = node.parent.lock()) return owner->value;
    return -1; // 已过期；不要先 expired() 再假定对象仍存在
}
// END weak-owner

// BEGIN shared-from-this
class Session : public std::enable_shared_from_this<Session> {
    Session() = default;
public:
    static std::shared_ptr<Session> create() {
        return std::shared_ptr<Session>(new Session);
    }
    std::shared_ptr<Session> share() { return shared_from_this(); }
    std::weak_ptr<Session> observe() noexcept { return weak_from_this(); }
    // 构造函数期间尚无有效的共享控制块；不能在那里调用 shared_from_this。
    // shared_ptr<Session>(this) 同样不是复用既有控制块。
};
// END shared-from-this

// BEGIN conditional-retain
class Retainer {
    std::shared_ptr<Item> held_;
public:
    int inspect_or_keep(const std::shared_ptr<Item>& item, bool keep) {
        if (keep) held_ = item; // 只有需要时才增加共享拥有者
        return item ? item->value : -1;
    }
    void set(std::shared_ptr<Item> item) { held_ = std::move(item); } // 总是取得一份拥有权
    void clear() noexcept { held_.reset(); }
};
// 纯观察仍用 const Item& / const Item*；只有“可能保留”才需要看到 shared_ptr。
// END conditional-retain

// BEGIN polymorphic-value
class Job {
public:
    virtual ~Job() = default;
    virtual std::string kind() const { return "base"; }
    virtual std::unique_ptr<Job> clone() const { return std::make_unique<Job>(*this); }
};
class RenderJob : public Job {
public:
    std::string kind() const override { return "render"; }
    std::unique_ptr<Job> clone() const override { return std::make_unique<RenderJob>(*this); }
};
inline std::string by_value(Job job) { return job.kind(); } // 传派生对象时发生切片
inline std::string by_reference(const Job& job) { return job.kind(); }
// END polymorphic-value

// BEGIN construction-dispatch
struct DispatchTrace {
    std::array<char, 4> calls{};
    std::size_t size = 0;
    void push(char c) noexcept { if (size < calls.size()) calls[size++] = c; }
};
class DispatchBase {
protected:
    DispatchTrace& trace_;
public:
    explicit DispatchBase(DispatchTrace& trace) : trace_(trace) { trace_.push(kind()); }
    virtual ~DispatchBase() { trace_.push(kind()); }
    virtual char kind() const noexcept { return 'B'; }
};
class DispatchDerived : public DispatchBase {
public:
    explicit DispatchDerived(DispatchTrace& trace) : DispatchBase(trace) { trace_.push(kind()); }
    ~DispatchDerived() override { trace_.push(kind()); }
    char kind() const noexcept override { return 'D'; }
};
// 完整构造再销毁：B D D B。基类构造/析构期间不向尚未构造/已销毁的派生部分分派。
// END construction-dispatch

// BEGIN constructor-failure
struct LifeCounts { int live = 0; int outer_destroyed = 0; };
class LiveGuard {
    LifeCounts& counts_;
public:
    explicit LiveGuard(LifeCounts& counts) noexcept : counts_(counts) { ++counts_.live; }
    ~LiveGuard() { --counts_.live; }
    LiveGuard(const LiveGuard&) = delete;
    LiveGuard& operator=(const LiveGuard&) = delete;
};
class ConstructorProbe {
    LifeCounts& counts_;
    LiveGuard first_;
public:
    ConstructorProbe(LifeCounts& counts, bool fail) : counts_(counts), first_(counts) {
        if (fail) throw std::runtime_error("construction failed");
    }
    ~ConstructorProbe() { ++counts_.outer_destroyed; }
};
// 构造函数体抛异常：first_ 已完整构造，自动析构；~ConstructorProbe 不执行。
// END constructor-failure

// BEGIN rethrow
class DomainError : public std::runtime_error {
public:
    int code;
    explicit DomainError(int value) : std::runtime_error("domain failure"), code(value) {}
};
inline void preserve_error() {
    try {
        throw DomainError(7);
    } catch (const std::exception&) {
        throw; // 原异常对象继续传播，保留 DomainError 和 code
        // throw e; 若 e 是 const std::exception&，按静态类型复制，发生切片。
    }
}
inline int classify_error() {
    try {
        preserve_error();
    } catch (const DomainError& e) {
        return e.code;            // 具体类型在前，避免复制异常对象
    } catch (const std::exception&) {
        return -1;
    } catch (...) {
        return -2;
    }
    return 0;
}
// END rethrow

} // namespace second_algorithm::objects
