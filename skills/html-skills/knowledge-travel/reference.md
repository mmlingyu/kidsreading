# Knowledge Travel · Reference

## 1. Level schema（嵌入 JSON）

```json
{
  "title": "艺术史穿越",
  "subtitle": "有知识答题 · 无知识互动",
  "passRule": "must-correct",
  "hero": { "height": 280, "speed": 480 },
  "levels": [
    {
      "id": "01_cave",
      "title": "洞穴岩画",
      "yearLabel": "40,000 BC",
      "motif": "cave",
      "width": 1400,
      "palette": {
        "sky": ["#3a2416", "#6b3a22", "#9a5a30"],
        "ground": "#5a3420",
        "accent": "#c9772f",
        "ink": "#21150d"
      },
      "knowledge": [
        "旧石器时代岩画常用赭石与木炭画在岩壁上",
        "动物常画成侧面剪影，姿态会『跑』起来"
      ],
      "quiz": {
        "prompt": "洞穴岩画最常用的颜料来源是？",
        "options": ["丙烯颜料", "赭石与木炭", "印刷油墨", "荧光漆"],
        "answer": 1,
        "explain": "赭石（氧化铁）与木炭易得，能吃进岩面。"
      },
      "refNote": "assets/cave-ref.png 或 huashu 01_cave 配方"
    },
    {
      "id": "02_egypt",
      "title": "埃及彩绘",
      "yearLabel": "1350 BC",
      "motif": "egypt",
      "width": 1400,
      "palette": {
        "sky": ["#f2d48a", "#e8bc5a", "#c9923a"],
        "ground": "#c9a45c",
        "accent": "#1f6aa5",
        "ink": "#3a2416"
      },
      "knowledge": [],
      "interact": {
        "kind": "hit-hotspot",
        "prompt": "走近圣甲虫，按 E 推日开门",
        "lx": 980,
        "ly": 520,
        "r": 72,
        "holdMs": 0,
        "burst": "scarab"
      },
      "refNote": "氛围关：无知识点，用场景互动过关"
    }
  ]
}
```

校验：

- `levels.length ∈ [4,12]`
- 每关必须能解析出门类型：`quiz` 或 `interact`
- **quiz 关**：`knowledge` 有效条数 ≥ 1；`quiz.options.length ∈ {3,4}`；`0 ≤ answer < options.length`
- **interact 关**：`knowledge` 为空/缺失/无效，或 `gate:"interact"`；必须有可玩热点（显式 `interact` 或 motif 默认表）
- 整局至少保留 **1 个 quiz 关**（产品定位仍是知识穿越；纯互动长卷应改用 animation/html-builder）

## 2. 无知识检测

```
function levelHasKnowledge(L) {
  const facts = (L.knowledge || []).map(s => String(s ?? "").trim()).filter(Boolean);
  const q = L.quiz;
  const quizOk = !!(q
    && String(q.prompt || "").trim()
    && Array.isArray(q.options) && q.options.length >= 2
    && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
  return facts.length >= 1 && quizOk;
}

function gateMode(L) {
  if (L.gate === "interact") return "interact";
  if (L.gate === "quiz" && levelHasKnowledge(L)) return "quiz";
  return levelHasKnowledge(L) ? "quiz" : "interact";
}
```

作者侧：素材不够写题时，**主动清空 `knowledge`** 并配置 `interact`，不要塞假题。

## 3. 玩法状态机

```
walk → approachGate
  ├─ quiz  → quizOpen → (wrong → quizOpen) | (correct → unlockNext → walk)
  └─ interact → nearHotspot → (hit|hold) → burstAnim → unlockNext → walk
```

- `unlockedIndex`：已解锁到第几关（0-based）。角色世界 x 不能越过 `levels[unlockedIndex].x1` 的关门线。
- interact 进行中（`bursting`）可锁移动 0.8–1.5s，镜头仍可微跟。
- 通关最后一门后显示 Ending Card，可「再玩一次」。

## 4. motif → 默认 interact（缺字段时补全）

| motif | burst | 默认热点 (lx, ly, r) | prompt 示例 |
|---|---|---|---|
| cave | fire | 1100, 700, 64 | 靠近火堆按 E 点燃岩壁 |
| egypt | scarab | 980, 520, 72 | 走近圣甲虫按 E 推日 |
| mosaic / roman | mosaic | 1000, 560, 68 | 踩亮马赛克按 E |
| vangogh | spiral | 1050, 360, 80 | 走近漩涡按 E 搅动星空 |
| ink | ink | 960, 500, 70 | 按 E 落墨晕开 |
| eightbit | coin | 900, 420, 56 | 顶问号砖按 E |
| monet | lily | 1000, 640, 70 | 按 E 拨涟漪 |
| flat / 其它 | ring | 1000, 400, 70 | 按 E 触发同心环 |

`hold-glow`：按住 `E` 达到 `holdMs`（建议 600–900）再爆发；适合「蓄力推日 / 注墨」。

## 5. 相机与世界（长卷约定）

| 量 | 建议值 |
|---|---|
| 画布逻辑分辨率 | 1920×1080（CSS 缩放适配） |
| 地面线 `GROUND` | 760 |
| 角色站立高 | 260–300 |
| 相机锚点 | 角色在屏宽约 38% 处 |
| 镜头 | 跟随平滑；过关动画时可不倒退 |

段布局：`x0` 累加 `width`。边界 seam：`x0 + 18*sin(y*0.011 + x0*0.001)`。

热点世界坐标：`worldX = level.x0 + interact.lx`。

## 6. 「画要活」最低标准

每关 `draw(level, t)` 至少包含：

1. **主动作**：与主题相关的循环
2. **两个环境循环**：星闪 / 草摆 / 光斑 / 颗粒等
3. **入场后不停住**：`t` 用秒；用关卡 id 哈希做伪随机，避免 `Math.random()`

interact 关额外：

4. **热点可读**：呼吸光圈或图标，未完成时持续提示
5. **burst ≥ 0.8s**：与母题同语言的爆发（火舌、甲虫推日、漩涡加速、墨晕扩散、金币弹出、同心环…）

答题 Overlay 打开时背景可慢动；burst 时提高强调色对比。

## 7. Quiz / Interact UI

**Quiz**

- 居中卡片：题干、选项、`explain`；无跳过。
- 选项命中区 ≥ 44px；`1–4` 选、`Enter` 确认。

**Interact**

- 不强制 Modal；以 Canvas 提示条 + HUD「互动」为主。
- 可选轻量 toast：`interact.prompt`。
- 触控第四键在 interact 关显示「互动」，在 quiz 关显示「答题」。

## 8. 参考图用法

| 来源 | 用法 |
|---|---|
| `assets/*` 图像 | 取色、构图暗示、report 引用；可裁小图 data URL 作剪影 |
| 用户文案 / MD | 抽 knowledge 与出题；抽不出则该关转 interact |
| huashu 风格卡 | 借母题动作 + 色板 + burst 语言，用代码重画 |

## 9. 艺术史默认关卡包（可裁剪）

| id | yearLabel | motif | 建议门 |
|---|---|---|---|
| 01_cave | 40,000 BC | cave | quiz 或 fire 互动 |
| 02_egypt | 1350 BC | egypt | 常作无知识氛围关 + scarab |
| 04_roman | 79 AD | mosaic | quiz |
| 17_ink | 1690 | ink | quiz 或 ink 互动 |
| 09_postimp | 1889 | vangogh | quiz |
| 28_monet | 1899 | monet | quiz |
| 14_8bit | 1985 | eightbit | quiz |
| 16_2026 | 2026 | flat | quiz |

科普向 brief：换知识与配色，保留长卷 + **自动门类型检测**。

## 10. 验收清单

- [ ] 方向键 / WASD 可走，Space 可跳
- [ ] `levelHasKnowledge` 已实现；空知识关不会误开 quiz
- [ ] quiz 关未答对不能进下一关
- [ ] interact 关未完成热点动作不能进下一关，且有可见 burst
- [ ] 至少 1 关为 quiz；允许混合 interact
- [ ] 4 关以上均有可见循环动画
- [ ] 缩小到 390px 宽仍可操作
- [ ] 无 console error；无 `localStorage`
- [ ] `report.md` 标明每关门类型；quiz 关含正确答案索引
