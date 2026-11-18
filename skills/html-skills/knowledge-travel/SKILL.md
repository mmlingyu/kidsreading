---
name: knowledge-travel
description: >-
  Build a side-scrolling knowledge travel game: controllable character walks
  through eras/levels drawn from reference images. Levels with knowledge use a
  quiz gate; levels without knowledge auto-get a scene interaction animation
  gate. Use when the user wants 知识穿越, 艺术史闯关, 关卡答题, 场景互动,
  scroll travel quiz, huashu-art-motion style levels, or an HTML game that mixes
  exploration with Q&A and interactive scenes.
whenToUse: >-
  知识穿越, 关卡答题, 艺术史游戏, 可控角色闯关, 参考图关卡, quiz gate,
  无知识关场景互动, long-scroll learning game.
user-invocable: true
---

# Knowledge Travel · 知识穿越答题游戏

把「长卷穿越」（角色从左走到右、跨界换画风）做成**可分享的单页 HTML 游戏**：每关有参考图气质与活的画面母题；**有知识则答题开门，无知识则场景交互动画开门**。

方法蒸馏自 [huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion) 的长卷骨架（地面统一、镜头只进不退、边界用下一关的签名语言），输出必须满足 html-share 沙箱分享约束。

视觉 / 关卡契约：见 [reference.md](reference.md)。可粘贴骨架：见 [examples.md](examples.md)。

## When this skill wins

用它，而不是纯 html-builder 或 3d-game-dev，当用户要的是：

- **可控角色**横向穿越多个「时代 / 关卡 / 主题岛」
- 每关有**参考图或风格气质**（洞穴、埃及、梵高、像素……或用户自定义科普主题）
- 过关机制二选一：
  - **有 knowledge + quiz** → 答题 Overlay，答对开门
  - **无知识**（空数组 / 缺字段 / quiz 不完整）→ **场景交互动画**（靠近热点按 E，播母题爆发后再开门）
- 最终交付是**一个自包含 `preview.html`**，能在沙箱 iframe 里玩

不要用它做：Blender 3D 原型（用 `3d-game-dev`）、纯静态解说页（用 `html-builder`）、馆藏卡组（用 `exhibit-card`）。

## Data model

从 brief + `assets/` 推断 **4–12 关**（默认艺术史可参考 35 风格年表，但成品游戏建议先做 6–8 关，避免单文件过重）。

每关 `Level`：

```
id          kebab-case，如 01_cave
title       中文关名
yearLabel   展示用年代字符串，如 "40,000 BC" / "1889" / "第 3 章"
motif       画面母题键（cave|egypt|mosaic|vangogh|ink|eightbit|… 或自定义）
palette     { sky[], ground, accent, ink }
width       关卡世界宽度 px（建议 1200–1800）
knowledge   0–5 条事实；≥1 且 quiz 完整 → 答题门；否则走交互门
quiz        可选 {
              prompt, options: string[3|4], answer: 0-based, explain
            }
interact    可选（无知识时必填或由运行时按 motif 补全）{
              kind: "hit-hotspot" | "hold-glow" | "collect",
              prompt,           # HUD / 提示文案
              lx, ly, r,        # 热点：相对本关 x0 的局部坐标 + 半径
              holdMs,           # hold-glow 时按住毫秒；hit 可为 0
              burst             # 成功动画键：fire|scarab|spiral|coin|ring|…
            }
gate        可选强制 "quiz" | "interact"；缺省则按 hasKnowledge 自动判定
refNote     本关参考了哪张 assets 图 / 哪段风格（写进 report）
```

### 无知识检测（必须实现）

运行时用同一函数判定（骨架已含 `levelHasKnowledge`）：

```
facts = knowledge 中非空短句
quizOk = prompt 非空 && options.length≥2 && answer 合法
hasKnowledge = facts.length≥1 && quizOk
gateMode = (gate==="interact" || !hasKnowledge) ? "interact" : "quiz"
```

检测到 `interact` 门时：

1. 若缺 `interact` 字段，按 `motif` 从默认表补全热点与 `burst`（见 reference.md）。
2. 门前 HUD 显示「互动」而非「答题」；触控按钮文案同步切换。
3. 玩家靠近热点按 `E`/`Enter`（或 hold）→ 播放 **≥0.8s** 场景爆发动画 → 解锁下一关。
4. 禁止空白过关：无知识关绝不能「走到门就自动开」，必须完成场景交互。

全游 `GameSpec`：

```
title, subtitle, heroStyle, levels[],
passRule: "must-correct" | "two-tries"   # 仅作用于 quiz 关
controls: arrows + A/D walk, Space jump, E/Enter gate action
```

把 `GameSpec` 嵌进 `preview.html` 的 `<script type="application/json" id="game-spec">`，便于验收与后续改关。

## Process

1. **读素材**  
   扫描 `assets/` 参考图与说明。用户给了主题年表就按主题；否则可用艺术史子集或 brief 科普线。每关在 `report.md` 写明参考来源与门类型（quiz / interact）。

2. **写关卡表并跑检测**  
   先填每关 `knowledge` / `quiz`。素材不够出题、或 brief 只要氛围关时，**故意留空 knowledge**，并写好 `interact`（或依赖 motif 默认）。整表里建议至少 1 关 quiz、允许若干 interact，避免整局零学习也避免整局纯问卷。

3. **复制骨架**  
   从 [examples.md](examples.md) 复制：长卷世界、玩家、相机、`levelHasKnowledge`、`openGate`（分支 quiz / interact）、答题 Modal、交互爆发层。

4. **画活每一关**  
   - 背景按 `motif` 程序化绘制（深底+强调色、无描边扁平、持续微动）。  
   - **每一关至少一个主动作 + 两个母题循环**。  
   - 关卡边界用**下一关**的签名语言画 seam。  
   - interact 关的热点要画得可读（光圈呼吸 / 图标），成功时 `burst` 与母题同语言。

5. **过关门**  
   - **quiz**：走到终点触发 Overlay；答对解锁；答错 `explain`；键盘 `1–4` + `Enter`。  
   - **interact**：靠近热点 + `E`；播 `burst` 动画；动画结束后 `unlocked++`。  
   - 未完成过关动作前，世界 x 不能越过本关关门线。

6. **验收**  
   - 键盘可全程通关；移动端触控可用。  
   - 无知识关必须能完成场景交互开门，且有可见爆发动画。  
   - 沙箱 iframe 可玩；无 `localStorage` / `parent`。  
   - `prefers-reduced-motion: reduce` 时缩短爆发但仍完成解锁。

## Hard constraints

- **一个文件**：`outputs/preview.html`。可另写 `outputs/report.md`、`outputs/levels.json`。禁止 Vite / React / npm。
- **沙箱**：iframe 无同源权限；状态只在内存。
- **用工具写文件**，不要把整份 HTML 贴进对话。
- **画面必须动**：禁止「静帧 PPT 关卡」。
- **过关是机制**：quiz 关不答对不能进下一关；interact 关不完成场景交互不能进下一关。
- **无知识必须补交互**：禁止静默把空知识关当成自动通关。
- 角色与场景用 **Canvas 2D 程序化绘制**。真人照片仅作参考。
- 若 brief 要求受限 IP 形象，改用几何旅行者或用户 `assets/` 角色剪影。

## Output

写入项目目录：

- `outputs/preview.html` — 可玩的知识穿越游戏（含 quiz + interact 分支）
- `outputs/report.md` — 关卡列表、门类型、参考图/知识点或交互说明、答案索引、验收勾选
- 可选 `outputs/levels.json`

最终回复只列上述文件的绝对路径与一句话游玩说明（方向键移动；有题答题，无题到热点互动）。

## Relationship to huashu-art-motion

| 借用 | 不照搬 |
|---|---|
| 长卷：段宽、地面线、只进不退相机、跨界换画风 | 不必引入 Playwright / uv / 整包 engine |
| 风格母题「让画活」+ 场景爆发 | 关卡数以可玩为准，不必 35 全收 |
| 年份角标气质 | 输出必须是 Studio 可分享单页 |

仓库内可参考实现（只读灵感）：`../renders/art-history-travel/`（若本机有）、以及 `.agents/skills/huashu-art-motion/references/11-长卷穿越片.md`。
