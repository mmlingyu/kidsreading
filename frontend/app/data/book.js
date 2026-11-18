// The Last Kids on Earth — 原创简化改写（非原书原文），供个人学习原型使用。
// 每章：正文段落（英/中）、核心词汇、阅读理解小题、章末沉浸式游戏脚本。

export const BOOK = {
  title: "The Last Kids on Earth",
  zh: "地球上最后的孩子",
  author: "原著 Max Brallier · 本应用为原创改写",
  level: "Lexile 650L · AR 4.1 · 8-12 岁",
  cover: "assets/cover.png",
  quote: {
    en: "We're the last kids on Earth. And we're not going down without a fight.",
    zh: "我们是地球上最后的孩子，绝不轻易认输。"
  }
};

export const CHAPTERS = [
  {
    id: 1,
    title: "42 Days Later",
    zh: "第四十二天",
    tag: "树屋守卫战",
    art: "assets/ch1.png",
    minutes: 4,
    paragraphs: [
      { en: "My name is Jack Sullivan. I am thirteen years old, and I live in a tree house.", zh: "我叫杰克·沙利文，今年十三岁，住在一座树屋里。", grammar: {"title":"and 连接两句","explain":"and 把年龄和住处接成一句。","pattern":"and"} },
      { en: "It is not a normal tree house. It has a zip line, a snack closet, and a very big sword.", zh: "这不是一座普通的树屋。它有滑索、零食柜，还有一把超级大的剑。", grammar: {"title":"and 连接并列事物","explain":"最后一项前面用 and。","pattern":"and a very big sword"} },
      { en: "Forty-two days ago, monsters came to our town. Most people ran away. I stayed.", zh: "四十二天前，怪物来到了我们的小镇。大多数人都逃走了，我留了下来。", grammar: {"title":"时间放在句首","explain":"Forty-two days ago 先说时间，再说发生了什么。","pattern":"Forty-two days ago"} },
      { en: "Now the streets are full of zombies. They are slow, they are smelly, and they are not very smart.", zh: "现在街上到处都是僵尸。它们行动缓慢、臭烘烘的，而且不太聪明。", grammar: {"title":"and 补充说明","explain":"not very smart 补上它们不太聪明这一点。","pattern":"not very smart"} },
      { en: "Every morning I eat cookies for breakfast. Then I check my traps and count my soda.", zh: "每天早上我吃饼干当早餐，然后检查陷阱、数一数我的汽水。", grammar: {"title":"Then 表示接下来","explain":"Then 告诉读者下一件事。","pattern":"Then"} },
      { en: "But today something is different. The zombies are walking toward my tree. Lots of them.", zh: "但今天有些不一样。僵尸们正朝我的树走来，而且是一大群。", grammar: {"title":"But 表示转折","explain":"But 把今天和往常分开。","pattern":"But"} },
      { en: "I grab my sword and smile. \"Okay,\" I say. \"Let's play.\"", zh: "我抓起剑，笑了。“好啊，”我说，“那就开打吧。”", grammar: {"title":"and 连接两个动作","explain":"抓起剑和笑是连续的两个动作。","pattern":"and smile"} }
    ],
    vocab: [
      { w: "tree house", pos: "n.", zh: "树屋", eg: "I live in a tree house.", egZh: "我住在一座树屋里。" },
      { w: "sword", pos: "n.", zh: "剑", eg: "He has a very big sword.", egZh: "他有一把很大的剑。" },
      { w: "monster", pos: "n.", zh: "怪物", eg: "Monsters came to our town.", egZh: "怪物来到了我们的小镇。" },
      { w: "zombie", pos: "n.", zh: "僵尸", eg: "The streets are full of zombies.", egZh: "街上到处都是僵尸。" },
      { w: "trap", pos: "n.", zh: "陷阱", eg: "I check my traps every morning.", egZh: "我每天早上检查陷阱。" },
      { w: "grab", pos: "v.", zh: "抓起", eg: "I grab my sword and smile.", egZh: "我抓起剑，笑了。" }
    ],
    quiz: [
      { q: "How old is Jack?", options: ["Ten", "Thirteen", "Sixteen"], answer: 1, zh: "杰克多大了？" },
      { q: "What is walking toward Jack's tree?", options: ["Dogs", "Zombies", "Teachers"], answer: 1, zh: "什么正朝杰克的树走来？" }
    ],
    game: {
      "title": "Tree House Defense",
      "zh": "树屋守卫战",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-tree-house-1",
          "kind": "vocab",
          "prompt": "树屋",
          "sentence": "I live in a ____.",
          "answer": "tree house",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-sword-2",
          "kind": "vocab",
          "prompt": "剑",
          "sentence": "He has a very big ____.",
          "answer": "sword",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-monster-3",
          "kind": "vocab",
          "prompt": "怪物",
          "sentence": "____ came to our town.",
          "answer": "Monsters",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-zombie-4",
          "kind": "vocab",
          "prompt": "僵尸",
          "sentence": "The streets are full of ____.",
          "answer": "zombies",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-trap-5",
          "kind": "vocab",
          "prompt": "陷阱",
          "sentence": "I check my ____ every morning.",
          "answer": "traps",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-grab-6",
          "kind": "vocab",
          "prompt": "抓起",
          "sentence": "I ____ my sword and smile.",
          "answer": "grab",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "and 连接两句",
          "sentence": "My name is Jack Sullivan. I am thirteen years old, ____ I live in a tree house.",
          "answer": "and",
          "hint": "and 把年龄和住处接成一句。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "and 连接并列事物",
          "sentence": "It is not a normal tree house. It has a zip line, a snack closet, ____.",
          "answer": "and a very big sword",
          "hint": "最后一项前面用 and。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "时间放在句首",
          "sentence": "____, monsters came to our town. Most people ran away. I stayed.",
          "answer": "Forty-two days ago",
          "hint": "Forty-two days ago 先说时间，再说发生了什么。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "and 补充说明",
          "sentence": "Now the streets are full of zombies. They are slow, they are smelly, and they are ____.",
          "answer": "not very smart",
          "hint": "not very smart 补上它们不太聪明这一点。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "Then 表示接下来",
          "sentence": "Every morning I eat cookies for breakfast. ____ I check my traps and count my soda.",
          "answer": "Then",
          "hint": "Then 告诉读者下一件事。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "But 表示转折",
          "sentence": "____ today something is different. The zombies are walking toward my tree. Lots of them.",
          "answer": "But",
          "hint": "But 把今天和往常分开。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "and 连接两个动作",
          "sentence": "I grab my sword ____. \"Okay,\" I say. \"Let's play.\"",
          "answer": "and smile",
          "hint": "抓起剑和笑是连续的两个动作。"
        }
      ]
    }
  },
  {
    id: 2,
    title: "The Snack Run",
    zh: "零食大作战",
    tag: "空城寻宝",
    art: "assets/ch2.png",
    minutes: 4,
    paragraphs: [
      { en: "A hero cannot fight monsters on an empty stomach. My snack closet has one cookie and half a soda.", zh: "英雄也不能饿着肚子打怪。我的零食柜里只剩一块饼干和半罐汽水。", grammar: {"title":"on 表示状态","explain":"on an empty stomach 说明空着肚子。","pattern":"on an empty stomach"} },
      { en: "So I do something very brave and very stupid: I go to the supermarket.", zh: "于是我做了一件既勇敢又愚蠢的事：我去超市。", grammar: {"title":"So 表示所以","explain":"So 连接前面的原因和后面的决定。","pattern":"So"} },
      { en: "The supermarket is dark and quiet. The lights are off, and the floor is covered with purple slime.", zh: "超市里又黑又安静。灯全灭了，地板上覆盖着一层紫色的黏液。", grammar: {"title":"and 连接两个结果","explain":"灯灭了，地板上也有黏液。","pattern":"and the floor"} },
      { en: "I fill my bag with cookies, chips, and twelve bottles of soda. Best day ever!", zh: "我往包里塞满饼干、薯片和十二瓶汽水。简直是人生最棒的一天！", grammar: {"title":"and 接上最后一项","explain":"and 把汽水也算进袋子里。","pattern":"and twelve bottles of soda"} },
      { en: "Then I see it: a giant footprint. It is bigger than my whole tree house.", zh: "就在这时，我看到了它：一个巨大的脚印，比我整座树屋还要大。", grammar: {"title":"比较级","explain":"bigger than 表示比另一样更大。","pattern":"bigger than"} },
      { en: "Something very big lives in this town now. And it is not a zombie.", zh: "现在这个镇上住着一个庞然大物，而且它不是僵尸。", grammar: {"title":"And 接着补充","explain":"And 后面再说它不是僵尸。","pattern":"And it is not"} },
      { en: "I take my snacks and run. I do not look back. Well, maybe I look back once.", zh: "我抓起零食就跑，不敢回头。好吧，也许我回头看了一眼。", grammar: {"title":"do not 表示没有做","explain":"do not 否定后面的动作。","pattern":"do not"} }
    ],
    vocab: [
      { w: "stomach", pos: "n.", zh: "肚子", eg: "You cannot fight on an empty stomach.", egZh: "你不能饿着肚子战斗。" },
      { w: "supermarket", pos: "n.", zh: "超市", eg: "I go to the supermarket.", egZh: "我去超市。" },
      { w: "slime", pos: "n.", zh: "黏液", eg: "The floor is covered with purple slime.", egZh: "地板上全是紫色黏液。" },
      { w: "footprint", pos: "n.", zh: "脚印", eg: "I see a giant footprint.", egZh: "我看到一个巨大的脚印。" },
      { w: "giant", pos: "adj.", zh: "巨大的", eg: "Something very big lives here.", egZh: "这里住着某个庞然大物。" },
      { w: "look back", pos: "phr.", zh: "回头看", eg: "I do not look back.", egZh: "我没有回头。" }
    ],
    quiz: [
      { q: "Why does Jack go to the supermarket?", options: ["To find his mum", "To get snacks", "To fight a giant"], answer: 1, zh: "杰克为什么去超市？" },
      { q: "What colour is the slime?", options: ["Green", "Blue", "Purple"], answer: 2, zh: "黏液是什么颜色的？" }
    ],
    game: {
      "title": "Snack Run",
      "zh": "零食大作战",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-stomach-1",
          "kind": "vocab",
          "prompt": "肚子",
          "sentence": "You cannot fight on an empty ____.",
          "answer": "stomach",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-supermarket-2",
          "kind": "vocab",
          "prompt": "超市",
          "sentence": "I go to the ____.",
          "answer": "supermarket",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-slime-3",
          "kind": "vocab",
          "prompt": "黏液",
          "sentence": "The floor is covered with purple ____.",
          "answer": "slime",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-footprint-4",
          "kind": "vocab",
          "prompt": "脚印",
          "sentence": "I see a giant ____.",
          "answer": "footprint",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-giant-5",
          "kind": "vocab",
          "prompt": "巨大的",
          "sentence": "Then I see it: a ____ footprint. It is bigger than my whole tree house.",
          "answer": "giant",
          "hint": "adj. 本章核心词。"
        },
        {
          "id": "v-look-back-6",
          "kind": "vocab",
          "prompt": "回头看",
          "sentence": "I do not ____.",
          "answer": "look back",
          "hint": "phr. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "on 表示状态",
          "sentence": "A hero cannot fight monsters ____. My snack closet has one cookie and half a soda.",
          "answer": "on an empty stomach",
          "hint": "on an empty stomach 说明空着肚子。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "So 表示所以",
          "sentence": "____ I do something very brave and very stupid: I go to the supermarket.",
          "answer": "So",
          "hint": "So 连接前面的原因和后面的决定。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "and 连接两个结果",
          "sentence": "The supermarket is dark and quiet. The lights are off, ____ is covered with purple slime.",
          "answer": "and the floor",
          "hint": "灯灭了，地板上也有黏液。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "and 接上最后一项",
          "sentence": "I fill my bag with cookies, chips, ____. Best day ever!",
          "answer": "and twelve bottles of soda",
          "hint": "and 把汽水也算进袋子里。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "比较级",
          "sentence": "Then I see it: a giant footprint. It is ____ my whole tree house.",
          "answer": "bigger than",
          "hint": "bigger than 表示比另一样更大。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "And 接着补充",
          "sentence": "Something very big lives in this town now. ____ a zombie.",
          "answer": "And it is not",
          "hint": "And 后面再说它不是僵尸。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "do not 表示没有做",
          "sentence": "I take my snacks and run. I ____ look back. Well, maybe I look back once.",
          "answer": "do not",
          "hint": "do not 否定后面的动作。"
        }
      ]
    }
  },
  {
    id: 3,
    title: "The Science Kid",
    zh: "科学怪才金特",
    tag: "结识金特",
    art: "assets/ch3.png",
    minutes: 4,
    paragraphs: [
      { en: "Quint Baker is my best friend. Before the monsters, he was just a kid with too many science books.", zh: "金特·贝克是我最好的朋友。在怪物出现之前，他只是一个科学书太多的小孩。", grammar: {"title":"Before 表示在那之前","explain":"Before the monsters 把时间退回怪物出现前。","pattern":"Before the monsters"} },
      { en: "Now he is a kid with too many science books and a zombie-proof cart.", zh: "现在，他是一个科学书太多、还拥有一辆防僵尸推车的小孩。", grammar: {"title":"and 接上新情况","explain":"and 把他现在多出来的装备接上。","pattern":"and a zombie-proof cart"} },
      { en: "I find him in his backyard, wearing three pairs of glasses. \"One broke,\" he says. \"Then another broke.\"", zh: "我在他家后院找到了他，他戴着三副眼镜。“碎了一副，”他说，“然后又碎了一副。”", grammar: {"title":"Then 表示随后","explain":"Then 说明下一副眼镜也坏了。","pattern":"Then another broke"} },
      { en: "His cart is full of bottles, tubes, and strange machines. One of them is beeping.", zh: "他的推车上装满了瓶子、试管和奇怪的机器，其中一台还在滴滴响。", grammar: {"title":"正在进行","explain":"is beeping 表示机器此刻正在响。","pattern":"is beeping"} },
      { en: "\"I call it the Zapper,\" Quint says. \"It makes zombies very, very sleepy.\"", zh: "“我管它叫电击枪，”金特说，“它能让僵尸变得非常、非常困。”", grammar: {"title":"says 引出原话","explain":"says 后面是他说出来的话。","pattern":"says"} },
      { en: "A zombie walks into the yard. Quint presses a red button. The zombie falls asleep standing up.", zh: "一只僵尸走进院子。金特按下红色按钮，那只僵尸站着就睡着了。", grammar: {"title":"第三人称单数","explain":"主语是 Quint 时，press 要写成 presses。","pattern":"presses"} },
      { en: "\"Okay,\" I say. \"You are definitely on my team.\"", zh: "“好吧，”我说，“你一定要加入我的小队。”", grammar: {"title":"definitely 加强语气","explain":"definitely 表示这件事很确定。","pattern":"definitely"} }
    ],
    vocab: [
      { w: "backyard", pos: "n.", zh: "后院", eg: "I find him in his backyard.", egZh: "我在他家后院找到了他。" },
      { w: "cart", pos: "n.", zh: "手推车", eg: "His cart is full of bottles.", egZh: "他的推车上全是瓶子。" },
      { w: "machine", pos: "n.", zh: "机器", eg: "One of the machines is beeping.", egZh: "其中一台机器在滴滴响。" },
      { w: "beep", pos: "v.", zh: "发出哔哔声", eg: "The machine is beeping.", egZh: "机器在哔哔响。" },
      { w: "press", pos: "v.", zh: "按下", eg: "Quint presses a red button.", egZh: "金特按下红色按钮。" },
      { w: "team", pos: "n.", zh: "队伍", eg: "You are on my team.", egZh: "你加入我的小队了。" }
    ],
    quiz: [
      { q: "What does the Zapper do?", options: ["Makes zombies sleepy", "Makes cookies", "Fixes glasses"], answer: 0, zh: "电击枪有什么作用？" },
      { q: "How many pairs of glasses is Quint wearing?", options: ["One", "Two", "Three"], answer: 2, zh: "金特戴着几副眼镜？" }
    ],
    game: {
      "title": "Science vs. Zombies",
      "zh": "科学大战僵尸",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-backyard-1",
          "kind": "vocab",
          "prompt": "后院",
          "sentence": "I find him in his ____.",
          "answer": "backyard",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-cart-2",
          "kind": "vocab",
          "prompt": "手推车",
          "sentence": "His ____ is full of bottles.",
          "answer": "cart",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-machine-3",
          "kind": "vocab",
          "prompt": "机器",
          "sentence": "One of the ____ is beeping.",
          "answer": "machines",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-beep-4",
          "kind": "vocab",
          "prompt": "发出哔哔声",
          "sentence": "The machine is ____.",
          "answer": "beeping",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-press-5",
          "kind": "vocab",
          "prompt": "按下",
          "sentence": "Quint ____ a red button.",
          "answer": "presses",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-team-6",
          "kind": "vocab",
          "prompt": "队伍",
          "sentence": "You are on my ____.",
          "answer": "team",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "Before 表示在那之前",
          "sentence": "Quint Baker is my best friend. ____, he was just a kid with too many science books.",
          "answer": "Before the monsters",
          "hint": "Before the monsters 把时间退回怪物出现前。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "and 接上新情况",
          "sentence": "Now he is a kid with too many science books ____.",
          "answer": "and a zombie-proof cart",
          "hint": "and 把他现在多出来的装备接上。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "Then 表示随后",
          "sentence": "I find him in his backyard, wearing three pairs of glasses. \"One broke,\" he says. \"____.\"",
          "answer": "Then another broke",
          "hint": "Then 说明下一副眼镜也坏了。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "正在进行",
          "sentence": "His cart is full of bottles, tubes, and strange machines. One of them ____.",
          "answer": "is beeping",
          "hint": "is beeping 表示机器此刻正在响。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "says 引出原话",
          "sentence": "\"I call it the Zapper,\" Quint ____. \"It makes zombies very, very sleepy.\"",
          "answer": "says",
          "hint": "says 后面是他说出来的话。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "第三人称单数",
          "sentence": "A zombie walks into the yard. Quint ____ a red button. The zombie falls asleep standing up.",
          "answer": "presses",
          "hint": "主语是 Quint 时，press 要写成 presses。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "definitely 加强语气",
          "sentence": "\"Okay,\" I say. \"You are ____ on my team.\"",
          "answer": "definitely",
          "hint": "definitely 表示这件事很确定。"
        }
      ]
    }
  },
  {
    id: 4,
    title: "The Bully Problem",
    zh: "昔日的校霸",
    tag: "德克入队",
    art: "assets/ch4.png",
    minutes: 4,
    paragraphs: [
      { en: "Dirk Savage used to be the biggest bully at our school. He could break a pencil with one hand.", zh: "德克·萨维奇以前是我们学校最凶的校霸，他一只手就能把铅笔掰断。", grammar: {"title":"used to 表示过去常常","explain":"used to be 说明他以前是那样。","pattern":"used to"} },
      { en: "Now he is standing on a school bus, swinging a broken stop sign at six zombies.", zh: "现在他站在一辆校车上，挥着半截停车牌对付六只僵尸。", grammar: {"title":"正在进行","explain":"swinging 表示他此刻正在挥。","pattern":"swinging"} },
      { en: "\"Need help?\" I shout. \"NO!\" he shouts back. Then a zombie grabs his jacket.", zh: "“要帮忙吗？”我喊。“不用！”他喊回来。然后一只僵尸抓住了他的外套。", grammar: {"title":"shout back 表示回喊","explain":"shouts back 是对着前面那句话回过去。","pattern":"shouts back"} },
      { en: "Quint and I look at each other. We help anyway.", zh: "我和金特对视了一眼，还是上去帮忙了。", grammar: {"title":"anyway 表示还是做了","explain":"anyway 说明对方拒绝了，他们还是帮忙。","pattern":"anyway"} },
      { en: "Quint's Zapper flashes, I pull the zombie away, and Dirk smashes the bus window to escape.", zh: "金特的电击枪一闪，我把僵尸拉开，德克砸开车窗冲了出来。", grammar: {"title":"and 连接同时发生的事","explain":"and 把 Dirk 的动作接到前面两个动作后面。","pattern":"and Dirk"} },
      { en: "He is quiet for a moment. Then he says, \"Thanks. I guess we are a team now.\"", zh: "他安静了一会儿，然后说：“谢了。看来我们现在是一队的了。”", grammar: {"title":"I guess 表示自己的判断","explain":"I guess 说明这是他现在的想法。","pattern":"I guess"} },
      { en: "Three kids, one cart, and zero adults. Honestly, this is going pretty well.", zh: "三个孩子、一辆推车、零个大人。说实话，目前进展还不错。", grammar: {"title":"and 接上最后一项","explain":"and 把大人的数量也数进去。","pattern":"and zero adults"} }
    ],
    vocab: [
      { w: "bully", pos: "n.", zh: "校霸；欺负人的人", eg: "He used to be the biggest bully at school.", egZh: "他以前是学校里最凶的校霸。" },
      { w: "swing", pos: "v.", zh: "挥舞", eg: "He is swinging a broken stop sign.", egZh: "他正挥着半截停车牌。" },
      { w: "shout", pos: "v.", zh: "大喊", eg: "\"Need help?\" I shout.", egZh: "“要帮忙吗？”我喊道。" },
      { w: "escape", pos: "v.", zh: "逃脱", eg: "He smashes the window to escape.", egZh: "他砸碎窗户逃了出来。" },
      { w: "jacket", pos: "n.", zh: "外套", eg: "A zombie grabs his jacket.", egZh: "一只僵尸抓住了他的外套。" },
      { w: "adult", pos: "n.", zh: "成年人", eg: "There are zero adults here.", egZh: "这里一个大人也没有。" }
    ],
    quiz: [
      { q: "What is Dirk using as a weapon?", options: ["A sword", "A stop sign", "A science cart"], answer: 1, zh: "德克用什么当武器？" },
      { q: "How many kids are on the team now?", options: ["Two", "Three", "Four"], answer: 1, zh: "现在队里有几个孩子？" }
    ],
    game: {
      "title": "Bus Rescue",
      "zh": "校车营救",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-bully-1",
          "kind": "vocab",
          "prompt": "校霸；欺负人的人",
          "sentence": "He used to be the biggest ____ at school.",
          "answer": "bully",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-swing-2",
          "kind": "vocab",
          "prompt": "挥舞",
          "sentence": "He is ____ a broken stop sign.",
          "answer": "swinging",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-shout-3",
          "kind": "vocab",
          "prompt": "大喊",
          "sentence": "\"Need help?\" I ____.",
          "answer": "shout",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-escape-4",
          "kind": "vocab",
          "prompt": "逃脱",
          "sentence": "He smashes the window to ____.",
          "answer": "escape",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-jacket-5",
          "kind": "vocab",
          "prompt": "外套",
          "sentence": "A zombie grabs his ____.",
          "answer": "jacket",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-adult-6",
          "kind": "vocab",
          "prompt": "成年人",
          "sentence": "There are zero ____ here.",
          "answer": "adults",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "used to 表示过去常常",
          "sentence": "Dirk Savage ____ be the biggest bully at our school. He could break a pencil with one hand.",
          "answer": "used to",
          "hint": "used to be 说明他以前是那样。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "正在进行",
          "sentence": "Now he is standing on a school bus, ____ a broken stop sign at six zombies.",
          "answer": "swinging",
          "hint": "swinging 表示他此刻正在挥。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "shout back 表示回喊",
          "sentence": "\"Need help?\" I shout. \"NO!\" he ____. Then a zombie grabs his jacket.",
          "answer": "shouts back",
          "hint": "shouts back 是对着前面那句话回过去。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "anyway 表示还是做了",
          "sentence": "Quint and I look at each other. We help ____.",
          "answer": "anyway",
          "hint": "anyway 说明对方拒绝了，他们还是帮忙。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "and 连接同时发生的事",
          "sentence": "Quint's Zapper flashes, I pull the zombie away, ____ smashes the bus window to escape.",
          "answer": "and Dirk",
          "hint": "and 把 Dirk 的动作接到前面两个动作后面。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "I guess 表示自己的判断",
          "sentence": "He is quiet for a moment. Then he says, \"Thanks. ____ we are a team now.\"",
          "answer": "I guess",
          "hint": "I guess 说明这是他现在的想法。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "and 接上最后一项",
          "sentence": "Three kids, one cart, ____. Honestly, this is going pretty well.",
          "answer": "and zero adults",
          "hint": "and 把大人的数量也数进去。"
        }
      ]
    }
  },
  {
    id: 5,
    title: "June",
    zh: "琼",
    tag: "校园潜入",
    art: "assets/ch5.png",
    minutes: 5,
    paragraphs: [
      { en: "I have been looking for June Del Toro since the monsters came. I saw her get on a school bus.", zh: "从怪物来的那天起，我就一直在找琼·德尔托罗。我看见她上了一辆校车。", grammar: {"title":"since 表示从那时起","explain":"since 后面是开始寻找的时间。","pattern":"since"} },
      { en: "So we go to the school. The halls are dark, and the lockers are all open.", zh: "于是我们去了学校。走廊里很暗，储物柜全都敞开着。", grammar: {"title":"and 连接两个景象","explain":"走廊很暗，柜子也开着。","pattern":"and the lockers"} },
      { en: "\"Hello?\" I call. My voice sounds small in the empty hallway.", zh: "“有人吗？”我喊了一声，声音在空荡的走廊里显得特别小。", grammar: {"title":"sounds 表示听起来","explain":"sounds small 描述声音给人的感觉。","pattern":"sounds"} },
      { en: "Then a door opens. June steps out, holding a broom with a knife taped to the end.", zh: "这时一扇门开了。琼走了出来，手里拿着一把绑了刀的扫帚。", grammar: {"title":"holding 表示手里拿着","explain":"holding 说明她出来时手里有东西。","pattern":"holding"} },
      { en: "\"I have been fine for six weeks,\" she says. \"Were you coming to rescue me?\"", zh: "“我这六个星期一直好好的，”她说，“你是来救我的吗？”", grammar: {"title":"for 加一段时间","explain":"for six weeks 表示持续了六周。","pattern":"for six weeks"} },
      { en: "I feel my face get hot. \"Uh... maybe?\"", zh: "我感觉脸一下子烫了。“呃……算是吧？”", grammar: {"title":"maybe 表示不确定","explain":"maybe 把回答说得不那么肯定。","pattern":"maybe"} },
      { en: "June laughs and joins us. She is the bravest person in this whole town, and she knows it.", zh: "琼笑着加入了我们。她是全镇最勇敢的人，而且她自己也知道。", grammar: {"title":"and 补充说明","explain":"and 后面补上她自己也知道这一点。","pattern":"and she knows it"} }
    ],
    vocab: [
      { w: "hallway", pos: "n.", zh: "走廊", eg: "The halls are dark.", egZh: "走廊里很暗。" },
      { w: "locker", pos: "n.", zh: "储物柜", eg: "The lockers are all open.", egZh: "储物柜全都开着。" },
      { w: "broom", pos: "n.", zh: "扫帚", eg: "She is holding a broom.", egZh: "她手里拿着一把扫帚。" },
      { w: "tape", pos: "v.", zh: "用胶带粘", eg: "A knife is taped to the end.", egZh: "末端用胶带绑了一把刀。" },
      { w: "rescue", pos: "v.", zh: "营救", eg: "Were you coming to rescue me?", egZh: "你是来救我的吗？" },
      { w: "brave", pos: "adj.", zh: "勇敢的", eg: "She is the bravest person here.", egZh: "她是这里最勇敢的人。" }
    ],
    quiz: [
      { q: "What is June holding?", options: ["A sword", "A broom with a knife", "A science book"], answer: 1, zh: "琼手里拿着什么？" },
      { q: "Does June need rescuing?", options: ["Yes, she is trapped", "No, she is fine", "She is a zombie"], answer: 1, zh: "琼需要被救吗？" }
    ],
    game: {
      "title": "School Stealth Mission",
      "zh": "校园潜入任务",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-hallway-1",
          "kind": "vocab",
          "prompt": "走廊",
          "sentence": "\"Hello?\" I call. My voice sounds small in the empty ____.",
          "answer": "hallway",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-locker-2",
          "kind": "vocab",
          "prompt": "储物柜",
          "sentence": "The ____ are all open.",
          "answer": "lockers",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-broom-3",
          "kind": "vocab",
          "prompt": "扫帚",
          "sentence": "She is holding a ____.",
          "answer": "broom",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-tape-4",
          "kind": "vocab",
          "prompt": "用胶带粘",
          "sentence": "A knife is ____ to the end.",
          "answer": "taped",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-rescue-5",
          "kind": "vocab",
          "prompt": "营救",
          "sentence": "Were you coming to ____ me?",
          "answer": "rescue",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-brave-6",
          "kind": "vocab",
          "prompt": "勇敢的",
          "sentence": "She is the ____ person here.",
          "answer": "bravest",
          "hint": "adj. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "since 表示从那时起",
          "sentence": "I have been looking for June Del Toro ____ the monsters came. I saw her get on a school bus.",
          "answer": "since",
          "hint": "since 后面是开始寻找的时间。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "and 连接两个景象",
          "sentence": "So we go to the school. The halls are dark, ____ are all open.",
          "answer": "and the lockers",
          "hint": "走廊很暗，柜子也开着。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "sounds 表示听起来",
          "sentence": "\"Hello?\" I call. My voice ____ small in the empty hallway.",
          "answer": "sounds",
          "hint": "sounds small 描述声音给人的感觉。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "holding 表示手里拿着",
          "sentence": "Then a door opens. June steps out, ____ a broom with a knife taped to the end.",
          "answer": "holding",
          "hint": "holding 说明她出来时手里有东西。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "for 加一段时间",
          "sentence": "\"I have been fine ____,\" she says. \"Were you coming to rescue me?\"",
          "answer": "for six weeks",
          "hint": "for six weeks 表示持续了六周。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "maybe 表示不确定",
          "sentence": "I feel my face get hot. \"Uh... ____?\"",
          "answer": "maybe",
          "hint": "maybe 把回答说得不那么肯定。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "and 补充说明",
          "sentence": "June laughs and joins us. She is the bravest person in this whole town, ____.",
          "answer": "and she knows it",
          "hint": "and 后面补上她自己也知道这一点。"
        }
      ]
    }
  },
  {
    id: 6,
    title: "Rover",
    zh: "怪兽宠物罗孚",
    tag: "收服罗孚",
    art: "assets/ch6.png",
    minutes: 4,
    paragraphs: [
      { en: "We hear the sound first: a happy little bark, very deep and very loud.", zh: "我们先听到了声音：一声很开心、很低沉、又很响亮的狗叫。", grammar: {"title":"first 表示最先","explain":"first 说明最先听到的是声音。","pattern":"first"} },
      { en: "Behind the mall sits a monster the size of a bus. It has six legs, three eyes, and a tail like a wrecking ball.", zh: "商场后面趴着一只公交车那么大的怪物。它有六条腿、三只眼睛，尾巴像一颗拆楼铁球。", grammar: {"title":"the size of 表示一样大","explain":"the size of a bus 用另一样东西来比大小。","pattern":"the size of"} },
      { en: "Quint whispers, \"That is scientifically impossible.\" The monster licks his face.", zh: "金特小声说：“这在科学上是不可能的。”怪物舔了他的脸。", grammar: {"title":"whispers 表示小声说","explain":"whispers 比 says 更轻。","pattern":"whispers"} },
      { en: "It is not a monster. It is a very big, very lonely puppy.", zh: "它不是怪物，它是一只很大、很孤单的小狗。", grammar: {"title":"not 用来否定","explain":"not a monster 把前面的判断改掉。","pattern":"not a monster"} },
      { en: "June throws a giant old tire. The monster jumps up, catches it, and does a happy wiggle.", zh: "琼扔出一个巨大的旧轮胎，怪物跳起来接住，开心地扭了扭身子。", grammar: {"title":"and 连接连续动作","explain":"接住以后又做了一个动作。","pattern":"and does"} },
      { en: "I name him Rover. Quint says that is not a proper scientific name. Nobody listens.", zh: "我给它取名罗孚。金特说这不是正经的科学命名，没人理他。", grammar: {"title":"that is not 表示那不算","explain":"that is not 否定前面那个叫法。","pattern":"that is not"} },
      { en: "Now our team has four kids and one monster puppy. I call that a fair fight.", zh: "现在队里有四个孩子和一只怪物小狗。我觉得这下势均力敌了。", grammar: {"title":"and 把新成员算进去","explain":"and 把小狗也算进队伍。","pattern":"and one monster puppy"} }
    ],
    vocab: [
      { w: "bark", pos: "n.", zh: "狗叫声", eg: "We hear a happy little bark.", egZh: "我们听到一声开心的狗叫。" },
      { w: "lonely", pos: "adj.", zh: "孤单的", eg: "It is a very lonely puppy.", egZh: "它是一只很孤单的小狗。" },
      { w: "lick", pos: "v.", zh: "舔", eg: "The monster licks his face.", egZh: "怪物舔了他的脸。" },
      { w: "whisper", pos: "v.", zh: "小声说", eg: "Quint whispers a fact.", egZh: "金特小声说了个知识点。" },
      { w: "wiggle", pos: "v.", zh: "扭动", eg: "The monster does a happy wiggle.", egZh: "怪物开心地扭动身体。" },
      { w: "puppy", pos: "n.", zh: "小狗", eg: "It is just a big puppy.", egZh: "它只是只大狗崽。" }
    ],
    quiz: [
      { q: "How many eyes does Rover have?", options: ["Two", "Three", "Six"], answer: 1, zh: "罗孚有几只眼睛？" },
      { q: "What does June throw?", options: ["A cookie", "A tire", "A broom"], answer: 1, zh: "琼扔了什么？" }
    ],
    game: {
      "title": "Make a New Friend",
      "zh": "交个新朋友",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-bark-1",
          "kind": "vocab",
          "prompt": "狗叫声",
          "sentence": "We hear a happy little ____.",
          "answer": "bark",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-lonely-2",
          "kind": "vocab",
          "prompt": "孤单的",
          "sentence": "It is a very ____ puppy.",
          "answer": "lonely",
          "hint": "adj. 本章核心词。"
        },
        {
          "id": "v-lick-3",
          "kind": "vocab",
          "prompt": "舔",
          "sentence": "The monster ____ his face.",
          "answer": "licks",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-whisper-4",
          "kind": "vocab",
          "prompt": "小声说",
          "sentence": "Quint ____ a fact.",
          "answer": "whispers",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-wiggle-5",
          "kind": "vocab",
          "prompt": "扭动",
          "sentence": "The monster does a happy ____.",
          "answer": "wiggle",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-puppy-6",
          "kind": "vocab",
          "prompt": "小狗",
          "sentence": "It is just a big ____.",
          "answer": "puppy",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "first 表示最先",
          "sentence": "We hear the sound ____: a happy little bark, very deep and very loud.",
          "answer": "first",
          "hint": "first 说明最先听到的是声音。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "the size of 表示一样大",
          "sentence": "Behind the mall sits a monster ____ a bus. It has six legs, three eyes, and a tail like a wrecking ball.",
          "answer": "the size of",
          "hint": "the size of a bus 用另一样东西来比大小。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "whispers 表示小声说",
          "sentence": "Quint ____, \"That is scientifically impossible.\" The monster licks his face.",
          "answer": "whispers",
          "hint": "whispers 比 says 更轻。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "not 用来否定",
          "sentence": "It is ____. It is a very big, very lonely puppy.",
          "answer": "not a monster",
          "hint": "not a monster 把前面的判断改掉。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "and 连接连续动作",
          "sentence": "June throws a giant old tire. The monster jumps up, catches it, ____ a happy wiggle.",
          "answer": "and does",
          "hint": "接住以后又做了一个动作。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "that is not 表示那不算",
          "sentence": "I name him Rover. Quint says ____ a proper scientific name. Nobody listens.",
          "answer": "that is not",
          "hint": "that is not 否定前面那个叫法。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "and 把新成员算进去",
          "sentence": "Now our team has four kids ____. I call that a fair fight.",
          "answer": "and one monster puppy",
          "hint": "and 把小狗也算进队伍。"
        }
      ]
    }
  },
  {
    id: 7,
    title: "Blarg",
    zh: "巨兽布拉格",
    tag: "末日真相",
    art: "assets/ch7.png",
    minutes: 5,
    paragraphs: [
      { en: "The monster is called Blargh. I know because it writes its name on a wall with one enormous claw.", zh: "那只怪物叫布拉格。我之所以知道，是因为它用一只巨大的爪子在墙上写下了自己的名字。", grammar: {"title":"because 说明原因","explain":"because 后面是他怎么知道名字的。","pattern":"because"} },
      { en: "It is as tall as the water tower. Its eyes glow purple, and every step shakes the windows.", zh: "它有水塔那么高，眼睛发着紫光，每走一步窗户都在抖。", grammar: {"title":"as tall as 表示一样高","explain":"as tall as 用水塔来比高度。","pattern":"as tall as"} },
      { en: "Quint finds slimy purple crystals all over town. \"These are portals,\" he says. \"Something opened a door to another world.\"", zh: "金特在镇上到处发现紫色水晶。“这些是传送门，”他说，“有东西打开了通往另一个世界的大门。”", grammar: {"title":"another 表示另一个","explain":"another world 是不同于这个小镇的世界。","pattern":"another world"} },
      { en: "So the zombies are not the real problem. They are just the welcoming committee.", zh: "所以僵尸并不是真正的问题，它们只是「迎宾队伍」而已。", grammar: {"title":"not 指出真正的问题","explain":"not the real problem 说明僵尸不是重点。","pattern":"not the real problem"} },
      { en: "We make a plan on the roof of my tree house: use the crystals, make a loud noise, and lead Blargh away from town.", zh: "我们在树屋顶上定下计划：利用水晶、制造巨响，把布拉格引离小镇。", grammar: {"title":"and 连接计划的最后一步","explain":"and 把引开巨兽接在计划末尾。","pattern":"and lead"} },
      { en: "June draws the map. Dirk carries the batteries. Quint builds the machine. I hold the sword and try to look brave.", zh: "琼画地图，德克扛电池，金特造机器，我握着剑，努力让自己看起来很勇敢。", grammar: {"title":"and 连接同时做的事","explain":"and try 是他拿着剑时还在做的事。","pattern":"and try"} },
      { en: "Rover licks my ear. \"Okay, team,\" I say. \"Let's save the world before dinner.\"", zh: "罗孚舔了舔我的耳朵。“好了，各位，”我说，“我们在晚饭前拯救世界吧。”", grammar: {"title":"before 表示在某事之前","explain":"before dinner 给这件事一个期限。","pattern":"before dinner"} }
    ],
    vocab: [
      { w: "claw", pos: "n.", zh: "爪子", eg: "It writes with one enormous claw.", egZh: "它用一只巨大的爪子写字。" },
      { w: "glow", pos: "v.", zh: "发光", eg: "Its eyes glow purple.", egZh: "它的眼睛发着紫光。" },
      { w: "crystal", pos: "n.", zh: "水晶", eg: "Quint finds purple crystals.", egZh: "金特发现了紫色水晶。" },
      { w: "portal", pos: "n.", zh: "传送门", eg: "These crystals are portals.", egZh: "这些水晶是传送门。" },
      { w: "roof", pos: "n.", zh: "屋顶", eg: "We make a plan on the roof.", egZh: "我们在屋顶上定计划。" },
      { w: "battery", pos: "n.", zh: "电池", eg: "Dirk carries the batteries.", egZh: "德克扛着电池。" }
    ],
    quiz: [
      { q: "What colour do Blargh's eyes glow?", options: ["Red", "Green", "Purple"], answer: 2, zh: "布拉格的眼睛发什么颜色的光？" },
      { q: "What are the purple crystals?", options: ["Candy", "Portals", "Batteries"], answer: 1, zh: "紫色水晶是什么？" }
    ],
    game: {
      "title": "Operation: Loud Noise",
      "zh": "行动：制造巨响",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-claw-1",
          "kind": "vocab",
          "prompt": "爪子",
          "sentence": "It writes with one enormous ____.",
          "answer": "claw",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-glow-2",
          "kind": "vocab",
          "prompt": "发光",
          "sentence": "Its eyes ____ purple.",
          "answer": "glow",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-crystal-3",
          "kind": "vocab",
          "prompt": "水晶",
          "sentence": "Quint finds purple ____.",
          "answer": "crystals",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-portal-4",
          "kind": "vocab",
          "prompt": "传送门",
          "sentence": "These crystals are ____.",
          "answer": "portals",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-roof-5",
          "kind": "vocab",
          "prompt": "屋顶",
          "sentence": "We make a plan on the ____.",
          "answer": "roof",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-battery-6",
          "kind": "vocab",
          "prompt": "电池",
          "sentence": "Dirk carries the ____.",
          "answer": "batteries",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "because 说明原因",
          "sentence": "The monster is called Blargh. I know ____ it writes its name on a wall with one enormous claw.",
          "answer": "because",
          "hint": "because 后面是他怎么知道名字的。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "as tall as 表示一样高",
          "sentence": "It is ____ the water tower. Its eyes glow purple, and every step shakes the windows.",
          "answer": "as tall as",
          "hint": "as tall as 用水塔来比高度。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "another 表示另一个",
          "sentence": "Quint finds slimy purple crystals all over town. \"These are portals,\" he says. \"Something opened a door to ____.\"",
          "answer": "another world",
          "hint": "another world 是不同于这个小镇的世界。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "not 指出真正的问题",
          "sentence": "So the zombies are ____. They are just the welcoming committee.",
          "answer": "not the real problem",
          "hint": "not the real problem 说明僵尸不是重点。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "and 连接计划的最后一步",
          "sentence": "We make a plan on the roof of my tree house: use the crystals, make a loud noise, ____ Blargh away from town.",
          "answer": "and lead",
          "hint": "and 把引开巨兽接在计划末尾。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "and 连接同时做的事",
          "sentence": "June draws the map. Dirk carries the batteries. Quint builds the machine. I hold the sword ____ to look brave.",
          "answer": "and try",
          "hint": "and try 是他拿着剑时还在做的事。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "before 表示在某事之前",
          "sentence": "Rover licks my ear. \"Okay, team,\" I say. \"Let's save the world ____.\"",
          "answer": "before dinner",
          "hint": "before dinner 给这件事一个期限。"
        }
      ]
    }
  },
  {
    id: 8,
    title: "We Are the Last Kids",
    zh: "我们是最后的孩子",
    tag: "终极决战",
    art: "assets/ch8.png",
    minutes: 5,
    paragraphs: [
      { en: "Blargh is bigger close up. Much bigger. Its shadow covers the whole football field.", zh: "近距离看，布拉格更大了，大得多。它的影子盖住了整个操场。", grammar: {"title":"close up 表示靠近看","explain":"close up 说明离得很近时的样子。","pattern":"close up"} },
      { en: "Dirk goes first. He swings the stop sign and hits the monster's knee. Blargh looks annoyed.", zh: "德克第一个上，他挥起停车牌砸中怪物的膝盖。布拉格看起来有点不爽。", grammar: {"title":"looks 加形容词","explain":"looks annoyed 表示看起来很恼火。","pattern":"looks annoyed"} },
      { en: "Quint's machine fires a beam of blue light. June throws the crystal spear. Rover bites a giant toe.", zh: "金特的机器射出蓝光，琼投出水晶长矛，罗孚咬住了巨兽的一根脚趾。", grammar: {"title":"throws 表示扔出","explain":"throws 是三个人同时出手中的一个动作。","pattern":"throws"} },
      { en: "And me? I run straight at the purple portal hanging in the air behind Blargh.", zh: "而我呢？我径直冲向布拉格身后悬在半空中的紫色传送门。", grammar: {"title":"And 把话题转到自己","explain":"And me 用来接上轮到自己做什么。","pattern":"And me"} },
      { en: "One swing. The portal cracks like glass. The sky flashes white, and Blargh is pulled back through the door.", zh: "一剑挥下，传送门像玻璃一样裂开。天空闪过一道白光，布拉格被拉回了门后。", grammar: {"title":"like 表示像","explain":"like glass 用玻璃来形容裂开的样子。","pattern":"like glass"} },
      { en: "Then it is quiet. No zombies, no growling. Just four kids, one dog, and a very nice sunrise.", zh: "然后世界安静了。没有僵尸，没有吼声，只有四个孩子、一只狗，和一场特别好看的日出。", grammar: {"title":"No 表示没有","explain":"No zombies 表示那些东西不在了。","pattern":"No zombies"} },
      { en: "June looks at us and says, \"We're the last kids on Earth.\" I add, \"And we're not going down without a fight.\"", zh: "琼看着我们说：“我们是地球上最后的孩子。”我补了一句：“绝不轻易认输。”", grammar: {"title":"without 表示没有","explain":"without a fight 表示不是毫无还手。","pattern":"without a fight"} }
    ],
    vocab: [
      { w: "shadow", pos: "n.", zh: "影子", eg: "Its shadow covers the field.", egZh: "它的影子盖住了操场。" },
      { w: "annoyed", pos: "adj.", zh: "恼火的", eg: "Blargh looks annoyed.", egZh: "布拉格看起来有点恼火。" },
      { w: "beam", pos: "n.", zh: "光束", eg: "The machine fires a beam of light.", egZh: "机器射出一道光束。" },
      { w: "crack", pos: "v.", zh: "裂开", eg: "The portal cracks like glass.", egZh: "传送门像玻璃一样裂开。" },
      { w: "sunrise", pos: "n.", zh: "日出", eg: "It is a very nice sunrise.", egZh: "这是一场很美的日出。" },
      { w: "without a fight", pos: "phr.", zh: "不战而降", eg: "We're not going down without a fight.", egZh: "我们绝不轻易认输。" }
    ],
    quiz: [
      { q: "What does Jack break?", options: ["The stop sign", "The purple portal", "A cookie"], answer: 1, zh: "杰克打碎了什么？" },
      { q: "How does the story end?", options: ["The kids run away", "The town is quiet at sunrise", "Blargh eats the tree house"], answer: 1, zh: "故事是怎样结尾的？" }
    ],
    game: {
      "title": "The Last Battle",
      "zh": "最后一战",
      "intro": {
        "en": "Type the missing words from this chapter.",
        "zh": "把这一章挖掉的词写回去。"
      },
      "recall": [
        {
          "id": "v-shadow-1",
          "kind": "vocab",
          "prompt": "影子",
          "sentence": "Its ____ covers the field.",
          "answer": "shadow",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-annoyed-2",
          "kind": "vocab",
          "prompt": "恼火的",
          "sentence": "Blargh looks ____.",
          "answer": "annoyed",
          "hint": "adj. 本章核心词。"
        },
        {
          "id": "v-beam-3",
          "kind": "vocab",
          "prompt": "光束",
          "sentence": "The machine fires a ____ of light.",
          "answer": "beam",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-crack-4",
          "kind": "vocab",
          "prompt": "裂开",
          "sentence": "The portal ____ like glass.",
          "answer": "cracks",
          "hint": "v. 本章核心词。"
        },
        {
          "id": "v-sunrise-5",
          "kind": "vocab",
          "prompt": "日出",
          "sentence": "It is a very nice ____.",
          "answer": "sunrise",
          "hint": "n. 本章核心词。"
        },
        {
          "id": "v-without-a-fight-6",
          "kind": "vocab",
          "prompt": "不战而降",
          "sentence": "We're not going down ____.",
          "answer": "without a fight",
          "hint": "phr. 本章核心词。"
        },
        {
          "id": "g-1",
          "kind": "grammar",
          "prompt": "close up 表示靠近看",
          "sentence": "Blargh is bigger ____. Much bigger. Its shadow covers the whole football field.",
          "answer": "close up",
          "hint": "close up 说明离得很近时的样子。"
        },
        {
          "id": "g-2",
          "kind": "grammar",
          "prompt": "looks 加形容词",
          "sentence": "Dirk goes first. He swings the stop sign and hits the monster's knee. Blargh ____.",
          "answer": "looks annoyed",
          "hint": "looks annoyed 表示看起来很恼火。"
        },
        {
          "id": "g-3",
          "kind": "grammar",
          "prompt": "throws 表示扔出",
          "sentence": "Quint's machine fires a beam of blue light. June ____ the crystal spear. Rover bites a giant toe.",
          "answer": "throws",
          "hint": "throws 是三个人同时出手中的一个动作。"
        },
        {
          "id": "g-4",
          "kind": "grammar",
          "prompt": "And 把话题转到自己",
          "sentence": "____? I run straight at the purple portal hanging in the air behind Blargh.",
          "answer": "And me",
          "hint": "And me 用来接上轮到自己做什么。"
        },
        {
          "id": "g-5",
          "kind": "grammar",
          "prompt": "like 表示像",
          "sentence": "One swing. The portal cracks ____. The sky flashes white, and Blargh is pulled back through the door.",
          "answer": "like glass",
          "hint": "like glass 用玻璃来形容裂开的样子。"
        },
        {
          "id": "g-6",
          "kind": "grammar",
          "prompt": "No 表示没有",
          "sentence": "Then it is quiet. ____, no growling. Just four kids, one dog, and a very nice sunrise.",
          "answer": "No zombies",
          "hint": "No zombies 表示那些东西不在了。"
        },
        {
          "id": "g-7",
          "kind": "grammar",
          "prompt": "without 表示没有",
          "sentence": "June looks at us and says, \"We're the last kids on Earth.\" I add, \"And we're not going down ____.\"",
          "answer": "without a fight",
          "hint": "without a fight 表示不是毫无还手。"
        }
      ]
    }
  }
];
