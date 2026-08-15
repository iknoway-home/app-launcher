---
name: update-ai-docs
description: AI 用ドキュメント（AGENTS.md / DESIGN.md / ai-docs/）を実装の現状に合わせて棚卸し・更新する。ユーザーに「ドキュメントを更新して」「棚卸しして」と頼まれたとき、セッション開始時に [ai-docs] 警告が出たとき、大きな機能追加・構成変更・リリースを終えた直後、または ai-docs に「未設定」が残っているときに使う。
---

# AI 用ドキュメントを棚卸しする

## Overview

`AGENTS.md`、`DESIGN.md`、`ai-docs/` が現在の実装や運用と合っているか確認し、**ずれている部分だけ**更新する手順です。
毎回すべてを書き直す必要はありません。

対象は**このプロジェクトの事実**だけです。AI ツール側の仕様（どのツールがどのファイルを読むか）は
このリポジトリの外側で決まるため、ここでは扱いません。

## Parameters

- **scope** (optional): 棚卸し対象。例: `all`、`ui`、`backend`、`ops`、`security`。
- **since** (optional): 確認する変更範囲。例: 前回更新以降、直近 30 日、特定コミット以降。

## Steps

### 1. 現状を確認する

```bash
bash scripts/ai-docs-check.sh
git status
git log --oneline -n 20
```

**Constraints:**

- MUST ユーザーの未コミット変更を勝手に戻さない。
- SHOULD git がない場合は、ファイル構成と更新日時から判断する。

### 2. 実態とドキュメントのずれを探す

ドキュメントを読んでから**実装を見て確かめる**。ドキュメントだけを読んで整合しているつもりにならないこと。
重点的に確認する箇所:

- ディレクトリ構成と、主要機能の置き場所
- 起動、ビルド、テスト、デプロイのコマンドが実在するか
- 環境変数と外部サービス
- UI 方針、コンポーネント、デザイントークン
- セキュリティ、権限、秘密情報の扱い

### 3. 必要なファイルだけ更新する

| 変更内容 | 更新先 |
|---|---|
| 作業ルール、命名、配置 | `AGENTS.md` |
| UI / UX / デザイン | `DESIGN.md` |
| プロジェクト概要 | `ai-docs/PROJECT.md` |
| 機能の置き場所 | `ai-docs/CODEMAP.md` |
| 設計、境界、依存 | `ai-docs/ARCHITECTURE.md` |
| 意思決定 | `ai-docs/DECISIONS.md` |
| 優先度、今後の方針 | `ai-docs/ROADMAP.md` |
| 環境変数、外部サービス | `ai-docs/ENVIRONMENT.md` |
| テスト、確認コマンド | `ai-docs/TESTING.md` |
| 運用、リリース、復旧 | `ai-docs/OPERATIONS.md` |
| セキュリティ | `ai-docs/SECURITY.md` |
| 再利用する手順 | `.agents/skills/<name>/SKILL.md`（`create-skill` スキル参照） |

**Constraints:**

- MUST 古い情報を残さない。追記でごまかさず、現在の実態に書き換える。
- MUST 実装されていないことを実装済みのように書かない。
- MUST `AGENTS.md` を厚くしない。手順が増えたらスキルへ逃がす。
  AGENTS.md 群の読み込み予算は合計 32 KiB で、**超過分は警告なく切り捨てられます**。
- SHOULD 変更がないファイルは触らない。差分を無駄に増やさない。

### 4. 「未設定」を減らす

判明している情報で「未設定」を埋める。

**Constraints:**

- MUST プロジェクトに該当しない項目は「なし」と書く。「未設定」は未調査・未決定の意味でだけ使う。
- MUST 分からない項目を推測で埋めない。埋めずに残すほうが、嘘を書くよりよい。

### 5. 追加ドキュメントの作成要否を判断する

条件を満たしたものだけ作る。最初から空ファイルを増やさない。

| ファイル | 作成する条件 |
|---|---|
| `ai-docs/API.md` | 公開 API・エンドポイントが増え、`CODEMAP.md` だけでは説明しきれなくなったとき |
| `ai-docs/DATA.md` | DB スキーマや主要データ構造が固まり、複数箇所から参照されるようになったとき |
| `ai-docs/PERFORMANCE.md` | パフォーマンス要件、計測方法、既知のボトルネックを管理し始めたとき |
| `ai-docs/GLOSSARY.md` | プロジェクト固有の用語が増え、命名や会話で誤解が起きるようになったとき |

作成したら `ai-docs/DECISIONS.md` と README のファイル一覧も更新する。

### 6. スキルの追加要否を判断する

同じ作業を次回も繰り返しそうなら `create-skill` スキルに従って追加する。

### 7. 更新後に確認する

リンク切れ、存在しないファイル名、存在しないコマンドがないか確認する。
最後にもう一度 `bash scripts/ai-docs-check.sh` を実行する。

```bash
wc -c AGENTS.md   # 16 KiB を超えていたらスキルへの切り出しを検討する
```

## Verification

- 実装と文書の明らかな不一致がない。
- 主要機能の入口が `ai-docs/CODEMAP.md` から辿れる。
- 重要な設計判断が `ai-docs/DECISIONS.md` に残っている。
- 「未設定」が減っている、または残った理由が説明できる。
- 変更していない文書に不要な差分がない。

## Rollback / Recovery

- 誤って古い情報を書いた場合は、実装の現在地を読み直して修正する。
- 不要な文書を追加した場合は、内容を適切な既存文書へ統合して削除する。

## Related Files

- `AGENTS.md` / `DESIGN.md` / `ai-docs/`
- `scripts/ai-docs-check.sh`
- `.agents/skills/create-skill/SKILL.md`
