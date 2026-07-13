# Orbit — App Launcher

Windows向けの軽量なアプリランチャー。Tauri v2 + React + TypeScript で構築しています。

## 起動

```bash
npm install
npm run dev
```

Tauriデスクトップ版を起動する場合：

```bash
npm run tauri dev
```

## 主な操作

- アプリカードをクリック：アプリを起動
- `Ctrl` / `⌘` + クリック：複数選択して起動キューを作成
- キュー内の項目をドラッグ：起動順を変更
- `Ctrl` / `⌘` + `K`：検索欄にフォーカス
- 設定画面：Windows起動時の自動起動、トレイ常駐、プリセット管理

初回のブラウザプレビューには操作確認用のサンプルアプリが表示されます。デスクトップ版では「アプリを追加」から実行ファイルやURLを登録してください。
