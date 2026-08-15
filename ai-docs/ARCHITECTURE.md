# ARCHITECTURE.md

このファイルは、システムの構造、責務分担、境界を記録します。

## 自動更新ルール

以下が変わった場合は、このファイルを更新してください。

- アプリ構成、データフロー、状態管理方針を変えた。
- フロントエンド、バックエンド、DB、外部サービスの責務を変えた。
- 重要な依存関係や境界を追加・削除した。
- 設計判断を変更した。

重要な判断をした場合は `ai-docs/DECISIONS.md` にも記録してください。

## 概要

```text
利用者
  -> React UI
  -> Zustand のメモリ状態
  -> Tauri API ラッパー
  -> Rust コマンド
  -> 設定 JSON / Windows プロセス / Windows Run キー
```

ブラウザプレビューでは Tauri コマンドが失敗したとき、設定の読み書きだけ localStorage へ切り替わります。URL はブラウザの新規ウィンドウで開きますが、ローカル実行ファイルの起動はできません。

## レイヤーと責務

| レイヤー | 責務 | 置き場所 |
|---|---|---|
| UI・画面ロジック | 表示、モーダル、検索、ショートカット、起動順制御 | `src/App.tsx` |
| クライアント状態 | 設定、選択、絞り込み、アプリとプリセットの更新 | `src/store.ts` |
| 型・初期値 | 設定データ型、ブラウザプレビュー用デモデータ | `src/types.ts` |
| Tauri 境界 | invoke 呼び出し、ブラウザ代替永続化、ウィンドウ終了 | `src/lib/tauri.ts` |
| OS・ファイル境界 | JSON 読み書き、プロセス起動、Windows Run キー | `src-tauri/src/main.rs` |

## データフロー

| 流れ | 説明 | 入口 |
|---|---|---|
| 初期読み込み | Rust が設定 JSON を返す。ファイルがなければ空のアプリ一覧を返し、ブラウザでは localStorage またはデモ初期値を使う | `src/lib/tauri.ts` の loadConfig、`src/App.tsx` の初期 effect |
| 更新・保存 | Zustand の設定変更後、React の effect が設定全体を保存する | `src/App.tsx` の保存 effect、`src/lib/tauri.ts` の saveConfig |
| 単体起動 | URL はブラウザで開き、それ以外は Rust が子プロセスとして起動する | `src/App.tsx` の runApp、`src-tauri/src/main.rs` の launch_app |
| キュー・プリセット起動 | UI が順番と待機時間を解釈し、各項目を逐次起動する | `src/App.tsx` の runQueue と runPreset |
| 自動起動設定 | UI の切替を保存し、Rust がユーザー単位の Run キーを更新する | `src/App.tsx` の handleStartupToggle、`src-tauri/src/main.rs` の set_startup |

## 状態管理

| 種類 | 管理場所 | 永続化 | 注意 |
|---|---|---|---|
| アプリ・プリセット・設定 | Zustand の config | 設定 JSON と localStorage | hydration 完了後の変更ごとに設定全体を保存する |
| 選択順・検索・グループ | Zustand | なし | 選択配列の順番が起動キュー順になる |
| モーダル・通知・ドラッグ・キーボード位置 | React ローカル state | なし | 画面を閉じると失われる |
| 最近の起動時刻 | AppItem の lastLaunched | 設定 JSON と localStorage | 起動に成功した直後に ISO 文字列で更新する |

## 境界ルール

- 設定データは TypeScript と Rust に同じ camelCase JSON 契約を重複定義している。項目追加時は両方を同時に更新する。
- OS 操作は Tauri コマンドへ集約し、React から Rust 実装を直接扱わない。
- プリセットの待機時間は UI が実行する。Rust は一件の起動だけを担当する。
- ブラウザ代替動作は設定永続化と URL 起動に限られる。

## 依存関係

| 依存 | 用途 | 注意 |
|---|---|---|
| Zustand | 単一ストアで設定と UI の選択状態を管理 | 永続化 middleware は使わず、React effect から保存する |
| Tauri API | Rust コマンドとウィンドウ操作 | ブラウザ実行時は呼び出し失敗をラッパーで処理する |
| Framer Motion | カード、モーダル、通知のアニメーション | UI ロジックとは分離されていない |
| winreg | Windows Run キーの登録 | Windows ターゲットでのみ依存する |
| dirs | OS のユーザー設定ディレクトリ解決 | 配下に app-launcher/config.json を作る |

## 既知の制約

- UI と画面ロジックの大半が `src/App.tsx` にまとまっている。
- Tauri の CSP は `src-tauri/tauri.conf.json` で null になっている。
- 引数は Rust 側で空白分割されるため、引用符を含む複雑な引数をシェル互換には解釈しない。
- Windows 以外の set_startup は成功扱いで何もしない。
