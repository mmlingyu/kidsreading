// 2.5D 电影舞台：按每章插画的构图复刻场景（天色 / 远景 / 前景框景 / 角色 / 粒子），
// 并叠加一个 CSS 3D 布景模型。全部为内联 DOM + SVG，无外部依赖、可离线运行。
import { sound } from "./audio.js";

export const SCENES = {
  1: {
    key: "treehouse", label: "树屋 · 俯视街道 · 黄昏",
    sky: ["#ffd9a0", "#ff9068", "#5b3674"], sun: "#fff3b0", sunAt: [76, 26],
    haze: "rgba(255,164,96,.20)", grade: "warm",
    far: "town", fore: "branches", artPos: "center 46%",
    particle: "leaf", particleColor: "#ffd98a",
    actors: ["zombie", "zombie", "zombie"], hero: "jack",
    set: "treehouse", tilt: -3, zoom: 1.06,
    accent: "#8fd12f",
    audio: { noise: { type: "lowpass", freq: 520, vol: .15 }, event: "growl", eventEvery: [4200, 8600] }
  },
  2: {
    key: "store", label: "便利店 · 一点透视货架 · 夜",
    sky: ["#243154", "#121a35", "#080d1f"], sun: "#ffe9a0", sunAt: [50, 12],
    haze: "rgba(120,150,255,.10)", grade: "cool",
    far: "shelves", fore: "shelves", artPos: "center 52%",
    particle: "dust", particleColor: "#cfe0ff",
    actors: ["zombie", "slime"], hero: "jack",
    set: "store", tilt: 0, zoom: 1.1,
    accent: "#ffd166",
    audio: { noise: { type: "lowpass", freq: 300, vol: .08 }, hum: { freq: 100, vol: .035, lfo: .7 }, event: "step", eventEvery: [3400, 6400] }
  },
  3: {
    key: "lab", label: "后院实验室 · 平视 · 正午",
    sky: ["#9fe3ff", "#58b8ee", "#2a6fb8"], sun: "#fffbe0", sunAt: [22, 20],
    haze: "rgba(180,235,255,.22)", grade: "bright",
    far: "trees", fore: "lab", artPos: "center 48%",
    particle: "spark", particleColor: "#b6f0ff",
    actors: ["zombie", "slime"], hero: "quint",
    set: "lab", tilt: 0, zoom: 1.04,
    accent: "#61d6ff",
    audio: { noise: { type: "bandpass", freq: 1500, q: .5, vol: .07 }, hum: { freq: 220, vol: .022, type: "triangle" }, event: "spark", eventEvery: [2600, 5600] }
  },
  4: {
    key: "field", label: "学校球场 · 低机位仰视 · 午后",
    sky: ["#bfe9ff", "#7ec8f5", "#3c83c9"], sun: "#fff8cf", sunAt: [82, 18],
    haze: "rgba(255,255,255,.16)", grade: "bright",
    far: "stands", fore: "grass", artPos: "center 55%",
    particle: "leaf", particleColor: "#d9ff9e",
    actors: ["zombie", "zombie", "zombie"], hero: "dirk",
    set: "field", tilt: 2, zoom: 1.08,
    accent: "#ff7a45",
    audio: { noise: { type: "lowpass", freq: 700, vol: .13 }, event: "crowd", eventEvery: [5000, 9000] }
  },
  5: {
    key: "hallway", label: "学校走廊 · 强透视 · 室内",
    sky: ["#3c4668", "#222a48", "#10152a"], sun: "#e9f2ff", sunAt: [50, 8],
    haze: "rgba(150,170,255,.10)", grade: "cool",
    far: "door", fore: "lockers", artPos: "center 50%",
    particle: "dust", particleColor: "#d8e2ff",
    actors: ["zombie", "zombie"], hero: "june",
    set: "hallway", tilt: 0, zoom: 1.12,
    accent: "#b39cff",
    audio: { hum: { freq: 120, vol: .045, lfo: .4 }, noise: { type: "lowpass", freq: 260, vol: .06 }, event: "step", eventEvery: [2800, 5200] }
  },
  6: {
    key: "parking", label: "商场停车场 · 金色时刻 · 车顶前景",
    sky: ["#ffd08a", "#ff9b62", "#a94f72"], sun: "#fff2c0", sunAt: [18, 34],
    haze: "rgba(255,183,110,.22)", grade: "warm",
    far: "cars", fore: "cars", artPos: "center 50%",
    particle: "bug", particleColor: "#fff0a8",
    actors: ["rover"], hero: "jack",
    set: "parking", tilt: -1, zoom: 1.05,
    accent: "#8fd12f",
    audio: { noise: { type: "lowpass", freq: 420, vol: .1 }, event: "bug", eventEvery: [1600, 3400] }
  },
  7: {
    key: "rooftop", label: "小镇屋顶 · 高机位 · 紫红末日",
    sky: ["#ff8d6b", "#a33f8f", "#2b1a55"], sun: "#ffd6f0", sunAt: [60, 22],
    haze: "rgba(190,70,160,.24)", grade: "doom",
    far: "giant", fore: "roof", artPos: "center 45%",
    particle: "ember", particleColor: "#ff9ae0",
    actors: ["boss"], hero: "jack",
    set: "rooftop", tilt: -4, zoom: 1.1,
    accent: "#d584ff",
    audio: { drone: { freq: 44, vol: .055 }, noise: { type: "lowpass", freq: 240, vol: .1 }, event: "rumble", eventEvery: [4600, 8200] }
  },
  8: {
    key: "portal", label: "决战 · 黎明 · 传送门核心",
    sky: ["#ffe0a3", "#ff9b7a", "#5b3b86"], sun: "#fff8d6", sunAt: [50, 16],
    haze: "rgba(255,180,130,.18)", grade: "epic",
    far: "roofs", fore: "rubble", artPos: "center 48%",
    particle: "ember", particleColor: "#ffe6a0",
    actors: ["boss", "boss"], hero: "team",
    set: "portal", tilt: 0, zoom: 1.12,
    accent: "#ffd166",
    audio: { drone: { freq: 52, vol: .06 }, hum: { freq: 330, vol: .03, type: "triangle" }, event: "portal", eventEvery: [3800, 7000] }
  },

  // ---------- 第二本《Mister Shivers》· 4-6 岁低龄线 ----------
  // 场景键 101-106 与 book2.js 各章的 scene 字段对应，按该册官方封面的构图复刻。
  101: {
    key: "bedroom", label: "卧室 · 床底低机位 · 暖黄夜灯",
    sky: ["#6b5f9e", "#3d3768", "#221f42"], sun: "#ffe3a8", sunAt: [78, 26],
    haze: "rgba(255,214,150,.16)", grade: "warm",
    far: "bedroom", fore: "bed", artPos: "center 50%",
    particle: "spark", particleColor: "#ffe9b0",
    actors: ["monster", "shadow"], hero: "kid",
    set: "bedroom", tilt: -2, zoom: 1.05,
    accent: "#ffca7a",
    audio: { noise: { type: "lowpass", freq: 360, vol: .07 }, event: "spark", eventEvery: [3600, 7200] }
  },
  102: {
    key: "woods", label: "回家小路 · 树林剪影 · 蓝紫黄昏",
    sky: ["#8fb6d8", "#5f6fa8", "#2c335e"], sun: "#ffe9c0", sunAt: [22, 18],
    haze: "rgba(180,200,255,.18)", grade: "cool",
    far: "forest", fore: "branches", artPos: "center 48%",
    particle: "leaf", particleColor: "#c9e6b0",
    actors: ["owl", "shadow"], hero: "kid",
    set: "forest", tilt: -1, zoom: 1.06,
    accent: "#9fd97a",
    audio: { noise: { type: "lowpass", freq: 520, vol: .1 }, event: "bird", eventEvery: [3200, 6400] }
  },
  103: {
    key: "dollhall", label: "长走廊 · 门边娃娃 · 一点透视",
    sky: ["#6e6a97", "#403d68", "#201e3c"], sun: "#ffedcf", sunAt: [50, 12],
    haze: "rgba(200,190,255,.14)", grade: "cool",
    far: "door", fore: "lockers", artPos: "center 50%",
    particle: "dust", particleColor: "#e2dcff",
    actors: ["monster", "shadow"], hero: "kid",
    set: "hallway", tilt: 0, zoom: 1.09,
    accent: "#c5a8ff",
    audio: { hum: { freq: 110, vol: .03, lfo: .4 }, noise: { type: "lowpass", freq: 280, vol: .06 }, event: "step", eventEvery: [3400, 6800] }
  },
  104: {
    key: "newwall", label: "新房间 · 墙面与窗 · 清晨",
    sky: ["#ffe0b0", "#ffb98f", "#f08f8a"], sun: "#fff6d8", sunAt: [76, 22],
    haze: "rgba(255,220,170,.20)", grade: "bright",
    far: "bedroom", fore: "window", artPos: "center 46%",
    particle: "dust", particleColor: "#fff0c4",
    actors: ["monster"], hero: "kid",
    set: "bedroom", tilt: 0, zoom: 1.04,
    accent: "#ffd166",
    audio: { noise: { type: "lowpass", freq: 620, vol: .08 }, event: "bird", eventEvery: [3800, 7600] }
  },
  105: {
    key: "mirror", label: "镜前 · 柔光圆环 · 薄荷夜",
    sky: ["#7fd3c9", "#4c91a8", "#2b4c72"], sun: "#eafff6", sunAt: [50, 20],
    haze: "rgba(190,255,240,.18)", grade: "bright",
    far: "door", fore: "window", artPos: "center 48%",
    particle: "spark", particleColor: "#c9fff0",
    actors: ["shadow", "monster"], hero: "kid",
    set: "mirror", tilt: 0, zoom: 1.07,
    accent: "#7ee0c8",
    audio: { hum: { freq: 180, vol: .025, type: "triangle" }, noise: { type: "lowpass", freq: 480, vol: .06 }, event: "spark", eventEvery: [3000, 6200] }
  },
  106: {
    key: "darkwalk", label: "黑走廊 · 手拉手 · 灯亮前",
    sky: ["#3b3c70", "#242548", "#12132b"], sun: "#fff0c0", sunAt: [50, 10],
    haze: "rgba(150,170,255,.10)", grade: "cool",
    far: "door", fore: "lockers", artPos: "center 52%",
    particle: "spark", particleColor: "#ffe9a8",
    actors: ["shadow", "shadow"], hero: "kid",
    set: "hallway", tilt: -1, zoom: 1.1,
    accent: "#ffd166",
    audio: { hum: { freq: 90, vol: .03, lfo: .3 }, noise: { type: "lowpass", freq: 240, vol: .06 }, event: "step", eventEvery: [3000, 6000] }
  }
};

// ---------- 程序化 SVG ----------
function svg(viewBox, inner, cls = "") {
  return `<svg class="${cls}" viewBox="${viewBox}" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;
}

function farShape(kind) {
  const roofs = (n, y, w, h, fill) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const x = i * (1200 / n) - 20;
      const hh = h * (0.7 + ((i * 7) % 5) * 0.12);
      s += `<path d="M${x} ${y} L${x + w / 2} ${y - hh * .5} L${x + w} ${y} L${x + w} 300 L${x} 300 Z" fill="${fill}"/>`;
      s += `<rect x="${x + w * .72}" y="${y - hh * .72}" width="12" height="30" fill="${fill}"/>`;
    }
    return s;
  };
  switch (kind) {
    case "town":
      return svg("0 0 1200 300", roofs(9, 210, 165, 110, "currentColor") +
        `<rect x="0" y="272" width="1200" height="28" fill="currentColor"/>` +
        `<path d="M140 272 L140 130 M140 152 L60 152 M140 176 L210 176" stroke="currentColor" stroke-width="7" fill="none"/>`, "far-svg");
    case "trees": {
      let s = "";
      for (let i = 0; i < 16; i++) {
        const x = i * 82 - 30, h = 120 + ((i * 13) % 7) * 20;
        s += `<path d="M${x} 300 L${x + 42} ${300 - h} L${x + 84} 300 Z" fill="currentColor"/>`;
      }
      return svg("0 0 1200 300", s, "far-svg");
    }
    case "stands":
      return svg("0 0 1200 300",
        `<path d="M0 300 L0 190 L1200 190 L1200 300 Z" fill="currentColor"/>` +
        `<path d="M0 190 L300 120 L900 120 L1200 190 Z" fill="currentColor" opacity=".7"/>` +
        `<rect x="120" y="40" width="12" height="110" fill="currentColor"/><rect x="90" y="34" width="72" height="18" fill="currentColor"/>` +
        `<rect x="1070" y="40" width="12" height="110" fill="currentColor"/><rect x="1040" y="34" width="72" height="18" fill="currentColor"/>`, "far-svg");
    case "shelves":
      return svg("0 0 1200 300",
        `<rect x="0" y="80" width="1200" height="220" fill="currentColor" opacity=".55"/>` +
        [0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 220 + 40}" y="110" width="140" height="190" fill="currentColor"/>`).join("") +
        `<rect x="0" y="96" width="1200" height="10" fill="currentColor"/>`, "far-svg");
    case "cars": {
      let s = `<rect x="0" y="250" width="1200" height="50" fill="currentColor"/>`;
      for (let i = 0; i < 7; i++) s += `<path d="M${i * 190 - 40} 250 q20 -60 80 -60 q60 0 80 60 Z" fill="currentColor"/>`;
      s += `<rect x="580" y="20" width="10" height="190" fill="currentColor"/><rect x="540" y="14" width="90" height="16" fill="currentColor"/>`;
      return svg("0 0 1200 300", s, "far-svg");
    }
    case "giant":
      return svg("0 0 1200 300",
        `<path d="M420 300 Q440 120 600 110 Q760 120 780 300 Z" fill="currentColor"/>` +
        `<circle cx="600" cy="132" r="72" fill="currentColor"/>` +
        `<circle cx="600" cy="132" r="34" fill="#fff" opacity=".55"/>` +
        [0, 1, 2, 3].map(i => `<path d="M${470 + i * 85} 250 q-30 -70 10 -110" stroke="currentColor" stroke-width="16" fill="none" stroke-linecap="round"/>`).join("") +
        roofs(8, 268, 170, 80, "currentColor"), "far-svg");
    case "roofs":
      return svg("0 0 1200 300", roofs(7, 230, 190, 130, "currentColor") +
        `<path d="M0 288 L1200 288" stroke="currentColor" stroke-width="20"/>`, "far-svg");
    case "door":
      return svg("0 0 1200 300",
        `<rect x="0" y="60" width="1200" height="240" fill="currentColor" opacity=".45"/>` +
        `<rect x="510" y="120" width="180" height="180" fill="currentColor"/>` +
        `<rect x="530" y="140" width="140" height="140" fill="#fff" opacity=".12"/>`, "far-svg");
    case "bedroom":
      return svg("0 0 1200 300",
        `<rect x="0" y="90" width="1200" height="210" fill="currentColor" opacity=".40"/>` +
        `<rect x="120" y="70" width="260" height="190" rx="10" fill="currentColor"/>` +
        `<rect x="138" y="88" width="224" height="154" fill="#fff" opacity=".13"/>` +
        `<path d="M250 70 L250 260 M138 165 L362 165" stroke="#fff" stroke-width="8" opacity=".18"/>` +
        `<rect x="820" y="130" width="230" height="150" rx="8" fill="currentColor"/>` +
        `<rect x="840" y="150" width="190" height="110" fill="#fff" opacity=".10"/>` +
        `<rect x="0" y="280" width="1200" height="20" fill="currentColor"/>`, "far-svg");
    case "forest": {
      let s = "";
      for (let i = 0; i < 11; i++) {
        const x = i * 118 - 40, h = 150 + ((i * 9) % 6) * 26;
        s += `<rect x="${x + 48}" y="${300 - h}" width="16" height="${h}" fill="currentColor"/>`;
        s += `<circle cx="${x + 56}" cy="${300 - h}" r="58" fill="currentColor"/>`;
      }
      s += `<rect x="0" y="282" width="1200" height="18" fill="currentColor"/>`;
      return svg("0 0 1200 300", s, "far-svg");
    }
    default: return "";
  }
}

function foreShape(kind) {
  const leaf = (x, y, r, fill) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .48}" fill="${fill}" transform="rotate(-24 ${x} ${y})"/>`;
  switch (kind) {
    case "branches":
      return svg("0 0 1200 700",
        `<path d="M-20 40 Q220 90 380 250 Q440 300 470 420" stroke="currentColor" stroke-width="42" fill="none" stroke-linecap="round"/>` +
        `<path d="M1220 10 Q1010 80 880 220" stroke="currentColor" stroke-width="34" fill="none" stroke-linecap="round"/>` +
        [80, 180, 270, 350, 410, 980, 1060, 1130].map((x, i) => leaf(x, 70 + (i % 4) * 48, 60, "currentColor")).join("") +
        `<path d="M-20 700 L-20 620 Q200 640 380 700 Z" fill="currentColor"/>`, "fore-svg");
    case "shelves":
      return svg("0 0 1200 700",
        `<rect x="0" y="0" width="105" height="700" fill="currentColor"/><rect x="1095" y="0" width="105" height="700" fill="currentColor"/>` +
        [140, 280, 420, 560].map(y => `<rect x="0" y="${y}" width="105" height="14" fill="#fff" opacity=".16"/><rect x="1095" y="${y}" width="105" height="14" fill="#fff" opacity=".16"/>`).join("") +
        `<path d="M0 700 L1200 700 L1200 660 L0 660 Z" fill="currentColor"/>`, "fore-svg");
    case "lab":
      return svg("0 0 1200 700",
        `<path d="M0 700 L0 610 Q300 590 600 610 Q900 630 1200 600 L1200 700 Z" fill="currentColor"/>` +
        `<path d="M-10 620 Q150 520 300 600" stroke="currentColor" stroke-width="16" fill="none"/>` +
        `<path d="M1210 620 Q1050 500 900 600" stroke="currentColor" stroke-width="16" fill="none"/>` +
        `<circle cx="180" cy="560" r="34" fill="currentColor"/><circle cx="1020" cy="555" r="28" fill="currentColor"/>`, "fore-svg");
    case "grass": {
      let s = `<path d="M0 700 L0 640 L1200 640 L1200 700 Z" fill="currentColor"/>`;
      for (let i = 0; i < 34; i++) s += `<path d="M${i * 38} 660 q10 -50 20 -2" stroke="currentColor" stroke-width="9" fill="none" stroke-linecap="round"/>`;
      return svg("0 0 1200 700", s, "fore-svg");
    }
    case "lockers":
      return svg("0 0 1200 700",
        `<rect x="0" y="0" width="120" height="700" fill="currentColor"/><rect x="1080" y="0" width="120" height="700" fill="currentColor"/>` +
        [0, 1, 2, 3, 4].map(i => `<rect x="20" y="${i * 140 + 20}" width="80" height="120" rx="6" fill="#fff" opacity=".10"/><rect x="1100" y="${i * 140 + 20}" width="80" height="120" rx="6" fill="#fff" opacity=".10"/>`).join(""), "fore-svg");
    case "cars":
      return svg("0 0 1200 700",
        `<path d="M-40 700 L-40 600 Q250 540 540 596 L540 700 Z" fill="currentColor"/>` +
        `<path d="M1240 700 L1240 610 Q980 550 720 600 L720 700 Z" fill="currentColor"/>` +
        `<rect x="0" y="676" width="1200" height="24" fill="currentColor"/>`, "fore-svg");
    case "roof":
      return svg("0 0 1200 700",
        `<path d="M0 700 L0 610 L1200 610 L1200 700 Z" fill="currentColor"/>` +
        `<rect x="0" y="596" width="1200" height="18" fill="currentColor"/>` +
        [100, 300, 500, 700, 900, 1100].map(x => `<rect x="${x}" y="520" width="12" height="80" fill="currentColor"/>`).join("") +
        `<rect x="0" y="512" width="1200" height="12" fill="currentColor"/>`, "fore-svg");
    case "rubble":
      return svg("0 0 1200 700",
        `<path d="M0 700 L0 590 L140 640 L260 600 L380 660 L520 610 L660 660 L800 605 L940 655 L1080 610 L1200 650 L1200 700 Z" fill="currentColor"/>` +
        `<path d="M0 0 L0 300 L60 260 L90 120 L40 0 Z" fill="currentColor"/><path d="M1200 0 L1200 320 L1140 270 L1110 100 L1160 0 Z" fill="currentColor"/>`, "fore-svg");
    case "bed":
      return svg("0 0 1200 700",
        `<rect x="0" y="0" width="1200" height="86" fill="currentColor"/>` +
        `<path d="M0 86 q300 46 600 12 q300 -34 600 12 L1200 0 L0 0 Z" fill="currentColor"/>` +
        `<path d="M0 700 L0 590 Q260 560 520 596 L1200 590 L1200 700 Z" fill="currentColor"/>` +
        `<rect x="0" y="676" width="1200" height="24" fill="currentColor"/>`, "fore-svg");
    case "window":
      return svg("0 0 1200 700",
        `<rect x="0" y="0" width="150" height="700" fill="currentColor"/>` +
        `<rect x="1050" y="0" width="150" height="700" fill="currentColor"/>` +
        `<path d="M0 0 q75 220 0 440" stroke="#fff" stroke-width="10" fill="none" opacity=".12"/>` +
        `<path d="M1200 0 q-75 220 0 440" stroke="#fff" stroke-width="10" fill="none" opacity=".12"/>` +
        `<rect x="0" y="0" width="1200" height="46" fill="currentColor"/>`, "fore-svg");
    default: return "";
  }
}

function sprite(kind) {
  const wrap = (inner, vb = "0 0 100 130") => `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
  switch (kind) {
    case "zombie":
      return wrap(`<ellipse cx="50" cy="124" rx="30" ry="6" fill="#0004"/>
        <rect x="30" y="62" width="40" height="52" rx="12" fill="#6f8f52" stroke="#25361a" stroke-width="3"/>
        <rect x="12" y="70" width="22" height="9" rx="4" fill="#8fb56a" stroke="#25361a" stroke-width="3"/>
        <rect x="66" y="70" width="22" height="9" rx="4" fill="#8fb56a" stroke="#25361a" stroke-width="3"/>
        <circle cx="50" cy="38" r="27" fill="#a8cf78" stroke="#25361a" stroke-width="3"/>
        <circle cx="41" cy="34" r="6" fill="#fff"/><circle cx="59" cy="34" r="6" fill="#fff"/>
        <circle cx="42" cy="35" r="2.5" fill="#1d2540"/><circle cx="60" cy="35" r="2.5" fill="#1d2540"/>
        <path d="M38 50 q12 6 24 0" stroke="#25361a" stroke-width="3" fill="none"/>
        <path d="M34 16 q16 -12 32 0" stroke="#3f5a2a" stroke-width="6" fill="none" stroke-linecap="round"/>`);
    case "slime":
      return wrap(`<ellipse cx="50" cy="120" rx="32" ry="7" fill="#0004"/>
        <path d="M18 112 Q10 62 50 58 Q90 62 82 112 Z" fill="#b57bff" stroke="#4b2a80" stroke-width="3"/>
        <circle cx="39" cy="86" r="6" fill="#fff"/><circle cx="61" cy="86" r="6" fill="#fff"/>
        <circle cx="40" cy="87" r="2.5" fill="#1d2540"/><circle cx="62" cy="87" r="2.5" fill="#1d2540"/>`, "0 0 100 130");
    case "boss":
      return wrap(`<ellipse cx="50" cy="124" rx="40" ry="7" fill="#0004"/>
        <path d="M12 118 Q4 42 50 26 Q96 42 88 118 Z" fill="#8b47c9" stroke="#3a1a63" stroke-width="3"/>
        <circle cx="50" cy="70" r="26" fill="#fff"/><circle cx="50" cy="70" r="13" fill="#1d2540"/>
        <circle cx="45" cy="65" r="4" fill="#fff"/>
        <path d="M22 108 q28 14 56 0" stroke="#3a1a63" stroke-width="4" fill="none"/>
        <path d="M16 46 l-12 -18 M84 46 l12 -18" stroke="#8b47c9" stroke-width="8" stroke-linecap="round"/>`, "0 0 100 130");
    case "rover":
      return wrap(`<ellipse cx="50" cy="124" rx="42" ry="7" fill="#0004"/>
        <path d="M14 116 Q6 58 50 52 Q94 58 86 116 Z" fill="#5fc9b7" stroke="#1f5f57" stroke-width="3"/>
        <path d="M18 60 q-16 -20 2 -30 M82 60 q16 -20 -2 -30" stroke="#5fc9b7" stroke-width="12" fill="none" stroke-linecap="round"/>
        <circle cx="36" cy="80" r="7" fill="#fff"/><circle cx="64" cy="80" r="7" fill="#fff"/>
        <circle cx="37" cy="81" r="3" fill="#1d2540"/><circle cx="65" cy="81" r="3" fill="#1d2540"/>
        <ellipse cx="50" cy="98" rx="10" ry="7" fill="#1f5f57"/>
        <path d="M40 106 q10 12 20 0" stroke="#1f5f57" stroke-width="3" fill="none"/>`, "0 0 100 130");
    case "jack":
    case "quint":
    case "dirk":
    case "june":
    case "team": {
      const skin = "#ffd7b0";
      const shirt = { jack: "#ef4b56", quint: "#4d8fe8", dirk: "#ff9c3f", june: "#7a5cff", team: "#8fd12f" }[kind];
      const hair = kind === "june" ? `<path d="M28 30 q22 -22 44 0 q4 26 -6 30 l-6 -18 q-14 8 -26 0 l-4 18 q-8 -8 -2 -30 Z" fill="#2b2438"/><path d="M68 26 q22 10 14 40 l-10 -6 q8 -22 -4 -34 Z" fill="#2b2438"/>` :
        `<path d="M27 32 q4 -24 25 -22 q22 2 22 24 q-10 -10 -22 -8 q-14 0 -25 6 Z" fill="#2b2438"/>`;
      const glasses = kind === "quint" ? `<circle cx="40" cy="42" r="9" fill="none" stroke="#1d2540" stroke-width="3"/><circle cx="60" cy="42" r="9" fill="none" stroke="#1d2540" stroke-width="3"/><path d="M49 42 h2" stroke="#1d2540" stroke-width="3"/>` : "";
      return wrap(`<ellipse cx="50" cy="126" rx="30" ry="6" fill="#0004"/>
        <rect x="30" y="66" width="40" height="54" rx="10" fill="${shirt}" stroke="#1d2540" stroke-width="3"/>
        <rect x="16" y="70" width="18" height="9" rx="4" fill="${skin}" stroke="#1d2540" stroke-width="3"/>
        <rect x="66" y="70" width="18" height="9" rx="4" fill="${skin}" stroke="#1d2540" stroke-width="3"/>
        <circle cx="50" cy="42" r="24" fill="${skin}" stroke="#1d2540" stroke-width="3"/>
        ${hair}${glasses}
        <circle cx="42" cy="44" r="2.6" fill="#1d2540"/><circle cx="58" cy="44" r="2.6" fill="#1d2540"/>
        <path d="M43 54 q7 6 14 0" stroke="#1d2540" stroke-width="2.5" fill="none"/>
        <path d="M84 30 L84 108" stroke="#a9793f" stroke-width="7" stroke-linecap="round"/>`, "0 0 100 130");
    }
    // ---- 低龄书《Mister Shivers》的可爱精灵 ----
    case "monster":
      return wrap(`<ellipse cx="50" cy="124" rx="30" ry="6" fill="#0004"/>
        <path d="M20 116 Q12 52 50 48 Q88 52 80 116 Z" fill="#b98bff" stroke="#5a3a92" stroke-width="3"/>
        <path d="M26 52 l-8 -18 l18 8 M74 52 l8 -18 l-18 8" fill="#b98bff" stroke="#5a3a92" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="39" cy="80" r="9" fill="#fff"/><circle cx="61" cy="80" r="9" fill="#fff"/>
        <circle cx="40" cy="81" r="3.6" fill="#2b2140"/><circle cx="62" cy="81" r="3.6" fill="#2b2140"/>
        <path d="M39 99 q11 10 22 0" stroke="#5a3a92" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="26" cy="96" r="5" fill="#ff9ec4" opacity=".7"/><circle cx="74" cy="96" r="5" fill="#ff9ec4" opacity=".7"/>`);
    case "owl":
      return wrap(`<ellipse cx="50" cy="124" rx="26" ry="6" fill="#0004"/>
        <path d="M22 118 Q16 56 50 46 Q84 56 78 118 Z" fill="#d9a86c" stroke="#6b4526" stroke-width="3"/>
        <path d="M24 52 l-6 -20 l20 10 M76 52 l6 -20 l-20 10" fill="#d9a86c" stroke="#6b4526" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="38" cy="76" r="12" fill="#fff"/><circle cx="62" cy="76" r="12" fill="#fff"/>
        <circle cx="38" cy="77" r="4" fill="#2b2140"/><circle cx="62" cy="77" r="4" fill="#2b2140"/>
        <path d="M50 88 l-7 8 l7 8 l7 -8 Z" fill="#ffb347" stroke="#6b4526" stroke-width="2"/>
        <path d="M30 108 q20 10 40 0" stroke="#6b4526" stroke-width="2.5" fill="none"/>`);
    case "shadow":
      return wrap(`<ellipse cx="50" cy="124" rx="30" ry="5" fill="#0003"/>
        <path d="M24 118 Q18 60 50 52 Q82 60 76 118 Z" fill="#2b2b58" opacity=".72"/>
        <circle cx="40" cy="82" r="5" fill="#ffe9a8" opacity=".9"/><circle cx="60" cy="82" r="5" fill="#ffe9a8" opacity=".9"/>
        <path d="M42 100 q8 6 16 0" stroke="#ffe9a8" stroke-width="2.5" fill="none" opacity=".8"/>`);
    case "kid":
      return wrap(`<ellipse cx="50" cy="126" rx="28" ry="6" fill="#0004"/>
        <rect x="30" y="66" width="40" height="54" rx="14" fill="#7ec8ff" stroke="#1d2540" stroke-width="3"/>
        <rect x="16" y="70" width="18" height="9" rx="4" fill="#ffd7b0" stroke="#1d2540" stroke-width="3"/>
        <rect x="66" y="70" width="18" height="9" rx="4" fill="#ffd7b0" stroke="#1d2540" stroke-width="3"/>
        <circle cx="50" cy="42" r="25" fill="#ffd7b0" stroke="#1d2540" stroke-width="3"/>
        <path d="M26 34 q4 -26 26 -24 q22 2 24 24 q-12 -12 -24 -10 q-14 0 -26 10 Z" fill="#3a2b2b"/>
        <circle cx="42" cy="44" r="3" fill="#1d2540"/><circle cx="58" cy="44" r="3" fill="#1d2540"/>
        <path d="M43 54 q7 7 14 0" stroke="#1d2540" stroke-width="2.5" fill="none"/>
        <circle cx="34" cy="52" r="5" fill="#ff9c9c" opacity=".7"/><circle cx="66" cy="52" r="5" fill="#ff9c9c" opacity=".7"/>`);
    default: return "";
  }
}

// ---------- CSS 3D 布景模型 ----------
function pl(inner, x, y, z, w, h, cls = "", ry = 0, rx = 0) {
  return `<div class="p3 ${cls}" style="--x:${x}px;--y:${y}px;--z:${z}px;--w:${w}px;--h:${h}px;--ry:${ry}deg;--rx:${rx}deg">${inner}</div>`;
}
const floor = (kind) => `<div class="floor3d ${kind}"></div>`;
const shelfFace = (i) => `<div class="shelf-face">${[0, 1, 2, 3].map(k => `<i class="shelf-row"></i>`).join("")}<b class="shelf-no">${i}</b></div>`;
const lockerWall = (side) => `<div class="locker-wall ${side}">${[0, 1, 2, 3, 4, 5].map(() => `<i></i>`).join("")}</div>`;

function buildSet(kind) {
  switch (kind) {
    case "treehouse":
      return floor("floor-grass") +
        pl(`<div class="trunk"></div>`, -190, 10, -230, 74, 330, "blend") +
        pl(`<div class="platform"></div>`, 0, 96, -40, 360, 46, "") +
        pl(`<div class="ladder"></div>`, 128, 168, 60, 54, 190, "") +
        pl(`<div class="leaf-clump"></div>`, -260, -150, 190, 210, 130, "") +
        pl(`<div class="leaf-clump alt"></div>`, 270, -140, 150, 190, 120, "");
    case "store":
      return floor("floor-tile") +
        [-1, 1].flatMap(s => [0, 1, 2].map(i =>
          pl(shelfFace(i + 1), s * (250 - i * 22), 30 + i * 8, -260 + i * 190, 190, 300, "shelf", s * 16))).join("") +
        pl(`<div class="ceil-light"></div>`, 0, -215, -120, 260, 34, "");
    case "lab":
      return floor("floor-tile") +
        pl(`<div class="bench"></div>`, 0, 120, 20, 340, 80, "") +
        [0, 1, 2].map(i => pl(`<div class="coil"></div>`, -150 + i * 150, -30, -100 - i * 90, 110, 110, "coil-wrap", i * 22)).join("") +
        pl(`<div class="flask"></div>`, 80, 60, 90, 60, 80, "");
    case "field":
      return floor("floor-grass") +
        pl(`<div class="goal"></div>`, 0, -40, -280, 300, 160, "") +
        pl(`<div class="stand-block"></div>`, -320, -60, -160, 200, 120, "", 18) +
        pl(`<div class="stand-block"></div>`, 320, -60, -160, 200, 120, "", -18);
    case "hallway":
      return floor("floor-tile") +
        `<div class="wall3d left">${lockerWall("left")}</div><div class="wall3d right">${lockerWall("right")}</div>` +
        `<div class="ceil3d"></div>` +
        pl(`<div class="end-door"></div>`, 0, -10, -520, 150, 230, "") +
        pl(`<div class="ceil-light"></div>`, 0, -220, -160, 190, 28, "");
    case "parking":
      return floor("floor-asphalt") +
        [0, 1, 2].map(i => pl(`<div class="car-roof"></div>`, -230 + i * 230, 110 + i * 22, -220 + i * 130, 180, 90, "car", i % 2 ? -12 : 12)).join("") +
        pl(`<div class="lamp-post"></div>`, 320, -130, -300, 20, 280, "");
    case "rooftop":
      return floor("floor-roof") +
        [0, 1, 2, 3].map(i => pl(`<div class="eye-ring"></div>`, 0, -70, -420 + i * 70, 150 + i * 40, 150 + i * 40, "eye-layer", 0)).join("") +
        pl(`<div class="rail"></div>`, 0, 170, 100, 620, 60, "");
    case "portal":
      return floor("floor-asphalt") +
        [0, 1, 2, 3, 4, 5].map(i => pl(`<div class="portal-ring"></div>`, 0, -60, -420 + i * 76, 130 + i * 52, 130 + i * 52, `ring-layer r${i}`, 0)).join("") +
        pl(`<div class="portal-core"></div>`, 0, -60, 70, 96, 96, "core") +
        [0, 1, 2, 3].map(i => pl(`<div class="shard"></div>`, -260 + i * 175, -170 + i * 60, -140 + i * 50, 26, 46, `shard s${i}`, i * 34)).join("");
    case "bedroom":
      return floor("floor-tile") +
        pl(`<div class="bench"></div>`, 0, 130, 20, 380, 90, "") +
        pl(`<div class="platform"></div>`, 0, 60, -30, 340, 46, "") +
        pl(`<div class="flask"></div>`, 250, 20, 90, 56, 76, "") +
        pl(`<div class="ceil-light"></div>`, 0, -215, -160, 210, 30, "");
    case "forest":
      return floor("floor-grass") +
        [-1, 1].flatMap(s => [0, 1, 2].map(i =>
          pl(`<div class="trunk"></div>`, s * (200 + i * 90), 20 - i * 10, -240 + i * 150, 60, 280 - i * 40, "blend"))).join("") +
        pl(`<div class="leaf-clump"></div>`, -240, -160, 170, 190, 120, "") +
        pl(`<div class="leaf-clump alt"></div>`, 250, -150, 150, 180, 110, "");
    case "mirror":
      return floor("floor-tile") +
        [0, 1, 2].map(i => pl(`<div class="eye-ring"></div>`, 0, -50, -300 + i * 80, 150 + i * 34, 150 + i * 34, "eye-layer", 0)).join("") +
        pl(`<div class="rail"></div>`, 0, 170, 100, 560, 56, "");
    default: return "";
  }
}

// ---------- 舞台 ----------
export class Stage {
  constructor(host, ch) {
    this.host = host;
    this.ch = ch;
    this.cfg = SCENES[ch.scene || ch.id] || SCENES[1];
    this.mode = sound.mode;
    this.timers = [];
    this.destroyed = false;
    this.build();
    this.bind();
  }

  build() {
    const c = this.cfg;
    this.host.style.setProperty("--accent", c.accent);
    const parts = c.sky.map((v, i) => `${v} ${i * (100 / (c.sky.length - 1))}%`).join(",");
    const pts = Array.from({ length: 20 }, (_, i) =>
      `<i class="pt pt-${c.particle}" style="--l:${(i * 5.3 + Math.random() * 7).toFixed(1)}%;--d:${(3 + Math.random() * 5).toFixed(1)}s;--dl:${(-Math.random() * 8).toFixed(1)}s;--s:${(4 + Math.random() * 7).toFixed(0)}px;--o:${(.35 + Math.random() * .5).toFixed(2)}"></i>`).join("");

    this.host.insertAdjacentHTML("afterbegin", `
      <div class="stage mode-${this.mode}" id="stage" style="--sky:linear-gradient(180deg,${parts});--sun:${c.sun};--sunx:${c.sunAt[0]}%;--suny:${c.sunAt[1]}%;--haze:${c.haze};--pc:${c.particleColor};--accent:${c.accent}">
        <div class="camera" id="camera">
          <div class="layer l-sky"><div class="drift"></div></div>
          <div class="layer l-far"><div class="drift">${farShape(c.far)}</div></div>
          <div class="layer l-mid"><div class="drift"><img src="${this.ch.art}" alt="" style="object-position:${c.artPos}"/></div></div>
          <div class="set3d" id="set3d"><div class="world3d" id="world3d">${buildSet(c.set)}</div></div>
          <div class="layer l-actors" id="actors"><div class="drift"></div></div>
          <div class="layer l-fore"><div class="drift">${foreShape(c.fore)}</div></div>
          <div class="particles" id="particles">${pts}</div>
          <div class="grade" id="grade"></div>
        </div>
        <canvas class="fx-canvas" id="fx-canvas"></canvas>
        <div class="flash" id="flash"></div>
      </div>`);

    this.el = this.host.querySelector("#stage");
    this.cameraEl = this.host.querySelector("#camera");
    this.actors = this.host.querySelector("#actors .drift");
    this.fxCanvas = this.host.querySelector("#fx-canvas");
    this.setActors();
    this.camera({ zoom: c.zoom, tilt: c.tilt }, true);
  }

  bind() {
    // 舞台本身不吃事件（否则前景层会挡住场景里的单词牌），视差改由 .game 容器接管
    this.onMove = (e) => {
      if (this.mode === "lite") return;
      const r = this.host.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.el.style.setProperty("--px", x.toFixed(3));
      this.el.style.setProperty("--py", y.toFixed(3));
      if (this.mode === "solid") this.el.style.setProperty("--ry3d", (x * 22).toFixed(1) + "deg");
      else this.el.style.setProperty("--ry3d", (x * 7).toFixed(1) + "deg");
    };
    this.onLeave = () => {
      this.el.style.setProperty("--px", "0");
      this.el.style.setProperty("--py", "0");
      this.el.style.setProperty("--ry3d", "0deg");
    };
    this.host.addEventListener("pointermove", this.onMove);
    this.host.addEventListener("pointerleave", this.onLeave);

    // 平板 / 手机：轻微倾斜设备也能转视角（已授权时生效，不请求权限）
    this.onTilt = (e) => {
      if (this.mode === "lite" || e.gamma == null) return;
      const g = Math.max(-24, Math.min(24, e.gamma));
      this.el.style.setProperty("--ry3d", (g * (this.mode === "solid" ? .8 : .3)).toFixed(1) + "deg");
      this.el.style.setProperty("--px", (g / 30).toFixed(3));
    };
    window.addEventListener("deviceorientation", this.onTilt);
  }

  setActors(list) {
    const kinds = list || this.cfg.actors;
    // 主角采用第一人称视角（玩家即主角），场景里只放敌人 / 伙伴，避免边缘出现半截角色
    // 低龄书（scene >= 100）的可爱精灵上移到画面中部，避免被下方字幕与选择卡盖住
    const high = Boolean(this.ch.scene && this.ch.scene >= 100);
    this.actors.innerHTML = kinds.map((k, i) => {
      const left = 22 + (i * 52) / Math.max(1, kinds.length - 1 || 1) + (i % 2 ? 5 : 0);
      const scale = .72 + (i % 3) * .12;
      const delay = (i * .18).toFixed(2);
      return `<div class="sprite ${high ? "high" : ""} sp-${k}" data-kind="${k}" style="--left:${left}%;--sc:${scale};--dl:${delay}s">${sprite(k)}</div>`;
    }).join("");
  }

  hit(index = 0) {
    const all = [...this.actors.querySelectorAll(".sprite:not(.hero)")];
    const el = all[index % Math.max(1, all.length)];
    if (!el) return;
    el.classList.add("hit");
    const t = setTimeout(() => el.classList.remove("hit"), 520);
    this.timers.push(t);
  }

  camera({ zoom = 1.06, cx = 0, cy = 0, tilt = 0, mood = "" } = {}, instant = false) {
    if (!this.cameraEl) return;
    if (instant) this.cameraEl.style.transition = "none";
    this.el.style.setProperty("--zoom", zoom);
    this.el.style.setProperty("--cx", cx + "px");
    this.el.style.setProperty("--cy", cy + "px");
    this.el.style.setProperty("--tilt", tilt + "deg");
    this.el.dataset.mood = mood;
    if (instant) requestAnimationFrame(() => { if (this.cameraEl) this.cameraEl.style.transition = ""; });
  }

  shake(power = 1) {
    if (this.mode === "lite") return;
    this.el.style.setProperty("--shake", power);
    this.el.classList.remove("shaking");
    void this.el.offsetWidth;
    this.el.classList.add("shaking");
    const t = setTimeout(() => this.el.classList.remove("shaking"), 480);
    this.timers.push(t);
  }

  flash(color = "rgba(255,255,255,.55)") {
    const f = this.host.querySelector("#flash");
    if (!f) return;
    f.style.background = color;
    f.classList.remove("on");
    void f.offsetWidth;
    f.classList.add("on");
    const t = setTimeout(() => f.classList.remove("on"), 420);
    this.timers.push(t);
  }

  setMode(mode) {
    this.mode = mode;
    sound.setMode(mode);
    this.el.className = `stage mode-${mode}`;
    if (mode === "lite") {
      this.el.style.setProperty("--px", "0");
      this.el.style.setProperty("--py", "0");
      this.el.style.setProperty("--ry3d", "0deg");
    }
  }

  label(text) {
    const l = this.host.querySelector("#scene-label");
    if (l) l.textContent = text;
  }

  // 场景里可点的英文单词牌：点中发音 + 收进单词本
  wordTags(words) {
    this.actors.insertAdjacentHTML("beforeend", words.slice(0, 3).map((w, i) =>
      `<button class="word3d" data-w="${encodeURIComponent(w.w)}" style="--wl:${14 + i * 29}%;--wt:${34 + (i % 2) * 12}%;--wd:${(i * .3).toFixed(1)}s" title="点击听发音">${w.w}</button>`).join(""));
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.timers.forEach(clearTimeout);
    this.host.removeEventListener("pointermove", this.onMove);
    this.host.removeEventListener("pointerleave", this.onLeave);
    window.removeEventListener("deviceorientation", this.onTilt);
  }
}
