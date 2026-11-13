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
      { en: "Tap, tap, tap.", zh: "咚，咚，咚。" },
      { en: "It is dark in my room.", zh: "我的房间黑黑的。" },
      { en: "The sound is under my bed.", zh: "声音是从床底下传来的。" },
      { en: "I look under the bed.", zh: "我弯下腰，往床底下看。" },
      { en: "Two big eyes look back at me.", zh: "两只大眼睛也在看着我。" },
      { en: "It is a little monster. It is scared, too.", zh: "原来是一只小怪物。它也很害怕。" },
      { en: "I turn on the light. We eat a cookie.", zh: "我打开灯。我们一起吃了一块饼干。" },
      { en: "Now we are friends.", zh: "现在，我们是朋友啦。" }
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
      title: "Under My Bed",
      zh: "床底下",
      intro: { en: "Something is under the bed. Let us turn on the light!", zh: "床底下有东西。我们一起把灯打开吧！" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "Tap, tap, tap! Something is under the bed. What do you do?", zh: "咚，咚，咚！床底下有东西。你要怎么做？" },
          fx: "weather/fireflies",
          choices: [
            { label: { en: "Turn on the light", zh: "把灯打开" }, to: "n2", effects: { xp: 10, item: "小夜灯徽章" }, fx: "holy/heal" },
            { label: { en: "Say hello very softly", zh: "轻轻说一声你好" }, to: "n2", effects: { xp: 10 }, fx: "arcane/rune-circle" }
          ]
        },
        n2: {
          text: { en: "Two big eyes! The little monster is scared of the dark. Catch the night lights for it!", zh: "两只大眼睛！小怪物怕黑。帮它接住飘出来的小夜灯吧！" },
          minigame: { type: "whack", duration: 20, goal: 6, title: "点亮冒出来的小夜灯！", next: "end" }
        },
        end: {
          end: true,
          text: { en: "The room is bright. The little monster smiles. Time for a cookie!", zh: "房间亮起来了。小怪物笑了。该吃饼干啦！" }
        }
      }
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
      { en: "I walk home through the woods.", zh: "我穿过树林走回家。" },
      { en: "The sun goes down. It gets dark.", zh: "太阳落山了，天慢慢黑了。" },
      { en: "A shadow walks behind me.", zh: "有个影子跟在我后面。" },
      { en: "I stop. The shadow stops.", zh: "我停下，影子也停下。" },
      { en: "I run. The shadow runs, too.", zh: "我跑起来，影子也跟着跑。" },
      { en: "I look up. It is an owl in a tree!", zh: "我抬头一看——是树上的一只猫头鹰！" },
      { en: "The owl says hoo. I laugh all the way home.", zh: "猫头鹰咕咕叫。我一路笑着回了家。" }
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
      title: "Woods Walk",
      zh: "树林小路",
      intro: { en: "It is getting dark in the woods. Walk home with the little stars.", zh: "树林里天黑了。跟着小星星走回家吧。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "Something follows you through the trees. What do you do?", zh: "树林里好像有东西跟着你。你要怎么做？" },
          fx: "weather/clouds",
          choices: [
            { label: { en: "Look up at the tree", zh: "抬头看看树上" }, to: "n2", effects: { xp: 10 }, fx: "pickups/collect-burst" },
            { label: { en: "Call my friend", zh: "叫上好朋友" }, to: "n2", effects: { xp: 10, item: "同行徽章" }, fx: "ui/achievement" }
          ]
        },
        n2: {
          text: { en: "Hoo! It is only an owl. Pick up the little stars on the path!", zh: "咕咕！原来只是猫头鹰。把小路上的星星捡起来吧！" },
          minigame: { type: "scavenge", duration: 20, goal: 6, title: "捡起路上的小星星！", next: "end" }
        },
        end: {
          end: true,
          text: { en: "The owl flies away. Home is bright and warm. Good night, woods!", zh: "猫头鹰飞走了。家里又亮又暖。晚安，树林！" }
        }
      }
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
      { en: "The hall is long and quiet.", zh: "走廊长长的，安安静静。" },
      { en: "A doll sits by the door.", zh: "门边坐着一个娃娃。" },
      { en: "I walk closer. The doll turns its head.", zh: "我走近一点，娃娃转过了头。" },
      { en: "My heart goes boom, boom, boom.", zh: "我的心咚、咚、咚地跳。" },
      { en: "The window is open. The wind pushes the doll.", zh: "窗户开着，是风在推娃娃。" },
      { en: "It is only my sister's toy.", zh: "原来只是妹妹的玩具。" },
      { en: "I close the window and wave at the doll.", zh: "我关上窗，跟娃娃挥挥手。" }
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
      title: "The Long Hall",
      zh: "长长的走廊",
      intro: { en: "The doll moved! Let us find out why.", zh: "娃娃动了一下！我们一起去看看为什么。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "The doll turns its head. What do you do?", zh: "娃娃转过了头。你要怎么做？" },
          fx: "arcane/blink-in",
          choices: [
            { label: { en: "Close the window", zh: "去把窗户关上" }, to: "n2", effects: { xp: 10 }, fx: "holy/heal" },
            { label: { en: "Wave at the doll", zh: "跟娃娃挥挥手" }, to: "n2", effects: { xp: 10, item: "勇敢徽章" }, fx: "ui/achievement" }
          ]
        },
        n2: {
          text: { en: "It is only the wind! Catch the soft little shadows in the hall.", zh: "原来只是风呀！把走廊里软软的小影子拍下来吧。" },
          minigame: { type: "whack", duration: 18, goal: 5, title: "拍拍飘过的小影子！", next: "end" }
        },
        end: {
          end: true,
          text: { en: "The window is closed. The doll sits still. You wave good night.", zh: "窗关好了，娃娃安静地坐着。你挥手说晚安。" }
        }
      }
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
      { en: "This is my new room.", zh: "这是我的新房间。" },
      { en: "I write Hello on the wall.", zh: "我在墙上写了 Hello。" },
      { en: "In the morning, there is a new line.", zh: "第二天早上，墙上多了一行字。" },
      { en: "It says Hello back.", zh: "上面写着 Hello back。" },
      { en: "Who wrote it? I look and look.", zh: "是谁写的呢？我看了又看。" },
      { en: "My big sister smiles at the door.", zh: "姐姐站在门口笑了。" },
      { en: "We write our names together.", zh: "我们一起写下了名字。" }
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
      title: "Hello, Wall",
      zh: "你好呀，墙",
      intro: { en: "Someone wrote back! Let us draw together.", zh: "有人回信啦！我们一起画画吧。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "A new line is on the wall. What do you write next?", zh: "墙上多了一行字。接下来你想写什么？" },
          fx: "arcane/rune-circle",
          choices: [
            { label: { en: "Write my name", zh: "写下自己的名字" }, to: "n2", effects: { xp: 10 }, fx: "pickups/collect-burst" },
            { label: { en: "Draw a little sun", zh: "画一个小太阳" }, to: "n2", effects: { xp: 10, item: "小太阳徽章" }, fx: "ui/confetti" }
          ]
        },
        n2: {
          text: { en: "Big sister wants to draw, too. Find the colorful crayons!", zh: "姐姐也想一起画。把彩色蜡笔找出来吧！" },
          minigame: { type: "scavenge", duration: 20, goal: 6, title: "收集彩色蜡笔！", next: "end" }
        },
        end: {
          end: true,
          text: { en: "Two names, one big sun. The new room feels like home.", zh: "两个名字，一个大太阳。新房间有家的感觉了。" }
        }
      }
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
      { en: "I look in the mirror.", zh: "我照了照镜子。" },
      { en: "I make a funny face.", zh: "我做了个鬼脸。" },
      { en: "The face in the mirror does not move.", zh: "镜子里的脸却没有动。" },
      { en: "I wave. It waves... late.", zh: "我挥挥手，它慢了一拍才挥。" },
      { en: "I step closer and laugh.", zh: "我凑近一点，笑了起来。" },
      { en: "It is my twin behind the glass!", zh: "原来是玻璃后面的双胞胎呀！" },
      { en: "We make funny faces together.", zh: "我们一起做鬼脸。" }
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
      title: "Funny Faces",
      zh: "鬼脸大集合",
      intro: { en: "The face in the mirror is late! Let us play.", zh: "镜子里的脸慢了一拍！我们来玩吧。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "The face waves late. What do you do?", zh: "镜子里的脸慢了一拍才挥手。你要怎么做？" },
          fx: "scifi/hologram",
          choices: [
            { label: { en: "Make a bigger funny face", zh: "做一个更大的鬼脸" }, to: "n2", effects: { xp: 10 }, fx: "ui/confetti" },
            { label: { en: "Step closer and say hi", zh: "凑近一点说嗨" }, to: "n2", effects: { xp: 10, item: "笑脸徽章" }, fx: "holy/heal" }
          ]
        },
        n2: {
          text: { en: "It is my twin! Catch all the happy smiles!", zh: "原来是双胞胎！把飞出来的笑脸都接住吧！" },
          minigame: { type: "whack", duration: 20, goal: 6, title: "接住飞出来的笑脸！", next: "end" }
        },
        end: {
          end: true,
          text: { en: "Two faces, two big laughs. The mirror is just glass after all.", zh: "两张脸，两阵大笑。镜子终究只是镜子呀。" }
        }
      }
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
      { en: "The lights go out. Oh no!", zh: "灯灭了。哎呀！" },
      { en: "The hall is very, very dark.", zh: "走廊好黑、好黑。" },
      { en: "My friends are here with me.", zh: "好朋友们和我在一起。" },
      { en: "We hold hands. We count to ten.", zh: "我们手拉着手，一起数到十。" },
      { en: "One, two, three... ten!", zh: "一、二、三……十！" },
      { en: "The lights come on. Nothing is there.", zh: "灯亮了。什么都没有。" },
      { en: "We all laugh. Good night, shadows.", zh: "我们都笑了。晚安啦，影子。" }
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
      title: "Good Night, Shadows",
      zh: "晚安，影子",
      intro: { en: "The lights went out. Hold hands and walk together!", zh: "灯灭了。手拉手，一起走过去吧！" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "The hall is very dark. What do you do with your friends?", zh: "走廊好黑。你要和朋友们怎么做？" },
          fx: "weather/fireflies",
          choices: [
            { label: { en: "Hold hands and count to ten", zh: "手拉手一起数到十" }, stat: "heart", dc: 4, success: { text: { en: "One, two, three... ten! Nobody is scared now.", zh: "一、二、三……十！大家都不怕了。" }, to: "n2", fx: "ui/confetti" }, fail: { text: { en: "You mix up six and seven, and everyone giggles. Try again!", zh: "把六和七数错了，大家笑成一团。再来一次！" }, to: "n2", fx: "pickups/collect-burst" } },
            { label: { en: "Sing a little song", zh: "一起唱首小歌" }, to: "n2", effects: { xp: 10, item: "勇气徽章" }, fx: "holy/heal" }
          ]
        },
        n2: {
          text: { en: "Almost there! Catch the last little shadows before the lights come on.", zh: "就快到啦！在灯亮之前，接住最后几个小影子吧。" },
          minigame: { type: "whack", duration: 22, goal: 8, title: "接住最后的小影子！", next: "end" }
        },
        end: {
          end: true,
          grand: true,
          text: { en: "The lights come on. We are not scared anymore. Good night, shadows!", zh: "灯亮了。我们再也不害怕啦。晚安，影子！" }
        }
      }
    }
  }
];
