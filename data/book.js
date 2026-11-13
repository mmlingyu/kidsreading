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
      { en: "My name is Jack Sullivan. I am thirteen years old, and I live in a tree house.", zh: "我叫杰克·沙利文，今年十三岁，住在一座树屋里。" },
      { en: "It is not a normal tree house. It has a zip line, a snack closet, and a very big sword.", zh: "这不是一座普通的树屋。它有滑索、零食柜，还有一把超级大的剑。" },
      { en: "Forty-two days ago, monsters came to our town. Most people ran away. I stayed.", zh: "四十二天前，怪物来到了我们的小镇。大多数人都逃走了，我留了下来。" },
      { en: "Now the streets are full of zombies. They are slow, they are smelly, and they are not very smart.", zh: "现在街上到处都是僵尸。它们行动缓慢、臭烘烘的，而且不太聪明。" },
      { en: "Every morning I eat cookies for breakfast. Then I check my traps and count my soda.", zh: "每天早上我吃饼干当早餐，然后检查陷阱、数一数我的汽水。" },
      { en: "But today something is different. The zombies are walking toward my tree. Lots of them.", zh: "但今天有些不一样。僵尸们正朝我的树走来，而且是一大群。" },
      { en: "I grab my sword and smile. \"Okay,\" I say. \"Let's play.\"", zh: "我抓起剑，笑了。“好啊，”我说，“那就开打吧。”" }
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
      title: "Tree House Defense",
      zh: "树屋守卫战",
      intro: { en: "The zombies are climbing! Protect your tree house and your snacks.", zh: "僵尸正在往上爬！守住你的树屋和零食。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "Three zombies are at the bottom of the tree. One is already on the ladder!", zh: "三只僵尸已经到了树下，其中一只已经爬上了梯子！" },
          fx: "weather/clouds",
          choices: [
            { label: { en: "Kick the ladder with all my strength", zh: "用尽全力踹翻梯子" }, stat: "guts", dc: 6, success: { text: { en: "CRASH! The ladder falls and the zombie lands in a bush. It looks very confused.", zh: "哐当！梯子倒了，僵尸摔进灌木丛，一脸懵。" }, to: "n2", fx: "explosions/cartoon-pow" }, fail: { text: { en: "The ladder shakes but does not fall. A zombie grabs your shoe and you lose a sock. Time for plan B!", zh: "梯子晃了晃却没倒。僵尸抓住了你的鞋，你丢掉了一只袜子。只好用 B 计划了！" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Throw soda cans like water balloons", zh: "像扔水球一样扔汽水罐" }, stat: "brains", dc: 5, success: { text: { en: "FIZZ! Two cans explode on the zombies. They slip on the sticky soda and slide away.", zh: "呲——两罐汽水在僵尸身上炸开，它们踩着黏糊糊的汽水滑走了。" }, to: "n2", fx: "nature/acid-splash" }, fail: { text: { en: "You throw your last can... and miss. That was your breakfast soda. Ouch.", zh: "你扔出最后一罐汽水……没中。那可是你的早餐汽水啊，心疼。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n2: {
          text: { en: "More zombies are coming out of the forest. Quick, defend the tree!", zh: "更多僵尸从树林里钻了出来。快，守住大树！" },
          minigame: { type: "whack", duration: 25, goal: 12, title: "点击冒出来的僵尸！", next: "n3" }
        },
        n3: {
          text: { en: "The last zombie runs away. Your tree house is safe, and so are your cookies.", zh: "最后一只僵尸逃走了。树屋安全了，你的饼干也安全了。" },
          choices: [
            { label: { en: "Celebrate with a cookie", zh: "吃块饼干庆祝一下" }, to: "end", effects: { xp: 10 }, fx: "pickups/collect-burst" },
            { label: { en: "Write \"ZOMBIES: 0, JACK: 1\" on the wall", zh: "在墙上记下“僵尸 0，杰克 1”" }, to: "end", effects: { xp: 10 }, fx: "ui/achievement" }
          ]
        },
        end: {
          end: true,
          text: { en: "You won your first battle. But tonight, you hear a strange sound from the empty town... and your snack closet is almost empty.", zh: "你赢下了第一场战斗。但今晚，你听到空荡的小镇上传来奇怪的声音……而你的零食柜也快见底了。" }
        }
      }
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
      { en: "A hero cannot fight monsters on an empty stomach. My snack closet has one cookie and half a soda.", zh: "英雄也不能饿着肚子打怪。我的零食柜里只剩一块饼干和半罐汽水。" },
      { en: "So I do something very brave and very stupid: I go to the supermarket.", zh: "于是我做了一件既勇敢又愚蠢的事：我去超市。" },
      { en: "The supermarket is dark and quiet. The lights are off, and the floor is covered with purple slime.", zh: "超市里又黑又安静。灯全灭了，地板上覆盖着一层紫色的黏液。" },
      { en: "I fill my bag with cookies, chips, and twelve bottles of soda. Best day ever!", zh: "我往包里塞满饼干、薯片和十二瓶汽水。简直是人生最棒的一天！" },
      { en: "Then I see it: a giant footprint. It is bigger than my whole tree house.", zh: "就在这时，我看到了它：一个巨大的脚印，比我整座树屋还要大。" },
      { en: "Something very big lives in this town now. And it is not a zombie.", zh: "现在这个镇上住着一个庞然大物，而且它不是僵尸。" },
      { en: "I take my snacks and run. I do not look back. Well, maybe I look back once.", zh: "我抓起零食就跑，不敢回头。好吧，也许我回头看了一眼。" }
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
      title: "Snack Run",
      zh: "零食大作战",
      intro: { en: "Grab what you need, stay quiet, and find out what made that footprint.", zh: "拿齐物资、保持安静，顺便查查那个大脚印是谁留下的。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "You are inside the dark supermarket. Your torch shows three aisles: snacks, drinks, and something moving in the shadows.", zh: "你身处漆黑的超市里。手电照亮三条通道：零食区、饮料区，还有阴影里某个正在动的东西。" },
          minigame: { type: "scavenge", duration: 30, goal: 8, title: "在手电熄灭前收集 8 份物资！", next: "n2" }
        },
        n2: {
          text: { en: "A low growl comes from the drinks aisle. The purple slime is moving toward your shoes.", zh: "饮料区传来低沉的吼声，紫色黏液正朝着你的鞋子蔓延。" },
          fx: "nature/acid-splash",
          choices: [
            { label: { en: "Jump onto the checkout counter", zh: "跳上收银台" }, stat: "guts", dc: 5, success: { text: { en: "You leap onto the counter just in time. The slime slides under your feet.", zh: "你及时跳上收银台，黏液从你脚下滑过。" }, to: "n3", fx: "moves/dash-strike" }, fail: { text: { en: "Your shoe sticks in the slime. You pull it free, but now it smells terrible.", zh: "你的鞋被黏液粘住了。你用力拔了出来，但它现在臭得要命。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Roll a soda bottle away to make noise", zh: "把汽水瓶滚到远处制造声响" }, stat: "brains", dc: 5, success: { text: { en: "The bottle rolls away. The growl follows the sound, and you walk out like a ninja.", zh: "瓶子滚向远处，吼声跟着声音走了，你像忍者一样溜了出去。" }, to: "n3", fx: "projectiles/energy-disc" }, fail: { text: { en: "The bottle hits a shelf. CLANG! Now the whole shop knows you are here.", zh: "瓶子撞上了货架。哐！现在整个超市都知道你在这儿了。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n3: {
          text: { en: "Outside, you see the footprint again. A huge shadow moves behind the mall.", zh: "到了外面，你又看到了那个大脚印。一个巨大的影子在商场后面移动。" },
          choices: [
            { label: { en: "Take a photo for evidence", zh: "拍张照片留作证据" }, to: "end", effects: { xp: 10, item: "巨兽照片" }, fx: "pickups/collect-burst" },
            { label: { en: "Run home and lock the door", zh: "跑回家锁好门" }, to: "end", effects: { xp: 10 }, fx: "moves/dash-strike" }
          ]
        },
        end: {
          end: true,
          text: { en: "You made it home with a full bag of snacks. But you cannot stop thinking about that giant shadow. You need a team.", zh: "你带着满满一包零食回到了家。但那个巨大的影子在你脑海里挥之不去。你需要一支队伍。" }
        }
      }
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
      { en: "Quint Baker is my best friend. Before the monsters, he was just a kid with too many science books.", zh: "金特·贝克是我最好的朋友。在怪物出现之前，他只是一个科学书太多的小孩。" },
      { en: "Now he is a kid with too many science books and a zombie-proof cart.", zh: "现在，他是一个科学书太多、还拥有一辆防僵尸推车的小孩。" },
      { en: "I find him in his backyard, wearing three pairs of glasses. \"One broke,\" he says. \"Then another broke.\"", zh: "我在他家后院找到了他，他戴着三副眼镜。“碎了一副，”他说，“然后又碎了一副。”" },
      { en: "His cart is full of bottles, tubes, and strange machines. One of them is beeping.", zh: "他的推车上装满了瓶子、试管和奇怪的机器，其中一台还在滴滴响。" },
      { en: "\"I call it the Zapper,\" Quint says. \"It makes zombies very, very sleepy.\"", zh: "“我管它叫电击枪，”金特说，“它能让僵尸变得非常、非常困。”" },
      { en: "A zombie walks into the yard. Quint presses a red button. The zombie falls asleep standing up.", zh: "一只僵尸走进院子。金特按下红色按钮，那只僵尸站着就睡着了。" },
      { en: "\"Okay,\" I say. \"You are definitely on my team.\"", zh: "“好吧，”我说，“你一定要加入我的小队。”" }
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
      title: "Science vs. Zombies",
      zh: "科学大战僵尸",
      intro: { en: "Help Quint finish his invention before the yard is full of zombies.", zh: "在院子被僵尸挤满之前，帮金特完成他的发明。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "The Zapper needs one last part. Quint hands you three things: a battery, a rubber duck, and a fork.", zh: "电击枪还差最后一个零件。金特递给你三样东西：一节电池、一只橡皮鸭和一把叉子。" },
          fx: "lightning/charge-up",
          choices: [
            { label: { en: "The battery, obviously", zh: "当然是电池" }, stat: "brains", dc: 4, success: { text: { en: "The Zapper hums to life. Blue sparks dance along the tubes.", zh: "电击枪嗡嗡启动，蓝色电火花顺着管子跳动。" }, to: "n2", fx: "lightning/plasma-ball" }, fail: { text: { en: "It fits, but the Zapper only makes a sad little squeak. Quint fixes it for you.", zh: "装是装上了，可电击枪只发出一声可怜的吱呀。金特帮你修好了。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "The rubber duck. Science is weird", zh: "橡皮鸭。科学就是很离奇" }, stat: "guts", dc: 8, success: { text: { en: "Amazingly, it works. The duck squeaks and the Zapper fires. Quint looks offended that you guessed it.", zh: "居然真的成功了！橡皮鸭吱呀一叫，电击枪开火了。金特对你居然猜中了感到很没面子。" }, to: "n2", fx: "lightning/plasma-ball", effects: { xp: 20 } }, fail: { text: { en: "The duck melts a little. Quint sighs and gives you the battery.", zh: "橡皮鸭有点融化了。金特叹了口气，把电池递给你。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n2: {
          text: { en: "Five zombies push through the gate. Quint is still holding the Zapper upside down.", zh: "五只僵尸挤开了院门，而金特还把电击枪拿倒了。" },
          choices: [
            { label: { en: "Turn the Zapper around and aim", zh: "把电击枪转正并瞄准" }, stat: "brains", dc: 5, success: { text: { en: "ZAP! A blue wave rolls across the yard. All five zombies sit down and start snoring.", zh: "滋啦！一道蓝色电波扫过院子，五只僵尸全都坐下打起了呼噜。" }, to: "n3", fx: "lightning/chain-lightning" }, fail: { text: { en: "You zap the garden hose. It is now very clean. Try again, hero.", zh: "你电到了花园水管。它现在非常干净。再来一次吧，英雄。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Push the cart into the zombies", zh: "把推车推向僵尸" }, stat: "guts", dc: 5, success: { text: { en: "The cart rolls down the slope like a bowling ball. STRIKE! Zombies everywhere.", zh: "推车顺着斜坡像保龄球一样滚下去。全中！僵尸倒了一地。" }, to: "n3", fx: "explosions/cartoon-pow" }, fail: { text: { en: "The cart hits a rock and spills beakers everywhere. Quint screams about his experiments.", zh: "推车撞上石头，烧杯撒了一地。金特为他的实验发出惨叫。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n3: {
          text: { en: "The yard is safe. Quint looks at you and smiles.", zh: "院子安全了。金特看着你，笑了。" },
          choices: [
            { label: { en: "\"Join my team. We need your brain.\"", zh: "“加入我的小队吧，我们需要你的大脑。”" }, to: "end", effects: { xp: 15, item: "队友：金特" }, fx: "ui/achievement" }
          ]
        },
        end: {
          end: true,
          text: { en: "Now there are two of you. Two kids against the end of the world. Better odds already.", zh: "现在你们有两个人了。两个孩子对抗世界末日，胜算已经大了不少。" }
        }
      }
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
      { en: "Dirk Savage used to be the biggest bully at our school. He could break a pencil with one hand.", zh: "德克·萨维奇以前是我们学校最凶的校霸，他一只手就能把铅笔掰断。" },
      { en: "Now he is standing on a school bus, swinging a broken stop sign at six zombies.", zh: "现在他站在一辆校车上，挥着半截停车牌对付六只僵尸。" },
      { en: "\"Need help?\" I shout. \"NO!\" he shouts back. Then a zombie grabs his jacket.", zh: "“要帮忙吗？”我喊。“不用！”他喊回来。然后一只僵尸抓住了他的外套。" },
      { en: "Quint and I look at each other. We help anyway.", zh: "我和金特对视了一眼，还是上去帮忙了。" },
      { en: "Quint's Zapper flashes, I pull the zombie away, and Dirk smashes the bus window to escape.", zh: "金特的电击枪一闪，我把僵尸拉开，德克砸开车窗冲了出来。" },
      { en: "He is quiet for a moment. Then he says, \"Thanks. I guess we are a team now.\"", zh: "他安静了一会儿，然后说：“谢了。看来我们现在是一队的了。”" },
      { en: "Three kids, one cart, and zero adults. Honestly, this is going pretty well.", zh: "三个孩子、一辆推车、零个大人。说实话，目前进展还不错。" }
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
      title: "Bus Rescue",
      zh: "校车营救",
      intro: { en: "A kid who used to be your enemy needs help. What do you do?", zh: "曾经的对手需要帮助，你会怎么做？" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "Dirk is trapped on the school bus. Zombies are pushing against both doors.", zh: "德克被困在校车上，僵尸正从两侧车门往里挤。" },
          fx: "weather/clouds",
          choices: [
            { label: { en: "Help him. Nobody gets left behind", zh: "去帮他。一个都不能丢下" }, stat: "heart", dc: 4, success: { text: { en: "You and Quint pull the doors open. Dirk jumps out and lands next to you with a THUD.", zh: "你和金特拉开车门，德克跳出来，砰的一声落在你们身边。" }, to: "n2", fx: "explosions/dirt-explosion" }, fail: { text: { en: "The door is stuck! You get a face full of zombie breath. Try again.", zh: "门卡住了！你迎面闻到一股僵尸口气。再试一次。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Throw a soda can to distract the zombies", zh: "扔汽水罐引开僵尸" }, stat: "brains", dc: 5, success: { text: { en: "The can lands on the football field with a loud FIZZ. Every zombie turns and shuffles away.", zh: "汽水罐落在操场上发出响亮的呲声，所有僵尸都转身慢慢走开了。" }, to: "n2", fx: "nature/acid-splash" }, fail: { text: { en: "The can hits Dirk's window instead. He is not impressed.", zh: "汽水罐砸到了德克旁边的车窗。他看起来不太高兴。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n2: {
          text: { en: "The biggest zombie is still blocking the path. Dirk rolls up his sleeves.", zh: "最大的那只僵尸还堵在路上。德克卷起了袖子。" },
          choices: [
            { label: { en: "Let Dirk lead the charge", zh: "让德克打头阵" }, stat: "guts", dc: 6, success: { text: { en: "WHAM! Dirk sends the zombie flying into a bush. He actually smiles.", zh: "砰！德克把僵尸打飞进灌木丛，他居然笑了。" }, to: "n3", fx: "explosions/cartoon-pow", effects: { xp: 15 } }, fail: { text: { en: "The zombie catches his arm. You pull Dirk back just in time.", zh: "僵尸抓住了他的胳膊，你及时把德克拉了回来。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Use Quint's Zapper to clear the path", zh: "用金特的电击枪清路" }, stat: "brains", dc: 5, success: { text: { en: "A blue wave sweeps the street. The zombie sits down and falls asleep mid-growl.", zh: "蓝色电波扫过街道，那只僵尸吼到一半就坐下睡着了。" }, to: "n3", fx: "lightning/chain-lightning", effects: { xp: 15 } }, fail: { text: { en: "The Zapper makes a squeak and then goes quiet. Quint needs a new battery.", zh: "电击枪吱呀一声就没动静了，金特需要一块新电池。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n3: {
          text: { en: "Dirk kicks a dent in the bus and says, \"So... what is the plan?\"", zh: "德克一脚把校车踢出个坑，说：“所以……接下来怎么办？”" },
          choices: [
            { label: { en: "\"We find June. Then we find out what made that giant footprint.\"", zh: "“先找到琼，再查清那个大脚印是什么。”" }, to: "end", effects: { xp: 10, item: "队友：德克" }, fx: "ui/achievement" }
          ]
        },
        end: {
          end: true,
          text: { en: "Three kids walk toward the school. Nobody says it out loud, but you are not just surviving now. You are a team.", zh: "三个孩子朝学校走去。谁都没有说出口，但你们已经不只是求生了——你们是一支队伍。" }
        }
      }
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
      { en: "I have been looking for June Del Toro since the monsters came. I saw her get on a school bus.", zh: "从怪物来的那天起，我就一直在找琼·德尔托罗。我看见她上了一辆校车。" },
      { en: "So we go to the school. The halls are dark, and the lockers are all open.", zh: "于是我们去了学校。走廊里很暗，储物柜全都敞开着。" },
      { en: "\"Hello?\" I call. My voice sounds small in the empty hallway.", zh: "“有人吗？”我喊了一声，声音在空荡的走廊里显得特别小。" },
      { en: "Then a door opens. June steps out, holding a broom with a knife taped to the end.", zh: "这时一扇门开了。琼走了出来，手里拿着一把绑了刀的扫帚。" },
      { en: "\"I have been fine for six weeks,\" she says. \"Were you coming to rescue me?\"", zh: "“我这六个星期一直好好的，”她说，“你是来救我的吗？”" },
      { en: "I feel my face get hot. \"Uh... maybe?\"", zh: "我感觉脸一下子烫了。“呃……算是吧？”" },
      { en: "June laughs and joins us. She is the bravest person in this whole town, and she knows it.", zh: "琼笑着加入了我们。她是全镇最勇敢的人，而且她自己也知道。" }
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
      title: "School Stealth Mission",
      zh: "校园潜入任务",
      intro: { en: "Move through the school without waking what sleeps in the gym.", zh: "穿过学校，别吵醒体育馆里睡着的东西。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "The gym door is moving. Something huge is breathing behind it. June points to two paths: the library or the cafeteria.", zh: "体育馆的门在动，门后有个庞然大物在呼吸。琼指了指两条路：图书馆或食堂。" },
          fx: "shadow/black-hole",
          choices: [
            { label: { en: "Sneak through the library", zh: "悄悄穿过图书馆" }, stat: "brains", dc: 5, success: { text: { en: "You tiptoe between the shelves. Not one book falls. Perfect stealth.", zh: "你们踮着脚从书架间穿过，一本书都没掉。完美潜行。" }, to: "n2", fx: "arcane/blink-in" }, fail: { text: { en: "You knock over a whole shelf of encyclopedias. The gym door stops moving. Uh-oh.", zh: "你撞倒了一整架百科全书。体育馆的门不动了。糟糕。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Go through the cafeteria and grab snacks", zh: "走食堂，顺便拿点零食" }, stat: "guts", dc: 6, success: { text: { en: "June lifts a whole crate of cookies without a sound. You are a legend.", zh: "琼一声不响地扛起一整箱饼干。你简直是个传奇。" }, to: "n2", fx: "pickups/collect-burst", effects: { xp: 15 } }, fail: { text: { en: "A tray CLANGS to the floor. Everyone freezes for five very long seconds.", zh: "一个托盘哐当落地，所有人僵住了整整五秒。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n2: {
          text: { en: "The gym door opens a crack. One enormous purple eye looks out at you.", zh: "体育馆的门开了一条缝，一只巨大的紫色眼睛朝你们看过来。" },
          choices: [
            { label: { en: "Hold still and don't breathe", zh: "屏住呼吸，一动不动" }, stat: "heart", dc: 6, success: { text: { en: "The eye blinks slowly and the door closes again. Nobody moves until you are outside.", zh: "那只眼睛慢慢眨了一下，门又关上了。直到走出学校，谁都没敢动。" }, to: "n3", fx: "arcane/blink-out" }, fail: { text: { en: "Dirk sneezes. The eye opens wide — then June yawns and says, \"That thing is afraid of us.\"", zh: "德克打了个喷嚏，眼睛猛地睁大——琼却打了个哈欠说：“那家伙怕我们呢。”" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Close the door and run", zh: "关上门就跑" }, stat: "guts", dc: 4, success: { text: { en: "You slam the door and sprint down the hall. Four kids, one breath, zero regrets.", zh: "你甩上门，四个人沿着走廊狂奔。四个人，一口气，零后悔。" }, to: "n3", fx: "moves/dash-strike" }, fail: { text: { en: "You run into a mop bucket. It is loud, wet, and extremely undignified.", zh: "你撞上了拖把桶，又响又湿，还特别没面子。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n3: {
          text: { en: "Outside, the sun is going down. June looks at the four of you and grins.", zh: "外面太阳快落山了。琼看着你们四个人，咧嘴一笑。" },
          choices: [
            { label: { en: "\"So, where do we find a giant monster?\"", zh: "“那么，去哪儿找那只巨型怪物？”" }, to: "end", effects: { xp: 10, item: "队友：琼" }, fx: "ui/achievement" }
          ]
        },
        end: {
          end: true,
          text: { en: "You are not looking for survivors any more. You are looking for the thing that turned your town into a monster park.", zh: "你们不再寻找幸存者了。你们要找的，是把小镇变成怪物乐园的那个东西。" }
        }
      }
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
      { en: "We hear the sound first: a happy little bark, very deep and very loud.", zh: "我们先听到了声音：一声很开心、很低沉、又很响亮的狗叫。" },
      { en: "Behind the mall sits a monster the size of a bus. It has six legs, three eyes, and a tail like a wrecking ball.", zh: "商场后面趴着一只公交车那么大的怪物。它有六条腿、三只眼睛，尾巴像一颗拆楼铁球。" },
      { en: "Quint whispers, \"That is scientifically impossible.\" The monster licks his face.", zh: "金特小声说：“这在科学上是不可能的。”怪物舔了他的脸。" },
      { en: "It is not a monster. It is a very big, very lonely puppy.", zh: "它不是怪物，它是一只很大、很孤单的小狗。" },
      { en: "June throws a giant old tire. The monster jumps up, catches it, and does a happy wiggle.", zh: "琼扔出一个巨大的旧轮胎，怪物跳起来接住，开心地扭了扭身子。" },
      { en: "I name him Rover. Quint says that is not a proper scientific name. Nobody listens.", zh: "我给它取名罗孚。金特说这不是正经的科学命名，没人理他。" },
      { en: "Now our team has four kids and one monster puppy. I call that a fair fight.", zh: "现在队里有四个孩子和一只怪物小狗。我觉得这下势均力敌了。" }
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
      title: "Make a New Friend",
      zh: "交个新朋友",
      intro: { en: "A monster puppy wants to play. Choose the right way to say hello.", zh: "一只怪物小狗想玩。用正确的方式跟它打招呼。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "Rover is watching you with all three eyes. His tail is wagging so hard it knocks over a lamppost.", zh: "罗孚用三只眼睛一起盯着你。它的尾巴摇得太用力，把一根路灯都扫倒了。" },
          fx: "weather/fireflies",
          choices: [
            { label: { en: "Offer him a cookie", zh: "递给它一块饼干" }, stat: "heart", dc: 4, success: { text: { en: "Rover takes the cookie very gently. Then he rests his huge head in your lap.", zh: "罗孚非常轻柔地叼走饼干，然后把大脑袋搁在了你腿上。" }, to: "n2", fx: "holy/heal" }, fail: { text: { en: "Rover eats the whole bag, wrapper and all. He looks hopeful for more.", zh: "罗孚把整袋饼干连包装一起吃了，还眼巴巴地想要更多。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Show him your sword so he knows you are boss", zh: "亮出剑，让它知道谁是老大" }, stat: "guts", dc: 8, success: { text: { en: "Rover tilts his head, then drops a slobbery tennis ball at your feet. He has chosen you as boss.", zh: "罗孚歪了歪头，然后把一只湿漉漉的网球放到你脚边。它认你当老大了。" }, to: "n2", fx: "ui/achievement", effects: { xp: 20 } }, fail: { text: { en: "Rover thinks the sword is a stick and tries to fetch it. You let him win.", zh: "罗孚把剑当成了树枝想叼走。你决定让它赢。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n2: {
          text: { en: "Suddenly Rover jumps up. He is staring at the sky above the town. Something huge is moving there.", zh: "罗孚忽然跳了起来，盯着小镇上方的天空。那里有个巨大的东西在移动。" },
          choices: [
            { label: { en: "Climb on Rover's back for a better look", zh: "爬到罗孚背上看看" }, stat: "guts", dc: 5, success: { text: { en: "From up there you see it clearly: a giant purple monster walking between the houses.", zh: "从高处你看得清清楚楚：一只紫色巨兽正走在房子之间。" }, to: "n3", fx: "moves/dash-strike" }, fail: { text: { en: "Rover wiggles and you slide off into a bush. But you still see the monster.", zh: "罗孚一扭身，你滑下来摔进灌木丛，不过还是看到了那只怪物。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Ask Quint to use his beeping machine", zh: "让金特用他那台会响的机器" }, stat: "brains", dc: 5, success: { text: { en: "The machine draws a map in blue light. One enormous red dot sits right in the town centre.", zh: "机器用蓝光画出一张地图，镇中心有一个巨大的红点。" }, to: "n3", fx: "scifi/hologram" }, fail: { text: { en: "The machine beeps once and shows a picture of a sandwich. Not helpful.", zh: "机器响了一声，显示出一张三明治图片。毫无帮助。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n3: {
          text: { en: "Rover puts his head under your hand, as if to say: I am with you.", zh: "罗孚把脑袋凑到你手底下，像是在说：我跟你一起。" },
          choices: [
            { label: { en: "\"Good boy. Let's go home.\"", zh: "“好孩子，我们回家。”" }, to: "end", effects: { xp: 10, item: "宠物：罗孚" }, fx: "ui/achievement" }
          ]
        },
        end: {
          end: true,
          text: { en: "Four kids. One monster puppy. And a giant problem walking into town. Tomorrow, we fight.", zh: "四个孩子，一只怪物小狗，还有一个正走进小镇的大麻烦。明天，开战。" }
        }
      }
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
      { en: "The monster is called Blargh. I know because it writes its name on a wall with one enormous claw.", zh: "那只怪物叫布拉格。我之所以知道，是因为它用一只巨大的爪子在墙上写下了自己的名字。" },
      { en: "It is as tall as the water tower. Its eyes glow purple, and every step shakes the windows.", zh: "它有水塔那么高，眼睛发着紫光，每走一步窗户都在抖。" },
      { en: "Quint finds slimy purple crystals all over town. \"These are portals,\" he says. \"Something opened a door to another world.\"", zh: "金特在镇上到处发现紫色水晶。“这些是传送门，”他说，“有东西打开了通往另一个世界的大门。”" },
      { en: "So the zombies are not the real problem. They are just the welcoming committee.", zh: "所以僵尸并不是真正的问题，它们只是「迎宾队伍」而已。" },
      { en: "We make a plan on the roof of my tree house: use the crystals, make a loud noise, and lead Blargh away from town.", zh: "我们在树屋顶上定下计划：利用水晶、制造巨响，把布拉格引离小镇。" },
      { en: "June draws the map. Dirk carries the batteries. Quint builds the machine. I hold the sword and try to look brave.", zh: "琼画地图，德克扛电池，金特造机器，我握着剑，努力让自己看起来很勇敢。" },
      { en: "Rover licks my ear. \"Okay, team,\" I say. \"Let's save the world before dinner.\"", zh: "罗孚舔了舔我的耳朵。“好了，各位，”我说，“我们在晚饭前拯救世界吧。”" }
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
      title: "Operation: Loud Noise",
      zh: "行动：制造巨响",
      intro: { en: "Build Quint's machine and lure the giant away from the town.", zh: "组装金特的机器，把巨兽引离小镇。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "Quint's machine needs power. Dirk holds three batteries, and one of them is glowing purple.", zh: "金特的机器需要电源。德克拿着三块电池，其中一块发着紫光。" },
          fx: "arcane/portal",
          choices: [
            { label: { en: "Use the glowing purple one", zh: "用发紫光的那块" }, stat: "brains", dc: 6, success: { text: { en: "The machine ROARS to life. A column of blue light shoots into the sky.", zh: "机器轰然启动，一道蓝色光柱直冲天空。" }, to: "n2", fx: "lightning/plasma-ball" }, fail: { text: { en: "The machine burps purple smoke and goes quiet. Quint needs a minute.", zh: "机器吐出一团紫烟就不动了。金特需要一点时间。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Use all three batteries at once", zh: "三块电池一起上" }, stat: "guts", dc: 7, success: { text: { en: "The machine screams with a sound only monsters can hear. Blargh turns his huge head.", zh: "机器发出只有怪物才听得见的尖啸，布拉格转过了它巨大的头。" }, to: "n2", fx: "explosions/big-explosion", effects: { xp: 20 } }, fail: { text: { en: "All the lights in town pop at once. Great. Now it is very dark.", zh: "全镇的灯瞬间全爆了。很好，现在一片漆黑。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n2: {
          text: { en: "Blargh is coming. The ground shakes like an earthquake. You need to lead it to the empty football field.", zh: "布拉格来了，地面像地震一样晃动。你得把它引到空旷的操场去。" },
          choices: [
            { label: { en: "Ride Rover and wave the sword", zh: "骑上罗孚，挥剑引诱" }, stat: "guts", dc: 6, success: { text: { en: "Rover runs like a furry rocket. Blargh follows, crushing only a few parked cars.", zh: "罗孚像毛茸茸的火箭一样飞奔，布拉格跟了上来，只压坏了区区几辆停着的车。" }, to: "n3", fx: "moves/dash-strike" }, fail: { text: { en: "Blargh looks at you, then at the school, and walks toward the school instead.", zh: "布拉格看了你一眼，又看了看学校，然后朝学校走了过去。" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Let June set up the crystal decoys", zh: "让琼布置水晶诱饵" }, stat: "brains", dc: 5, success: { text: { en: "June places the crystals in a perfect line. Blargh follows the glowing trail to the field.", zh: "琼把水晶排成一条完美的线，布拉格顺着光迹走向了操场。" }, to: "n3", fx: "arcane/rune-circle" }, fail: { text: { en: "The crystals roll downhill into a storm drain. Improvise!", zh: "水晶顺着坡滚进了下水道。随机应变！" }, to: "n3", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n3: {
          text: { en: "The giant is standing in the middle of the field. Around you, the whole team is ready.", zh: "巨兽站在操场中央，你身边的全队都已就位。" },
          choices: [
            { label: { en: "\"Everyone together. On three!\"", zh: "“大家一起，数到三！”" }, to: "end", effects: { xp: 15, item: "作战计划" }, fx: "ui/achievement" }
          ]
        },
        end: {
          end: true,
          text: { en: "One. Two. Three — the sky turns purple, and the biggest fight of your life begins.", zh: "一、二、三——天空变成紫色，你这一生最宏大的一战开始了。" }
        }
      }
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
      { en: "Blargh is bigger close up. Much bigger. Its shadow covers the whole football field.", zh: "近距离看，布拉格更大了，大得多。它的影子盖住了整个操场。" },
      { en: "Dirk goes first. He swings the stop sign and hits the monster's knee. Blargh looks annoyed.", zh: "德克第一个上，他挥起停车牌砸中怪物的膝盖。布拉格看起来有点不爽。" },
      { en: "Quint's machine fires a beam of blue light. June throws the crystal spear. Rover bites a giant toe.", zh: "金特的机器射出蓝光，琼投出水晶长矛，罗孚咬住了巨兽的一根脚趾。" },
      { en: "And me? I run straight at the purple portal hanging in the air behind Blargh.", zh: "而我呢？我径直冲向布拉格身后悬在半空中的紫色传送门。" },
      { en: "One swing. The portal cracks like glass. The sky flashes white, and Blargh is pulled back through the door.", zh: "一剑挥下，传送门像玻璃一样裂开。天空闪过一道白光，布拉格被拉回了门后。" },
      { en: "Then it is quiet. No zombies, no growling. Just four kids, one dog, and a very nice sunrise.", zh: "然后世界安静了。没有僵尸，没有吼声，只有四个孩子、一只狗，和一场特别好看的日出。" },
      { en: "June looks at us and says, \"We're the last kids on Earth.\" I add, \"And we're not going down without a fight.\"", zh: "琼看着我们说：“我们是地球上最后的孩子。”我补了一句：“绝不轻易认输。”" }
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
      title: "The Last Battle",
      zh: "最后一战",
      intro: { en: "Four kids, one monster puppy, one giant. Use everyone's strength.", zh: "四个孩子、一只怪物小狗、一个巨人。用上每个人的力量。" },
      start: "n1",
      nodes: {
        n1: {
          text: { en: "Blargh swings one huge arm at the team. Choose your opening move.", zh: "布拉格朝小队挥出巨臂。选择你的开局动作。" },
          fx: "shadow/dark-explosion",
          choices: [
            { label: { en: "Dirk: block the arm with the stop sign", zh: "德克：用停车牌挡住手臂" }, stat: "guts", dc: 6, success: { text: { en: "CLANG! Dirk holds the arm for three whole seconds. That is all Quint needs.", zh: "哐！德克硬生生挡了三秒，金特需要的正是这三秒。" }, to: "n2", fx: "explosions/cartoon-pow" }, fail: { text: { en: "Dirk is sent flying into the grass. He stands up and says, \"My turn again.\"", zh: "德克被扫飞进草地，他爬起来说：“轮到我了。”" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "Quint: fire the Zapper at full power", zh: "金特：电击枪全功率开火" }, stat: "brains", dc: 6, success: { text: { en: "A blue wave hits Blargh's chest. The giant takes one step back. ONE STEP!", zh: "蓝色电波击中布拉格胸口，巨兽后退了一步。整整一步！" }, to: "n2", fx: "lightning/chain-lightning" }, fail: { text: { en: "The Zapper overheats and Quint drops it in a puddle. Time for a new idea.", zh: "电击枪过热，金特把它掉进了水坑。得换个办法了。" }, to: "n2", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n2: {
          text: { en: "June points to the glowing purple portal above the monster. \"That is the door. Break the door!\"", zh: "琼指向怪物头顶发光的紫色传送门：“那是门，把门打碎！”" },
          minigame: { type: "whack", duration: 30, goal: 16, boss: true, title: "击碎传送门核心！", next: "n3" }
        },
        n3: {
          text: { en: "The portal is cracked. One last hit will close it forever.", zh: "传送门裂开了，最后一击就能把它彻底关上。" },
          choices: [
            { label: { en: "Jack: jump from Rover's back and swing the sword", zh: "杰克：从罗孚背上跃起挥剑" }, stat: "guts", dc: 7, success: { text: { en: "CRAAACK! The portal shatters into a million purple stars. Blargh is gone.", zh: "咔嚓——！传送门碎成百万颗紫色星星，布拉格消失了。" }, to: "n4", fx: "explosions/big-explosion", effects: { xp: 30 } }, fail: { text: { en: "You slip, but June catches your hand and Dirk pushes you up. Try again — together.", zh: "你脚下一滑，琼抓住了你的手，德克把你托了上去。再来一次，一起上。" }, to: "n4", hp: -1, fx: "impacts/hit-flash" } },
            { label: { en: "All four kids: jump at the same time", zh: "四个人：同时起跳" }, stat: "heart", dc: 5, success: { text: { en: "Four kids, one perfect jump. The portal breaks like a dropped phone screen.", zh: "四个孩子，完美的一跃。传送门像摔碎的手机屏一样裂开。" }, to: "n4", fx: "explosions/big-explosion", effects: { xp: 30 } }, fail: { text: { en: "You all bump into each other and fall in a heap, laughing. Then Rover headbutts the portal.", zh: "四个人撞成一团摔在地上，笑成一堆。然后罗孚一头把传送门撞碎了。" }, to: "n4", hp: -1, fx: "impacts/hit-flash" } }
          ]
        },
        n4: {
          text: { en: "The sun comes up over Wakefield. The town is quiet for the first time in forty-two days.", zh: "太阳升起，照在韦克菲尔德小镇上。四十二天来，镇上第一次这么安静。" },
          choices: [
            { label: { en: "Say the team's line together", zh: "一起说出小队的宣言" }, to: "end", effects: { xp: 20 }, fx: "ui/achievement" }
          ]
        },
        end: {
          end: true,
          grand: true,
          text: { en: "We're the last kids on Earth. And we're not going down without a fight.", zh: "我们是地球上最后的孩子，绝不轻易认输。" }
        }
      }
    }
  }
];
