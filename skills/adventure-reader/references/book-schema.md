# book.json

阅读器按句渲染 `paragraphs`。中文开关读 `zh`，朗读和划词读 `en`，绿色高亮读 `vocab`，语法条读 `grammar`。章末把 `game.recall` 交给填空：答对进知识库，答错进错题本。

```json
{
  "id": "kebab-case-id",
  "status": "ready",
  "age": "8-12 岁",
  "level": "自编分级 · 8-12 岁",
  "kicker": "CHAPTER BOOK · 8-12 岁",
  "tagline": "一句话介绍怎么玩",
  "blurb": "书架卡片上的两句介绍",
  "color": "#8fd12f",
  "book": {
    "title": "English Title",
    "zh": "中文书名",
    "author": "根据用户提供的内容改写",
    "level": "自编分级 · 8-12 岁",
    "quote": { "en": "一句书里的英文", "zh": "对应中文" }
  },
  "chapters": []
}
```

## 一章

```json
{
  "id": 1,
  "scene": 1,
  "title": "English Chapter Title",
  "zh": "中文章名",
  "tag": "四个字以内的关卡名",
  "art": "",
  "minutes": 4,
  "paragraphs": [
    {
      "en": "Jack lives in a tree house.",
      "zh": "杰克住在一座树屋里。",
      "grammar": {
        "title": "一般现在时",
        "explain": "lives 是 live 的第三人称单数，表示习惯或事实。",
        "pattern": "主语 + 动词-s + …"
      }
    }
  ],
  "vocab": [
    { "w": "tree house", "pos": "n.", "zh": "树屋", "eg": "Jack lives in a tree house.", "egZh": "杰克住在一座树屋里。" }
  ],
  "quiz": [
    { "q": "Where does Jack live?", "options": ["A cave", "A tree house", "A school"], "answer": 1, "zh": "杰克住在哪里？" }
  ],
  "game": {}
}
```

`scene`：1 树屋黄昏、2 便利店夜、3 后院实验室、4 球场午后、5 学校走廊、6 屋顶黄昏、7 商场中庭、8 暗巷夜；101–106 是低龄卧室、树林和走廊。编号会选中舞台里对应的背景图、3D 布景和配乐。选最接近本章地点的一个。

`vocab.w` 用小写，短语可以有空格。`pos` 用 `n.` `v.` `adj.` `adv.` `phr.` 之一。

## 章末 game

```json
{
  "title": "Say It Back",
  "zh": "把这一章写出来",
  "intro": { "en": "Type the missing words.", "zh": "把挖掉的词写回去。" },
  "recall": [
    {
      "id": "v-tree-house",
      "kind": "vocab",
      "prompt": "树屋",
      "sentence": "Jack lives in a ____.",
      "answer": "tree house",
      "hint": "名词。这一章用来称呼他的家。"
    },
    {
      "id": "g-1",
      "kind": "grammar",
      "prompt": "一般现在时",
      "sentence": "Jack ____ in a tree house.",
      "answer": "lives",
      "hint": "主语是 he 时，动词加 -s。"
    }
  ]
}
```

- 不要写 `nodes`、`start`、`minigame`。旧书里的小游戏不再生成。
- `recall` 先是每个核心词一题，再按段落顺序每个句子一题。`id` 在本章内不重复，用小写短横线。
- `sentence` 里正好一个 `____`。`answer` 是挖掉的 1–5 个英文词，不能夹中文。
- 单词题的 `answer` 等于 `vocab.w`，填回 `sentence` 后等于该词的 `eg`。
- 语法题填回 `sentence` 后等于该句 `en`。只挖语法点，不把整句挖空。
- 可选 `accept` 是其他可判对的写法。没有第二种写法就不要加。
- 阅读页调用 `AdventureRecall.mount`。答对进知识库，答错进错题本，空提交两边都不进。同一题以最后一次为准。
