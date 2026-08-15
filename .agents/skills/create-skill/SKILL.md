---
name: create-skill
description: 再利用する作業手順をスキル（.agents/skills/<name>/SKILL.md）として作成・更新する。同じ作業を次回も繰り返しそうなとき、手順を間違えると影響が大きい作業をやったとき、AI が手順を無視して事故が起きたとき、または「手順書にして」「スキルにして」と頼まれたときに使う。ツール固有の rules / subagent / MCP を作るべきかの判断にも使う。
---

# スキルを作成・更新する

## Overview

このリポジトリでは、**再利用する作業手順はすべてスキル**（`.agents/skills/<name>/SKILL.md`）として持ちます。
1 ファイル書けば Claude Code・Codex・Cursor・GitHub Copilot・Gemini CLI が読めて、
**タスクが合致したときに AI が自動で発動できる**からです。

「AI が手順書を読まずに作業してしまう」という一番よくある事故は、手順をスキルにすることで構造的に防げます。

## まず「作るべきか」を判断する

| 状況 | 置き場所 |
|---|---|
| 再利用する作業手順 | **スキル**（`.agents/skills/`）。まずこれを選ぶ |
| 全作業に常時効かせたい短いルール | `AGENTS.md`。ただし厚くしすぎない |
| 特定パスを触るときだけ効かせたいルール | Claude Code は `.claude/rules/*.md` に `paths:` frontmatter、Cursor は `.cursor/rules/*.mdc` に `globs:` |
| 独立コンテキストで動かす定型の役割 | Claude Code は `.claude/agents/*.md`、Codex は `.codex/agents/*.toml` |
| チーム共有の外部ツール連携 | `.mcp.json`（Claude Code） |

**作らなくてよい例:**

- 1 回限りの軽微な作業。
- `AGENTS.md` や既存スキルに書けば十分な内容。
- まだ運用が固まっていない実験的な手順。
- プロジェクト固有の**事実**（それは `ai-docs/` に書く。スキルは**手順**を書く場所）。

**Constraints:**

- MUST 既存スキルと重複する場合は、新規作成ではなく既存を更新する。
- MUST 同じ内容をツール別ファイルに長文で重複させない。実体は 1 つに保つ。

## 作り方

### 1. ディレクトリを作る

```bash
mkdir -p .agents/skills/<skill-name>
```

**Constraints:**

- MUST ディレクトリ名は `kebab-case`。1〜64 文字、小文字英数字とハイフンのみ。先頭末尾のハイフンと `--` は不可。
- MUST `SKILL.md` の `name` は**ディレクトリ名と完全に一致**させる。

### 2. frontmatter を書く

```yaml
---
name: release-or-deploy
description: 本番または検証環境へリリース・デプロイする。「デプロイして」「リリースして」と頼まれたとき、タグを打つとき、または本番反映の前後に使う。
---
```

**書いてよいフィールドは 6 つだけ**: `name`、`description`、`license`、`compatibility`、`metadata`、`allowed-tools`。
これ以外を書くとツールによってはエラーになります（Claude Code は
`Unexpected key(s) in SKILL.md frontmatter` を返す）。
実際に多くのツールが見ているのは `name` と `description` の 2 つなので、まずそこを正確に書いてください。

**Constraints:**

- MUST `description` には「**何をするか**」ではなく「**いつ発動すべきか**」を具体的な言い回しで書く。
  これが自動発動の唯一の判断材料になる。「デプロイを支援します」は役に立たない。
  「『デプロイして』と頼まれたとき、タグを打つとき」のように、**トリガーを列挙する**。
- MUST 複数ツールで使うスキルに、Claude Code 独自フィールド（`model`、`context: fork`、`argument-hint` など）を書かない。
- SHOULD `version` や `author` を書きたい場合は `metadata:` の下に入れる。

### 3. 本文を書く

本文には最低限これを書く。

```text
## Overview        何を、いつ、なぜ実行する手順か
## Parameters      作業ごとに変わる入力値、対象ファイル、環境、URL
## Steps           実行手順。重要な制約は MUST / SHOULD / MAY で明示する
## Verification    成功をどう確認するか
## Rollback / Recovery   失敗時の戻し方
## Related Files   関連するコード、設定、ドキュメント
```

**Constraints:**

- MUST `SKILL.md` 本文は 500 行未満に保つ。長い資料は `references/` に分けて、本文からは相対パスで参照する。
- MUST 手順を書くだけでなく、**間違えやすい点と、それをやると何が起きるか**を書く。禁止事項だけ並べても守られない。
- SHOULD スクリプトは `scripts/`、テンプレートや素材は `assets/` に置く。
- SHOULD プロジェクト固有の事実（URL、環境名、コマンド）は直書きせず `ai-docs/` を参照する。両方に書くと必ず片方が古くなる。

### 4. 動くか確認する

```bash
# 名前が認識されているか（どちらか使えるほうで）
codex exec --skip-git-repo-check "利用可能なスキル名を一覧して"
claude -p "利用可能なスキル名を一覧して"
```

**Constraints:**

- MUST 一覧に出ることを確認する。出ない場合は `name` とディレクトリ名の不一致、または frontmatter の書式エラーを疑う。
- SHOULD `skills-ref validate .agents/skills/<name>` が使える環境なら実行する。

### 5. 見つけられるようにする

作成したスキルが人からも辿れるように、必要なら `README.md` と `ai-docs/CODEMAP.md` を更新する。

## 外部のスキルを使う場合

他リポジトリ・サードパーティのスキルを複数プロジェクトで使うなら、**このリポジトリに同梱しない**。
ユーザーレベル（`~/.agents/skills/`）に 1 回入れれば全プロジェクトで有効になります。

## Verification

- スキル名がツールの一覧に出る。
- `description` を読んだだけで、いつ発動すべきかが分かる。
- 手順に沿って実行すれば、書いた本人でなくても同じ結果になる。
- プロジェクト固有の事実が `ai-docs/` と二重管理になっていない。

## Rollback / Recovery

- 発動しすぎる場合は `description` のトリガーを絞る。逆に発動しない場合はトリガーの言い回しを増やす。
- 不要になったスキルはディレクトリごと削除する。内容に残す価値があれば `ai-docs/` に移す。

## Related Files

- `AGENTS.md`
- `README.md`
- Agent Skills 仕様: <https://agentskills.io/specification>
