#!/usr/bin/env python3
"""Check an adventure-reader book.json against the 小小冒险家 chapter contract."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCENES = {1, 2, 3, 4, 5, 6, 7, 8, 101, 102, 103, 104, 105, 106}
POS = {"n.", "v.", "adj.", "adv.", "phr."}
KINDS = {"vocab", "grammar"}
WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def words(text: str) -> list[str]:
    return [item.lower() for item in WORD.findall(text or "")]


def contains_term(text: str, term: str) -> bool:
    hay = f" {' '.join(words(text))} "
    needle = " ".join(words(term))
    return bool(needle) and f" {needle} " in hay


def check_bilingual(errors: list[str], node: object, where: str) -> None:
    if not isinstance(node, dict):
        fail(errors, f"{where} 必须是 {{en, zh}}")
        return
    if not str(node.get("en") or "").strip():
        fail(errors, f"{where}.en 为空")
    if not str(node.get("zh") or "").strip():
        fail(errors, f"{where}.zh 为空")
    if re.search(r"[\u4e00-\u9fff]", str(node.get("en") or "")):
        fail(errors, f"{where}.en 里不能夹中文")


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip()).lower()


def filled(sentence: str, answer: str) -> str:
    return str(sentence or "").replace("____", str(answer or ""), 1)


def check_recall(errors: list[str], chapter: dict, where: str) -> None:
    game = chapter.get("game")
    if not isinstance(game, dict):
        fail(errors, f"{where} 缺少 game")
        return
    if game.get("nodes") or game.get("start"):
        fail(errors, f"{where}.game 不要再写小游戏节点，章末只保留 recall")
    for key in ("title", "zh"):
        if not str(game.get(key) or "").strip():
            fail(errors, f"{where}.game.{key} 为空")
    check_bilingual(errors, game.get("intro"), f"{where}.game.intro")
    recall = game.get("recall")
    paragraphs = chapter.get("paragraphs") if isinstance(chapter.get("paragraphs"), list) else []
    vocab = chapter.get("vocab") if isinstance(chapter.get("vocab"), list) else []
    if not isinstance(recall, list) or not recall:
        fail(errors, f"{where}.game.recall 不能为空")
        return
    expected = len(vocab) + len(paragraphs)
    if len(recall) != expected:
        fail(errors, f"{where}.game.recall 应该是 {len(vocab)} 个单词加 {len(paragraphs)} 个语法，现在是 {len(recall)}")
    seen_ids: set[str] = set()
    vocab_items = []
    grammar_items = []
    for index, item in enumerate(recall):
        loc = f"{where}.game.recall[{index}]"
        if not isinstance(item, dict):
            fail(errors, f"{loc} 不是对象")
            continue
        kind = item.get("kind")
        if kind not in KINDS:
            fail(errors, f"{loc}.kind 只能是 vocab 或 grammar")
        item_id = str(item.get("id") or "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", item_id):
            fail(errors, f"{loc}.id 必须是小写短横线")
        elif item_id in seen_ids:
            fail(errors, f"{loc}.id 重复")
        else:
            seen_ids.add(item_id)
        if not str(item.get("prompt") or "").strip() or not str(item.get("hint") or "").strip():
            fail(errors, f"{loc} 需要 prompt 和 hint")
        sentence = str(item.get("sentence") or "")
        answer = str(item.get("answer") or "").strip()
        if sentence.count("____") != 1:
            fail(errors, f"{loc}.sentence 必须正好有一个 ____")
        if not answer or "____" in answer or re.search(r"[\u4e00-\u9fff]", answer):
            fail(errors, f"{loc}.answer 必须是挖掉的英文")
        elif not (1 <= len(answer.split()) <= 5):
            fail(errors, f"{loc}.answer 挖空控制在 1–5 个词")
        if kind == "vocab":
            vocab_items.append(item)
        elif kind == "grammar":
            grammar_items.append(item)
    if vocab_items and grammar_items and recall.index(grammar_items[0]) < recall.index(vocab_items[-1]):
        fail(errors, f"{where}.game.recall 先写完全部单词，再写语法")
    if len(vocab_items) != len(vocab) or len(grammar_items) != len(paragraphs):
        fail(errors, f"{where}.game.recall 的单词题和语法题数量不对")
        return
    blob = " ".join(str(p.get("en") or "") for p in paragraphs if isinstance(p, dict))
    for index, (item, word) in enumerate(zip(vocab_items, vocab)):
        loc = f"{where}.game.recall 单词[{index}]"
        if not isinstance(word, dict) or squash(item.get("answer")) != squash(word.get("w")):
            fail(errors, f"{loc} 的答案必须就是核心词 {word.get('w') if isinstance(word, dict) else ''}")
        elif squash(filled(item.get("sentence"), item.get("answer"))) != squash(word.get("eg")):
            fail(errors, f"{loc} 填回答案后必须等于该词的例句")
        elif not contains_term(blob, str(item.get("answer") or "")):
            fail(errors, f"{loc} 的答案没有出现在本章英文里")
    for index, (item, paragraph) in enumerate(zip(grammar_items, paragraphs)):
        loc = f"{where}.game.recall 语法[{index}]"
        source = paragraph.get("en") if isinstance(paragraph, dict) else ""
        if squash(filled(item.get("sentence"), item.get("answer"))) != squash(source):
            fail(errors, f"{loc} 填回答案后必须等于这一句英文")
        elif not contains_term(blob, str(item.get("answer") or "")):
            fail(errors, f"{loc} 的答案没有出现在本章英文里")


def check_book(book: object) -> list[str]:
    errors: list[str] = []
    if not isinstance(book, dict):
        return ["根节点必须是对象"]
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", str(book.get("id") or "")):
        fail(errors, "id 必须是小写 kebab-case")
    check_bilingual(errors, (book.get("book") or {}).get("quote") if isinstance(book.get("book"), dict) else None, "book.quote")
    chapters = book.get("chapters")
    if not isinstance(chapters, list) or not chapters:
        fail(errors, "chapters 不能为空")
        return errors
    for index, chapter in enumerate(chapters, start=1):
        where = f"chapters[{index}]"
        if not isinstance(chapter, dict):
            fail(errors, f"{where} 不是对象")
            continue
        if chapter.get("id") != index:
            fail(errors, f"{where}.id 必须是 {index}")
        if chapter.get("scene") not in SCENES:
            fail(errors, f"{where}.scene 必须是已有布景编号")
        paragraphs = chapter.get("paragraphs")
        if not isinstance(paragraphs, list) or not (4 <= len(paragraphs) <= 12):
            fail(errors, f"{where} 需要 4–12 句")
            paragraphs = paragraphs if isinstance(paragraphs, list) else []
        blob = " ".join(str(p.get("en") or "") for p in paragraphs if isinstance(p, dict))
        for p_index, paragraph in enumerate(paragraphs):
            loc = f"{where}.paragraphs[{p_index}]"
            if not isinstance(paragraph, dict):
                fail(errors, f"{loc} 不是对象")
                continue
            check_bilingual(errors, paragraph, loc)
            grammar = paragraph.get("grammar")
            if not isinstance(grammar, dict) or not str(grammar.get("title") or "").strip() or not str(grammar.get("explain") or "").strip():
                fail(errors, f"{loc}.grammar 需要 title 和 explain")
        vocab = chapter.get("vocab")
        if not isinstance(vocab, list) or not (4 <= len(vocab) <= 8):
            fail(errors, f"{where} 需要 4–8 个核心词")
            vocab = vocab if isinstance(vocab, list) else []
        for v_index, item in enumerate(vocab):
            loc = f"{where}.vocab[{v_index}]"
            if not isinstance(item, dict):
                fail(errors, f"{loc} 不是对象")
                continue
            if item.get("pos") not in POS:
                fail(errors, f"{loc}.pos 不在 n./v./adj./adv./phr. 里")
            if not contains_term(blob, str(item.get("w") or "")):
                fail(errors, f"{loc} 的 {item.get('w')!r} 没有出现在本章英文里")
        quiz = chapter.get("quiz")
        if not isinstance(quiz, list) or len(quiz) != 2:
            fail(errors, f"{where} 需要恰好 2 道题")
        else:
            for q_index, item in enumerate(quiz):
                options = item.get("options") if isinstance(item, dict) else None
                if not isinstance(item, dict) or not isinstance(options, list) or len(options) != 3:
                    fail(errors, f"{where}.quiz[{q_index}] 需要 3 个选项")
                    continue
                if item.get("answer") not in (0, 1, 2):
                    fail(errors, f"{where}.quiz[{q_index}].answer 必须是 0、1 或 2")
        check_recall(errors, chapter, where)
    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("用法: python validate.py book.json", file=sys.stderr)
        return 2
    path = Path(argv[1])
    try:
        book = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"无法读取 {path}: {exc}")
        return 1
    errors = check_book(book)
    if errors:
        print(f"{path} 未通过，{len(errors)} 个问题：")
        for item in errors:
            print(f"- {item}")
        return 1
    chapters = book["chapters"]
    blanks = sum(len(chapter["game"]["recall"]) for chapter in chapters)
    print(f"通过：{book['id']} · {len(chapters)} 章 · 每句含中文与语法 · 章末填空 {blanks} 题")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
