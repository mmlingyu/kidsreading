---
name: adventure-reader
description: Turn a story, article, pasted text, or web link into an interactive graded English adventure book (book.json) for the 小小冒险家 reader. Each sentence has hideable Chinese, read-aloud English, highlightable core words, and a core grammar note, and each chapter ends by typing that chapter's words and grammar into blanks, with correct answers saved to a knowledge base and wrong answers saved to an error notebook. Use when asked to import a novel or document, generate an English 闯关阅读 book, or produce book.json.
---

# 英语闯关图书

把一份内容或一个链接，写成「小小冒险家」能直接吃的互动英语书。成品是一份 `outputs/book.json`，不是新的阅读器，也不是原文粘贴。

现有 App 的流程（生成时必须对齐，不要另起一套玩法）：

1. 书架选书 → 章节地图。第 1 章默认解锁，完成一章的章末冒险才解锁下一章。
2. 阅读页按 `paragraphs` 逐句显示英文。工具栏可以隐藏/显示全部中文、朗读整章、朗读本段。正文里拖选任意词句会朗读、慢速、逐音节（单个英文词还会进单词本）。这些都是引擎行为，句子只要是干净英文即可。
3. `vocab` 里的词如果原样出现在英文句子里，会被高亮；点一下会发音并收进单词本。
4. `quiz` 是三选一，答对加 XP。
5. 章末打开 `game.recall`：先填这一章的核心词，再填每一句挖空的语法。学习者自己打字。答对记入知识库，答错记入错题本。做完这一组才解锁下一章。

`grammar` 写在每一句上，阅读页显示在中文下方，章末填空也从这里挖空。不要省略。

## 先拿到正文

- 用户贴了正文：只用这份正文。
- 用户给了链接：打开链接，抽出正文。打不开、要登录、或页面没有可读故事时停止，请用户粘贴文本。不要凭标题编一本书。
- 正文过长：收成 4–8 章的分级故事，覆盖起因、经过、结尾，不要逐段翻译整本书。
- 用自己的分级英文重写情节。每句都是新句子。用户原文只作情节依据，不整段抄进 `en`。

先定年龄带，再动笔：

| 用户说法 | 句子 | 每章句数 | 建议 `scene` |
|---|---|---|---|
| 4–6 岁 / 入门 | 3–7 个词，现在时 | 6–8 | 101–106 |
| 8–12 岁 / 章节书 | 8–16 个词 | 6–8 | 1–8 |
| 没说 | 按 8–12 岁 | 6 章 | 1–8 里挑贴合的 |

## 写 `outputs/book.json`

形状以 `references/book-schema.md` 为准，最小样例是 `references/example-book.json`。写完立刻跑两步：

```text
python "<本技能目录>/scripts/validate.py" outputs/book.json
node "<本技能目录>/scripts/playtest.js" outputs/book.json
```

校验失败就改 JSON，不要改校验脚本来放行。自测失败就改这一章的填空，或改 `assets/recall.js` 里判分、记账、空答案也过关的地方。不要把自测改松来放行。两步都通过后再交付。

`playtest.js` 每次都检查填空引擎，再检查这本书的每一题：

- 什么都没写就提交，不算对，也不进知识库或错题本。
- 答错只进错题本。同一题后来答对，从错题本移到知识库。答对之后再答错，从知识库移回错题本。
- 标准答案必须判对。故意写错的答案必须判错。大小写和首尾空格不算错，多出来的词算错。

硬规则：

- `chapters` 按 `id` 从 1 连续编号。
- 每一句都有 `en`、`zh`、`grammar.title`、`grammar.explain`。`zh` 是整句中文，给「隐藏/显示中文」。`en` 是朗读和划词的唯一文本，不要夹中文、音标或 Markdown。
- 每章 4–8 个 `vocab`。阅读器用完整词边界高亮：`snacks` 不会点亮 `snack`。每个 `w` 必须按同样的词形出现在本章至少一句 `en` 里。
- 每章恰好 2 道 `quiz`，`answer` 是 0、1 或 2，题干答案能在本章英文里找到。
- 每章一个 `game.recall`，不要写 `nodes`、`minigame` 或骰子检定。先放每个核心词一题，再按句子顺序放每句语法一题。
- 单词题：`answer` 就是 `vocab.w`。`sentence` 用该词的 `eg`，把这个词换成四个下划线 `____`。`prompt` 用中文释义，`hint` 用词性和一个短提示。`zh` 用该词的 `egZh`，显示在英文填空下面，说明这一句的意思。
- 语法题：`sentence` 用这一句 `en`，只挖掉语法点那 1–5 个词，换成 `____`。填回去必须和原句一致。`prompt` 用 `grammar.title`，`hint` 用 `grammar.explain`。`zh` 用这一句的中文。不要整句都挖空，也不要每章挖同一个词。
- `scene` 只能是 1–8 或 101–106，用来选阅读页的场景背景。不要发明新场景号，也不要再配一套小游戏。

## 章末填空

生成可打开的 HTML 时，引入 `assets/recall.js`。进入某一章的填空时调用：

```js
AdventureRecall.mount(host, chapter.game.recall, {
  onGrade(item, result) {
    // result.ok 为 true 时写入知识库，否则写入错题本。空答案不会进这个回调。
  },
  onSpeak(item) {
    // 提交后朗读：把 ____ 换成正确答案，先读英文整句，再读中文 prompt。点「朗读」也会走到这里。
  },
  // 填空屏自带字母键盘。实体按键会点亮同一个键，句子里的空跟着当前输入变化。
  onDone({ correct, total }) {
    // 每一题都提交过之后才解锁下一章。correct 是第一次就答对的题数。
  }
});
```

判分忽略大小写和首尾、连续空格。`accept` 可以列可接受的其他写法，没有就不要加。反馈只有两句：答对说「已记入知识库」，答错给出正确答案并说「已记入错题本」。同一题以最后一次为准，答对就离开错题本，答错就离开知识库。

`scene` 仍可选阅读背景。`assets/games.js` 里的打地鼠、掌舵、分类等只留给已经上架的旧书，新书不要调用 `AdventureGames`。
- `art` 只能填 App 里已经存在的图片路径。没有新插画就留空字符串，不要编路径。现有阅读页会把 `art` 直接当作图片地址，空地址会显示破图，上架前要另给占位图。

## 给小小冒险家供书

阅读 App 在本机的小小冒险家目录里，不调用模型，也不保存密钥。生成和阅读分开：

1. 本技能写出 `book.json`，并跑过上面的校验和填空自测。
2. App 书架上的「导入这本书」读取该文件。浏览器再检查一遍，通过后写入本机书架，不上传。
3. 有 `game.recall` 的章节走填空。脚本是 `assets/recall.js`，App 里的副本是 `vendor/adventure-recall.js`。改了判分或记账，两处一起改，再跑 `playtest.js`。答对写入这台浏览器的知识库，答错写入错题本。
4. 没有 `recall`、仍带着旧小游戏节点的书，继续用原来的冒险舞台。不要把新书写成这种旧结构。
5. 阅读页「导入」里的粘贴和链接交给本机 `POST http://127.0.0.1:6010/api/reader/imports`。接口用 DeepSeek Harness 调用本技能，校验和填空自测通过后才把 `book.json` 交回阅读页做中英对照预览。阅读页不保存密钥。已有的 `book.json` 仍直接走第 2 步。

## 交付时说明

列出：书 id、章数、年龄带、填空题数、`outputs/book.json` 的路径、校验已通过、填空自测已通过。用一两句说明这是分级改写，不是原文。若链接没读到正文，说明停在哪一步。告诉用户到小小冒险家书架点「导入这本书」，读完后用章末填空把词和语法写出来。
