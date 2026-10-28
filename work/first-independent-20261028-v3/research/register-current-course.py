"""One-time author registry for the independently researched interval chapter.

Writes structural relationships only. Does not accept chapter promises or review.
Run from the repository root after the author's Q identities have stabilized.
"""
import json
import re
from pathlib import Path

ROOT = Path.cwd()
BASE = "content/interval-decisions/区间上的取舍"
CPP = BASE + ".cpp"
DOC = "interval-decisions"
STANDARD = "https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf"


def put(path, value):
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def q(*numbers):
    return [f"Q{n:06d}" for n in numbers]


prerequisites = {
    27: [], 28: [27], 29: [27, 28], 30: [28, 29], 31: [29, 30], 32: [27, 28],
    33: [27, 29, 31], 34: [28, 29, 33], 35: [28, 29, 31, 33, 34],
    36: [28, 30, 31, 33], 37: [30, 31], 38: [29, 30, 31, 37], 39: [27, 28, 29, 32],
}
headings = dict(re.findall(r"(?m)^### (Q\d{6}) · (.+)$", (ROOT / (BASE + ".source.md")).read_text(encoding="utf-8")))
assert set(headings) == set(q(*prerequisites)), "Author Q identities changed; review semantic assignment first"
questions = [{"id": f"Q{n:06d}", "title": re.sub(r"`", "", headings[f"Q{n:06d}"]),
              "document": DOC, "anchor": f"q{n:06d}", "prerequisites": q(*p), "sources": [STANDARD]}
             for n, p in prerequisites.items()]


def implementation(identity, symbol, regions, knowledge, time, space="O(n) including retained input-order results", kind="manual"):
    return {"id": identity, "kind": kind, "source": CPP, "regions": regions, "symbol": symbol,
            "standard": "c++17", "questions": q(*knowledge), "complexity": {"time": time, "space": space},
            "target": "interval-independent"}


def task(identity, title, contract, urls, method_id, method_title, invariant, implementations):
    return {"id": identity, "title": title, "document": DOC, "contract": contract, "sourceUrls": urls,
            "methods": [{"id": method_id, "title": method_title, "invariant": invariant, "implementations": implementations}]}


basic = [27, 28, 29, 30, 31, 32]
tasks = [
    task("closed-union", "合并闭区间及覆盖信息复用",
         "LC56 closed intervals, endpoints touching merge; original n<=10000, endpoints 0..10000, start<=end. Reference allows empty input and bounded signed coordinates, returns sorted disjoint closed components, preserves caller input. Continuous length is r-l; integer point count r-l+1. Identity and multiplicity are intentionally discarded.",
         ["https://leetcode.com/problems/merge-intervals/"], "union-frontier", "累计最远右端、封口已完成分量",
         "After sorting starts, all output components except the last are final. The last records the entire connected component seen so far, including nested ranges.",
         [implementation("merge-closed", "merge_closed", ["merge_closed"], basic, "O(n log(n+1)) including input copy")]),
    task("insert-union", "向已有规范闭并集插入一区间",
         "LC57 sorted non-overlapping closed intervals, n<=10000, endpoints 0..100000, legal possibly empty input. Return the canonical union after insertion, preserving both caller inputs. Precondition prior ranges are already sorted and disjoint; not an arbitrary-input merge API.",
         ["https://leetcode.com/problems/insert-interval/"], "three-regions", "已知左侧、中间扩展、已知右侧",
         "Ranges strictly before added are final; intersecting/touching middle ranges only expand added; after the first remaining gap no later range can join it.",
         [implementation("insert-closed", "insert_closed", ["insert_closed"], basic, "O(n)")]),
    task("containment-existence", "保留原身份的包含与被包含存在性",
         "CSES2168: 1<=n<=200000, 1<=l<r<=1e9, no two identical intervals. Output two 0/1 arrays in original order. Reference permits empty input and singleton closed intervals but still excludes identical ranges; does not claim containment counts or duplicate-group semantics.",
         ["https://cses.fi/problemset/task/2168/"], "extreme-summaries", "同左端长段先、前缀max与后缀min",
         "Start ascending/end descending makes prior starts no later and later starts no earlier; prefix maximum end and suffix minimum end decide existential containment under the no-identical-input contract.",
         [implementation("containment-flags", "containment_flags", ["orders", "containment_flags"], basic, "O(n log(n+1))")]),
    task("occupancy-load", "所有请求必接时的并发峰值与负载容量",
         "CSES1619 has n<=200000, positive-duration visits, all arrival/departure times distinct, unit load. LC1094 has trips [passengers,from,to], half-open stops, n<=1000. Reference takes positive loads<=1e9, |coordinate|<=1e9, n<=200000, supports Closed singleton or nonempty HalfOpen intervals, returns peak<=2e14 without modifying input.",
         ["https://cses.fi/problemset/task/1619/", "https://leetcode.com/problems/car-pooling/"], "endpoint-events", "按端点政策安排增减事件",
         "Running sum equals active load after the current event. Closed starts precede ends at equal coordinates; HalfOpen ends precede starts. Peaks at a closed singleton must not disappear through net-delta aggregation.",
         [implementation("peak-load", "peak_load", ["peak_load"], basic + [33], "O(n log(n+1))")]),
    task("room-allocation", "最少资源数和一份实际房间安排",
         "CSES1164 n<=200000, closed stays 1<=a<=b<=1e9; same-day departure/arrival cannot reuse a room. Return minimum rooms and valid 1-based room labels in original order, any optimum allowed. Reference also supports positive-duration HalfOpen occupancy and empty input; caller unchanged.",
         ["https://cses.fi/problemset/task/1164/"], "earliest-release", "起点扫描与最早释放候选",
         "Each allocated room has exactly one last-release record. Reuse a compatible minimum release, otherwise current start witnesses overlap with all rooms and forces a new one. Feasible construction attains the depth lower bound.",
         [implementation("rooms-manual", "allocate_manual", ["release_min_heap", "allocate_manual"], basic + [33, 34], "O(n log(n+1)) total; heap repair worst O(log(r+1)); vector-backed push amortized O(log(r+1)), an expanding push can be O(r)"),
          implementation("rooms-adapter", "allocate_standard", ["allocate_standard"], basic + [33, 35], "O(n log(n+1)) total; heap comparisons O(log(r+1)), vector-backed push amortized O(log(r+1)) with possible O(r) expansion", kind="standard"),
          implementation("rooms-heap-algorithms", "allocate_heap_algorithms", ["allocate_heap_algorithms"], basic + [33, 36], "O(n log(n+1)) total; push_heap/pop_heap worst O(log(r+1)), separate vector push_back amortized O(1)", kind="standard")]),
    task("activity-selection", "最大场数、实际选择与最少删除",
         "CSES1629 complete movies, n<=200000, 1<=a<b<=1e9, touching may chain; LC435 permits duplicate and signed ranges and asks removals=n-maximum kept. Return original selected IDs in finish order, any maximum. Reference endpoint policy explicit; HalfOpen positive-duration, Closed allows singleton; empty yields empty.",
         ["https://cses.fi/problemset/task/1629/", "https://leetcode.com/problems/non-overlapping-intervals/"], "finish-exchange", "最早结束兼容选择",
         "A first minimum-finish request can replace the first request of some optimal count schedule without shrinking its future feasible set. Repeat on the compatible suffix; rewards are not part of this objective.",
         [implementation("choose-activities", "choose_activities", ["choose_activities"], basic, "O(n log(n+1))")]),
    task("interval-stabbing", "最少点命中全部闭区间",
         "LC452 n<=100000, -2^31<=start<end<=2^31-1, closed hits include both endpoints. Return a minimum set of hit coordinates; reference also permits empty and singleton closed input. Keep coordinates as long long, use direct comparisons, no subtraction comparator. Not continuous target covering.",
         ["https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/"], "right-end-hits", "最早结束未命中段的右端",
         "Move a required hit inside the earliest-ending unhit range to its right endpoint; no remaining previously hit range loses coverage. Triggering disjoint witness ranges give the matching lower bound.",
         [implementation("stabbing-points", "stabbing_points", ["stabbing_points"], basic, "O(n log(n+1))")]),
    task("continuous-cover", "最少片段覆盖连续目标并检测无解",
         "LC1024 clips may be cut/overlap, n<=100, endpoints 0..100 and time in 1..100. Reference target>0 and bounded signed endpoints, closed segments may be singleton. Return a minimum original-ID cover of [0,target], or {false,empty}; do not return a partial plan as success. LC1326 is a coordinate-to-interval reduction, not a new algorithm implementation.",
         ["https://leetcode.com/problems/video-stitching/", "https://leetcode.com/problems/minimum-number-of-taps-to-open-to-water-a-garden/"], "farthest-frontier", "看完可接候选再最远推进",
         "At each covered prefix, consume all starts<=covered, choose greatest end. This dominates all one-step reachable frontiers; consumed candidates cannot help beyond that frontier. Failure to advance proves an uncovered gap.",
         [implementation("minimum-cover", "minimum_cover", ["minimum_cover"], basic, "O(n log(n+1))")]),
    task("fixed-resources", "固定k同质资源的最大观看数",
         "CSES1632 1<=k<=n<=200000, 1<=start<end<=1e9, complete positive-duration movies, end<=next start. Reference allows k=0 and Closed singleton policy as separately explained. Return any maximum original-ID subset schedulable on k resources; no input modification, no weighted-resource claim.",
         ["https://cses.fi/problemset/task/1632/"], "latest-compatible-release", "结束排序与最大兼容前驱",
         "Maintain an optimal continuation consistent with the greedy processed prefix. Replace the chosen resource's first future movie when current is absent, or exchange entire future chains when present elsewhere. Latest compatible release preserves earlier-free resources; duplicate releases remain distinct.",
         [implementation("choose-k-resources", "choose_k_resources", ["choose_k_resources"], basic + [37, 38], "O(n log(n+1)+n log(k+1))", "O(n+k) including output and sorting copy")]),
    task("weighted-intervals", "单资源最大收益与计划恢复",
         "CSES1140 n<=200000, closed day ranges and reward<=1e9 so total<=2e14; LC1235 n<=50000, positive durations/rewards<=10000, touching compatible, result<=5e8. Reference permits zero reward/empty input and returns optimal long long reward plus legal original-ID plan, ties arbitrary. Two implementations differ only in predecessor search.",
         ["https://cses.fi/problemset/task/1140/", "https://leetcode.com/problems/maximum-profit-in-job-scheduling/"], "prefix-dp", "兼容前缀的选择或跳过",
         "After finish sorting, selecting i permits exactly the compatible prefix p(i); best[i]=max(best[i-1],reward[i]+best[p(i)]). Predecessor is counted only among earlier jobs, strictness follows endpoint policy, traceback uses original IDs.",
         [implementation("weighted-manual", "weighted_manual", ["compatible_prefix_manual", "weighted_core", "weighted_manual"], basic + [37], "O(n log(n+1))"),
          implementation("weighted-library-bound", "weighted_standard", ["compatible_prefix_standard", "weighted_core", "weighted_standard"], basic + [37], "O(n log(n+1))", kind="standard")]),
    task("budgeted-value", "至多k项预算的单资源最大收益",
         "LC1751 closed inclusive days, 1<=k<=n and n*k<=1e6, each value<=1e6, n may reach1e6. At most k is not exactly k and not k simultaneous resources. Return value only, no traceback claim. k<=1000 implies original int result<=1e9; reference returns long long and permits empty/k=0.",
         ["https://leetcode.com/problems/maximum-number-of-events-that-can-be-attended-ii/"], "budget-prefix-dp", "预算层与前缀状态的依赖顺序",
         "For budget c, current[i]=max(current[i-1],reward[i]+previous[p(i)]). previous belongs to c-1, not the current budget; process prefix ascending and swap whole layers after all i. Arbitrary p(i) prevents rolling only adjacent job rows.",
         [implementation("bounded-weighted", "bounded_weighted", ["bounded_weighted"], basic + [37], "O(n log(n+1)+n*min(k,n))", "O(n) for ordering, predecessors and two budget layers")]),
    task("offline-interval-query", "每个查询点的最短原闭区间",
         "LC1851 intervals and queries each<=100000, closed integer endpoints/queries in1..1e7; length=end-start+1, missing=-1, restore query order. Reference allows empty and repeated queries, preserves inputs, uses bounded signed coordinates with long long lengths. Not shortest component of a merged union; requires all queries known before processing.",
         ["https://leetcode.com/problems/minimum-interval-to-include-each-query/"], "offline-candidate-heap", "左端纳入、长度优先、右端永久过期",
         "Nondecreasing queries admit all starts<=q. Before answering, discard expired heap tops; any valid top is no longer than a buried candidate. Expiry is permanent only because queries are ordered, and answers return to original IDs.",
         [implementation("minimum-query-lengths", "minimum_query_lengths", ["minimum_query_lengths"], basic + [33, 35], "O(n log(n+1)+m log(m+1)+(n+m)log(n+1))", "O(n+m)")]),
]

targets = [{"id": "interval-independent", "kind": "run", "source": "tests/cpp/interval_decisions_test.cpp", "standard": "c++17", "timeoutSeconds": 120}]
for suffix in ["MOVIE", "ROOMS", "PROJECTS", "CUSTOMERS", "MOVIE_II", "NESTED"]:
    targets.append({"id": "interval-" + suffix.lower().replace("_", "-") + "-entry", "kind": "compile", "source": "tests/cpp/interval_entry.cpp",
                    "standard": "c++17", "timeoutSeconds": 90, "defines": ["INTERVAL_" + suffix]})
for number in [56, 57, 435, 452, 1024, 1235, 1851, 1094, 1751]:
    targets.append({"id": f"interval-lc{number}-adapter", "kind": "run", "source": "tests/cpp/interval_adapter_test.cpp",
                    "standard": "c++17", "timeoutSeconds": 90, "defines": [f"INTERVAL_LC{number}"]})

put("catalog/learning.json", {"schemaVersion": 1, "questions": questions, "tasks": tasks, "targets": targets})
put("carrier/publications.json", {"schemaVersion": 2, "state": "active", "collections": [{"id": DOC,
    "title": "区间上的取舍：覆盖、冲突与收益", "kind": "chapter", "visibility": "published", "chapterNumber": 1,
    "documents": [{"id": DOC, "title": "区间上的取舍", "path": BASE}]}]})
put("catalog/chapters.json", {"schemaVersion": 1, "chapters": [{"id": DOC, "collection": DOC,
    "contract": "content/interval-decisions/chapter.contract.json", "review": "content/interval-decisions/chapter.review.json"}]})
print(json.dumps({"questions": len(questions), "tasks": len(tasks), "implementations": sum(len(m["implementations"]) for t in tasks for m in t["methods"]), "targets": len(targets)}, ensure_ascii=False))
