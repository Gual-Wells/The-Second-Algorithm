// Separately compiled file fragments, extracted by tools/verify_cpp_systems.py.
// Each BEGIN/END block is the source authority for one displayed fragment.
// They are not concatenated into a single translation unit.
#if 0

// BEGIN tu-client-a
// a.cpp
#include "state.hpp"
namespace second_algorithm::translation_examples {
int first() { return increment(); }
}
// END tu-client-a

// BEGIN tu-client-b
// b.cpp
#include "state.hpp"
namespace second_algorithm::translation_examples {
int second() { return increment(); }
}
// END tu-client-b

// BEGIN odr-bad-header
// state.hpp -- valid when included once in one TU, wrong as a shared definition.
#ifndef SECOND_ALGORITHM_STATE_HPP
#define SECOND_ALGORITHM_STATE_HPP
namespace second_algorithm::translation_examples {
int shared_count = 0;
int increment() { return ++shared_count; }
}
#endif
// END odr-bad-header

// BEGIN odr-declaration-header
// state.hpp
#ifndef SECOND_ALGORITHM_STATE_HPP
#define SECOND_ALGORITHM_STATE_HPP
namespace second_algorithm::translation_examples {
extern int shared_count;
int increment();
}
#endif
// END odr-declaration-header

// BEGIN odr-one-definition
// state.cpp
#include "state.hpp"
namespace second_algorithm::translation_examples {
int shared_count = 0;
int increment() { return ++shared_count; }
}
// END odr-one-definition

// BEGIN odr-inline-header
// state.hpp -- C++17
#ifndef SECOND_ALGORITHM_STATE_HPP
#define SECOND_ALGORITHM_STATE_HPP
namespace second_algorithm::translation_examples {
inline int shared_count = 0;
inline int increment() { return ++shared_count; }
}
#endif
// END odr-inline-header

// BEGIN odr-local-header
// state.hpp -- each TU gets its own state and function.
#ifndef SECOND_ALGORITHM_STATE_HPP
#define SECOND_ALGORITHM_STATE_HPP
namespace second_algorithm::translation_examples {
namespace {
int shared_count = 0;
int increment() { return ++shared_count; }
}
}
#endif
// END odr-local-header

// BEGIN hidden-definition
// hidden.cpp -- does not define the externally declared increment().
namespace second_algorithm::translation_examples {
namespace {
[[maybe_unused]] int increment() { return 99; }
}
}
// END hidden-definition

// BEGIN pimpl-header
// handle.hpp
#ifndef SECOND_ALGORITHM_HANDLE_HPP
#define SECOND_ALGORITHM_HANDLE_HPP
#include <memory>
namespace second_algorithm::translation_examples {
class Handle {
    struct Impl;
    std::unique_ptr<Impl> implementation_;
public:
    explicit Handle(int value);
    ~Handle();
    Handle(Handle&&) noexcept;
    Handle& operator=(Handle&&) noexcept;
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    int value() const noexcept;
};
}
#endif
// END pimpl-header

// BEGIN pimpl-definition
// handle.cpp
#include "handle.hpp"
namespace second_algorithm::translation_examples {
struct Handle::Impl {
    int value;
    explicit Impl(int initial) : value(initial) {}
};
Handle::Handle(int value)
    : implementation_(std::make_unique<Impl>(value)) {}
Handle::~Handle() = default;
Handle::Handle(Handle&&) noexcept = default;
Handle& Handle::operator=(Handle&&) noexcept = default;
int Handle::value() const noexcept {
    return implementation_ ? implementation_->value : 0;
}
}
// END pimpl-definition

// BEGIN feature-probe
// portability.hpp
#ifndef SECOND_ALGORITHM_PORTABILITY_HPP
#define SECOND_ALGORITHM_PORTABILITY_HPP
#include <cstddef>
#if __has_include(<version>)
#include <version>
#endif
#if defined(__cpp_lib_span) && __cpp_lib_span >= 202002L
#include <span>
namespace second_algorithm::translation_examples {
inline constexpr bool has_std_span = true;
inline int first_or_zero(const int* data, std::size_t size) {
    const std::span<const int> values(data, size);
    return values.empty() ? 0 : values.front();
}
}
#else
namespace second_algorithm::translation_examples {
inline constexpr bool has_std_span = false;
inline int first_or_zero(const int* data, std::size_t size) {
    return size == 0 ? 0 : data[0];
}
}
#endif
#endif
// END feature-probe

#endif
