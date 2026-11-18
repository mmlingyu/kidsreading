"""Original book-only gates extracted from uploaded quality_review.py. No Studio/security/other skills imports."""
import importlib.util,json,shutil,subprocess
from pathlib import Path
BASE_DIR=Path(__file__).resolve().parent.parent

def _report_gate(outputs: Path, errors: list[str], evidence: list[str]) -> None:
    report = outputs / "report.md"
    if not report.is_file() or report.stat().st_size < 80:
        errors.append("缺少有效的 outputs/report.md Review 报告")
    else:
        evidence.append(f"Review 报告：{report.name}（{report.stat().st_size} bytes）")

def _book_checker():
    path = BASE_DIR / "skills" / "adventure-reader" / "scripts" / "validate.py"
    spec = importlib.util.spec_from_file_location("adventure_reader_validate", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("找不到 adventure-reader 校验脚本")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def _review_book(outputs: Path, errors: list[str], evidence: list[str]) -> None:
    book_path = outputs / "book.json"
    if not book_path.is_file() or book_path.stat().st_size < 80:
        errors.append("缺少 outputs/book.json")
        return
    try:
        book = json.loads(book_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        errors.append("outputs/book.json 不是合法 JSON")
        return
    problems = _book_checker().check_book(book)
    if problems:
        errors.extend(problems[:12])
        if len(problems) > 12:
            errors.append(f"另外还有 {len(problems) - 12} 个校验问题")
        return
    chapters = book.get("chapters") if isinstance(book, dict) else []
    evidence.append(f"书稿：{book.get('id')} · {len(chapters)} 章")
    node = shutil.which("node")
    script = BASE_DIR / "skills" / "adventure-reader" / "scripts" / "playtest.js"
    if not node or not script.is_file():
        errors.append("本机没有 node，填空自测没有运行")
        return
    try:
        proc = subprocess.run(
            [node, str(script), str(book_path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        errors.append(f"填空自测没有跑完：{exc}")
        return
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "填空自测失败").strip().splitlines()
        errors.append((tail[-1] if tail else "填空自测失败")[:300])
        return
    line = (proc.stdout or "填空自测通过").strip().splitlines()
    evidence.append((line[-1] if line else "填空自测通过")[:200])

def revision_prompt(project: dict, report: dict, attempt: int) -> str:
    errors = "\n".join(f"- {item}" for item in report.get("errors") or [])
    construction = (
        "这是第二次也是最后一次自动修订；图像任务必须改变失败部分的构造，不能只改形容词。\n"
        if attempt >= 2
        else ""
    )
    return (
        f"产物 Review 未通过，请修订 outputs/ 中的交付物。\n{construction}"
        f"必须修复：\n{errors}\n"
        "不要重写计划；直接检查真实文件并修复。保留旧版本，更新最终产物与 report.md。"
    )

