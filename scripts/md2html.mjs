#!/usr/bin/env node
// このファイルは _tools/md2html.mjs のコピー。直接編集しない。
// 原本本文ハッシュ: sha256: 590bb8a734ac95f12235c9e0b85f53732c21ca9832296542761b2dba150674bf（sync-md2html.mjs が更新する）
/**
 * md2html — プラン系 Markdown を「読む用」の HTML に変換する。
 *
 * 使い方:
 *   node scripts/md2html.mjs              # plans/ 配下の .md を、同じ場所に .html として出力
 *   node scripts/md2html.mjs <ディレクトリ>  # 任意のディレクトリを対象にする
 *   node scripts/md2html.mjs <dir> -r     # サブフォルダも再帰的に変換
 *   node scripts/md2html.mjs --clean      # 生成済み .html と index.html を削除
 *
 * 方針:
 *   - .md と .html を同じフォルダに置く（編集は .md、読むのは .html）
 *   - index.html に一覧を作る
 *   - 外部依存なし（Node だけで動く）。生成物は .gitignore 済み。
 */

import fs from "node:fs";
import path from "node:path";

// リポジトリ固有の差は、実行場所ではなくスクリプト横の設定で明示する。
const scriptDir = path.dirname(path.resolve(process.argv[1] || import.meta.filename));
const configPath = path.join(path.basename(scriptDir) === "scripts" ? path.dirname(scriptDir) : scriptDir, "md2html.config.json");
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error(`md2html: 設定ファイルを読めません: ${configPath} (${error.message})`);
    process.exit(1);
  }
}

const AI_URL_LIMIT = 6000;

// 対応状況は 2026-08-16 にログイン済みブラウザーで実測済み。
const AI_TARGETS = [
  { id: "chatgpt", label: "ChatGPT", baseUrl: "https://chatgpt.com/", queryParam: "prompt", submits: false },
  { id: "claude", label: "Claude", baseUrl: "https://claude.ai/new", queryParam: "q", submits: false },
  { id: "perplexity", label: "Perplexity", baseUrl: "https://www.perplexity.ai/search/", queryParam: "q", submits: true },
  { id: "grok", label: "Grok", baseUrl: "https://grok.com/", queryParam: "q", submits: true },
  { id: "gemini", label: "Gemini", baseUrl: "https://gemini.google.com/app", queryParam: null, submits: false, needsClipboard: true },
];

const AI_CONSULT_TOPICS = [
  { id: "transport", label: "移動の現実性", ask: "各移動の所要時間と乗り換えを確認し、無理のある箇所と現実的な交通手段・きっぷを具体的に教えてください。" },
  { id: "cost", label: "費用の妥当性", ask: "概算費用が現実的かを項目別に確認し、見落としや節約できる点を教えてください。料金は最新情報の確認が必要なものを明記してください。" },
  { id: "alternatives", label: "代替案", ask: "混雑、運休、悪天候で予定どおり動けない場合の代替案を、行程を大きく崩さない順に提案してください。" },
  { id: "packing", label: "持ち物", ask: "この行き先、日数、移動手段に合う持ち物リストを作り、必須・あると便利・現地調達可に分けてください。" },
];

const PRIVATE_AI_LINE = /予約(?:番号|コード|ID)|確認番号|連絡先|電話番号|メールアドレス|認証|トークン|パスワード/i;

function cleanAiText(value) {
  if (!value || PRIVATE_AI_LINE.test(value)) return "";
  return value
    .replace(/<!--.*?-->/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "")
    .replace(/(?:\+?81[- ]?)?0\d{1,4}[- ]\d{1,4}[- ]\d{3,4}/g, "")
    .replace(/[*_~`#]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlanData(md, title) {
  const field = (label) => {
    const match = md.match(new RegExp(`^\\s*[-*+]\\s+.*?(?:${label}).*?:\\s*(.+)$`, "mi"));
    return cleanAiText(match?.[1] || "").slice(0, 240);
  };
  const itineraryStart = md.search(/^##\s+行程\s*$/m);
  const itineraryRest = itineraryStart >= 0 ? md.slice(itineraryStart).replace(/^##\s+行程\s*\r?\n?/, "") : "";
  const nextSection = itineraryRest.search(/^##\s+/m);
  const itinerarySection = nextSection >= 0 ? itineraryRest.slice(0, nextSection) : itineraryRest;
  const itinerary = [];
  for (const line of itinerarySection.split("\n")) {
    const day = line.match(/^###\s+(.+)$/);
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (day) {
      const text = cleanAiText(day[1]);
      if (text) itinerary.push(`【${text}】`);
    } else if (item) {
      const text = cleanAiText(item[1]).replace(/^\d+[.)]\s*/, "");
      if (text) itinerary.push(text.slice(0, 220));
    }
    if (itinerary.length >= 36) break;
  }
  const dayLabels = itinerary.filter((line) => line.startsWith("【")).map((line) => line.slice(1, -1));
  return {
    title: cleanAiText(title).slice(0, 180),
    schedule: dayLabels.join(" / ") || cleanAiText(title.match(/\d+日(?:間|プラン)?/)?.[0] || "日程の記載なし"),
    itinerary,
    transport: field("移動手段"),
    estimatedCost: field("目安費用|概算費用"),
    theme: field("テーマ"),
    season: field("ベストシーズン|おすすめシーズン"),
  };
}

const THEME_RULES = [
  ["温泉", /温泉|湯治|露天風呂/],
  ["絶景", /絶景|夜景|パノラマ|展望|夕日|朝日|富士山/],
  ["グルメ", /グルメ|食べ歩き|海鮮|寿司|そば|うどん|ラーメン|ランチ|名物|市場/],
  ["歴史", /歴史|城|城跡|古戦場|宿場|史跡|世界遺産/],
  ["神社仏閣", /神社|神宮|寺|大社|参拝|仏閣/],
  ["自然", /自然|高原|渓谷|峡谷|滝|湖|湿原|山|紅葉|桜|花/],
  ["海・島", /海|湾|半島|島|岬|ビーチ|海岸|水族館/],
  ["街歩き", /街歩き|町歩き|市街|散策|商店街|レトロ/],
  ["アート", /美術館|博物館|アート|建築/],
  ["アクティブ", /ハイキング|登山|サイクリング|カヌー|ラフティング|スキー/],
];

function extractSearchData(md, title, sourceRel, href) {
  const parts = sourceRel.split(path.sep);
  const root = parts[0];
  const regionPart = parts.find((part) => /^\d+_.+地方$/.test(part));
  const prefecturePart = parts.find((part) => /(?:都|道|府|県)$/.test(part));
  const dayMatch = path.basename(sourceRel, path.extname(sourceRel)).match(/(\d+)日/)
    || title.match(/(\d+)日/);
  const plan = extractPlanData(md, title);
  const complete = !/プラン内容は後で作成|TODO|TBD/i.test(md) && /^##\s+行程\s*$/m.test(md);
  const kind = root === "バイク" ? "バイク" : root === "豊橋駅発_激安格安プラン" ? "格安" : "国内";
  const scope = root === "バイク"
    ? (parts.includes("遠征") ? "遠征" : parts.includes("週末") ? "週末" : "日帰り")
    : "";
  const searchable = cleanAiText(md).slice(0, 8000);
  const tags = THEME_RULES.filter(([, pattern]) => pattern.test(`${title} ${plan.theme} ${searchable}`))
    .map(([tag]) => tag).slice(0, 4);
  if (kind === "バイク") tags.unshift("ツーリング");
  if (root === "豊橋駅発_激安格安プラン" || parts.includes("格安プラン")) tags.unshift("節約");
  return {
    href,
    title,
    kind,
    scope,
    region: regionPart ? regionPart.replace(/^\d+_/, "") : (kind === "バイク" ? "ツーリング" : "未分類"),
    prefecture: prefecturePart || "",
    days: dayMatch ? dayMatch[1] : (scope === "日帰り" ? "1" : ""),
    theme: plan.theme,
    season: plan.season,
    transport: plan.transport,
    cost: plan.estimatedCost,
    tags: [...new Set(tags)].slice(0, 4),
    updated: fs.statSync(path.resolve(process.cwd(), sourceRel)).mtime.toISOString().slice(0, 10),
    complete,
    search: `${title} ${regionPart || ""} ${prefecturePart || ""} ${plan.theme} ${plan.season} ${plan.transport} ${tags.join(" ")} ${searchable}`.toLocaleLowerCase("ja"),
  };
}

function buildTripPrompt(plan, topicId, topics = AI_CONSULT_TOPICS) {
  const topic = topics.find((item) => item.id === topicId) || topics[0];
  const lines = ["以下は私の旅行プランです。", "", `プラン名: ${plan.title}`, `日程: ${plan.schedule}`];
  if (plan.transport) lines.push(`移動手段: ${plan.transport}`);
  if (plan.estimatedCost) lines.push(`概算費用: ${plan.estimatedCost}`);
  lines.push("", "立ち寄り先・行程:");
  if (plan.itinerary.length) {
    for (const item of plan.itinerary) lines.push(item.startsWith("【") ? item : `- ${item}`);
  } else {
    lines.push("- 行程の記載なし");
  }
  lines.push("", "---", topic.ask);
  return lines.join("\n");
}

function aiTarget(id) {
  return AI_TARGETS.find((target) => target.id === id) || AI_TARGETS[0];
}

function buildAiUrl(id, prompt) {
  const target = aiTarget(id);
  if (!target.queryParam) return target.baseUrl;
  return `${target.baseUrl}?${target.queryParam}=${encodeURIComponent(prompt)}`;
}

function fitAiPrompt(id, prompt) {
  let text = prompt;
  const suffix = "\n…（URL長の上限に合わせて行程の末尾を省略）";
  while (text && buildAiUrl(id, `${text.trimEnd()}${suffix}`).length > AI_URL_LIMIT) {
    text = text.slice(0, Math.floor(text.length * 0.9));
  }
  return text === prompt ? text : `${text.trimEnd()}${suffix}`;
}

const PLAN_ROOTS = new Set(["日本", "豊橋駅発_激安格安プラン", "バイク", "海外"]);

function isTravelPlan(sourcePath) {
  if (!config.travel?.enabled) return false;
  const relative = path.relative(process.cwd(), sourcePath);
  const [root] = relative.split(path.sep);
  const roots = new Set(config.travel.planRoots || PLAN_ROOTS);
  return !relative.startsWith("..") && roots.has(root) && path.basename(sourcePath).toLowerCase() !== "readme.md";
}

const CSS = `
:root{color-scheme:light;--bg:#f6f4ee;--surface:#fffdf8;--surface-2:#ebe7db;--fg:#222720;--muted:#697066;--line:#d8d5ca;--accent:#176b58;--accent-strong:#0f4d40;--accent-soft:#dcece5;--warm:#c9663d;--code-bg:#eeece4;--mark:#fff0ad;--shadow:0 14px 40px rgba(41,52,43,.08)}
:root[data-theme="dark"]{color-scheme:dark;--bg:#191d19;--surface:#212721;--surface-2:#2b322b;--fg:#eef1e9;--muted:#aeb8ad;--line:#3e493f;--accent:#83ccb7;--accent-strong:#a7e0d0;--accent-soft:#263d35;--warm:#ed946f;--code-bg:#2b312b;--mark:#5d5228;--shadow:0 14px 40px rgba(0,0,0,.2)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#191d19;--surface:#212721;--surface-2:#2b322b;--fg:#eef1e9;--muted:#aeb8ad;--line:#3e493f;--accent:#83ccb7;--accent-strong:#a7e0d0;--accent-soft:#263d35;--warm:#ed946f;--code-bg:#2b312b;--mark:#5d5228;--shadow:0 14px 40px rgba(0,0,0,.2)}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);
 font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif;
 font-size:17px;line-height:1.9;-webkit-text-size-adjust:100%;overflow-wrap:anywhere}
.wrap{width:min(100% - 2.5rem,74ch);margin:0 auto;padding:2.5rem 0 6rem}
.bar{width:min(100% - 2.5rem,74ch);margin:0 auto;padding:1rem 0 0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;font-size:.84rem;color:var(--muted)}
.bar a{color:var(--muted)}
.theme-picker{display:flex;align-items:center;gap:.4rem;margin-left:auto}
.theme-picker span{white-space:nowrap}
.theme-options{display:inline-flex;border:1px solid var(--line)}
.theme-options button{border:0;border-right:1px solid var(--line);padding:.2rem .48rem;background:transparent;color:var(--muted);font:inherit;line-height:1.4;cursor:pointer}
.theme-options button:last-child{border-right:0}
.theme-options button[aria-pressed="true"]{background:var(--code-bg);color:var(--fg);font-weight:700}
.theme-options button:focus-visible{position:relative;outline:2px solid var(--accent);outline-offset:2px}
.ai-consult-open{border:1px solid var(--line);border-radius:3px;padding:.3rem .65rem;background:var(--bg);color:var(--accent);font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}
.ai-consult-dialog{width:min(calc(100% - 2rem),34rem);padding:0;border:1px solid var(--line);border-radius:5px;background:var(--bg);color:var(--fg);box-shadow:0 1.2rem 4rem #0005}
.ai-consult-dialog::backdrop{background:#0008}
.ai-consult-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;border-bottom:1px solid var(--line)}
.ai-consult-head h2{margin:0;padding:0;border:0;font:700 1.25rem/1.4 "Hiragino Mincho ProN","Yu Mincho",serif}
.ai-consult-close{border:0;background:transparent;color:var(--muted);font:inherit;font-size:1.2rem;cursor:pointer}
.ai-consult-body{padding:1.15rem 1.2rem 1.3rem}
.ai-consult-body label{display:grid;gap:.35rem;font-weight:700}
.ai-consult-body select{width:100%;padding:.55rem;border:1px solid var(--line);border-radius:3px;background:var(--bg);color:var(--fg);font:inherit}
.ai-consult-note,.ai-consult-status{color:var(--muted);font-size:.84rem;line-height:1.65}
.ai-consult-targets{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:1rem}
.ai-consult-targets a{display:block;border:1px solid var(--line);border-radius:3px;padding:.55rem .7rem;text-align:center;text-decoration:none;font-weight:700}
h1,h2,h3,h4,h5,h6{scroll-margin-top:1rem;line-height:1.45;margin:2.4em 0 .75em}
h1,h2{font-family:"Hiragino Mincho ProN","Yu Mincho",YuMincho,serif;font-weight:700}
h1{font-size:clamp(1.75rem,5vw,2.15rem);margin-top:0;padding-bottom:.45em;border-bottom:2px solid var(--fg)}
h2{font-size:1.48rem;padding-bottom:.3em;border-bottom:1px solid var(--line)}
h3{font-size:1.16rem;font-weight:750}
h4,h5,h6{font-size:1rem;font-weight:700;color:var(--muted)}
p,ul,ol,blockquote,table,pre{margin:0 0 1.15em}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:3px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
ul,ol{padding-left:1.55em}
li{margin:.32em 0}
li>input[type=checkbox]{margin-right:.45em}
blockquote{border-left:3px solid var(--line);padding:.15em 0 .15em 1em;color:var(--muted)}
hr{border:0;border-top:1px solid var(--line);margin:2.75em 0}
code{background:var(--code-bg);padding:.12em .35em;border-radius:3px;font-size:.88em;
 font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:3px;padding:1em;overflow:auto;max-width:100%}
pre code{background:none;padding:0;font-size:.84em;line-height:1.65;overflow-wrap:normal;word-break:normal;white-space:pre}
.tablewrap{max-width:100%;overflow-x:auto;margin:0 0 1.25em;border:1px solid var(--line)}
table{border-collapse:collapse;width:100%;min-width:max-content;margin:0;font-size:.9em;font-variant-numeric:tabular-nums}
th,td{border:0;border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:.52em .72em;text-align:left;vertical-align:top}
tr:last-child td{border-bottom:0} th:last-child,td:last-child{border-right:0}
th{background:var(--code-bg);font-weight:700;white-space:nowrap}
.align-center{text-align:center}.align-right{text-align:right}
img{max-width:100%;height:auto}
.toc{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:.7em 0;margin:0 0 2.75em}
.toc summary{cursor:pointer;font-weight:700}
.toc ul{margin:.65em 0 .2em;padding-left:1.25em}
.toc li{margin:.18em 0;font-size:.9em;line-height:1.55}
.index-note{color:var(--muted);font-size:.9em}
.entries{list-style:none;padding:0;margin-top:2rem;border-top:1px solid var(--line)}
.entries li{margin:0;border-bottom:1px solid var(--line)}
.entries a{display:grid;grid-template-columns:minmax(12rem,1fr) auto;gap:.5rem 1.5rem;padding:.85em .2em;
 text-decoration:none;color:var(--fg)}
.entries a:hover .n{text-decoration:underline;text-underline-offset:3px}
.entries .n{font-weight:700}
.entries .m{font-size:.78em;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
.home-body{background:radial-gradient(circle at 82% 0,var(--accent-soft),transparent 30rem),var(--bg)}
.home-bar,.home-wrap{width:min(100% - 3rem,76rem)}
.home-bar{padding-top:1.35rem}.home-brand{color:var(--fg)!important;text-decoration:none;font-weight:850;letter-spacing:.02em}
.home-wrap{max-width:none;padding-top:1.5rem}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.hero{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(16rem,.7fr);align-items:end;gap:3rem;padding:3.5rem 0 2.8rem}
.hero-eyebrow{margin:0 0 .7rem;color:var(--warm);font-size:.78rem;font-weight:850;letter-spacing:.14em;text-transform:uppercase}
.hero h1{max-width:12ch;margin:0;border:0;padding:0;font:800 clamp(2.7rem,7vw,5.6rem)/1.06 "Hiragino Mincho ProN","Yu Mincho",serif;letter-spacing:-.05em}
.hero-copy{max-width:34rem;margin:1.25rem 0 0;color:var(--muted);font-size:1rem;line-height:1.75}
.hero-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin:0}
.hero-stats div{padding:1rem;border:1px solid var(--line);border-radius:14px;background:color-mix(in srgb,var(--surface) 85%,transparent)}
.hero-stats dt{color:var(--muted);font-size:.72rem;font-weight:750}.hero-stats dd{margin:.15rem 0 0;font-size:1.45rem;font-weight:850;font-variant-numeric:tabular-nums}
.travel-index{margin:0 0 3rem}
.search-box{position:relative}.search-box::before{content:"⌕";position:absolute;left:1.15rem;top:50%;translate:0 -50%;font-size:1.7rem;color:var(--accent);pointer-events:none}
.search-box input{width:100%;padding:1.05rem 3.2rem;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--fg);box-shadow:var(--shadow);font-family:inherit;font-size:1.02rem;font-weight:700;line-height:1.4}
.search-clear{position:absolute;right:.75rem;top:50%;translate:0 -50%;border:0;border-radius:99px;background:var(--surface-2);color:var(--muted);padding:.35rem .65rem;font:inherit;cursor:pointer}
.quick-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:1.1rem 0 2rem}
.kind-card{display:flex;align-items:center;gap:.9rem;padding:1rem;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--fg);text-align:left;font:inherit;cursor:pointer}
.kind-card:hover,.kind-card[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft)}
.kind-icon{display:grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:50%;background:var(--surface-2);font-size:1.2rem}.kind-card strong{display:block}.kind-card small{display:block;color:var(--muted);font-size:.75rem}
.filter-panel{padding:1.15rem;border:1px solid var(--line);border-radius:18px;background:var(--surface)}
.travel-filters{display:grid;grid-template-columns:1.1fr 1.2fr 1.2fr .7fr .85fr;gap:.8rem}
.travel-filters label{display:grid;gap:.3rem;color:var(--muted);font-size:.73rem;font-weight:800}
.travel-filters select{min-width:0;width:100%;padding:.62rem .7rem;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--fg);font:inherit}
.tag-filter{display:flex;flex-wrap:wrap;gap:.45rem;margin:1rem 0 0;padding:1rem 0 0;border-top:1px solid var(--line)}
.tag-chip{border:1px solid var(--line);border-radius:999px;padding:.35rem .7rem;background:transparent;color:var(--muted);font-family:inherit;font-size:.78rem;font-weight:700;line-height:1.4;cursor:pointer}.tag-chip:hover,.tag-chip[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-strong)}
.results-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:2.2rem 0 1rem}.results-head h2{margin:0;border:0;padding:0;font-size:1.55rem}.travel-count{margin:0;color:var(--muted);font-size:.85rem;font-variant-numeric:tabular-nums}.filter-reset{border:0;background:transparent;color:var(--accent);font-family:inherit;font-size:.82rem;font-weight:700;cursor:pointer}
.travel-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;list-style:none;padding:0;margin:0}
.travel-card{position:relative;min-width:0;margin:0;border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden;transition:translate .18s ease,box-shadow .18s ease,border-color .18s ease}.travel-card:hover{translate:0 -3px;border-color:var(--accent);box-shadow:var(--shadow)}
.travel-card>a{display:flex;flex-direction:column;height:100%;padding:1.1rem;color:var(--fg);text-decoration:none}.card-top{display:flex;align-items:center;justify-content:space-between;gap:.7rem}.kind-pill{border-radius:999px;padding:.2rem .55rem;background:var(--accent-soft);color:var(--accent-strong);font-size:.7rem;font-weight:850}.draft-pill{color:var(--warm);font-size:.7rem;font-weight:800}.card-title{margin:.75rem 0 .45rem;font-size:1.05rem;line-height:1.5;font-weight:850}.card-place{margin:0;color:var(--muted);font-size:.78rem}.card-theme{display:-webkit-box;min-height:3.2em;margin:.8rem 0;color:var(--muted);font-size:.8rem;line-height:1.6;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.card-tags{display:flex;flex-wrap:wrap;gap:.35rem;margin:auto 0 .8rem}.card-tags span{border-radius:999px;background:var(--surface-2);padding:.18rem .5rem;color:var(--muted);font-size:.68rem}.card-meta{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding-top:.75rem;border-top:1px solid var(--line);color:var(--muted);font-size:.72rem;font-variant-numeric:tabular-nums}.card-meta b{color:var(--fg)}.card-updated{white-space:nowrap}
.load-more{display:block;margin:1.5rem auto 0;border:1px solid var(--line);border-radius:999px;padding:.65rem 1.35rem;background:var(--surface);color:var(--fg);font-family:inherit;font-size:.85rem;font-weight:700;cursor:pointer}.empty-state{grid-column:1/-1;padding:4rem 1rem;text-align:center;color:var(--muted)}
@media (max-width:600px){
 body{font-size:16px;line-height:1.82}.wrap{width:min(100% - 2rem,74ch);padding-top:1.8rem}.bar{width:calc(100% - 2rem)}
 h2{font-size:1.32rem}.entries a{grid-template-columns:1fr;gap:.15rem}.entries .m{text-align:left}
 th,td{padding:.48em .6em}
 .home-bar,.home-wrap{width:calc(100% - 2rem)}.hero{grid-template-columns:1fr;gap:1.8rem;padding:2.5rem 0 2rem}.hero h1{font-size:clamp(2.55rem,15vw,4.2rem)}.hero-stats div{padding:.75rem}.hero-stats dd{font-size:1.15rem}.hero-stats dt{font-size:.65rem}
 .quick-kinds{grid-template-columns:1fr}.travel-filters{grid-template-columns:1fr 1fr}.travel-results{grid-template-columns:1fr}.filter-panel{padding:1rem}.results-head{align-items:center}
 .ai-consult-targets{grid-template-columns:1fr}
}
@media (min-width:601px) and (max-width:900px){.travel-results{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{grid-template-columns:1fr}.travel-filters{grid-template-columns:1fr 1fr}}
@media print{
 :root,:root[data-theme="light"],:root[data-theme="dark"]{color-scheme:light;--bg:#fff;--fg:#111;--muted:#444;--line:#bbb;--accent:#111;--code-bg:#f3f3f3}
 body{font-size:11pt;line-height:1.65}.bar,.toc,.ai-consult-dialog{display:none}.wrap{width:auto;max-width:none;padding:0}
 h1,h2,h3,h4{break-after:avoid}pre,blockquote,.tablewrap,img{break-inside:avoid}.tablewrap{overflow:visible}table{min-width:0}
 a{color:inherit;text-decoration:none}a[href^="http"]::after{content:" (" attr(href) ")";font-size:.8em}
}
`;

/* ---------- Markdown → HTML (最小構成の自前パーサ) ---------- */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slug = (s) =>
  s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").slice(0, 80);

// Markdown の URL は属性へ入るため、危険なスキームを HTML に持ち込まない。
function safeUrl(value, { image = false } = {}) {
  const url = value.trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return null;
  if (url.startsWith("#") || url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) return url;
  if (/^https?:/i.test(url)) return url;
  if (!image && /^mailto:/i.test(url)) return url;
  return null;
}

function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => `\uE000${codes.push(`<code>${esc(c)}</code>`) - 1}\uE000`);
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => {
    const src = safeUrl(u, { image: true });
    return src ? `<img src="${src}" alt="${a}">` : a;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const raw = safeUrl(u);
    if (!raw) return t;
    const href = /^(https?:|#|mailto:)/i.test(raw) ? raw : raw.replace(/\.md($|#)/, ".html$1");
    const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${href}"${ext}>${t}</a>`;
  });
  s = s.replace(/(^|[^\w*])\*\*([^*]+)\*\*/g, "$1<strong>$2</strong>");
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/(^|\s)(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return s.replace(/\uE000(\d+)\uE000/g, (_, i) => codes[+i]);
}

function render(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const toc = [];
  const usedIds = new Map();
  let i = 0;

  const listItem = (text) =>
    text.replace(/^\[( |x|X)\]\s+/, (_, c) =>
      `<input type="checkbox" disabled${c.toLowerCase() === "x" ? " checked" : ""}>`);

  while (i < lines.length) {
    const line = lines[i];

    // フェンス付きコードブロック
    const fence = line.match(/^\s*(```+|~~~+)(.*)$/);
    if (fence) {
      const close = fence[1][0].repeat(fence[1].length);
      const lang = fence[2].trim().replace(/[^\w-]/g, "");
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(close)) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="language-${lang}"` : ""}>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // 見出し
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lv = h[1].length;
      const text = h[2].replace(/\s*#+\s*$/, "");
      const baseId = slug(text) || `h${out.length}`;
      const duplicate = usedIds.get(baseId) || 0;
      usedIds.set(baseId, duplicate + 1);
      const id = duplicate ? `${baseId}-${duplicate + 1}` : baseId;
      if (lv >= 2 && lv <= 3) toc.push({ lv, id, text: esc(text) });
      out.push(`<h${lv} id="${id}">${inline(text)}</h${lv}>`);
      i++;
      continue;
    }

    // 水平線
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // テーブル
    if (/\|/.test(line) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1] || "")) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      const align = cells(lines[i + 1]).map((cell) => {
        const left = cell.startsWith(":");
        const right = cell.endsWith(":");
        return left && right ? "center" : right ? "right" : "left";
      });
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(
        `<div class="tablewrap" role="region" aria-label="横にスクロールできる表" tabindex="0"><table><thead><tr>${head.map((c, col) => `<th class="align-${align[col] || "left"}">${inline(c)}</th>`).join("")}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map((c, col) => `<td class="align-${align[col] || "left"}">${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      );
      continue;
    }

    // 引用
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${render(buf.join("\n")).body}</blockquote>`);
      continue;
    }

    // リスト（ネスト対応）
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const stack = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (stack.length && /^\s+\S/.test(lines[i])))) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) { // 継続行
          out.push(" " + inline(lines[i].trim()));
          i++;
          continue;
        }
        const depth = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
        const tag = /\d/.test(m[2]) ? "ol" : "ul";
        while (stack.length > depth + 1) { out.push(`</li></${stack.pop()}>`); }
        if (stack.length === depth + 1) out.push("</li>");
        while (stack.length < depth + 1) { out.push(`<${tag}>`); stack.push(tag); }
        out.push(`<li>${listItem(inline(m[3]))}`);
        i++;
      }
      while (stack.length) { out.push(`</li></${stack.pop()}>`); }
      continue;
    }

    // 空行
    if (!line.trim()) { i++; continue; }

    // 段落
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|>|```|~~~|([-*+]|\d+[.)])\s)/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join("\n")).replace(/\n/g, "<br>\n")}</p>`);
  }

  return { body: out.join("\n"), toc };
}

function page(title, md, backHref, plan = null) {
  const { body, toc } = render(md);
  const tocHtml =
    toc.length >= 3
      ? `<details class="toc" open><summary>目次</summary><ul>${toc
          .map((t) => `<li style="margin-left:${(t.lv - 2) * 1.1}em"><a href="#${t.id}">${t.text}</a></li>`)
          .join("")}</ul></details>`
      : "";
  const content = tocHtml && /<h1\b/.test(body)
    ? body.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/, `$1\n${tocHtml}`)
    : `${tocHtml}${body}`;
  const aiButton = plan ? `<button type="button" class="ai-consult-open" data-ai-consult-open>AIに相談</button>` : "";
  const aiDialog = plan ? `<dialog class="ai-consult-dialog" data-ai-consult-dialog>
<div class="ai-consult-head"><h2>AIに相談</h2><button type="button" class="ai-consult-close" data-ai-consult-close aria-label="閉じる">✕</button></div>
<div class="ai-consult-body">
<label>相談する内容<select data-ai-consult-topic>${AI_CONSULT_TOPICS.map((topic) => `<option value="${topic.id}">${topic.label}</option>`).join("")}</select></label>
<p class="ai-consult-note">プラン名・日程・立ち寄り先・移動手段・概算費用を渡します。メモ、予約番号、連絡先、URLは送りません。「→」付きは送信前に編集でき、付いていないAIは開くと回答が始まります。Geminiはプロンプトをコピーして開きます。</p>
<div class="ai-consult-targets" data-ai-consult-targets></div>
<p class="ai-consult-status" data-ai-consult-status role="status" aria-live="polite"></p>
</div>
</dialog>` : "";
  const aiScript = plan ? `<script>(()=>{const plan=${JSON.stringify(plan).replace(/</g, "\\u003c")};const topics=${JSON.stringify(AI_CONSULT_TOPICS).replace(/</g, "\\u003c")};const targets=${JSON.stringify(AI_TARGETS).replace(/</g, "\\u003c")};const limit=${AI_URL_LIMIT};${buildTripPrompt.toString()};const dialog=document.querySelector("[data-ai-consult-dialog]");const topic=document.querySelector("[data-ai-consult-topic]");const targetBox=document.querySelector("[data-ai-consult-targets]");const status=document.querySelector("[data-ai-consult-status]");const buildUrl=(target,prompt)=>target.queryParam?target.baseUrl+"?"+target.queryParam+"="+encodeURIComponent(prompt):target.baseUrl;const fitPrompt=(target,prompt)=>{if(!target.queryParam)return prompt;let text=prompt;const suffix="\\n…（URL長の上限に合わせて行程の末尾を省略）";while(text&&buildUrl(target,text.trimEnd()+suffix).length>limit)text=text.slice(0,Math.floor(text.length*.9));return text===prompt?text:text.trimEnd()+suffix};const copyFallback=(text)=>{const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();document.execCommand("copy");area.remove()};const copyPrompt=(text)=>{if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text).catch(()=>copyFallback(text));copyFallback(text);return Promise.resolve()};const refresh=()=>{const prompt=buildTripPrompt(plan,topic.value,topics);targetBox.replaceChildren(...targets.map((target)=>{const text=fitPrompt(target,prompt);const link=document.createElement("a");link.href=buildUrl(target,text);link.target="_blank";link.rel="noopener";link.textContent=target.needsClipboard?target.label+"（コピー）":target.label+(target.submits?"":" →");if(target.needsClipboard)link.addEventListener("click",()=>{copyPrompt(text);status.textContent="プロンプトをコピーしました。Geminiで貼り付けてください。"});return link}))};document.querySelector("[data-ai-consult-open]").addEventListener("click",()=>{refresh();dialog.showModal()});document.querySelector("[data-ai-consult-close]").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",(event)=>{if(event.target===dialog)dialog.close()});topic.addEventListener("change",()=>{status.textContent="";refresh()})})()</script>` : "";
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<script>(()=>{try{const t=localStorage.getItem("md2html-theme");if(t==="light"||t==="dark"||t==="auto")document.documentElement.dataset.theme=t}catch{}})()</script>
<style>${CSS}</style>
</head>
<body>
<nav class="bar" aria-label="読書設定">
${backHref ? `<a href="${backHref}">一覧へ戻る</a>` : ""}
${aiButton}
<div class="theme-picker"><span>表示</span><div class="theme-options" role="group" aria-label="配色"><button type="button" data-theme-choice="light">ライト</button><button type="button" data-theme-choice="dark">ダーク</button><button type="button" data-theme-choice="auto">自動</button></div></div>
</nav>
<main class="wrap">
${content}
</main>
${aiDialog}
<script>(()=>{const root=document.documentElement;const buttons=[...document.querySelectorAll("[data-theme-choice]")];const current=()=>["light","dark","auto"].includes(root.dataset.theme)?root.dataset.theme:"auto";const paint=()=>{const value=current();for(const button of buttons)button.setAttribute("aria-pressed",String(button.dataset.themeChoice===value))};for(const button of buttons)button.addEventListener("click",()=>{const value=button.dataset.themeChoice;root.dataset.theme=value;try{localStorage.setItem("md2html-theme",value)}catch{}paint()});paint()})()</script>
${aiScript}
</body>
</html>`;
}

function travelHomePage(items) {
  const unique = (key, compare = (a, b) => a.localeCompare(b, "ja")) =>
    [...new Set(items.map((item) => item[key]).filter(Boolean))].sort(compare);
  const options = (values, suffix = "") => values.map((value) => `<option value="${esc(value)}">${esc(value)}${suffix}</option>`).join("");
  const counts = Object.fromEntries(["国内", "格安", "バイク"].map((kind) => [kind, items.filter((item) => item.kind === kind).length]));
  const tagCounts = new Map();
  for (const item of items) for (const tag of item.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  const popularTags = [...tagCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")).slice(0, 10);
  const cards = items
    .sort((a, b) => Number(b.complete) - Number(a.complete) || a.kind.localeCompare(b.kind, "ja") || a.region.localeCompare(b.region, "ja") || Number(a.days || 99) - Number(b.days || 99) || a.title.localeCompare(b.title, "ja"))
    .map((item) => {
      const place = [item.region === "ツーリング" ? item.scope : item.region, item.prefecture].filter(Boolean).join(" / ");
      const meta = item.days ? `${item.days}日` : item.scope || "日数未設定";
      const detail = [meta, item.season || item.cost].filter(Boolean).join(" · ");
      const tagHtml = item.tags.map((tag) => `<span>#${esc(tag)}</span>`).join("");
      return `<li class="travel-card" data-kind="${esc(item.kind)}" data-region="${esc(item.region)}" data-prefecture="${esc(item.prefecture)}" data-days="${esc(item.days)}" data-status="${item.complete ? "complete" : "draft"}" data-tags="${esc(item.tags.join(" "))}" data-search="${esc(item.search)}"><a href="${item.href}"><div class="card-top"><span class="kind-pill">${item.kind === "バイク" ? "🏍 " : item.kind === "格安" ? "¥ " : "● "}${esc(item.kind)}</span>${item.complete ? "" : '<span class="draft-pill">下書き</span>'}</div><h3 class="card-title">${esc(item.title)}</h3><p class="card-place">${esc(place || "地域未設定")}</p><p class="card-theme">${esc(item.theme || (item.complete ? "行程とメモをチェック" : "内容はこれから追加予定"))}</p><div class="card-tags">${tagHtml}</div><div class="card-meta"><span><b>${esc(detail)}</b></span><span class="card-updated">更新 ${esc(item.updated)}</span></div></a></li>`;
    }).join("");
  const themeUi = `<div class="theme-picker"><span>表示</span><div class="theme-options" role="group" aria-label="配色"><button type="button" data-theme-choice="light">ライト</button><button type="button" data-theme-choice="dark">ダーク</button><button type="button" data-theme-choice="auto">自動</button></div></div>`;
  const themeScript = `<script>(()=>{const root=document.documentElement;const buttons=[...document.querySelectorAll("[data-theme-choice]")];const current=()=>["light","dark","auto"].includes(root.dataset.theme)?root.dataset.theme:"auto";const paint=()=>{const value=current();for(const button of buttons)button.setAttribute("aria-pressed",String(button.dataset.themeChoice===value))};for(const button of buttons)button.addEventListener("click",()=>{const value=button.dataset.themeChoice;root.dataset.theme=value;try{localStorage.setItem("md2html-theme",value)}catch{}paint()});paint()})()</script>`;
  const appScript = `<script>(()=>{const PAGE=18;let limit=PAGE;let activeTag="";const q=document.querySelector("[data-travel-query]");const kind=document.querySelector("[data-travel-kind]");const region=document.querySelector("[data-travel-region]");const prefecture=document.querySelector("[data-travel-prefecture]");const days=document.querySelector("[data-travel-days]");const status=document.querySelector("[data-travel-status]");const rows=[...document.querySelectorAll(".travel-card")];const count=document.querySelector("[data-travel-count]");const more=document.querySelector("[data-load-more]");const empty=document.querySelector("[data-empty]");const clear=document.querySelector("[data-search-clear]");const kindCards=[...document.querySelectorAll("[data-kind-card]")];const tagChips=[...document.querySelectorAll("[data-tag]")];const normalize=(value)=>value.trim().toLocaleLowerCase("ja");const refreshOptions=()=>{for(const option of region.options){if(!option.value)continue;option.hidden=!rows.some((row)=>(!kind.value||row.dataset.kind===kind.value)&&row.dataset.region===option.value)}if(region.selectedOptions[0]?.hidden)region.value="";for(const option of prefecture.options){if(!option.value)continue;option.hidden=!rows.some((row)=>(!kind.value||row.dataset.kind===kind.value)&&(!region.value||row.dataset.region===region.value)&&row.dataset.prefecture===option.value)}if(prefecture.selectedOptions[0]?.hidden)prefecture.value=""};const filter=()=>{const words=normalize(q.value).split(/\\s+/).filter(Boolean);const matched=rows.filter((row)=>words.every((word)=>row.dataset.search.includes(word))&&(!kind.value||row.dataset.kind===kind.value)&&(!region.value||row.dataset.region===region.value)&&(!prefecture.value||row.dataset.prefecture===prefecture.value)&&(!days.value||row.dataset.days===days.value)&&(!status.value||row.dataset.status===status.value)&&(!activeTag||row.dataset.tags.split(" ").includes(activeTag)));for(const row of rows)row.hidden=true;matched.slice(0,limit).forEach((row)=>row.hidden=false);count.textContent=matched.length+"件のプラン";more.hidden=matched.length<=limit;empty.hidden=matched.length>0;clear.hidden=!q.value;for(const card of kindCards)card.setAttribute("aria-pressed",String(card.dataset.kindCard===kind.value));for(const chip of tagChips)chip.setAttribute("aria-pressed",String(chip.dataset.tag===activeTag))};const reset=()=>{q.value="";kind.value="";region.value="";prefecture.value="";days.value="";status.value="";activeTag="";limit=PAGE;refreshOptions();filter()};for(const control of[q,kind,region,prefecture,days,status])control.addEventListener("input",()=>{limit=PAGE;if(control===kind||control===region)refreshOptions();filter()});for(const card of kindCards)card.addEventListener("click",()=>{kind.value=kind.value===card.dataset.kindCard?"":card.dataset.kindCard;limit=PAGE;refreshOptions();filter();document.querySelector(".filter-panel").scrollIntoView({behavior:"smooth",block:"start"})});for(const chip of tagChips)chip.addEventListener("click",()=>{activeTag=activeTag===chip.dataset.tag?"":chip.dataset.tag;limit=PAGE;filter()});more.addEventListener("click",()=>{limit+=PAGE;filter()});clear.addEventListener("click",()=>{q.value="";q.focus();limit=PAGE;filter()});document.querySelector("[data-reset]").addEventListener("click",reset);refreshOptions();filter()})()</script>`;
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="行き先、日数、テーマから探せる個人用の旅行プラン集"><title>旅のプラン帳</title><script>(()=>{try{const t=localStorage.getItem("md2html-theme");if(t)document.documentElement.dataset.theme=t}catch{}})()</script><style>${CSS}</style></head>
<body class="home-body"><nav class="bar home-bar" aria-label="サイト設定"><a class="home-brand" href="index.html">旅のプラン帳</a>${themeUi}</nav><main class="wrap home-wrap">
<header class="hero"><div><p class="hero-eyebrow">MY TRAVEL LIBRARY</p><h1>次、どこ行く？</h1><p class="hero-copy">行き先が決まっていても、まだぼんやりでも大丈夫。地域・日数・やりたいことから、使えそうなプランをさっと探せます。</p></div><dl class="hero-stats"><div><dt>国内</dt><dd>${counts["国内"]}</dd></div><div><dt>格安</dt><dd>${counts["格安"]}</dd></div><div><dt>バイク</dt><dd>${counts["バイク"]}</dd></div></dl></header>
<section class="travel-index" aria-label="旅行プランを探す"><div class="search-box"><label><span class="sr-only">キーワード検索</span><input type="search" data-travel-query placeholder="行き先・温泉・絶景・グルメ…" autocomplete="off"></label><button type="button" class="search-clear" data-search-clear hidden>クリア</button></div>
<div class="quick-kinds" aria-label="プラン種別"><button type="button" class="kind-card" data-kind-card="国内" aria-pressed="false"><span class="kind-icon">🚃</span><span><strong>国内旅行</strong><small>${counts["国内"]}プラン・全国から探す</small></span></button><button type="button" class="kind-card" data-kind-card="格安" aria-pressed="false"><span class="kind-icon">¥</span><span><strong>豊橋発・格安</strong><small>${counts["格安"]}プラン・予算優先</small></span></button><button type="button" class="kind-card" data-kind-card="バイク" aria-pressed="false"><span class="kind-icon">🏍</span><span><strong>ツーリング</strong><small>${counts["バイク"]}プラン・豊橋発</small></span></button></div>
<div class="filter-panel"><div class="travel-filters"><label>プラン種別<select data-travel-kind><option value="">すべて</option>${options(["国内","格安","バイク"])}</select></label><label>地域<select data-travel-region><option value="">すべて</option>${options(unique("region"))}</select></label><label>都道府県<select data-travel-prefecture><option value="">すべて</option>${options(unique("prefecture"))}</select></label><label>日数<select data-travel-days><option value="">すべて</option>${options(unique("days",(a,b)=>Number(a)-Number(b)),"日")}</select></label><label>状態<select data-travel-status><option value="" selected>すべて</option><option value="complete">中身あり</option><option value="draft">下書き</option></select></label></div><div class="tag-filter" aria-label="テーマタグ">${popularTags.map(([tag,count])=>`<button type="button" class="tag-chip" data-tag="${esc(tag)}" aria-pressed="false">#${esc(tag)} <small>${count}</small></button>`).join("")}</div></div>
<div class="results-head"><div><h2>見つかったプラン</h2><p class="travel-count" data-travel-count aria-live="polite"></p></div><button type="button" class="filter-reset" data-reset>条件をリセット</button></div><ul class="travel-results">${cards}<li class="empty-state" data-empty hidden>条件に合うプランがありません。<br>キーワードを短くするか、条件をリセットしてみてください。</li></ul><button type="button" class="load-more" data-load-more>さらに表示</button></section></main>${themeScript}${appScript}</body></html>`;
}

/* ---------- 実行 ---------- */

const args = process.argv.slice(2);
const inspectAiPrompt = args.indexOf("--inspect-ai-prompt");
if (inspectAiPrompt >= 0) {
  const sourceArg = args[inspectAiPrompt + 1];
  if (!sourceArg || !fs.existsSync(sourceArg) || !sourceArg.toLowerCase().endsWith(".md")) {
    console.error("使い方: node scripts/md2html.mjs --inspect-ai-prompt <plan.md>");
    process.exit(1);
  }
  const md = fs.readFileSync(sourceArg, "utf-8");
  const title = (md.match(/^#\s+(.+)$/m)?.[1] || path.basename(sourceArg, path.extname(sourceArg))).trim();
  const plan = extractPlanData(md, title);
  const prompt = buildTripPrompt(plan, AI_CONSULT_TOPICS[0].id);
  console.log(prompt);
  console.log("\nURL長（全相談テーマの最大）:");
  for (const target of AI_TARGETS) {
    const results = AI_CONSULT_TOPICS.map((topic) => {
      const topicPrompt = buildTripPrompt(plan, topic.id);
      const fitted = fitAiPrompt(target.id, topicPrompt);
      return { label: topic.label, length: buildAiUrl(target.id, fitted).length, truncated: fitted !== topicPrompt };
    });
    const longest = results.sort((a, b) => b.length - a.length)[0];
    console.log(`${target.label}: ${longest.length}文字（${longest.label}${longest.truncated ? "・プロンプト省略あり" : ""}）`);
  }
  process.exit(0);
}
const clean = args.includes("--clean");
const recursive = args.includes("--recursive") || args.includes("-r");
const target = path.resolve(args.find((a) => !a.startsWith("-")) || config.defaultTarget || "plans");
const searchIndex = args.includes("--search-index") || (config.travel?.enabled && recursive && target === process.cwd());
const label = path.basename(target);

// 変換対象外（AI/システム向け、生成物、依存物）
const SKIP_DIRS = new Set([
  ".git", ".github", ".claude", ".codex", ".cursor", ".agents", ".wrangler",
  "node_modules", "vendor", "dist", "build", "target", "docs-html",
  ".venv", "venv", "__pycache__", "coverage", "test-results", "playwright-report",
  "ai-docs", "sops", "scripts", "plans",  // AI向け・ツール・別途変換済み
  ...(config.skipDirectories || []),
]);
const SKIP_FILES = /^(AGENTS|CLAUDE( \d+)?|GEMINI|QWEN|copilot-instructions)\.md$|\.sop\.md$/i;

if (!fs.existsSync(target)) {
  console.log(`md2html: ${path.relative(process.cwd(), target) || label}/ が無いのでスキップ`);
  process.exit(0);
}

/** 対象ディレクトリを列挙する（再帰モードなら子孫も） */
function dirsOf(root) {
  const list = [root];
  if (!recursive) return list;
  for (let i = 0; i < list.length; i++) {
    for (const e of fs.readdirSync(list[i], { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(e.name)) {
        list.push(path.join(list[i], e.name));
      }
    }
  }
  return list;
}

const dirs = dirsOf(target);
const searchEntries = [];

if (clean) {
  let n = 0;
  for (const d of dirs) {
    for (const f of fs.readdirSync(d)) {
      if (f.toLowerCase().endsWith(".html") && fs.existsSync(path.join(d, f.replace(/\.html$/i, ".md")))) {
        fs.unlinkSync(path.join(d, f)); n++;
      } else if (f === "index.html" && !fs.existsSync(path.join(d, "index.md"))) {
        fs.unlinkSync(path.join(d, f)); n++;
      }
    }
  }
  console.log(`md2html: ${label}/ の HTML を ${n} 件削除`);
  process.exit(0);
}

let converted = 0;
for (const dir of dirs) {
  const rel = path.relative(target, dir);
  const back = rel ? path.relative(dir, path.join(dir, "..")) + "/index.html" : null;
  const entries = [];

  // サブフォルダ
  if (recursive) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "ja"))) {
      if (e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(e.name)) {
        const n = fs.readdirSync(path.join(dir, e.name)).filter((f) => f.toLowerCase().endsWith(".md")).length;
        entries.push({ href: `${encodeURIComponent(e.name)}/index.html`, title: e.name, meta: `フォルダ${n ? ` · ${n} 件` : ""}` });
      }
    }
  }

  // Markdown
  const mds = fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") && !SKIP_FILES.test(f))
    .sort((a, b) => {
      const modified = fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs;
      return modified || a.localeCompare(b, "ja");
    });

  for (const f of mds) {
    const src = path.join(dir, f);
    const md = fs.readFileSync(src, "utf-8");
    const h1 = md.match(/^#\s+(.+)$/m);
    const title = (h1 ? h1[1] : path.basename(f, path.extname(f))).trim();
    const plan = isTravelPlan(src) ? extractPlanData(md, title) : null;
    fs.writeFileSync(path.join(dir, f.replace(/\.md$/i, ".html")), page(title, md, "index.html", plan), "utf-8");
    converted++;
    entries.push({
      href: encodeURIComponent(f.replace(/\.md$/i, ".html")),
      title,
      meta: `${f} · ${new Intl.NumberFormat("ja-JP").format(md.length)} 文字 · 更新 ${fs.statSync(src).mtime.toISOString().slice(0, 10)}`,
    });
    if (searchIndex && isTravelPlan(src)) {
      const sourceRel = path.relative(target, src);
      const href = sourceRel.split(path.sep).map(encodeURIComponent).join("/").replace(/\.md$/i, ".html");
      searchEntries.push(extractSearchData(md, title, path.relative(process.cwd(), src), href));
    }
  }

  if (!entries.length) continue;

  const name = rel || label;
  const indexMd = `# ${name}\n\n文書は更新が新しい順です。編集は \`.md\`、閲覧は \`.html\` を使います。\n`;
  const indexHtml = page(name, indexMd, back).replace(
    "</main>",
    `<ul class="entries">${entries
      .map((e) => `<li><a href="${e.href}"><span class="n">${esc(e.title)}</span><span class="m">${esc(e.meta)}</span></a></li>`)
      .join("")}</ul>\n</main>`
  );
  fs.writeFileSync(path.join(dir, "index.html"), indexHtml, "utf-8");
}

if (searchIndex && searchEntries.length) {
  fs.writeFileSync(path.join(target, "index.html"), travelHomePage(searchEntries), "utf-8");
}

console.log(`md2html: ${label}/ → ${converted} 件変換 + index.html`);
