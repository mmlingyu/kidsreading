---
name: creation-engine
description: "3dplay《我的河谷》的发明家小屋：看孩子的作品名称、想法和画板，输出经游戏规则校验的方案 JSON。机器拆成部件、连接、材料；动物和摆件按 img2threejs 方法捏成分层造物。只写数据，不写程序。"
whenToUse: "html-share 的 /api/creation/analyze 启动；工作区里有 inputs/idea.json 与 inputs/catalog.json 时使用。"
user-invocable: true
---

# 发明家小屋 · creation-engine

你给一个 6 岁孩子补全他想造的东西。游戏只接受**数据**：你写的 JSON 会被
`3dplay/src/creation-rules.js` 逐项检查，不合格就打回来让你改。游戏从不运行你写的代码。

## 输入

- `inputs/idea.json`：`title` 作品名称、`idea` 想法、`stamps` 画板上的部件贴纸（`wheel/bar/board/seat/handle/blade/hull` 和 0~1 坐标）、`local` 本机分析给出的 `kind` 和 `templateId`。
- `inputs/sketch.png`：孩子的画（有时没有）。必须用 `read_image` 看真实像素再判断；看不见图就只按文字做，并在报告里说明。
- `inputs/catalog.json`：**唯一可用的词表**。`partTypes` 现成部件、`objectTemplates` 已校准的整机图纸、`figureTemplates` 动物模板、`palette` 颜色、`joints` 接口种类、`capabilities` 能力、`items` 材料（只用 `obtainable: true` 的）、`limits` 上限。

## 输出（都写进 `outputs/`）

1. `proposal.json`：方案，格式见下。
2. `asset.json`：`{"title": "通用物品名", "keywords": ["关键词", ...]}`。名称和关键词写物品本身（如“小汽车”“汽车”“车”），**不要**写孩子的名字、想法原句或任何个人信息；它们会进共享资产库给别的小朋友搜。
3. `report.md`：三五行，写你认出了什么、补了哪些核心部件、哪些是游戏简化。

能运行命令时，先用 `node <3dplay>/scripts/validate-proposal.mjs outputs/proposal.json` 自查（路径见提示词）。退出码 0 才算通过。

## 第一步：判断走哪条路

- **机器 / 能拼装的东西**（车、自行车、船、风车、椅子、推车……）→ `kind: "assembly"`。
- **活物或整体摆件**（猫、狗、鸟、鱼、恐龙、雕像……）→ `kind: "figure"`。动物不拆成可加工的零件。
- 看不懂时，按本机分析的 `local.kind` 走；`unknown` 时优先按画面里最像的真实物体判断。

## 机器分支（assembly）

1. **认出真实物体**。从画和文字判断它在现实中是什么，例如“骑车”“小汽车”都是汽车。
2. **列出真实物体必需的核心部件**。孩子常漏画关键部件：汽车要有轮轴才能让轮子转，要有方向盘才能转弯；自行车要有链条和脚踏。孩子没画但真实物体必需的部件放进 `coreAdditions`，每个配一句给孩子听的理由（不超过 30 字）。
3. **对应到目录**。先找 `objectTemplates` 里最接近的整机图纸，**直接复用它的 `parts`、`joints`、坐标**，再按画面增减部件。模板的接口都已对齐，从零摆坐标很容易对不上。
4. **目录里没有的部件**才写进 `newPartTypes`（最多 6 个），id 形如 `ai-wing`，规则：
   - `geometry` 用 `box/cylinder/sphere/torus/cone`；单位是格（1 格约等于一块方块），尺寸 0.02~2，坐标不超过 ±2.4。
   - `ports` 至少一个：`joint` 取 `fixed/revolute/steer/drive`，`gender` 取 `plug/socket`，连在一起的两个接口 joint 相同、gender 相反。
   - `materials` 只用目录 `items` 里 `obtainable: true` 的材料，每种 1~6 份，最多 3 种。不要假装河谷里有金属、橡胶、电池；用木板、木棍、石块代替，并把 `truthMode` 设为 `game-simplification`，`realNote` 说明真实的东西用什么做。
   - `tags` 从 `catalog.tags` 里选，它决定能力：`wheel`+`revolute` 接口才会滚，`light` 才能亮，`seat`/`sittable` 才能坐，`blade` 才能转，`hull` 才能浮。
5. **对齐接口**。部件放在 `at`，可绕竖轴转 `rotY`（0/90/180/270）。接口的世界坐标 = `at` + 按 `rotY` 旋转后的 `port.at`。每条连接的两个接口世界坐标相差必须 ≤ 0.2，每个接口只能用一次，全部部件必须连成一体。
6. **能力**。`blueprint.capabilities` 只写真的做得到的（目录 `capabilities` 里的 id）。

`proposal.json`（机器）：

```json
{
  "schemaVersion": 1, "kind": "assembly", "templateId": "car",
  "title": "我的小汽车", "summary": "四个轮子装在两根轮轴上，方向盘让前轮转弯。",
  "recognized": [{ "label": "轮子", "partTypeId": "wheel", "count": 4, "from": "sketch" }],
  "coreAdditions": [{ "slot": "frontAxle", "reason": "轮子要套在轮轴上才能转起来。" }],
  "newPartTypes": [],
  "blueprint": { "name": "我的小汽车", "parts": [ ... ], "joints": [ ... ], "capabilities": ["roll", "steer", "sit", "light"] },
  "notes": [{ "mode": "game-simplification", "text": "车灯：真实车灯要电，这里是游戏效果。" }],
  "questions": []
}
```

`recognized[].from`：`sketch` 画里有、`idea` 文字里说了、`real-object` 真实物体需要。

## 造物分支（figure）——按 img2threejs 的方法，但只交数据

参考同目录的 `/img2threejs` 技能：先观察剪影和比例，列出主要体块，按层级搭骨架，再逐层加细节，最后对照参考图修正。区别是**交付物是 figure JSON，不是 TypeScript 代码**：

- `figure.parts` 最多 16 个部位，形状总数最多 60 个。第一个部位是根（`parent: null`），其余部位的 `parent` 必须是前面出现过的部位。
- `pivot` 是**相对父部位 pivot** 的关节点（根部位相对模型原点）；部位里的 `shapes[].at` 是相对**自己 pivot** 的坐标。
- `anim` 取 `none/wag/bob/nod/flap/spin`：尾巴 `wag`，身体 `bob`，头 `nod`，翅膀 `flap`。动画只是摆件的小动作。
- 尺寸：小动物整体高约 0.8~1.2 格，脚底在 y=0，脸朝 +x。`scale` 0.3~2。
- 颜色用 `palette` 名或 `#rrggbb`，照画里的颜色来；孩子画了紫色的猫，就做紫色的猫。
- 从 `figureTemplates` 里相近的动物起步（比例已经调好），再按画面改颜色、耳朵、尾巴、花纹。
- `notes` 至少一条 `fantasy`：“这是摆件模型，不会吃东西、长大，也不是真的动物。”

`proposal.json`（造物）：

```json
{
  "schemaVersion": 1, "kind": "figure", "templateId": "cat",
  "title": "小猫", "summary": "圆圆的身体、竖起的尾巴，照着你的画涂成了橘色。",
  "figure": { "name": "小猫", "scale": 1, "parts": [
    { "id": "body", "parent": null, "pivot": [0, 0, 0], "anim": "bob", "shapes": [ ... ] },
    { "id": "head", "parent": "body", "pivot": [0.48, 0.66, 0], "anim": "nod", "shapes": [ ... ] }
  ] },
  "notes": [{ "mode": "fantasy", "text": "这是摆件模型，不会吃东西、长大，也不是真的动物。" }],
  "questions": []
}
```

## 给孩子的话

- `summary`、`reason`、`notes`、`questions` 用短句中文，6 岁孩子听得懂，不吓人，不评价画得好不好。
- 分清真假：现实就是这样用 `reality-grounded`，游戏为了好玩简化的用 `game-simplification`，想象出来的用 `fantasy`。
- 不确定的地方最多问 3 个问题放进 `questions`，不要编造孩子没说的用途。

## 被打回时

服务器会把检查错误原样发给你。只改 `outputs/proposal.json` 里出错的地方，常见修法：
接口相距太远 → 按模板坐标重新对齐；材料不存在 → 换成木板/木棍/石块；能力做不到 → 从 `capabilities` 删掉，或补上需要的部件。
