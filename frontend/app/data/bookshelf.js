// 书架注册表：内置书写在这里。adventure-reader 生成的书从本机导入，不改这个文件。
// 章节进度按 id 独立存储（见 state.js），所以加书不会影响已有书的存档。
import { BOOK as B1, CHAPTERS as C1 } from "./book.js?v=2";
import { BOOK as B2, CHAPTERS as C2 } from "./book2.js?v=2";
import { loadImported } from "./import-book.js";

export const BOOKS = [
  {
    id: "tlkoe",
    status: "ready",
    heroHtml: true,
    book: B1,
    chapters: C1,
    kicker: "CHAPTER BOOK · 8-12 岁",
    heroTitle: "The Last<br>Kids on Earth",
    age: "8-12 岁",
    level: "Lexile 650L · AR 4.1",
    tagline: "一章一关，读完就进入属于你的末日冒险。",
    blurb: "杰克和伙伴们在怪物来袭后的小镇里，一章一个关卡。",
    cover: "assets/books/tlkoe-cover.jpg",
    hero: "assets/books/tlkoe-hero.jpg",
    color: "#8fd12f",
    credit: "官方封面：Google Books / Viking，首页与 hero 均由该封面裁切；章节插画：AI 生成"
  },
  {
    id: "mister-shivers",
    status: "ready",
    heroHtml: true,
    book: B2,
    chapters: C2,
    kicker: "EARLY READER · 4-6 岁",
    heroTitle: "Mister<br>Shivers",
    age: "4-6 岁",
    level: "Lexile 460–520L · AR 2.5",
    tagline: "一章一个小小的怪物故事，读完一起把灯打开。",
    blurb: "与《The Last Kids on Earth》同一作者的低龄短篇集，画风温柔、句子超短。",
    cover: "assets/books/ms-2-beneath.jpg",
    hero: "assets/books/ms-ch1.jpg",
    color: "#ff9a6b",
    credit: "封面与章节插图：Mister Shivers 系列官方图书封面（Scholastic Acorn / 豆瓣图书）"
  },
  {
    id: "next-book",
    status: "import",
    title: "导入一本书",
    zh: "中英对照后上架",
    kicker: "粘贴 · 链接 · book.json",
    age: "4–6 岁或 8–12 岁",
    level: "本机改写成分级书",
    tagline: "点这里开始导入",
    blurb: "把故事或链接交给本机，生成带中文和语法的分级书，看过对照再收进书架。",
    cover: "",
    hero: "",
    color: "#b8a9e8"
  }
];

export const catalog = () => [...BOOKS, ...loadImported()];
export const byId = (id) => catalog().find((b) => b.id === id) || catalog()[0];
export const readyBooks = () => catalog().filter((b) => b.status === "ready");
export const allVocab = () => readyBooks().flatMap((b) => b.chapters.flatMap((c) => c.vocab));
