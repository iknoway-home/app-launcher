# TESTING.md

このファイルは、実在する確認コマンドと手動確認点を記録します。

## 自動更新ルール

以下が変わった場合は、このファイルを更新してください。

- テストコマンド、lint、型チェック、ビルド手順を変えた。
- テスト方針、対象範囲、CI 設定を変えた。
- 重要な手動確認手順を追加・変更した。
- 既知の未テスト領域が増えた、または解消された。

## 確認コマンド

| 目的 | コマンド | 備考 |
|---|---|---|
| 依存関係を固定ファイルどおり導入 | `npm ci` | package-lock.json が必要 |
| ブラウザ開発サーバー | `npm run dev` | localhost の 1420 番ポートを使用 |
| TypeScript と Vite の本番ビルド | `npm run build` | tsc -b の後に Vite が dist を生成 |
| ビルド結果のプレビュー | `npm run preview` | 先にビルドが必要 |
| Tauri 開発版 | `npm run tauri dev` | Rust と Tauri のビルド環境が必要 |
| Tauri 配布物ビルド | `npm run tauri build` | beforeBuildCommand として npm run build も動く |
| 計画文書の HTML 変換 | `npm run plans:html` | `scripts/md2html.mjs` が plans 配下を処理する |
| AI 文書構成検査 | `bash scripts/ai-docs-check.sh` | bash が PATH にない Windows では Git for Windows の bash を直接指定する |

lint、単体テスト専用、型チェック専用の npm script は `package.json` に存在しません。

## 自動テストの現状

- JavaScript、React、Rust の単体・統合テストファイルはない。
- `npm run build` が TypeScript の厳格チェックとフロントエンドビルドを兼ねる。
- Rust 専用の検査コマンドは npm scripts に登録されていない。

## 手動確認

| 機能 | 確認内容 | 環境 |
|---|---|---|
| 初期表示 | 設定がないデスクトップ版では空状態、ブラウザ初回ではデモアプリが表示される | Tauri とブラウザ |
| 検索・キーボード | かな表記、頭文字、入力抜けで絞り込み、矢印・Enter・数字・Esc が動く | ブラウザ可 |
| アプリ管理 | 追加、削除、お気に入り、カード並べ替え、再起動後の復元 | Tauri とブラウザ |
| キュー・プリセット | 複数選択、順序変更、待機付き起動、保存、再実行、削除 | Windows Tauri |
| OS 連携 | 通常起動、引数付き起動、管理者起動、Run キー登録と解除 | Windows Tauri |
| UI | 幅 1280x800 と最小幅 1000x720 付近で欠けや横スクロールがない | Windows Tauri |

## CI

| ワークフロー | 実行タイミング | 内容 |
|---|---|---|
| `ai-docs-check` | main または master への push、PR、手動実行 | `scripts/ai-docs-check.sh` の check モード |
| `ai-docs-check` の remind | 毎月 1 日 21:00 UTC | 検査出力があれば棚卸し Issue を一件だけ作る |

アプリの TypeScript/Rust ビルドやテストを行う CI はありません。

## 既知の未テスト領域

- Windows 実機での exe 起動、管理者昇格、自動起動、ウィンドウ終了、設定ファイル復元。
- URL および file URL の起動差異。
- 壊れた設定 JSON、保存失敗、起動失敗の UI 表示。
- ライトテーマ、タスクトレイ、グローバルホットキーは未実装のため対象外。
