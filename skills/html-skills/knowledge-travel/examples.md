# Knowledge Travel · Skeleton

Copy into `outputs/preview.html`, then replace `#game-spec` JSON and expand `drawMotif` / burst. Keep structure: world → player → `levelHasKnowledge` → quiz | sceneInteract → gate.

完整可玩案例见同目录 `outputs/preview.html`（含一关 `knowledge: []` 的埃及互动关）。

## 关键分支（必须保留）

```js
function levelHasKnowledge(L) {
  const facts = (L.knowledge || []).map(s => String(s ?? '').trim()).filter(Boolean);
  const q = L.quiz;
  const quizOk = !!(q && String(q.prompt || '').trim()
    && Array.isArray(q.options) && q.options.length >= 2
    && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
  return facts.length >= 1 && quizOk;
}
function gateMode(L) {
  if (L.gate === 'interact') return 'interact';
  if (L.gate === 'quiz' && levelHasKnowledge(L)) return 'quiz';
  return levelHasKnowledge(L) ? 'quiz' : 'interact';
}
```

无知识关：补 `interact` 或按 motif 默认表；靠近热点按 E → `startBurst` → 动画结束后 `unlocked++`。禁止走到门就自动开。

## 最小 HTML 骨架

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>知识穿越</title>
<style>
  html,body{margin:0;height:100%;background:#0c0a12;color:#f3ece0;font-family:system-ui,sans-serif;overflow:hidden}
  #stage{position:relative;width:100%;height:100%;display:grid;place-items:center}
  canvas{width:min(100vw,100vh*16/9);height:auto;background:#111;border-radius:12px;touch-action:none}
  #hud{position:absolute;left:12px;top:12px;right:12px;display:flex;justify-content:space-between;pointer-events:none;text-shadow:0 2px 8px #000;gap:12px}
  #badge{background:rgba(250,246,236,.88);color:#1e1a22;border-radius:12px;padding:10px 14px}
  #badge b{display:block;font-size:22px}
  #tip{background:rgba(20,16,28,.72);border-radius:12px;padding:8px 12px;font-size:.9rem}
  #quiz{position:absolute;inset:0;display:none;place-items:center;background:rgba(8,6,14,.72)}
  #quiz.open{display:grid}
  #card{width:min(520px,92vw);background:#f6f1e7;color:#1a1520;border-radius:16px;padding:20px}
  .opt{display:block;width:100%;margin:8px 0;padding:12px 14px;border:2px solid #d8d0c4;border-radius:12px;background:#fff;font:inherit;text-align:left;cursor:pointer}
  #touch{display:none;position:absolute;bottom:16px;left:0;right:0;justify-content:center;gap:10px}
  @media(pointer:coarse){#touch{display:flex}button.t{pointer-events:auto;padding:14px 18px;border:0;border-radius:12px;background:rgba(255,255,255,.14);color:#fff}}
</style>
</head>
<body>
<div id="stage">
  <canvas id="c" width="1920" height="1080"></canvas>
  <div id="hud"><div id="badge"><b id="yr">—</b><span id="nm">—</span></div><div id="tip"></div><div id="prog"></div></div>
  <div id="touch"><button class="t" data-k="ArrowLeft">←</button><button class="t" data-k=" ">跳</button><button class="t" data-k="ArrowRight">→</button><button class="t" data-k="Enter" id="actBtn">答题</button></div>
  <div id="quiz"><div id="card"><h2 id="qprompt"></h2><div id="qopts"></div><div id="explain"></div></div></div>
</div>
<script type="application/json" id="game-spec">
{
  "title": "艺术史穿越",
  "subtitle": "有知识答题 · 无知识互动",
  "passRule": "must-correct",
  "levels": [
    {
      "id": "01_cave", "title": "洞穴岩画", "yearLabel": "40,000 BC", "motif": "cave", "width": 1400,
      "palette": {"sky":["#3a2416","#6b3a22","#9a5a30"],"ground":"#5a3420","accent":"#c9772f","ink":"#21150d"},
      "knowledge": ["岩画常用赭石与木炭", "动物侧面剪影会『跑』"],
      "quiz": {"prompt": "洞穴岩画常用颜料？", "options": ["丙烯", "赭石与木炭", "油墨"], "answer": 1, "explain": "赭石与木炭易得，能吃进岩面。"}
    },
    {
      "id": "02_egypt", "title": "埃及彩绘", "yearLabel": "1350 BC", "motif": "egypt", "width": 1500,
      "palette": {"sky":["#f2d48a","#e8bc5a","#c9923a"],"ground":"#c9a45c","accent":"#1f6aa5","ink":"#3a2416"},
      "knowledge": [],
      "interact": {
        "kind": "hit-hotspot",
        "prompt": "走近圣甲虫，按 E 推日开门",
        "lx": 980, "ly": 520, "r": 72, "holdMs": 0, "burst": "scarab"
      }
    },
    {
      "id": "09_postimp", "title": "梵高星空", "yearLabel": "1889", "motif": "vangogh", "width": 1500,
      "palette": {"sky":["#1a2a6a","#2a3a8a","#0a1a4a"],"ground":"#2a3a20","accent":"#f5d03b","ink":"#1a1a40"},
      "knowledge": ["星空用旋转笔触表现流动"],
      "quiz": {"prompt": "梵高星空的笔触特征？", "options": ["完全平涂", "漩涡状短笔触", "照片网点"], "answer": 1, "explain": "流场笔触让夜空『转起来』。"}
    },
    {
      "id": "14_8bit", "title": "8-bit", "yearLabel": "1985", "motif": "eightbit", "width": 1400,
      "palette": {"sky":["#5c94fc","#70a4ff"],"ground":"#00a800","accent":"#fc9838","ink":"#0b1d24"},
      "knowledge": ["有限色板像素画"],
      "quiz": {"prompt": "8-bit 画面主要靠什么造型？", "options": ["矢量渐变", "有限色像素块", "照片贴图"], "answer": 1, "explain": "靠像素块读形。"}
    }
  ]
}
</script>
<script>
(() => {
  const SPEC = JSON.parse(document.getElementById('game-spec').textContent);
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const W = 1920, H = 1080, G = 760;
  const MOTIF_INTERACT = {
    cave:{prompt:'靠近火堆按 E',lx:1100,ly:700,r:64,burst:'fire'},
    egypt:{prompt:'走近圣甲虫按 E 推日',lx:980,ly:520,r:72,burst:'scarab'},
    vangogh:{prompt:'走近漩涡按 E',lx:1050,ly:360,r:80,burst:'spiral'},
    eightbit:{prompt:'顶问号砖按 E',lx:900,ly:420,r:56,burst:'coin'},
    flat:{prompt:'按 E 触发同心环',lx:1000,ly:400,r:70,burst:'ring'},
  };
  function levelHasKnowledge(L) {
    const facts = (L.knowledge || []).map(s => String(s ?? '').trim()).filter(Boolean);
    const q = L.quiz;
    const quizOk = !!(q && String(q.prompt || '').trim()
      && Array.isArray(q.options) && q.options.length >= 2
      && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
    return facts.length >= 1 && quizOk;
  }
  function gateMode(L) {
    if (L.gate === 'interact') return 'interact';
    return levelHasKnowledge(L) ? 'quiz' : 'interact';
  }
  const levels = []; let x = 0;
  for (const raw of SPEC.levels) {
    const L = {...raw, x0:x, x1:x+raw.width, _mode:gateMode(raw)};
    if (L._mode === 'interact') L._interact = Object.assign({}, MOTIF_INTERACT[L.motif]||MOTIF_INTERACT.flat, L.interact||{});
    levels.push(L); x += raw.width;
  }
  const WORLD = x;
  const player = { x:320, y:G, vx:0, face:1, walk:0, jv:0, ground:true };
  const keys = Object.create(null);
  let cam=0, t=0, unlocked=0, quizOpen=false, bursting=null, last=performance.now();
  const segAt = px => levels.find(s => px >= s.x0 && px < s.x1) || levels[levels.length-1];
  const curLevel = () => levels[Math.min(unlocked, levels.length-1)];
  const gateX = () => curLevel().x1 - 40;

  function sky(c, pal) {
    const g = c.createLinearGradient(0,0,0,H);
    pal.sky.forEach((col,i)=>g.addColorStop(i/Math.max(1,pal.sky.length-1), col));
    c.fillStyle=g; c.fillRect(0,0,W,H);
  }
  function drawMotif(c, L, lt) {
    const p=L.palette; sky(c,p); c.fillStyle=p.ground; c.fillRect(0,G,W,H-G);
    // expand per motif — keep at least one loop + two ambient cycles
    c.fillStyle=p.accent; c.beginPath();
    c.arc(W*0.55, 280+Math.sin(lt*2)*8, 40, 0, 7); c.fill();
  }
  function drawBurst(c) {
    if (!bursting) return;
    const p = bursting.age / bursting.dur, sx = bursting.ix - cam, sy = bursting.iy;
    c.fillStyle = `rgba(255,200,80,${1-p})`;
    for (let i=0;i<10;i++){ const a=i*0.63+bursting.age*3; c.beginPath();
      c.arc(sx+Math.cos(a)*p*110, sy+Math.sin(a)*p*80, 12, 0, 7); c.fill(); }
  }
  function drawHero(c, sx, L) {
    c.save(); c.translate(sx, player.y); c.scale(player.face,1);
    c.fillStyle=L.palette.accent; c.beginPath(); c.arc(0,-240,30,0,7); c.fill();
    c.fillStyle='#f5e6d3'; c.beginPath(); c.arc(0,-232,22,0,7); c.fill();
    c.fillStyle=L.palette.sky[1]||'#888'; c.fillRect(-28,-200,56,150); c.restore();
  }
  function startBurst(L) {
    const it=L._interact;
    bursting={L, ix:L.x0+it.lx, iy:it.ly, age:0, dur:1.0};
  }
  function openQuiz() {
    if (quizOpen||bursting||unlocked>=levels.length) return;
    const L=curLevel(); if (L._mode!=='quiz') return;
    quizOpen=true; document.getElementById('quiz').classList.add('open');
    document.getElementById('qprompt').textContent=L.quiz.prompt;
    document.getElementById('explain').textContent='';
    const box=document.getElementById('qopts'); box.innerHTML='';
    L.quiz.options.forEach((text,i)=>{ const b=document.createElement('button'); b.className='opt';
      b.textContent=`${i+1}. ${text}`; b.onclick=()=>answer(i); box.appendChild(b); });
  }
  function answer(i) {
    const L=curLevel(); const opts=[...document.querySelectorAll('.opt')];
    opts.forEach((el,idx)=>{ el.classList.toggle('ok', idx===L.quiz.answer); el.classList.toggle('bad', idx===i&&i!==L.quiz.answer); });
    document.getElementById('explain').textContent=L.quiz.explain;
    if (i===L.quiz.answer){ unlocked++; setTimeout(()=>{ document.getElementById('quiz').classList.remove('open'); quizOpen=false; },700); }
  }
  function openGate() {
    const L=curLevel(); if (!L) return;
    if (L._mode==='interact') startBurst(L); else openQuiz();
  }
  function render() {
    const L=segAt(player.x);
    ctx.clearRect(0,0,W,H);
    for (const s of levels) {
      if (s.x1<cam-40||s.x0>cam+W+40) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(s.x0-cam,0,s.width,H); ctx.clip();
      ctx.save(); ctx.translate(-(cam-s.x0),0); drawMotif(ctx,s,t); ctx.restore(); ctx.restore();
      if (levels.indexOf(s)===unlocked && s._mode==='interact') {
        const it=s._interact, sx=s.x0+it.lx-cam;
        ctx.strokeStyle=`rgba(255,255,255,${0.5+0.3*Math.sin(t*4)})`; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(sx,it.ly,it.r,0,7); ctx.stroke();
      }
    }
    const gx=gateX()-cam;
    if (unlocked<levels.length){ ctx.fillStyle=curLevel().palette.accent; ctx.fillRect(gx-18,G-180,36,180); }
    drawBurst(ctx); drawHero(ctx, player.x-cam, L);
    document.getElementById('yr').textContent=L.yearLabel;
    document.getElementById('nm').textContent=L.title+(curLevel()._mode==='interact'?' · 互动关':'');
    document.getElementById('prog').textContent=`关卡 ${Math.min(unlocked+1,levels.length)}/${levels.length}`;
    document.getElementById('actBtn').textContent=curLevel()._mode==='interact'?'互动':'答题';
    document.getElementById('tip').textContent=curLevel()._mode==='interact'?(curLevel()._interact.prompt):'门前按 E 答题';
  }
  function step(dt) {
    t+=dt;
    if (bursting){ bursting.age+=dt; if (bursting.age>=bursting.dur){ bursting=null; unlocked++; } return; }
    if (quizOpen) return;
    let ax=0; if(keys.ArrowLeft||keys.a)ax-=1; if(keys.ArrowRight||keys.d)ax+=1;
    player.vx+=(ax*480-player.vx)*Math.min(1,dt*10);
    player.x=Math.max(80,Math.min(gateX()-8, player.x+player.vx*dt));
    if(Math.abs(player.vx)>15){player.face=player.vx>0?1:-1; player.walk+=dt*10;}
    if((keys[' ']||keys.ArrowUp)&&player.ground){player.jv=-900;player.ground=false;}
    player.jv+=2400*dt; player.y+=player.jv*dt; if(player.y>=G){player.y=G;player.jv=0;player.ground=true;}
    if((keys.e||keys.E||keys.Enter)&& player.x>gateX()-140){ openGate(); keys.e=keys.E=keys.Enter=false; }
    cam+=(player.x-W*0.38-cam)*Math.min(1,dt*4);
    cam=Math.max(0,Math.min(Math.max(0,WORLD-W),cam));
  }
  window.addEventListener('keydown',e=>{keys[e.key]=true; if(['ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();});
  window.addEventListener('keyup',e=>{keys[e.key]=false;});
  document.querySelectorAll('#touch .t').forEach(btn=>{
    const k=btn.dataset.k;
    btn.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true; if(k==='Enter')openGate();});
    btn.addEventListener('pointerup',()=>keys[k]=false);
  });
  function loop(now){ const dt=Math.min(.05,(now-last)/1000); last=now; step(dt); render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>
```

Fill real briefs by expanding `levels`、`drawMotif`、`drawBurst`；**保留 `levelHasKnowledge` / `gateMode` / interact 爆发**，长卷相机不变。
