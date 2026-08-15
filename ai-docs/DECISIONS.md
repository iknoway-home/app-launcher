# DECISIONS.md

このファイルは、重要な意思決定を軽量に残すためのログです。

## 自動更新ルール

以下のような判断をした場合は追記してください。

- 技術スタック、ライブラリ、外部サービスを選んだ。
- アーキテクチャやデータ構造を変えた。
- 既存方針とは違う実装を採用した。
- セキュリティ、運用、コスト、パフォーマンスに影響する判断をした。
- 「今はやらない」と決めた。

軽微な実装判断は記録不要です。

## 書き方

新しい判断を上に追加します。日付は YYYY-MM-DD とし、Status、Context、Decision、Alternatives、Consequences、Related をすべて記載します。

## Decisions

## 2026-08-15: AI 文書を現行実装に合わせて初期化する

- Status: Accepted
- Context: ai-docs 一式が汎用テンプレートのままで、実在しないコマンドやディレクトリ例を含み、Orbit の実装境界を説明していなかった。今回の依頼では既存の `AGENTS.md`、`README.md`、`DESIGN.md` とコード・設定を変更せず、ai-docs の全ファイルを残す制約がある。
- Decision: `package.json`、`src-tauri/tauri.conf.json`、TypeScript、Rust、GitHub Actions、plans の実物から確認できた事実だけで ai-docs を書き直す。該当しない領域は「なし」、リリース頻度・公開先などコードから確定できない運用項目だけ表の TODO セルとして残す。既存の ai-docs ファイルは削除しない。
- Alternatives: スキル既定どおり該当しない文書を削除し、`AGENTS.md` の参照も直す案は、今回の明示的な削除禁止と既存文書の編集禁止に反するため採らなかった。計画文書の構想を現在仕様として転記する案は、未実装機能を実装済みと誤認させるため採らなかった。`DESIGN.md` のテンプレート内容を実装に合わせて直す案も、ユーザー所有文書の編集禁止により採らなかった。
- Consequences: AI は実在する入口、コマンド、OS 境界、未実装機能を ai-docs から把握できる。一方、UI デザインの汎用記述とプロジェクト概要にはコードとの差異が残るため、実装確認では `src/App.tsx` と `src/styles.css` を優先する必要がある。運用項目は決定されるまでマーカーが残る。
- Related: `ai-docs/PROJECT.md`、`ai-docs/ARCHITECTURE.md`、`ai-docs/CODEMAP.md`、`ai-docs/TESTING.md`、`ai-docs/ENVIRONMENT.md`、`ai-docs/OPERATIONS.md`、`ai-docs/ROADMAP.md`、`ai-docs/SECURITY.md`

## 既存文書と実装の差異

- `AGENTS.md` のプロジェクト概要 3 項目は汎用値のままだが、今回の制約により変更していない。現在の概要は `ai-docs/PROJECT.md` を参照する。
- `DESIGN.md` は PC・タブレット・モバイルを対象とする汎用テンプレートだが、Tauri のウィンドウ最小幅は 1000、CSS のレスポンシブ指定は 1160 以下の一段階だけで、実装は Windows デスクトップ向けである。
- `DESIGN.md` に記載された CSS 変数ベースのトークンは `src/styles.css` に実装されておらず、色や余白は具体値で記述されている。
