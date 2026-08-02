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
:root{--bg:#fbfbfa;--fg:#26251f;--muted:#6b6a63;--line:#e3e1d9;--accent:#3a6ea5;--code-bg:#f2f1ec;--mark:#fff6cc}
@media (prefers-color-scheme:dark){:root{--bg:#1b1c1e;--fg:#e6e4dd;--muted:#9b9a92;--line:#33353a;--accent:#7fb2e5;--code-bg:#26282c;--mark:#4a4326}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
 font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif;
 font-size:16px;line-height:1.85;-webkit-text-size-adjust:100%}
.wrap{max-width:860px;margin:0 auto;padding:2.5rem 1.25rem 6rem}
.bar{max-width:860px;margin:0 auto;padding:1rem 1.25rem 0;font-size:.85rem;color:var(--muted)}
.bar a{color:var(--muted)}
h1,h2,h3,h4{line-height:1.4;font-weight:700;margin:2.2em 0 .8em}
h1{font-size:1.9rem;margin-top:0;padding-bottom:.4em;border-bottom:2px solid var(--line)}
h2{font-size:1.4rem;padding-bottom:.3em;border-bottom:1px solid var(--line)}
h3{font-size:1.15rem}
h4{font-size:1rem;color:var(--muted)}
p,ul,ol,blockquote,table,pre{margin:0 0 1.1em}
a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
ul,ol{padding-left:1.6em}
li{margin:.3em 0}
li>input[type=checkbox]{margin-right:.45em}
blockquote{border-left:3px solid var(--line);padding:.2em 0 .2em 1em;color:var(--muted)}
hr{border:0;border-top:1px solid var(--line);margin:2.5em 0}
code{background:var(--code-bg);padding:.15em .4em;border-radius:4px;font-size:.88em;
 font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:8px;padding:1em;overflow-x:auto}
pre code{background:none;padding:0;font-size:.85em;line-height:1.6}
.tablewrap{overflow-x:auto;margin:0 0 1.1em}
table{border-collapse:collapse;width:100%;font-size:.92em}
th,td{border:1px solid var(--line);padding:.5em .7em;text-align:left;vertical-align:top}
th{background:var(--code-bg);font-weight:600;white-space:nowrap}
img{max-width:100%;height:auto}
.toc{background:var(--code-bg);border:1px solid var(--line);border-radius:8px;padding:.6em 1em;margin:0 0 2.5em}
.toc summary{cursor:pointer;font-weight:600}
.toc ul{margin:.7em 0 .3em;padding-left:1.2em}
.toc li{margin:.15em 0;font-size:.92em}
.cards{list-style:none;padding:0;display:grid;gap:.75rem}
.cards a{display:block;border:1px solid var(--line);border-radius:10px;padding:.9em 1.1em;
 text-decoration:none;color:var(--fg);background:var(--code-bg)}
.cards a:hover{border-color:var(--accent)}
.cards .n{font-weight:600}
.cards .m{display:block;font-size:.82em;color:var(--muted);margin-top:.25em}
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
      const id = slug(text) || `h${out.length}`;
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
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(
        `<div class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
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
      ? `<details class="toc"><summary>目次</summary><ul>${toc
          .map((t) => `<li style="margin-left:${(t.lv - 2) * 1.1}em"><a href="#${t.id}">${t.text}</a></li>`)
          .join("")}</ul></details>`
      : "";
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${backHref ? `<nav class="bar"><a href="${backHref}">← 一覧へ</a></nav>` : ""}
<main class="wrap">
${tocHtml}
${body}
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
        entries.push({ href: `${encodeURIComponent(e.name)}/index.html`, title: `📁 ${e.name}`, meta: `フォルダ${n ? ` · ${n} 件` : ""}` });
      }
    }
  }

  // Markdown
  const mds = fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") && !SKIP_FILES.test(f))
    .sort((a, b) => a.localeCompare(b, "ja"));

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
  const indexMd = `# ${name}\n\n編集は \`.md\`、読むのは \`.html\` を使ってください。\n`;
  const indexHtml = page(name, indexMd, back).replace(
    "</main>",
    `<ul class="cards">${entries
      .map((e) => `<li><a href="${e.href}"><span class="n">${esc(e.title)}</span><span class="m">${esc(e.meta)}</span></a></li>`)
      .join("")}</ul>\n</main>`
  );
  fs.writeFileSync(path.join(dir, "index.html"), indexHtml, "utf-8");
}

console.log(`md2html: ${label}/ → ${converted} 件変換 + index.html`);
