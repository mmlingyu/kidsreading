// 书架注册表：新增一本书只需在这里加一条 + 提供对应的 data/bookN.js 与封面/插画。
// 章节进度按 id 独立存储（见 state.js），所以加书不会影响已有书的存档。
import { BOOK as B1, CHAPTERS as C1 } from "./book.js";
import { BOOK as B2, CHAPTERS as C2 } from "./book2.js";

export const BOOKS = [
  {
    id: "tlkoe",
    status: "ready",
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
    status: "coming",
    title: "下一本书",
    zh: "等你来上架",
    kicker: "COMING SOON",
    age: "—",
    level: "书目位已预留",
    tagline: "在 data/bookshelf.js 里加一条，就能把新书放上书架。",
    blurb: "进度、XP、单词本、章末冒险引擎都是按书隔离的，接上即可用。",
    cover: "",
    hero: "",
    color: "#b8a9e8"
  }
];

export const byId = (id) => BOOKS.find((b) => b.id === id) || BOOKS[0];
export const readyBooks = () => BOOKS.filter((b) => b.status === "ready");
export const allVocab = () => readyBooks().flatMap((b) => b.chapters.flatMap((c) => c.vocab));
