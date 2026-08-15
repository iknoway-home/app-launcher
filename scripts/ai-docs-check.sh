#!/usr/bin/env bash
# AI 用ドキュメントの構成チェック。
#
# 使い方:
#   bash scripts/ai-docs-check.sh          # 問題があれば表示する（なければ無音）
#   bash scripts/ai-docs-check.sh --check  # 決定的エラーがあれば exit 1（CI 用）
#
# このスクリプトは 2 種類のことを見ます。
#
#   [ERROR] 決定的な不具合。壊れたリンク、規格外の SKILL.md、参照先の消滅など。
#           機械的に判定できるので CI で落として構わない。
#   [HINT]  参考情報。「未設定」の残数や、更新されていない文書の数。
#           正しさの証明ではないため、これだけでは CI を落とさない。
#
# 「30 日経ったから古い」は文書の正しさを測っていません。あくまで棚卸しのきっかけです。
# 出力は SessionStart フックでコンテキストに入るため、短く保つこと。
set -u

DAY_THRESHOLD=30        # 文書が何日更新されていなければ棚卸しを促すか
COMMIT_THRESHOLD=5      # その間に何件のコード変更があれば促すか
AGENTS_WARN_BYTES=16384 # AGENTS.md がこれを超えたら警告（読み込み上限 32 KiB の半分）

MODE="${1:-}"
cd "$(dirname "$0")/.." || exit 0

errors=0
lines=""
append() { if [ -z "$lines" ]; then lines="$1"; else lines="$lines
$1"; fi; }
err() { append "[ERROR] $1"; errors=$((errors + 1)); }
hint() { append "[HINT] $1"; }

# --- 1. 入口ファイルのリンクが生きているか -----------------------------------
for entry in CLAUDE.md GEMINI.md QWEN.md; do
  [ -e "$entry" ] || [ -L "$entry" ] || continue
  if [ ! -e "$entry" ]; then
    err "$entry のリンクが切れています。README の「リンクを作り直す」を実行してください。"
  fi
done

if [ -e .claude ] && [ ! -e .claude/skills ]; then
  err ".claude/skills が存在しないか、リンクが切れています。'ln -sfn ../.agents/skills .claude/skills' で復旧できます。"
fi

# --- 2. SKILL.md が仕様に沿っているか ---------------------------------------
# 仕様上 frontmatter に書いてよいのは name/description/license/compatibility/metadata/allowed-tools のみ。
# name はディレクトリ名と一致必須。description は必須（Codex は空だとエラーにする）。
if [ -d .agents/skills ]; then
  while IFS= read -r skill; do
    dir="$(basename "$(dirname "$skill")")"
    fm="$(awk 'NR==1 && $0!="---"{exit} NR>1 && /^---[[:space:]]*$/{exit} NR>1{print}' "$skill")"
    name="$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p' | head -1 | tr -d '"'"'"' ')"
    desc="$(printf '%s\n' "$fm" | sed -n 's/^description:[[:space:]]*//p' | head -1)"

    [ -n "$name" ] || name="$dir"
    if [ "$name" != "$dir" ]; then
      err "$skill: name '$name' がディレクトリ名 '$dir' と一致しません。"
    fi
    if [ -z "$desc" ]; then
      err "$skill: description がありません（必須。いつ発動するかを書く）。"
    fi
    if ! printf '%s' "$dir" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$'; then
      err "$skill: ディレクトリ名 '$dir' が規格外です（小文字英数字とハイフンのみ、連続ハイフン不可）。"
    fi
    bad="$(printf '%s\n' "$fm" | sed -n 's/^\([a-zA-Z0-9_-]*\):.*/\1/p' \
      | grep -vxE 'name|description|license|compatibility|metadata|allowed-tools' | tr '\n' ' ')"
    if [ -n "$(printf '%s' "$bad" | tr -d ' ')" ]; then
      err "$skill: 規格外の frontmatter キー: ${bad}（他ツールで読めなくなります）"
    fi
  done <<EOF
$(find .agents/skills -name SKILL.md 2>/dev/null)
EOF
fi

# --- 3. 廃止した二重入口が復活していないか -----------------------------------
[ -d .claude/commands ] && hint ".claude/commands/ はスキルに統合されました。.agents/skills/ へ移すと全ツールで使えます。"
[ -d sops ] && hint "sops/ の手順は .agents/skills/ に置くと AI が自動で見つけられます。"

# --- 4. AGENTS.md のサイズ ---------------------------------------------------
if [ -f AGENTS.md ]; then
  size="$(wc -c < AGENTS.md | tr -d ' ')"
  if [ "${size:-0}" -gt "$AGENTS_WARN_BYTES" ]; then
    hint "AGENTS.md が ${size} バイトです。読み込み予算は全 AGENTS.md 合計で 32 KiB、超過分は黙って切り捨てられます。手順はスキルへ切り出してください。"
  fi
fi

# --- 5. 文書内リンクの切れ ---------------------------------------------------
# 「まだ無くてよいもの」は除外する。条件を満たしたときに作る追加文書、
# プロジェクトによって有無が変わる設定ファイル、コマンド例に出てくるファイルなど。
is_optional() {
  case "$1" in
    ai-docs/API.md|ai-docs/DATA.md|ai-docs/PERFORMANCE.md|ai-docs/GLOSSARY.md) return 0 ;;
    .mcp.json|.env.example|.codex/config.toml|.codex/hooks.json) return 0 ;;
    package.json|pyproject.toml|go.mod|Cargo.toml|Makefile) return 0 ;;
    */AGENTS.md) return 0 ;;
  esac
  return 1
}

missing=""
for doc in AGENTS.md DESIGN.md $(find ai-docs .agents/skills -name '*.md' 2>/dev/null); do
  [ -f "$doc" ] || continue
  # DECISIONS.md は過去の記録。当時存在したファイルを指すのは正しいので対象外にする。
  case "$doc" in */DECISIONS.md|DECISIONS.md) continue ;; esac
  for ref in $(grep -oE '`[A-Za-z0-9._/-]+\.(md|sh|json|yml)`' "$doc" 2>/dev/null | tr -d '`' | sort -u); do
    # パスらしきもの（スラッシュを含む）だけ見る。裸のファイル名は文中の言及のことが多い。
    case "$ref" in */*) ;; *) continue ;; esac
    [ -e "$ref" ] && continue
    # ドキュメントからの相対パスとしても解決してみる（docs/README.md の `../DESIGN.md` など）
    [ -e "$(dirname "$doc")/$ref" ] && continue
    is_optional "$ref" && continue
    # 同梱スキルは全プロジェクト共通の雛形で、bootstrap-ai-docs が
    # 「該当しなければ削除してよい」としている文書を参照している。
    # スキル側からの参照に限り、その削除可能な文書は欠落扱いしない。
    case "$doc" in
      .agents/skills/*)
        case "$ref" in
          ai-docs/OPERATIONS.md|ai-docs/SECURITY.md|ai-docs/ENVIRONMENT.md|ai-docs/ROADMAP.md) continue ;;
        esac
        ;;
    esac
    # .gitignore で除外されているものは実行時に作られる成果物。
    # クリーンな checkout に無いのが正常なので、参照を書いてよい。
    git check-ignore -q "$ref" 2>/dev/null && continue
    case "$missing" in *" $ref "*) continue ;; esac
    missing="$missing $ref "
  done
done
if [ -n "$(printf '%s' "$missing" | tr -d ' ')" ]; then
  err "存在しないファイルを参照しています:$(printf '%s' "$missing" | tr -s ' ')"
fi

# --- 6. 「未設定」の残数（ヒント） -------------------------------------------
placeholders="$(grep -rl "未設定" AGENTS.md DESIGN.md ai-docs 2>/dev/null | wc -l | tr -d ' ')"
if [ "${placeholders:-0}" -gt 0 ]; then
  hint "${placeholders} ファイルに「未設定」が残っています。判明した情報があれば埋めてください（該当しない項目は「なし」と書く）。初回なら bootstrap-ai-docs スキルを実行してください。"
fi

# --- 7. 棚卸しのきっかけ（ヒント） -------------------------------------------
# 文書ごとに個別判定する。1 ファイル更新しただけで全体が「新しい」判定になるのを避けるため。
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git rev-parse --verify HEAD >/dev/null 2>&1; then
  now="$(date +%s)"
  stale_docs=0
  for doc in AGENTS.md DESIGN.md $(find ai-docs -name '*.md' 2>/dev/null); do
    [ -f "$doc" ] || continue
    ts="$(git log -1 --format=%ct -- "$doc" 2>/dev/null)"
    [ -n "$ts" ] || continue
    [ $(( (now - ts) / 86400 )) -ge "$DAY_THRESHOLD" ] && stale_docs=$((stale_docs + 1))
  done
  newest="$(git log -1 --format=%ct -- AGENTS.md DESIGN.md ai-docs 2>/dev/null)"
  code_commits=0
  if [ -n "$newest" ]; then
    code_commits="$(git rev-list --count HEAD --since="@${newest}" -- . \
      ':(exclude)AGENTS.md' ':(exclude)CLAUDE.md' ':(exclude)DESIGN.md' \
      ':(exclude)ai-docs' ':(exclude).agents' 2>/dev/null || echo 0)"
  fi
  if [ "$stale_docs" -gt 0 ] && [ "${code_commits:-0}" -ge "$COMMIT_THRESHOLD" ]; then
    hint "${stale_docs} 件の文書が ${DAY_THRESHOLD} 日以上更新されておらず、その間にコード変更が ${code_commits} 件あります。作業の区切りで update-ai-docs スキルを実行してください。"
  fi
fi

[ -n "$lines" ] && printf '%s\n' "$lines"

if [ "$MODE" = "--check" ] && [ "$errors" -gt 0 ]; then
  exit 1
fi
exit 0
