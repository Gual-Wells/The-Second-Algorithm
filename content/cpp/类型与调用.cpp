#include <array>
#include <cstddef>
#include <cstdint>
#include <initializer_list>
#include <istream>
#include <limits>
#include <memory>
#include <optional>
#include <ostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

namespace second_algorithm::calls {

// BEGIN init-forms
struct Record { int count; };
struct UserCtor {
    int count;
    UserCtor() {} // 用户提供构造函数；UserCtor{} 不保证 count 为 0
};
inline void initialization_examples() {
    int zero{};                 // 0
    Record r{};                 // count == 0
    std::vector<int> a(3, 7);    // {7, 7, 7}
    std::vector<int> b{3, 7};    // {3, 7}
    std::vector<int> c{};        // 空容器
    // int x;                   // 自动局部对象，未初始化；不能读取
    // std::vector<int> d();     // 函数声明，不是空 vector
    // int narrow{3.5};          // 窄化，编译错误
    (void)zero; (void)r; (void)a; (void)b; (void)c;
}
// END init-forms

// BEGIN list-owner
inline std::vector<std::unique_ptr<int>> make_owned_values() {
    std::vector<std::unique_ptr<int>> values;
    values.reserve(2);
    values.push_back(std::make_unique<int>(10));
    values.push_back(std::make_unique<int>(20));
    return values;
    // vector<unique_ptr<int>>{make_unique<int>(10)} 不成立：
    // initializer_list 的元素是 const，不能从中移动 unique_ptr。
}
// END list-owner

// BEGIN auto-deduction
inline void deduction_examples() {
    const int n = 7;
    auto value = n;             // int：去掉顶层 const 和引用
    auto& alias = n;            // const int&
    const int* const ptr = &n;
    auto p = ptr;               // const int*：只去掉指针自身的 const
    int a[3]{};
    auto decayed = a;           // int*
    auto& whole = a;            // int (&)[3]
    auto one{1};               // int，C++17
    auto list = {1};            // initializer_list<int>
    // auto mixed = {1, 2.0};   // 无法推导同一个元素类型
    auto&& lref = value;        // int&，引用折叠
    auto&& rref = 7;            // int&&；变量表达式 rref 本身仍是左值
    static_assert(std::is_same_v<decltype(value), int>);
    static_assert(std::is_same_v<decltype(alias), const int&>);
    static_assert(std::is_same_v<decltype(p), const int*>);
    static_assert(std::is_same_v<decltype(decayed), int*>);
    static_assert(std::is_same_v<decltype(whole), int (&)[3]>);
    static_assert(std::is_same_v<decltype(one), int>);
    static_assert(std::is_same_v<decltype(list), std::initializer_list<int>>);
    static_assert(std::is_same_v<decltype(lref), int&>);
    static_assert(std::is_same_v<decltype(rref), int&&>);
    (void)rref;
}
// END auto-deduction

// BEGIN decltype-return
inline auto copy_first(std::vector<int>& a) { return a.at(0); } // int
inline decltype(auto) borrow_first(std::vector<int>& a) {
    return a.at(0);                                           // int&
}
inline void decltype_examples() {
    int n = 1;
    static_assert(std::is_same_v<decltype(n), int>);
    static_assert(std::is_same_v<decltype((n)), int&>);
    // decltype(auto) bad() { int x=1; return (x); }
    // 推导为 int&，返回悬空引用；换成 auto 或 return x 才是值。
    (void)n;
}
// END decltype-return

// BEGIN explicit-null
class Count {
    int n_;
public:
    explicit Count(int n) : n_(n) {}
    explicit operator bool() const noexcept { return n_ != 0; }
    int value() const noexcept { return n_; }
};
inline int select(int) { return 1; }
inline int select(const char*) { return 2; }
inline bool has_items(Count c) {
    if (c) return true;    // 上下文 bool 转换接受 explicit operator bool
    return false;
    // bool b = c;        // 不接受隐式转换
    // Count n = 3;       // 不接受 explicit 构造函数
}
// select(0) == 1：0 是 int，精确匹配优先。
// select(nullptr) == 2：nullptr 不能隐式转成 int。
// nullptr 可转换成多种指针；f(int*) 与 f(double*) 仍可能歧义。
// END explicit-null

// BEGIN integer-width
inline std::int64_t product(int a, int b) {
    static_assert(std::numeric_limits<int>::digits <= 31, "requires at most 32-bit int");
    return std::int64_t{a} * b; // 先提升再乘；假定 int 不超过 32 位
}
inline bool valid_index(std::ptrdiff_t i, std::size_t size) {
    using U = std::make_unsigned_t<std::ptrdiff_t>;
    return i >= 0 && static_cast<U>(i) < size;
}
inline int nonnegative_mod(int x, int p) { // p > 0
    if (p <= 0) throw std::invalid_argument("positive modulus required");
    int r = x % p;
    return r < 0 ? r + p : r; // 避免 (r+p)%p 在 r>=0 时多做一次潜在溢出加法
}
inline bool is_odd(int x) noexcept { return x % 2 != 0; }
// END integer-width

// BEGIN bit-width
inline std::uint64_t bit_mask(unsigned position) {
    if (position >= 64) throw std::out_of_range("bit position");
    return std::uint64_t{1} << position;
}
inline std::uint64_t low_bits(unsigned count) {
    if (count > 64) throw std::out_of_range("bit count");
    if (count == 64) return std::numeric_limits<std::uint64_t>::max();
    return (std::uint64_t{1} << count) - 1;
}
// END bit-width

// BEGIN sequencing
inline std::pair<int, int> pair_values(int a, int b) { return {a, b}; }
inline std::pair<int, int> next_pair(int& next) {
    int first = next++;
    int second = next++;
    return pair_values(first, second); // 明确 first 在前，避免依赖实参求值顺序
}
inline std::array<int, 2> braced_next(int& next) {
    return {next++, next++}; // 初始化列表的子句从左到右
}
// C++17: pair_values(next++, next++) 两个实参的初始化不交错，
// 但谁先求值未指定，可能得到 (0,1) 或 (1,0)。不能把前者写成接口契约。
// END sequencing

// BEGIN ref-lifetime
inline const std::string& identity(const std::string& text) { return text; }
inline std::string_view prefix(const std::string& owner, std::size_t n) {
    return std::string_view(owner).substr(0, n); // 结果借用 owner
}
inline void borrowing_examples() {
    const std::string& extended = std::string("alive"); // 临时量活到引用作用域末尾
    std::string owner = "abcdef";
    std::string_view view = prefix(owner, 3);            // owner 仍在且未使 view 失效
    std::string saved = identity(std::string("copied")); // 分号前完成复制，安全
    // const auto& bad = identity(std::string("dead"));
    // 分号后临时量已销毁：函数形参/返回引用不会再次延长寿命。
    // auto bad_view = prefix(std::string("dead"), 2);   // 同理悬空
    (void)extended; (void)view; (void)saved;
}
// END ref-lifetime

// BEGIN ref-accessor
class Text {
    std::string data_;
public:
    explicit Text(std::string data) : data_(std::move(data)) {}
    std::string& data() & noexcept { return data_; }
    const std::string& data() const & noexcept { return data_; }
    std::string data() && { return std::move(data_); } // 临时对象交出一个值
    std::string data() const && { return data_; }     // const 右值只能复制
};
// auto& a = object.data()：借用；auto b = object.data()：复制。
// auto kept = Text("abc").data()：拥有自己的字符串，不借用已销毁的 Text。
// END ref-accessor

// BEGIN member-init
class Batch {
    const std::size_t size_;       // 按声明顺序初始化
    std::vector<int> values_;
    int& audit_count_;            // 引用成员必须在初始化列表绑定
public:
    Batch(std::size_t size, int& audit)
        : size_(size), values_(size_, 0), audit_count_(audit) {
        ++audit_count_;
    }
    explicit Batch(int& audit) : Batch(4, audit) {} // 委托时不再列其他成员
    std::size_t size() const noexcept { return size_; }
};
// END member-init

// BEGIN deleted-overload
inline int exact_index(int n) { return n; }
inline int exact_index(double) = delete; // 拦住 double -> int 的隐式截断
// exact_index(2.5) 命中被删除的精确匹配，不会再退回 int 版本。
// 它并不拦住所有其他数值类型；要表达更广的类型约束需另设受约束接口。
// END deleted-overload

// BEGIN ipv4-value
class IPv4 {
    std::uint32_t value_ = 0;
public:
    IPv4() = default;
    explicit IPv4(std::uint32_t value) : value_(value) {}
    IPv4(unsigned a, unsigned b, unsigned c, unsigned d) {
        if (a > 255 || b > 255 || c > 255 || d > 255)
            throw std::out_of_range("IPv4 octet");
        value_ = (std::uint32_t{a} << 24) | (std::uint32_t{b} << 16)
               | (std::uint32_t{c} << 8) | d;
    }
    std::uint32_t value() const noexcept { return value_; }
    IPv4& operator++() noexcept { ++value_; return *this; } // 模 2^32 递增
    IPv4 operator++(int) noexcept { IPv4 old = *this; ++*this; return old; }
    friend bool operator==(IPv4 a, IPv4 b) noexcept { return a.value_ == b.value_; }
    friend bool operator<(IPv4 a, IPv4 b) noexcept { return a.value_ < b.value_; }
};
inline std::ostream& operator<<(std::ostream& out, IPv4 a) {
    auto x = a.value();
    return out << ((x >> 24) & 255) << '.' << ((x >> 16) & 255) << '.'
               << ((x >> 8) & 255) << '.' << (x & 255);
}
// END ipv4-value

// BEGIN ipv4-parse
inline std::istream& operator>>(std::istream& in, IPv4& target) {
    int a = 0, b = 0, c = 0, d = 0;
    char s1 = 0, s2 = 0, s3 = 0;
    if (!(in >> a >> s1 >> b >> s2 >> c >> s3 >> d)) return in;
    auto octet = [](int x) { return 0 <= x && x <= 255; };
    if (s1 != '.' || s2 != '.' || s3 != '.' ||
        !octet(a) || !octet(b) || !octet(c) || !octet(d)) {
        in.setstate(std::ios::failbit);
        return in;
    }
    target = IPv4(static_cast<unsigned>(a), static_cast<unsigned>(b),
                  static_cast<unsigned>(c), static_cast<unsigned>(d));
    return in;
}
inline std::optional<IPv4> parse_ipv4_record(const std::string& text) {
    std::istringstream in(text);
    IPv4 a;
    if (!(in >> a)) return std::nullopt;
    in >> std::ws;
    if (!in.eof()) return std::nullopt; // 整条记录不能留下尾随内容
    return a;
}
// END ipv4-parse

// BEGIN ipv4-range
template<class Visit>
void for_each_address(IPv4 first, IPv4 last, Visit visit) {
    if (last < first) throw std::invalid_argument("reversed IPv4 range");
    for (IPv4 current = first;; ++current) {
        visit(current);
        if (current == last) break; // 在 ++ 之前停止，last==2^32-1 也不会回绕
    }
}
// END ipv4-range

} // namespace second_algorithm::calls
