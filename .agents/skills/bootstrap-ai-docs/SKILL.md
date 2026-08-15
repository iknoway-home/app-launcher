---
name: bootstrap-ai-docs
description: AI 用ドキュメントテンプレートをこのプロジェクト用に初期設定する。テンプレートをコピーした直後、AGENTS.md や ai-docs に「未設定」がたくさん残っているとき、「テンプレートを初期化して」「セットアップして」と頼まれたときに使う。実際のコードを調べて事実を埋め、このプロジェクトに不要なファイルを削除する。1 リポジトリにつき原則 1 回だけ実行する。
---

# テンプレートをこのプロジェクト用に初期化する

## Overview

テンプレートは「どんなプロジェクトでも使える」形で配られているため、コピー直後は
**空欄と、このプロジェクトには関係ないファイル**が混ざっています。

この手順は 1 回だけ実行し、テンプレートを**このリポジトリの実物の説明**に変えます。
これをやらないと「未設定」が残り続け、AI がドキュメントを信用しなくなります。

**最重要: 埋める内容はコードを読んで確かめること。** テンプレートの例文をそれらしく書き換えるだけでは、
もっともらしい嘘のドキュメントができあがります。それは空欄より有害です。

## Steps

### 1. リポジトリの実物を調べる

```bash
ls -a
cat README.md 2>/dev/null | head -60
# 技術スタックと実在するコマンドを確認する
cat package.json 2>/dev/null || cat pyproject.toml 2>/dev/null || cat go.mod 2>/dev/null || cat Cargo.toml 2>/dev/null
ls .github/workflows/ 2>/dev/null
```

**Constraints:**

- MUST 「動かせるコマンド」は実在を確認する。`package.json` の `scripts` にないものを `TESTING.md` に書かない。
- SHOULD 既存の README やコメントに書かれた事実を優先する。ユーザーが既に書いたものを勝手に言い換えない。

### 2. リンクと構成が壊れていないか確認する

```bash
bash scripts/ai-docs-check.sh
```

シンボリックリンク（`CLAUDE.md` / `GEMINI.md` / `QWEN.md` / `.claude/skills`）が壊れている場合は、
README の「リンクを作り直す」手順で復旧する。Windows などリンクを使えない環境での代替も README にある。

### 3. 使わないものを削除する

**空のまま残さないこと。** 中身のないファイルは、AI に「調べたが何もなかった」と誤解させます。

| 条件 | 削除するもの |
|---|---|
| UI がない（CLI、ライブラリ、API のみ） | `DESIGN.md` |
| デプロイ先も運用もまだない | `ai-docs/OPERATIONS.md` |
| 認証も外部連携も秘密情報もない | `ai-docs/SECURITY.md` |
| 環境変数も外部サービスもない | `ai-docs/ENVIRONMENT.md` |
| Issue やプロジェクト管理ツールで優先度を管理している | `ai-docs/ROADMAP.md` |
| GitHub を使わない | `.github/` 一式 |
| Claude Code を使わない | `.claude/` 一式 |
| GitHub Copilot を使わない | `.github/copilot-instructions.md` |
| Gemini CLI / Qwen Code を使わない | `GEMINI.md` / `QWEN.md` |

削除したら `AGENTS.md` の「正はどこにあるか」表からもその行を消す。

**Constraints:**

- MUST 削除したファイルへの参照を残さない。リンク切れは AI を混乱させる。
- MUST 迷ったら消さずに残し、「このプロジェクトには該当しない」と 1 行書く。
- SHOULD `ai-docs/API.md`、`DATA.md`、`PERFORMANCE.md`、`GLOSSARY.md` は**最初は作らない**。必要になってから作る。

### 4. 事実を埋める

優先順位の高い順に埋める。全部を一度に完璧にしなくてよい。

1. **`ai-docs/PROJECT.md`** — 目的、主なユーザー、技術スタック、今の状態。これが一番効く。
2. **`AGENTS.md` の「プロジェクト概要」表** — 3 行だけ。
3. **`ai-docs/TESTING.md`** — 実在する確認コマンドだけ。
4. **`ai-docs/CODEMAP.md`** — **自明でない入口だけ**。`src/` にソースがある、のような当たり前のことは書かない。
   「認証は `lib/auth/session.ts` で、middleware から呼ばれる」のような、探すのに時間がかかる情報を書く。
5. 残りのファイルは、調べて分かった範囲で埋める。

**Constraints:**

- MUST 分からない項目は「未設定」のまま残す。埋めたふりをしない。
- MUST 該当しない項目は「なし」と書く。「未設定」と「なし」を区別する。
- SHOULD 一般論を書かない。どのプロジェクトにも当てはまる文はドキュメントの価値を下げる。

### 5. プロジェクト固有のルールを追記する

調査中に見つけた、このリポジトリ特有の決まりごとを `AGENTS.md` の末尾に足す。
例: 「マイグレーションは追記のみ」「`generated/` は手で編集しない」「本番 DB に直接つながない」。

**Constraints:**

- MUST 一般的なコーディング作法を足さない。AI は既に知っている。**このリポジトリでしか通用しない制約**だけを書く。
- MUST `AGENTS.md` を厚くしすぎない。目安 16 KiB 以内（`wc -c AGENTS.md` で確認）。
- SHOULD 特定ディレクトリだけの規則は、そのディレクトリに `AGENTS.md` を置く。

### 6. 確認する

```bash
bash scripts/ai-docs-check.sh
wc -c AGENTS.md
```

最後に、埋めた内容が実物と合っているか 1 つ 2 つ抜き取りで確かめる（書いたコマンドを実際に実行してみる等）。

### 7. 記録する

`ai-docs/DECISIONS.md` に、初期化で削除したファイルとその理由を 1 行残す。
後から「なぜこのプロジェクトには SECURITY.md がないのか」を追える状態にする。

## Verification

- `bash scripts/ai-docs-check.sh` が警告なしで通る。
- `AGENTS.md` の概要 3 行が埋まっている。
- `ai-docs/TESTING.md` のコマンドが実際に動く。
- 残っている「未設定」が、意図的に残したものだけである。
- このプロジェクトに関係ないファイルが残っていない。

## Rollback / Recovery

- 消しすぎた場合は、テンプレート元リポジトリから該当ファイルを取り直す。
- 埋めた内容が間違っていた場合は、`update-ai-docs` スキルで修正する。

## Related Files

- `AGENTS.md`、`ai-docs/`、`README.md`
- `scripts/ai-docs-check.sh`
- `.agents/skills/update-ai-docs/SKILL.md`
