# CODEMAP.md

## 原本・生成物・ローカルキャッシュ

- 原本は `src/` と `src-tauri/`。閲覧用計画の原本は `plans/*.md`。
- 生成物は `dist/`（`npm run build`）と `plans/*.html`（`npm run plans:html`）で、手編集しない。
- `node_modules/`、`src-tauri/target/`、`build/`、`test-results/`、`playwright-report/`、`.wrangler/` はローカルキャッシュとして Git 管理しない。

このファイルは、探索に時間がかかる機能の入口だけを記録します。

## 自動更新ルール

以下が変わった場合は、このファイルを更新してください。

- 新しい主要機能を追加した。
- 機能の置き場所、責務、入口ファイルを変えた。
- 重要な共通処理、API、DB、状態管理の場所を変えた。
- 既存の説明が実態とずれた。

軽微な関数追加や内部実装の差し替えだけなら更新不要です。

## 探し方

1. まずこのファイルで機能名を探す。
2. 見つからない場合は rg で画面文言、型名、Tauri コマンド名を検索する。
3. 新しい主要機能だった場合は、このファイルに入口を追加する。

## 機能マップ

| 機能 / 領域 | 入口 | メモ |
|---|---|---|
| 検索判定 | `src/App.tsx` の matchesSearch | NFKC、小文字、カタカナからひらがな、区切り除去、部分列、単語頭文字を組み合わせる |
| キーボード操作 | `src/App.tsx` の handleShortcut | 検索欄だけでなく画面全体で矢印、Enter、数字、Esc を処理する |
| 起動キュー | `src/App.tsx` の runQueue | 待機と逐次起動は Rust ではなく UI が担当する |
| プリセットの並び | `src/store.ts` の getPresetApps | order で配列を直接 sort してからアプリを解決する |
| 設定の自動保存 | `src/App.tsx` の hydration 後の effect | Zustand の変更が設定全体の保存につながる |
| ブラウザプレビュー代替 | `src/lib/tauri.ts` | invoke 失敗時に localStorage を使う。デモデータ自体は `src/types.ts` にある |
| 設定 JSON の場所 | `src-tauri/src/main.rs` の config_file | dirs が返す設定ディレクトリの app-launcher/config.json |
| 管理者起動 | `src-tauri/src/main.rs` の launch_app | Windows では PowerShell の Start-Process と RunAs を利用する |
| 自動起動 | `src-tauri/src/main.rs` の set_startup | ユーザー単位の Windows Run キーに OrbitAppLauncher を登録する |
| Tauri 権限 | `src-tauri/capabilities/default.json` | main ウィンドウには core:default だけを付与する |
| ウィンドウ・ビルド接続 | `src-tauri/tauri.conf.json` | Vite のポート 1420 と dist を Tauri に接続する |

## ディレクトリの役割

| パス | 役割 | 更新時の注意 |
|---|---|---|
| `src/` | React UI、状態、型、Tauri 呼び出し | 設定型変更時は Rust の同名構造体も確認する |
| `src-tauri/` | Rust バックエンドと Tauri 設定 | OS 操作と権限設定の境界 |
| `plans/` | 実装計画と UX 調査記録 | 実装との差異はコードを正とする |
| `scripts/` | Markdown 変換と AI 文書検査 | npm scripts から呼ばれないものもある |
| `ai-docs/` | 現在の実装を説明する AI 向け文書 | テンプレート例ではなくコード上の事実を保つ |

## よく触るファイル

| 目的 | ファイル |
|---|---|
| 画面・操作・検索・起動順を変える | `src/App.tsx` |
| アプリやプリセットの更新規則を変える | `src/store.ts` |
| 永続化データの項目を変える | `src/types.ts`、`src-tauri/src/main.rs` |
| OS 呼び出しやブラウザ代替を変える | `src/lib/tauri.ts`、`src-tauri/src/main.rs` |
| 見た目とレスポンシブ幅を変える | `src/styles.css` |
| Tauri ウィンドウやバンドルを変える | `src-tauri/tauri.conf.json` |
