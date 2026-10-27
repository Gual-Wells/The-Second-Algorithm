#include <algorithm>
#include <cstdio>
#include <cstddef>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

namespace second_algorithm::object_interfaces {

// BEGIN value-members
struct Record {
    std::string name;
    std::vector<int> values;
    int revision = 0;
}; // No manual lifetime code: members already own their resources.

inline Record copy_and_edit(const Record& source, std::string name) {
    Record result = source;
    result.name = std::move(name);
    return result;
}
// END value-members

// BEGIN borrowed-parameters
inline std::size_t value_count(const Record& record) noexcept {
    return record.values.size();
}
inline std::size_t optional_value_count(const Record* record) noexcept {
    return record ? record->values.size() : 0;
}
inline void append_value(Record& record, int value) {
    record.values.push_back(value);
}
// END borrowed-parameters

// BEGIN unique-parameters
inline std::unique_ptr<Record> make_record(std::string name) {
    auto result = std::make_unique<Record>();
    result->name = std::move(name);
    return result;
}
inline std::string consume_record(std::unique_ptr<Record> record) {
    if (!record) throw std::invalid_argument("record required");
    return std::move(record->name);
}
inline void replace_record(std::unique_ptr<Record>& target, std::string name) {
    auto prepared = make_record(std::move(name));
    target = std::move(prepared);
}
// END unique-parameters

// BEGIN named-rvalue
inline std::unique_ptr<Record> bind_only(std::unique_ptr<Record>&& input) {
    // Binding input alone has not moved ownership. This construction does.
    auto owned = std::move(input);
    return owned;
}
// END named-rvalue

// BEGIN unique-observers
inline int inspect_reset_release() {
    auto owner = std::make_unique<int>(7);
    int* observer = owner.get();  // Borrow only.
    const int saved = *observer;
    owner.reset(new int(9));      // Old observer is now invalid.
    int* released = owner.release(); // owner becomes empty; resource still alive.
    std::unique_ptr<int> adopted(released);
    return saved + *adopted;
}
// END unique-observers

// BEGIN owner-const
static_assert(std::is_same_v<
    decltype(*std::declval<const std::unique_ptr<int>&>()), int&>);
static_assert(std::is_same_v<
    decltype(*std::declval<const std::unique_ptr<const int>&>()), const int&>);

inline int const_owner_example() {
    const auto owner = std::make_unique<int>(3);
    *owner = 4;  // const owner, mutable owned object.
    return *owner;
}
// END owner-const

// BEGIN file-owner
struct CloseFile {
    void operator()(std::FILE* file) const noexcept {
        if (file) std::fclose(file);
    }
};
using File = std::unique_ptr<std::FILE, CloseFile>;

inline File open_file(const char* path, const char* mode) {
    File file(std::fopen(path, mode));
    if (!file) throw std::runtime_error("open failed");
    return file;
}
inline void close_checked(File& file) {
    auto* raw = file.release();
    if (raw && std::fclose(raw) != 0)
        throw std::runtime_error("close failed");
}
// END file-owner

// BEGIN unique-polymorphic
struct BaseRecord {
    virtual ~BaseRecord() = default;
    virtual int value() const = 0;
};
struct CountRecord : BaseRecord {
    int value() const override { return 7; }
};
inline std::unique_ptr<BaseRecord> make_polymorphic_record() {
    return std::make_unique<CountRecord>();
}
// END unique-polymorphic

// BEGIN int-buffer
class IntBuffer {
    std::size_t size_ = 0;
    std::unique_ptr<int[]> data_;
public:
    explicit IntBuffer(std::size_t size = 0)
        : size_(size), data_(size ? std::make_unique<int[]>(size) : nullptr) {}
    ~IntBuffer() = default;
    IntBuffer(const IntBuffer& source) : IntBuffer(source.size_) {
        if (size_) std::copy_n(source.data_.get(), size_, data_.get());
    }
    IntBuffer& operator=(const IntBuffer& source) {
        IntBuffer prepared(source);
        swap(prepared);
        return *this;
    }
    IntBuffer(IntBuffer&& source) noexcept
        : size_(std::exchange(source.size_, 0)), data_(std::move(source.data_)) {}
    IntBuffer& operator=(IntBuffer&& source) noexcept {
        if (this != &source) {
            data_ = std::move(source.data_);
            size_ = std::exchange(source.size_, 0);
        }
        return *this;
    }
    void swap(IntBuffer& other) noexcept {
        std::swap(size_, other.size_);
        data_.swap(other.data_);
    }
    std::size_t size() const noexcept { return size_; }
    int& at(std::size_t index) {
        if (index >= size_) throw std::out_of_range("buffer index");
        return data_[index];
    }
    const int& at(std::size_t index) const {
        if (index >= size_) throw std::out_of_range("buffer index");
        return data_[index];
    }
};
// END int-buffer

// BEGIN move-choice
struct CopyFallback {
    CopyFallback() = default;
    CopyFallback(const CopyFallback&) = default; // Suppresses implicit move.
};
struct MoveDeleted {
    MoveDeleted() = default;
    MoveDeleted(const MoveDeleted&) = default;
    MoveDeleted(MoveDeleted&&) = delete;
};
struct DefaultedMove {
    MoveDeleted member;
    DefaultedMove() = default;
    DefaultedMove(const DefaultedMove&) = default;
    DefaultedMove(DefaultedMove&&) = default; // Defined as deleted, then ignored.
};

inline IntBuffer copy_from_const(const IntBuffer& source) {
    return IntBuffer(std::move(source)); // const IntBuffer&& selects const& copy.
}
inline CopyFallback copy_from_rvalue(CopyFallback source) {
    return CopyFallback(std::move(source)); // No move candidate: copy is viable.
}
// MoveDeleted result(std::move(source)); is ill-formed: deleted move wins.
// END move-choice

// BEGIN move-if-noexcept
template<class T>
T relocate_one(T& source) {
    return T(std::move_if_noexcept(source));
}
// Copies a copyable T whose move may throw; moves when copy is unavailable.
// END move-if-noexcept

// BEGIN return-value
inline IntBuffer zeros(std::size_t count) {
    return IntBuffer(count); // C++17: no intervening IntBuffer copy/move.
}
inline IntBuffer filled(std::size_t count, int value) {
    IntBuffer result(count);
    for (std::size_t i = 0; i < count; ++i) result.at(i) = value;
    return result; // NRVO is permitted; otherwise move selection applies.
}
// END return-value

// BEGIN borrowed-view
inline std::string_view prefix_view(std::string_view text, std::size_t count) {
    return text.substr(0, std::min(count, text.size()));
}
inline std::string prefix_owned(std::string_view text, std::size_t count) {
    return std::string(prefix_view(text, count));
}
inline void append_exact(std::string& output, std::string_view part) {
    if (!part.empty()) output.append(part.data(), part.size());
}
// END borrowed-view

// BEGIN qualified-getter
class Message {
    std::string text_;
public:
    explicit Message(std::string text) : text_(std::move(text)) {}
    const std::string& text() const & noexcept { return text_; }
    std::string text() && { return std::move(text_); }
    std::string text() const && { return text_; }
};
// Lvalue access borrows; temporary access returns an owning value.
// END qualified-getter

// BEGIN shared-parameters
class RecordKeeper {
    std::shared_ptr<Record> retained_;
public:
    void retain(std::shared_ptr<Record> record) {
        retained_ = std::move(record);
    }
    void retain_if(const std::shared_ptr<Record>& record, bool keep) {
        if (keep) retained_ = record;
    }
    void clear() noexcept { retained_.reset(); }
    std::size_t size() const noexcept {
        return retained_ ? retained_->values.size() : 0;
    }
};
// END shared-parameters

// BEGIN weak-observer
inline std::optional<std::string> observed_name(const std::weak_ptr<Record>& observer) {
    if (auto owned = observer.lock()) return owned->name;
    return std::nullopt;
}
// END weak-observer

// BEGIN shared-alias
inline std::shared_ptr<int> share_revision(std::shared_ptr<Record> owner) {
    if (!owner) throw std::invalid_argument("record required");
    return std::shared_ptr<int>(owner, &owner->revision);
}
template<class A, class B>
bool same_owner(const std::shared_ptr<A>& a, const std::shared_ptr<B>& b) noexcept {
    return !a.owner_before(b) && !b.owner_before(a);
}
// END shared-alias

} // namespace second_algorithm::object_interfaces
