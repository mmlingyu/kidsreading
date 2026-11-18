// Mister Shivers（Max Brallier / Scholastic Acorn）—— 4-6 岁低龄线。
// 剧情脉络沿用原著各册的短篇故事（床底下 / 树林里的影子 / 走廊娃娃 / 墙上的字 /
// 镜子里的脸 / 黑暗中散步），按 4-6 岁做了「温和化 + 超短句」的简化英文重述，
// 不逐字复制原书文本；正式商用需取得授权。
// 配图取自该系列官方封面（见 assets/books/），非 AI 生成。

export const BOOK = {
  title: "Mister Shivers",
  zh: "颤栗先生 · 小小怪物故事集",
  author: "Max Brallier 原著 · Letizia Rubegni 插画 · 本应用为低龄简化改写",
  level: "Lexile 460–520L · AR 2.5 · 4-6 岁",
  cover: "assets/books/ms-2-beneath.jpg",
  quote: {
    en: "Turn on the light. We are not scared anymore.",
    zh: "把灯打开，我们再也不害怕啦。"
  }
};

export const CHAPTERS = [
  {
    id: 1,
    scene: 101,
    title: "Beneath the Bed",
    zh: "床底下",
    tag: "开灯小任务",
    art: "assets/books/ms-ch1.jpg",
    minutes: 2,
    paragraphs: [
      { en: "Tap, tap, tap.", zh: "咚，咚，咚。", grammar: {"title":"同一个声音重复三次","explain":"三个 tap 连在一起，模仿敲击。","pattern":"tap"} },
      { en: "It is dark in my room.", zh: "我的房间黑黑的。", grammar: {"title":"is 表示当时的状态","explain":"is 把主语和 dark 连起来。","pattern":"is"} },
      { en: "The sound is under my bed.", zh: "声音是从床底下传来的。", grammar: {"title":"under 表示在下面","explain":"under my bed 说明声音的位置。","pattern":"under"} },
      { en: "I look under the bed.", zh: "我弯下腰，往床底下看。", grammar: {"title":"look 表示看","explain":"look 是这个句子的动作。","pattern":"look"} },
      { en: "Two big eyes look back at me.", zh: "两只大眼睛也在看着我。", grammar: {"title":"look back 表示回看","explain":"look back 说明眼睛也在看说话的人。","pattern":"look back"} },
      { en: "It is a little monster. It is scared, too.", zh: "原来是一只小怪物。它也很害怕。", grammar: {"title":"too 表示同样","explain":"too 说明小怪物也害怕。","pattern":"too"} },
      { en: "I turn on the light. We eat a cookie.", zh: "我打开灯。我们一起吃了一块饼干。", grammar: {"title":"turn on 表示打开","explain":"turn on 是打开灯这个动作。","pattern":"turn on"} },
      { en: "Now we are friends.", zh: "现在，我们是朋友啦。", grammar: {"title":"are 表示现在的关系","explain":"are friends 说明他们现在是朋友。","pattern":"are"} }
    ],
    vocab: [
      { w: "bed", pos: "n.", zh: "床", eg: "The sound is under my bed.", egZh: "声音从床底下传来。" },
      { w: "dark", pos: "adj.", zh: "黑的", eg: "It is dark in my room.", egZh: "我的房间黑黑的。" },
      { w: "friend", pos: "n.", zh: "朋友", eg: "Now we are friends.", egZh: "现在我们是朋友啦。" }
    ],
    quiz: [
      { q: "What is under the bed?", options: ["A little monster", "A big dog", "A toy car"], answer: 0, zh: "床底下是什么？" }
    ],
    game: {
      "title": "Under My Bed",
      "zh": "床底下",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-bed-1",
          "kind": "vocab",
          "prompt": "床",
          "sentence": "The sound is under my ____.",
          "answer": "bed",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-dark-2",
          "kind": "vocab",
          "prompt": "黑的",
          "sentence": "It is ____ in my room.",
          "answer": "dark",
          "hint": "adj. 本章核心词。"
        },
        {
          "id": "v-friend-3",
          "kind": "vocab",
          "prompt": "朋友",
          "sentence": "Now we are ____.",
          "answer": "friends",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "同一个声音重复三次",
          "sentence": "Tap, tap, ____.",
          "answer": "tap",
          "hint": "三个 tap 连在一起，模仿敲击。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "is 表示当时的状态",
          "sentence": "It ____ dark in my room.",
          "answer": "is",
          "hint": "is 把主语和 dark 连起来。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "under 表示在下面",
          "sentence": "The sound is ____ my bed.",
          "answer": "under",
          "hint": "under my bed 说明声音的位置。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "look 表示看",
          "sentence": "I ____ under the bed.",
          "answer": "look",
          "hint": "look 是这个句子的动作。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "look back 表示回看",
          "sentence": "Two big eyes ____ at me.",
          "answer": "look back",
          "hint": "look back 说明眼睛也在看说话的人。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "too 表示同样",
          "sentence": "It is a little monster. It is scared, ____.",
          "answer": "too",
          "hint": "too 说明小怪物也害怕。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "turn on 表示打开",
          "sentence": "I ____ the light. We eat a cookie.",
          "answer": "turn on",
          "hint": "turn on 是打开灯这个动作。"
        },
        {
          "id": "g-8",
          "kind": "grammar",
          "prompt": "are 表示现在的关系",
          "sentence": "Now we ____ friends.",
          "answer": "are",
          "hint": "are friends 说明他们现在是朋友。"
        }
      ]
    }
  },
  {
    id: 2,
    scene: 102,
    title: "Shadow in the Woods",
    zh: "树林里的影子",
    tag: "回家小路",
    art: "assets/books/ms-ch2.jpg",
    minutes: 2,
    paragraphs: [
      { en: "I walk home through the woods.", zh: "我穿过树林走回家。", grammar: {"title":"through 表示穿过","explain":"through the woods 说明从树林中间走。","pattern":"through"} },
      { en: "The sun goes down. It gets dark.", zh: "太阳落山了，天慢慢黑了。", grammar: {"title":"goes down 表示落下","explain":"goes down 说明太阳落下去。","pattern":"goes down"} },
      { en: "A shadow walks behind me.", zh: "有个影子跟在我后面。", grammar: {"title":"behind 表示在后面","explain":"behind me 说明影子跟在身后。","pattern":"behind"} },
      { en: "I stop. The shadow stops.", zh: "我停下，影子也停下。", grammar: {"title":"stops 表示停下","explain":"stops 和前面的 stop 对应，主语是影子。","pattern":"stops"} },
      { en: "I run. The shadow runs, too.", zh: "我跑起来，影子也跟着跑。", grammar: {"title":"too 表示也同样","explain":"too 说明影子也跟着跑。","pattern":"too"} },
      { en: "I look up. It is an owl in a tree!", zh: "我抬头一看——是树上的一只猫头鹰！", grammar: {"title":"an 表示一个","explain":"an owl 第一次提到这只猫头鹰。","pattern":"an owl"} },
      { en: "The owl says hoo. I laugh all the way home.", zh: "猫头鹰咕咕叫。我一路笑着回了家。", grammar: {"title":"all the way 表示一路","explain":"all the way home 说明笑着走完剩下的路。","pattern":"all the way"} }
    ],
    vocab: [
      { w: "woods", pos: "n.", zh: "树林", eg: "I walk through the woods.", egZh: "我穿过树林。" },
      { w: "shadow", pos: "n.", zh: "影子", eg: "A shadow walks behind me.", egZh: "有个影子跟在我后面。" },
      { w: "owl", pos: "n.", zh: "猫头鹰", eg: "It is an owl in a tree!", egZh: "是树上的一只猫头鹰！" }
    ],
    quiz: [
      { q: "What is the shadow?", options: ["An owl", "A big dog", "A bus"], answer: 0, zh: "那个影子其实是什么？" }
    ],
    game: {
      "title": "Woods Walk",
      "zh": "树林小路",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-woods-1",
          "kind": "vocab",
          "prompt": "树林",
          "sentence": "I walk through the ____.",
          "answer": "woods",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-shadow-2",
          "kind": "vocab",
          "prompt": "影子",
          "sentence": "A ____ walks behind me.",
          "answer": "shadow",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-owl-3",
          "kind": "vocab",
          "prompt": "猫头鹰",
          "sentence": "It is an ____ in a tree!",
          "answer": "owl",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "through 表示穿过",
          "sentence": "I walk home ____ the woods.",
          "answer": "through",
          "hint": "through the woods 说明从树林中间走。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "goes down 表示落下",
          "sentence": "The sun ____. It gets dark.",
          "answer": "goes down",
          "hint": "goes down 说明太阳落下去。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "behind 表示在后面",
          "sentence": "A shadow walks ____ me.",
          "answer": "behind",
          "hint": "behind me 说明影子跟在身后。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "stops 表示停下",
          "sentence": "I stop. The shadow ____.",
          "answer": "stops",
          "hint": "stops 和前面的 stop 对应，主语是影子。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "too 表示也同样",
          "sentence": "I run. The shadow runs, ____.",
          "answer": "too",
          "hint": "too 说明影子也跟着跑。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "an 表示一个",
          "sentence": "I look up. It is ____ in a tree!",
          "answer": "an owl",
          "hint": "an owl 第一次提到这只猫头鹰。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "all the way 表示一路",
          "sentence": "The owl says hoo. I laugh ____ home.",
          "answer": "all the way",
          "hint": "all the way home 说明笑着走完剩下的路。"
        }
      ]
    }
  },
  {
    id: 3,
    scene: 103,
    title: "The Doll in the Hall",
    zh: "走廊里的娃娃",
    tag: "关窗小任务",
    art: "assets/books/ms-ch3.jpg",
    minutes: 2,
    paragraphs: [
      { en: "The hall is long and quiet.", zh: "走廊长长的，安安静静。", grammar: {"title":"and 连接两个样子","explain":"long and quiet 一起形容走廊。","pattern":"and quiet"} },
      { en: "A doll sits by the door.", zh: "门边坐着一个娃娃。", grammar: {"title":"by 表示在旁边","explain":"by the door 说明娃娃的位置。","pattern":"by the door"} },
      { en: "I walk closer. The doll turns its head.", zh: "我走近一点，娃娃转过了头。", grammar: {"title":"turns 表示转动","explain":"turns its head 是娃娃做的动作。","pattern":"turns"} },
      { en: "My heart goes boom, boom, boom.", zh: "我的心咚、咚、咚地跳。", grammar: {"title":"goes 表示心跳","explain":"goes boom 用来描写心跳的声音。","pattern":"goes"} },
      { en: "The window is open. The wind pushes the doll.", zh: "窗户开着，是风在推娃娃。", grammar: {"title":"pushes 表示推","explain":"pushes the doll 说明是风在动它。","pattern":"pushes"} },
      { en: "It is only my sister's toy.", zh: "原来只是妹妹的玩具。", grammar: {"title":"only 表示只不过","explain":"only 把可怕的东西说成玩具。","pattern":"only"} },
      { en: "I close the window and wave at the doll.", zh: "我关上窗，跟娃娃挥挥手。", grammar: {"title":"and 连接两个动作","explain":"关上窗，再向娃娃挥手。","pattern":"and wave"} }
    ],
    vocab: [
      { w: "hall", pos: "n.", zh: "走廊", eg: "The hall is long and quiet.", egZh: "走廊长长的，安安静静。" },
      { w: "doll", pos: "n.", zh: "娃娃", eg: "A doll sits by the door.", egZh: "门边坐着一个娃娃。" },
      { w: "wind", pos: "n.", zh: "风", eg: "The wind pushes the doll.", egZh: "风在推娃娃。" }
    ],
    quiz: [
      { q: "Why does the doll move?", options: ["The wind", "A monster", "A dog"], answer: 0, zh: "娃娃为什么会动？" }
    ],
    game: {
      "title": "The Long Hall",
      "zh": "长长的走廊",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-hall-1",
          "kind": "vocab",
          "prompt": "走廊",
          "sentence": "The ____ is long and quiet.",
          "answer": "hall",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-doll-2",
          "kind": "vocab",
          "prompt": "娃娃",
          "sentence": "A ____ sits by the door.",
          "answer": "doll",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-wind-3",
          "kind": "vocab",
          "prompt": "风",
          "sentence": "The ____ pushes the doll.",
          "answer": "wind",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "and 连接两个样子",
          "sentence": "The hall is long ____.",
          "answer": "and quiet",
          "hint": "long and quiet 一起形容走廊。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "by 表示在旁边",
          "sentence": "A doll sits ____.",
          "answer": "by the door",
          "hint": "by the door 说明娃娃的位置。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "turns 表示转动",
          "sentence": "I walk closer. The doll ____ its head.",
          "answer": "turns",
          "hint": "turns its head 是娃娃做的动作。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "goes 表示心跳",
          "sentence": "My heart ____ boom, boom, boom.",
          "answer": "goes",
          "hint": "goes boom 用来描写心跳的声音。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "pushes 表示推",
          "sentence": "The window is open. The wind ____ the doll.",
          "answer": "pushes",
          "hint": "pushes the doll 说明是风在动它。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "only 表示只不过",
          "sentence": "It is ____ my sister's toy.",
          "answer": "only",
          "hint": "only 把可怕的东西说成玩具。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "and 连接两个动作",
          "sentence": "I close the window ____ at the doll.",
          "answer": "and wave",
          "hint": "关上窗，再向娃娃挥手。"
        }
      ]
    }
  },
  {
    id: 4,
    scene: 104,
    title: "The Writing on the Wall",
    zh: "墙上的字",
    tag: "找彩色蜡笔",
    art: "assets/books/ms-ch4.jpg",
    minutes: 2,
    paragraphs: [
      { en: "This is my new room.", zh: "这是我的新房间。", grammar: {"title":"This is 介绍新地方","explain":"This is 用来告诉读者这是哪里。","pattern":"This is"} },
      { en: "I write Hello on the wall.", zh: "我在墙上写了 Hello。", grammar: {"title":"write 表示写","explain":"write Hello 是写在墙上的动作。","pattern":"write"} },
      { en: "In the morning, there is a new line.", zh: "第二天早上，墙上多了一行字。", grammar: {"title":"there is 表示出现了","explain":"there is 说明早上多了一行字。","pattern":"there is"} },
      { en: "It says Hello back.", zh: "上面写着 Hello back。", grammar: {"title":"back 表示回应","explain":"Hello back 是对着上一句 Hello 回答。","pattern":"back"} },
      { en: "Who wrote it? I look and look.", zh: "是谁写的呢？我看了又看。", grammar: {"title":"wrote 表示写过","explain":"wrote 问的是这行字是谁写的。","pattern":"wrote"} },
      { en: "My big sister smiles at the door.", zh: "姐姐站在门口笑了。", grammar: {"title":"at the door 表示在门口","explain":"at the door 说明姐姐站的位置。","pattern":"at the door"} },
      { en: "We write our names together.", zh: "我们一起写下了名字。", grammar: {"title":"together 表示一起","explain":"together 说明两个名字是一起写的。","pattern":"together"} }
    ],
    vocab: [
      { w: "wall", pos: "n.", zh: "墙", eg: "I write on the wall.", egZh: "我在墙上写字。" },
      { w: "write", pos: "v.", zh: "写", eg: "We write our names.", egZh: "我们写下名字。" },
      { w: "name", pos: "n.", zh: "名字", eg: "What is your name?", egZh: "你叫什么名字？" }
    ],
    quiz: [
      { q: "Who writes Hello back?", options: ["Big sister", "A monster", "The doll"], answer: 0, zh: "是谁回了 Hello back？" }
    ],
    game: {
      "title": "Hello, Wall",
      "zh": "你好呀，墙",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-wall-1",
          "kind": "vocab",
          "prompt": "墙",
          "sentence": "I write on the ____.",
          "answer": "wall",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-write-2",
          "kind": "vocab",
          "prompt": "写",
          "sentence": "We ____ our names.",
          "answer": "write",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-name-3",
          "kind": "vocab",
          "prompt": "名字",
          "sentence": "What is your ____?",
          "answer": "name",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "This is 介绍新地方",
          "sentence": "____ my new room.",
          "answer": "This is",
          "hint": "This is 用来告诉读者这是哪里。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "write 表示写",
          "sentence": "I ____ Hello on the wall.",
          "answer": "write",
          "hint": "write Hello 是写在墙上的动作。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "there is 表示出现了",
          "sentence": "In the morning, ____ a new line.",
          "answer": "there is",
          "hint": "there is 说明早上多了一行字。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "back 表示回应",
          "sentence": "It says Hello ____.",
          "answer": "back",
          "hint": "Hello back 是对着上一句 Hello 回答。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "wrote 表示写过",
          "sentence": "Who ____ it? I look and look.",
          "answer": "wrote",
          "hint": "wrote 问的是这行字是谁写的。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "at the door 表示在门口",
          "sentence": "My big sister smiles ____.",
          "answer": "at the door",
          "hint": "at the door 说明姐姐站的位置。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "together 表示一起",
          "sentence": "We write our names ____.",
          "answer": "together",
          "hint": "together 说明两个名字是一起写的。"
        }
      ]
    }
  },
  {
    id: 5,
    scene: 105,
    title: "The Face in the Mirror",
    zh: "镜子里的脸",
    tag: "鬼脸大集合",
    art: "assets/books/ms-ch5.jpg",
    minutes: 2,
    paragraphs: [
      { en: "I look in the mirror.", zh: "我照了照镜子。", grammar: {"title":"in 表示在里面","explain":"in the mirror 说明看的是镜子里。","pattern":"in"} },
      { en: "I make a funny face.", zh: "我做了个鬼脸。", grammar: {"title":"funny 表示滑稽的","explain":"funny 形容做出来的表情。","pattern":"funny"} },
      { en: "The face in the mirror does not move.", zh: "镜子里的脸却没有动。", grammar: {"title":"does not 表示没有","explain":"does not move 否定镜子里的动作。","pattern":"does not"} },
      { en: "I wave. It waves... late.", zh: "我挥挥手，它慢了一拍才挥。", grammar: {"title":"late 表示晚了一点","explain":"late 说明挥手有延迟。","pattern":"late"} },
      { en: "I step closer and laugh.", zh: "我凑近一点，笑了起来。", grammar: {"title":"closer 表示更近","explain":"closer 是 close 的比较级。","pattern":"closer"} },
      { en: "It is my twin behind the glass!", zh: "原来是玻璃后面的双胞胎呀！", grammar: {"title":"behind 表示在后面","explain":"behind the glass 说明双胞胎站在玻璃后。","pattern":"behind"} },
      { en: "We make funny faces together.", zh: "我们一起做鬼脸。", grammar: {"title":"together 表示一起","explain":"together 说明两个人一起做鬼脸。","pattern":"together"} }
    ],
    vocab: [
      { w: "mirror", pos: "n.", zh: "镜子", eg: "I look in the mirror.", egZh: "我照镜子。" },
      { w: "face", pos: "n.", zh: "脸", eg: "I make a funny face.", egZh: "我做了个鬼脸。" },
      { w: "wave", pos: "v.", zh: "挥手", eg: "I wave at the mirror.", egZh: "我朝镜子挥挥手。" }
    ],
    quiz: [
      { q: "Who is behind the glass?", options: ["My twin", "A ghost", "A cat"], answer: 0, zh: "玻璃后面是谁？" }
    ],
    game: {
      "title": "Funny Faces",
      "zh": "鬼脸大集合",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-mirror-1",
          "kind": "vocab",
          "prompt": "镜子",
          "sentence": "I look in the ____.",
          "answer": "mirror",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-face-2",
          "kind": "vocab",
          "prompt": "脸",
          "sentence": "I make a funny ____.",
          "answer": "face",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-wave-3",
          "kind": "vocab",
          "prompt": "挥手",
          "sentence": "I ____ at the mirror.",
          "answer": "wave",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "in 表示在里面",
          "sentence": "I look ____ the mirror.",
          "answer": "in",
          "hint": "in the mirror 说明看的是镜子里。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "funny 表示滑稽的",
          "sentence": "I make a ____ face.",
          "answer": "funny",
          "hint": "funny 形容做出来的表情。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "does not 表示没有",
          "sentence": "The face in the mirror ____ move.",
          "answer": "does not",
          "hint": "does not move 否定镜子里的动作。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "late 表示晚了一点",
          "sentence": "I wave. It waves... ____.",
          "answer": "late",
          "hint": "late 说明挥手有延迟。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "closer 表示更近",
          "sentence": "I step ____ and laugh.",
          "answer": "closer",
          "hint": "closer 是 close 的比较级。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "behind 表示在后面",
          "sentence": "It is my twin ____ the glass!",
          "answer": "behind",
          "hint": "behind the glass 说明双胞胎站在玻璃后。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "together 表示一起",
          "sentence": "We make funny faces ____.",
          "answer": "together",
          "hint": "together 说明两个人一起做鬼脸。"
        }
      ]
    }
  },
  {
    id: 6,
    scene: 106,
    title: "A Walk in the Dark",
    zh: "黑黑的走廊",
    tag: "一起数到十",
    art: "assets/books/ms-ch6.jpg",
    minutes: 3,
    paragraphs: [
      { en: "The lights go out. Oh no!", zh: "灯灭了。哎呀！", grammar: {"title":"go out 表示熄灭","explain":"go out 说明灯灭了。","pattern":"go out"} },
      { en: "The hall is very, very dark.", zh: "走廊好黑、好黑。", grammar: {"title":"very 用来加强","explain":"very, very 把黑说得更黑。","pattern":"very, very"} },
      { en: "My friends are here with me.", zh: "好朋友们和我在一起。", grammar: {"title":"with 表示陪着","explain":"with me 说明朋友就在身边。","pattern":"with me"} },
      { en: "We hold hands. We count to ten.", zh: "我们手拉着手，一起数到十。", grammar: {"title":"to 表示数到","explain":"count to ten 是一直数到十。","pattern":"to ten"} },
      { en: "One, two, three... ten!", zh: "一、二、三……十！", grammar: {"title":"ten 表示数完","explain":"ten 是这串数字的最后一个。","pattern":"ten"} },
      { en: "The lights come on. Nothing is there.", zh: "灯亮了。什么都没有。", grammar: {"title":"come on 表示亮起","explain":"come on 和前面的 go out 相反。","pattern":"come on"} },
      { en: "We all laugh. Good night, shadows.", zh: "我们都笑了。晚安啦，影子。", grammar: {"title":"Good night 表示道别","explain":"Good night 用来跟影子说晚安。","pattern":"Good night"} }
    ],
    vocab: [
      { w: "hand", pos: "n.", zh: "手", eg: "We hold hands.", egZh: "我们手拉手。" },
      { w: "count", pos: "v.", zh: "数数", eg: "We count to ten.", egZh: "我们数到十。" },
      { w: "light", pos: "n.", zh: "灯；光", eg: "The lights come on.", egZh: "灯亮了。" }
    ],
    quiz: [
      { q: "What do the friends do?", options: ["Count to ten", "Run away", "Turn off the light"], answer: 0, zh: "朋友们一起做了什么？" }
    ],
    game: {
      "title": "Good Night, Shadows",
      "zh": "晚安，影子",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-hand-1",
          "kind": "vocab",
          "prompt": "手",
          "sentence": "We hold ____.",
          "answer": "hands",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-count-2",
          "kind": "vocab",
          "prompt": "数数",
          "sentence": "We ____ to ten.",
          "answer": "count",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-light-3",
          "kind": "vocab",
          "prompt": "灯；光",
          "sentence": "The ____ come on.",
          "answer": "lights",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "go out 表示熄灭",
          "sentence": "The lights ____. Oh no!",
          "answer": "go out",
          "hint": "go out 说明灯灭了。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "very 用来加强",
          "sentence": "The hall is ____ dark.",
          "answer": "very, very",
          "hint": "very, very 把黑说得更黑。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "with 表示陪着",
          "sentence": "My friends are here ____.",
          "answer": "with me",
          "hint": "with me 说明朋友就在身边。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "to 表示数到",
          "sentence": "We hold hands. We count ____.",
          "answer": "to ten",
          "hint": "count to ten 是一直数到十。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "ten 表示数完",
          "sentence": "One, two, three... ____!",
          "answer": "ten",
          "hint": "ten 是这串数字的最后一个。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "come on 表示亮起",
          "sentence": "The lights ____. Nothing is there.",
          "answer": "come on",
          "hint": "come on 和前面的 go out 相反。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "Good night 表示道别",
          "sentence": "We all laugh. ____, shadows.",
          "answer": "Good night",
          "hint": "Good night 用来跟影子说晚安。"
        }
      ]
    }
  }
];
