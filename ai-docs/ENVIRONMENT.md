# ENVIRONMENT.md

このファイルは、設定ファイル、外部依存、ローカル起動条件を記録します。

## 自動更新ルール

以下が変わった場合は、このファイルを更新してください。

- 環境変数を追加・削除・変更した。
- `.env.example`、設定ファイル、起動手順を変えた。
- 外部サービス、API、DB、Storage、認証プロバイダを追加・変更した。
- ローカル開発、本番、ステージングの差分が変わった。

秘密値は絶対に書かないでください。

## 環境

| 環境 | 用途 | 入口 | 注意 |
|---|---|---|---|
| ブラウザ開発 | UI と localStorage 代替動作の確認 | `npm run dev` | 実行ファイル起動と Windows Run キーは利用不可 |
| Tauri 開発 | デスクトップ版と Rust コマンドの確認 | `npm run tauri dev` | Node.js、Rust、Tauri の Windows 前提ツールが必要 |
| 配布ビルド | Windows 配布物の生成 | `npm run tauri build` | 配布方式と公開先は未決 |
| staging | なし | なし | デスクトップアプリの検証環境は定義されていない |

## 環境変数

なし。ソースと設定にアプリ固有の環境変数参照はありません。

## 設定ファイル

| ファイル | 用途 | 注意 |
|---|---|---|
| `package.json` | npm scripts と JavaScript 依存関係 | lockfile は package-lock.json |
| `vite.config.ts` | React プラグインと固定ポート 1420 | ポート競合時に別ポートへ退避しない |
| `src-tauri/tauri.conf.json` | 製品名、識別子、ウィンドウ、ビルド、バンドル | frontendDist は dist |
| `src-tauri/capabilities/default.json` | main ウィンドウの Tauri 権限 | core:default のみ |
| `src-tauri/Cargo.toml` | Rust 依存関係と Windows 限定依存 | 最低 Rust バージョンは 1.77.2 |

## 実行時データ

| 環境 | 保存先 | 内容 |
|---|---|---|
| Tauri | OS の設定ディレクトリ配下の app-launcher/config.json | アプリ、プリセット、設定 |
| ブラウザ | localStorage の orbit-launcher-config | 同じ Config JSON |

Windows では dirs の config_dir が通常 AppData の Roaming を指しますが、実際の絶対パスは OS API の返り値で決まります。

## 外部サービス

なし。ネットワーク API、認証プロバイダ、DB、テレメトリは実装されていません。

## よくある問題

| 症状 | 原因 | 対応 |
|---|---|---|
| 開発サーバーが起動しない | 1420 番ポートが使用中 | 使用中のプロセスを確認してから再実行する |
| ブラウザで exe が起動しない | Tauri コマンドがない | Windows で Tauri 開発版を起動する |
| 設定 JSON の形式エラー | 手動編集などで Config 契約と不一致 | ファイルを退避して起動し、必要な項目を UI から再登録する |
| npm の bash コマンドが見つからない | Windows の PATH に bash がない | Git for Windows の bash.exe でスクリプトを実行する |
