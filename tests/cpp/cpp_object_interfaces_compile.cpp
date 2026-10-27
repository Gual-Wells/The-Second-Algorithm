#include "../../content/cpp-object-interfaces/对象如何传递.cpp"
namespace oi = second_algorithm::object_interfaces;
#if defined(PROBE_DELETED_MOVE)
int main() { oi::MoveDeleted source; oi::MoveDeleted target(std::move(source)); }
#elif defined(PROBE_CONST_UNIQUE)
int main() {
    const auto source = std::make_unique<int>(1);
    auto target = std::move(source);
}
#elif defined(PROBE_NAMED_UNIQUE)
void take(std::unique_ptr<int>&& source) { auto target = source; }
int main() {}
#else
int main() {
    oi::CopyFallback source;
    oi::CopyFallback target(std::move(source));
    oi::DefaultedMove other;
    oi::DefaultedMove copied(std::move(other));
    (void)target; (void)copied;
}
#endif
