#!/usr/bin/env node
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

const CSS = `
:root{color-scheme:light dark;--bg:#fbfaf7;--fg:#24231f;--muted:#64635d;--line:#d8d5cb;--accent:#2d5f78;--code-bg:#f1efe8;--mark:#fff1b8}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1a;--fg:#e9e6dc;--muted:#aaa79e;--line:#41403b;--accent:#8fc1d8;--code-bg:#282825;--mark:#514821}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);
 font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif;
 font-size:17px;line-height:1.9;-webkit-text-size-adjust:100%;overflow-wrap:anywhere}
.wrap{width:min(100% - 2.5rem,74ch);margin:0 auto;padding:2.5rem 0 6rem}
.bar{width:min(100% - 2.5rem,74ch);margin:0 auto;padding:1rem 0 0;font-size:.84rem;color:var(--muted)}
.bar a{color:var(--muted)}
h1,h2,h3,h4,h5,h6{scroll-margin-top:1rem;line-height:1.45;margin:2.4em 0 .75em}
h1,h2{font-family:"Hiragino Mincho ProN","Yu Mincho",YuMincho,serif;font-weight:700}
h1{font-size:clamp(1.75rem,5vw,2.15rem);margin-top:0;padding-bottom:.45em;border-bottom:2px solid var(--fg)}
h2{font-size:1.48rem;padding-bottom:.3em;border-bottom:1px solid var(--line)}
h3{font-size:1.16rem;font-weight:750}
h4,h5,h6{font-size:1rem;font-weight:700;color:var(--muted)}
p,ul,ol,blockquote,table,pre{margin:0 0 1.15em}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:3px}
a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
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
@media (max-width:600px){
 body{font-size:16px;line-height:1.82}.wrap{width:min(100% - 2rem,74ch);padding-top:1.8rem}.bar{width:calc(100% - 2rem)}
 h2{font-size:1.32rem}.entries a{grid-template-columns:1fr;gap:.15rem}.entries .m{text-align:left}
 th,td{padding:.48em .6em}
}
@media print{
 :root{--bg:#fff;--fg:#111;--muted:#444;--line:#bbb;--accent:#111;--code-bg:#f3f3f3}
 body{font-size:11pt;line-height:1.65}.bar,.toc{display:none}.wrap{width:auto;max-width:none;padding:0}
 h1,h2,h3,h4{break-after:avoid}pre,blockquote,.tablewrap,img{break-inside:avoid}.tablewrap{overflow:visible}table{min-width:0}
 a{color:inherit;text-decoration:none}a[href^="http"]::after{content:" (" attr(href) ")";font-size:.8em}
}
`;

/* ---------- Markdown → HTML (最小構成の自前パーサ) ---------- */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slug = (s) =>
  s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").slice(0, 80);

function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => `\uE000${codes.push(`<code>${esc(c)}</code>`) - 1}\uE000`);
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const href = /^(https?:|#|mailto:)/.test(u) ? u : u.replace(/\.md($|#)/, ".html$1");
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

function page(title, md, backHref) {
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
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${backHref ? `<nav class="bar" aria-label="パンくず"><a href="${backHref}">一覧へ戻る</a></nav>` : ""}
<main class="wrap">
${content}
</main>
</body>
</html>`;
}

/* ---------- 実行 ---------- */

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const recursive = args.includes("--recursive") || args.includes("-r");
const target = path.resolve(args.find((a) => !a.startsWith("-")) || "plans");
const label = path.basename(target);

// 変換対象外（AI/システム向け、生成物、依存物）
const SKIP_DIRS = new Set([
  ".git", ".github", ".claude", ".codex", ".cursor", ".agents", ".wrangler",
  "node_modules", "vendor", "dist", "build", "target", "docs-html",
  ".venv", "venv", "__pycache__", "coverage", "test-results", "playwright-report",
  "ai-docs", "sops", "scripts", "plans",  // AI向け・ツール・別途変換済み
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
    fs.writeFileSync(path.join(dir, f.replace(/\.md$/i, ".html")), page(title, md, "index.html"), "utf-8");
    converted++;
    entries.push({
      href: encodeURIComponent(f.replace(/\.md$/i, ".html")),
      title,
      meta: `${f} · ${new Intl.NumberFormat("ja-JP").format(md.length)} 文字 · 更新 ${fs.statSync(src).mtime.toISOString().slice(0, 10)}`,
    });
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

console.log(`md2html: ${label}/ → ${converted} 件変換 + index.html`);
