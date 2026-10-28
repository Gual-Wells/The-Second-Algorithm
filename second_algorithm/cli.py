from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .catalog import report, search, validate
from .collect import collect
from .chapters import chapter_inputs, chapter_quality, render_chapters
from .learning import course_targets, search_learning, validate_learning
from .inquiry import (check_handoff, checkpoint, open_study, seal_handoff, study_status)
from .storage import now, read_json, read_jsonl, sources, valid_id, valid_url, write_json
from .workflow import (add_evidence, check_release, init_job, job_status, list_jobs, prepare_release,
                       resume_job, verify_course, verify_job)


def emit(value) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main(argv=None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="第二算法：来源与内容研究工具。结构检查不认证语义完备。")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="repository root")
    commands = parser.add_subparsers(dest="command", required=True)
    listing = commands.add_parser("sources", help="查看来源池，采用状态与研究进度分开")
    listing.add_argument("--priority", choices=["core", "extension"])
    listing.add_argument("--role")
    listing.add_argument("--id", dest="source_id")
    collecting = commands.add_parser("collect", help="读取一个登记入口的目录元数据，不读取题目正文")
    collecting.add_argument("source")
    collecting.add_argument("entry")
    collecting.add_argument("--timeout", type=int, default=30)
    collecting.add_argument("--accept-change", action="store_true", help="only after reviewing removed catalogue identities")
    commands.add_parser("validate", help="检查登记、身份、摘要、引用和真实承载位置")
    commands.add_parser("report", help="生成来源、已读与待处理情况，不生成全网覆盖率")
    searching = commands.add_parser("search", help="在自有来源/题目/模式/书目记录内作中英文子串检索")
    searching.add_argument("query")
    searching.add_argument("--kind", choices=["all", "source", "case", "pattern", "book", "inventory"], default="all")
    planning = commands.add_parser("query-plan", help="生成待执行查询计划；不会冒称已搜索")
    planning.add_argument("topic")
    proposal = commands.add_parser("propose-source", help="记录待核来源，不能自动提升为已采用/已读取")
    proposal.add_argument("id")
    proposal.add_argument("name")
    proposal.add_argument("url")
    proposal.add_argument("--reason", required=True)
    course = commands.add_parser("course", help="检查当前统一课程，不将旧案例/模式当作覆盖证据")
    course_commands = course.add_subparsers(dest="course_command", required=True)
    course_commands.add_parser("validate", help="校验Q主讲、前置、源码区域及验证目标关系")
    course_commands.add_parser("targets", help="输出当前登记的验证目标供CI使用")
    chapter_list = course_commands.add_parser("chapters", help="按人可读方式查看章节合同、承诺与真实缺口")
    chapter_list.add_argument("chapter", nargs="?")
    quality = course_commands.add_parser("quality", help="检查逐承诺审阅与当前输入身份，不自动评定教学质量")
    quality.add_argument("chapter", nargs="?")
    quality.add_argument("--json", action="store_true", dest="json_output")
    chapter_hash = course_commands.add_parser("chapter-inputs", help="供真实审阅绑定的当前输入摘要，排除审阅文件自身")
    chapter_hash.add_argument("chapter")
    course_search = course_commands.add_parser("search", help="检索当前Q、任务及实现记录")
    course_search.add_argument("query")
    course_verify = course_commands.add_parser("verify", help="用真实编译器验证所有登记目标")
    course_verify.add_argument("--compiler", help="内容发布必需；显式撤回不运行C++编译器")
    course_verify.add_argument("--output", default=".local/course-verification")
    research = commands.add_parser("research", help="显式研究任务与可恢复证据；不自动完成语义研究")
    research_commands = research.add_subparsers(dest="research_command", required=True)
    initializing = research_commands.add_parser("init")
    initializing.add_argument("job")
    initializing.add_argument("--goal", required=True)
    status = research_commands.add_parser("status")
    status.add_argument("job", nargs="?")
    resuming = research_commands.add_parser("resume")
    resuming.add_argument("job")
    opening = research_commands.add_parser("open-study", help="建立独立于正文的动态研究档案，不选择或编写章节")
    opening.add_argument("job")
    opening.add_argument("--chapter", required=True)
    studying = research_commands.add_parser("study-status", help="检查阶段链、当前资料、缺口及恢复动作")
    studying.add_argument("job")
    checkpointing = research_commands.add_parser("checkpoint", help="保存真实阶段研究及不可变输入快照")
    checkpointing.add_argument("job")
    checkpointing.add_argument("--phase", required=True,
                               choices=["overview", "scope", "collection", "synthesis", "scope-review", "resynthesis"])
    checkpointing.add_argument("--record", required=True)
    handing = research_commands.add_parser("seal-handoff", help="冻结当前研究交接；不等于完成教学或出版")
    handing.add_argument("job")
    handcheck = research_commands.add_parser("check-handoff", help="核验出版所绑定的完整研究链及当前资料")
    handcheck.add_argument("path")
    evidence = research_commands.add_parser("evidence")
    evidence.add_argument("job")
    evidence.add_argument("--kind", choices=["research", "review"], required=True)
    evidence.add_argument("--path", required=True)
    evidence.add_argument("--summary", required=True)
    evidence.add_argument("--outcome", choices=["accepted", "needs-work"], required=True)
    verifying = research_commands.add_parser("verify")
    verifying.add_argument("job")
    verifying.add_argument("--compiler", help="内容发布必需；显式撤回不运行C++编译器")
    preparing = research_commands.add_parser("prepare-release")
    preparing.add_argument("job")
    checking = research_commands.add_parser("check-release", help="部署前拒绝缺失、过期或改变的发布准备包")
    checking.add_argument("packet")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        if args.command == "sources":
            rows = sources(root)
            if args.priority:
                rows = [s for s in rows if s["priority"] == args.priority]
            if args.role:
                rows = [s for s in rows if args.role in s["roles"]]
            if args.source_id:
                row = next((s for s in rows if s["id"] == args.source_id), None)
                if row is None:
                    raise ValueError("Unknown source: " + args.source_id)
                emit(row)
            else:
                emit([{"id": s["id"], "name": s["name"], "priority": s["priority"], "admission": s["admission"]["state"], "roles": s["roles"], "entries": [e["id"] for e in s["entries"]], "actual_read_scope": s["verification"]["read_scope"]} for s in rows])
        elif args.command == "collect":
            if not 1 <= args.timeout <= 120:
                raise ValueError("timeout must be between 1 and 120 seconds")
            result = collect(root, args.source, args.entry, timeout=args.timeout, accept_change=args.accept_change)
            emit(result)
            return 0 if result["state"] in ("captured", "unchanged") else 2
        elif args.command == "validate":
            result = validate(root)
            result["scope"] = "historical-research-and-sources"
            if (root / "catalog/learning.json").exists():
                current = validate_learning(root)
                result["currentCourse"] = current
                result["ok"] = result["ok"] and current["ok"]
            emit(result)
            return 0 if result["ok"] else 1
        elif args.command == "report":
            result = {"historicalResearch": report(root), "currentCourse": validate_learning(root)}
            emit(result)
        elif args.command == "search":
            emit(search(root, args.query, args.kind))
        elif args.command == "query-plan":
            plans = read_json(root / "catalog/query-plans.json", {"topics": []})
            topic = next((p for p in plans["topics"] if p["id"] == args.topic), None)
            if topic is None:
                raise ValueError("Unknown topic; current plans: " + ", ".join(p["id"] for p in plans["topics"]))
            emit({"topic": topic, "generated_at": now(), "executed": False, "note": "A query plan is not search evidence. Record actual reads and results in the research task."})
        elif args.command == "propose-source":
            if not valid_id(args.id) or not valid_url(args.url):
                raise ValueError("A stable source ID and public HTTPS URL are required")
            if args.id in {s["id"] for s in sources(root)}:
                raise ValueError("Source already registered")
            path = root / "catalog/source-proposals.jsonl"
            rows = read_jsonl(path)
            if args.id in {s["id"] for s in rows}:
                raise ValueError("Source proposal already exists")
            item = {"id": args.id, "name": args.name, "url": args.url, "reason": args.reason, "proposed_at": now(), "state": "unverified", "read_scope": "none"}
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(item, ensure_ascii=False) + "\n")
            emit(item)
        elif args.command == "course":
            if args.course_command == "validate":
                result = validate_learning(root)
                emit(result)
                return 0 if result["ok"] else 1
            if args.course_command == "targets":
                emit(course_targets(root))
            elif args.course_command == "chapters":
                print(render_chapters(root, args.chapter))
            elif args.course_command == "chapter-inputs":
                emit(chapter_inputs(root, args.chapter))
            elif args.course_command == "quality":
                result = chapter_quality(root, args.chapter)
                if args.json_output:
                    emit(result)
                else:
                    for chapter in result["chapters"]:
                        print(chapter["title"] + "：" + ("审阅记录当前有效" if chapter["ok"] else "阻止发布"))
                        for error in chapter["errors"]:
                            print("- " + error)
                    for error in result.get("errors", []):
                        print("- " + error)
                    if result.get("operation") == "withdrawal":
                        print("显式撤回：不要求章节质量审阅。")
                    print("结构与审阅身份核验；不自动认证难度、完备性或用户掌握。")
                return 0 if result["ok"] else 1
            elif args.course_command == "search":
                emit(search_learning(root, args.query))
            elif args.course_command == "verify":
                result = verify_course(root, args.compiler, args.output)
                emit(result)
                return 0 if result["passed"] else 1
        elif args.command == "research":
            if args.research_command == "init":
                emit(init_job(root, args.job, args.goal))
            elif args.research_command == "status":
                emit(job_status(root, args.job) if args.job else list_jobs(root))
            elif args.research_command == "resume":
                emit(resume_job(root, args.job))
            elif args.research_command == "open-study":
                emit(open_study(root, args.job, args.chapter))
            elif args.research_command == "study-status":
                result = study_status(root, args.job)
                emit(result)
                return 0 if result["ok"] else 1
            elif args.research_command == "checkpoint":
                emit(checkpoint(root, args.job, args.phase, args.record))
            elif args.research_command == "seal-handoff":
                emit(seal_handoff(root, args.job))
            elif args.research_command == "check-handoff":
                result = check_handoff(root, args.path)
                emit(result)
                return 0 if result["ok"] else 1
            elif args.research_command == "evidence":
                emit(add_evidence(root, args.job, kind=args.kind, path=args.path,
                                  summary=args.summary, outcome=args.outcome))
            elif args.research_command == "verify":
                result = verify_job(root, args.job, args.compiler)
                emit(result)
                return 0 if result["passed"] else 1
            elif args.research_command == "prepare-release":
                emit(prepare_release(root, args.job))
            elif args.research_command == "check-release":
                emit(check_release(root, args.packet))
    except (ValueError, KeyError, OSError, TypeError, json.JSONDecodeError) as error:
        emit({"ok": False, "error": str(error)})
        return 1
    return 0
