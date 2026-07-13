import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, ArrowUp, Check, ChevronRight, Clock3, Command, Download, ExternalLink, Folder, FolderOpen,
  GripVertical, LayoutGrid, MonitorUp, MoreHorizontal, PanelRight, Play, Plus, Power, Rocket, Search,
  Settings2, SlidersHorizontal, Sparkles, Star, Timer, Trash2, X, Zap,
  Code2, Globe2, MessageCircle, Music2, Palette, StickyNote, TerminalSquare,
} from "lucide-react";
import { getPresetApps, useLauncherStore } from "./store";
import { launchPath, loadConfig, saveConfig, setStartup } from "./lib/tauri";
import { defaultConfig, type AppItem, type IconName, type Preset } from "./types";

const iconMap: Record<IconName, typeof Code2> = {
  code: Code2, browser: Globe2, terminal: TerminalSquare, music: Music2,
  chat: MessageCircle, design: Palette, notes: StickyNote, folder: Folder,
};

const iconColors: Record<IconName, string> = {
  code: "icon-violet", browser: "icon-blue", terminal: "icon-slate", music: "icon-green",
  chat: "icon-pink", design: "icon-orange", notes: "icon-yellow", folder: "icon-cyan",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function AppIcon({ app, small = false }: { app: AppItem; small?: boolean }) {
  const Icon = iconMap[app.icon] ?? Folder;
  return (
    <div className={`app-icon ${iconColors[app.icon] ?? "icon-blue"} ${small ? "app-icon-small" : ""}`}>
      <Icon size={small ? 16 : 25} strokeWidth={1.8} />
    </div>
  );
}

function App() {
  const { config, hydrated, selectedIds, activeGroup, searchQuery, setConfig, markHydrated, setSearchQuery, setActiveGroup, toggleSelected, selectOnly, clearSelection, addApp, updateApp, removeApp, reorderApps, reorderSelection, savePreset, removePreset, updateSettings } = useLauncherStore();
  const [modal, setModal] = useState<"add" | "preset" | "settings" | null>(null);
  const [toast, setToast] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => {
    let active = true;
    loadConfig().then((loaded) => {
      if (!active) return;
      if (loaded) setConfig(loaded);
      markHydrated();
    });
    return () => { active = false; };
  }, [markHydrated, setConfig]);

  useEffect(() => {
    if (!hydrated) return;
    void saveConfig(config);
  }, [config, hydrated]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape" && selectedIds.length > 0 && !modal) clearSelection();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [clearSelection, modal, selectedIds.length]);

  const groups = useMemo(() => {
    const counts = config.apps.reduce<Record<string, number>>((acc, app) => ({ ...acc, [app.group]: (acc[app.group] ?? 0) + 1 }), {});
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], "ja"));
  }, [config.apps]);

  const visibleApps = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return config.apps.filter((app) => {
      const groupMatch = activeGroup === "すべて" || (activeGroup === "お気に入り" ? app.favorite : app.group === activeGroup);
      const searchMatch = !query || [app.name, app.group, app.path].join(" ").toLocaleLowerCase().includes(query);
      return groupMatch && searchMatch;
    });
  }, [activeGroup, config.apps, searchQuery]);

  const selectedApps = selectedIds.map((id) => config.apps.find((app) => app.id === id)).filter((app): app is AppItem => Boolean(app));
  const favoriteCount = config.apps.filter((app) => app.favorite).length;

  const runApp = async (app: AppItem) => {
    try {
      await launchPath(app.path, app.args, app.runAsAdmin);
      updateApp(app.id, { lastLaunched: new Date().toISOString() });
      notify(`${app.name} を起動しました`);
    } catch {
      notify(`${app.name} を起動できませんでした。パスを確認してください`);
    }
  };

  const runQueue = async (apps: AppItem[], delays?: number[]) => {
    if (!apps.length) return;
    notify(`${apps.length} 個のアプリを順番に起動しています`);
    for (let index = 0; index < apps.length; index += 1) {
      const delay = delays?.[index] ?? (index === 0 ? 0 : 1200);
      if (delay > 0) await wait(delay);
      try {
        await launchPath(apps[index].path, apps[index].args, apps[index].runAsAdmin);
        updateApp(apps[index].id, { lastLaunched: new Date().toISOString() });
      } catch {
        notify(`${apps[index].name} の起動に失敗しました`);
      }
    }
    notify("起動キューが完了しました");
  };

  const runPreset = (preset: Preset) => {
    const items = [...preset.items].sort((a, b) => a.order - b.order);
    void runQueue(getPresetApps(preset, config.apps), items.map((item) => item.delayMs));
  };

  const handleCardClick = (event: React.MouseEvent, app: AppItem) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      toggleSelected(app.id);
    } else {
      void runApp(app);
    }
  };

  const handleStartupToggle = async (enabled: boolean) => {
    updateSettings({ launchOnStartup: enabled });
    await setStartup(enabled);
    notify(enabled ? "Windows起動時の自動起動を有効にしました" : "自動起動を無効にしました");
  };

  const categoryLabel = activeGroup === "すべて" ? "すべてのアプリ" : activeGroup;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Rocket size={18} /></div>
          <div><div className="brand-name">ORBIT</div><div className="brand-subtitle">APP LAUNCHER</div></div>
        </div>
        <div className="topbar-actions">
          <div className="status-pill"><span className="status-dot" /> システム準備完了</div>
          <button className="icon-button" aria-label="設定" onClick={() => setModal("settings")}><Settings2 size={18} /></button>
          <button className="avatar" aria-label="プロフィール">IK</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">ライブラリ</div>
            <SidebarItem icon={<LayoutGrid size={17} />} label="すべて" count={config.apps.length} active={activeGroup === "すべて"} onClick={() => setActiveGroup("すべて")} />
            <SidebarItem icon={<Star size={17} />} label="お気に入り" count={favoriteCount} active={activeGroup === "お気に入り"} onClick={() => setActiveGroup("お気に入り")} />
          </div>
          <div className="sidebar-section group-section">
            <div className="sidebar-label row-between"><span>グループ</span><button className="tiny-add" onClick={() => setModal("add")}><Plus size={14} /></button></div>
            {groups.map(([group, count]) => <SidebarItem key={group} icon={<span className="group-dot" />} label={group} count={count} active={activeGroup === group} onClick={() => setActiveGroup(group)} />)}
            {!groups.length && <div className="sidebar-empty">アプリを追加すると<br />グループが表示されます</div>}
          </div>
          <div className="sidebar-section preset-section">
            <div className="sidebar-label row-between"><span>プリセット</span><span className="preset-count">{config.presets.length}</span></div>
            {config.presets.map((preset) => <button className="preset-link" key={preset.id} onClick={() => runPreset(preset)}><Zap size={14} /><span>{preset.name}</span><ChevronRight size={13} /></button>)}
            {!config.presets.length && <div className="sidebar-empty">選択したアプリを<br />プリセットとして保存できます</div>}
          </div>
          <div className="sidebar-bottom">
            <div className="tip-card"><Sparkles size={15} /><div><strong>ヒント</strong><span>Ctrl + クリックで<br />複数選択できます</span></div></div>
            <button className="sidebar-settings" onClick={() => setModal("settings")}><SlidersHorizontal size={16} /> 環境設定</button>
          </div>
        </aside>

        <main className="main-content">
          <div className="content-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> ワークスペース</div><h1>すばやく、<em>整然と。</em></h1><p>あなたの毎日を始めるアプリを、ここに。</p></div>
            <button className="primary-button" onClick={() => setModal("add")}><Plus size={18} /> アプリを追加</button>
          </div>

          <div className="toolbar">
            <div className="search-box"><Search size={17} /><input ref={searchInputRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="アプリを検索..." aria-label="アプリを検索" /><kbd>⌘ K</kbd></div>
            <div className="view-actions"><span className="result-count">{visibleApps.length} APPS</span><button className="view-button active"><LayoutGrid size={16} /></button><button className="view-button"><MoreHorizontal size={17} /></button></div>
          </div>

          <div className="section-title"><div><h2>{categoryLabel}</h2><span>{visibleApps.length} 個のアプリ</span></div><div className="selection-hint">{selectedIds.length > 0 ? <><span className="selection-dot" /> {selectedIds.length} 個を選択中</> : <><Command size={14} /> Ctrl + クリックで複数選択</>}</div></div>

          <div className="app-grid" onDragOver={(event) => event.preventDefault()}>
            {visibleApps.map((app, index) => <AppCard key={app.id} app={app} selected={selectedIds.includes(app.id)} index={index} onClick={handleCardClick} onFavorite={() => updateApp(app.id, { favorite: !app.favorite })} onDelete={() => removeApp(app.id)} onDragStart={() => setDraggedId(app.id)} onDrop={() => { if (draggedId) reorderApps(draggedId, app.id); setDraggedId(null); }} />)}
            {visibleApps.length === 0 && <EmptyState query={searchQuery} onAdd={() => setModal("add")} />}
            <button className="add-card" onClick={() => setModal("add")}><span><Plus size={23} /></span><strong>アプリを追加</strong><small>exe / lnk / URL</small></button>
          </div>

          <div className="bottom-note"><span><MonitorUp size={14} /> Windowsスタートアップ</span><span className="note-separator" />{config.settings.launchOnStartup ? "自動起動は有効です" : "自動起動は無効です"}<button onClick={() => setModal("settings")}>設定を変更 <ChevronRight size={13} /></button></div>
        </main>

        <AnimatePresence>{selectedApps.length > 0 && <QueuePanel apps={selectedApps} onClear={clearSelection} onRun={() => void runQueue(selectedApps)} onSave={() => setModal("preset")} onReorder={reorderSelection} draggedIndex={draggedQueueIndex} setDraggedIndex={setDraggedQueueIndex} />}</AnimatePresence>
      </div>

      <AnimatePresence>{modal === "add" && <AddModal onClose={() => setModal(null)} onSubmit={(app) => { addApp(app); setModal(null); notify(`${app.name} をライブラリに追加しました`); }} />}</AnimatePresence>
      <AnimatePresence>{modal === "preset" && <PresetModal count={selectedApps.length} onClose={() => setModal(null)} onSubmit={(name, delay) => { savePreset(name, delay); setModal(null); notify(`「${name}」を保存しました`); }} />}</AnimatePresence>
      <AnimatePresence>{modal === "settings" && <SettingsModal settings={config.settings} onClose={() => setModal(null)} onStartupToggle={handleStartupToggle} onUpdate={(patch) => updateSettings(patch)} presets={config.presets} onRunPreset={runPreset} onDeletePreset={removePreset} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}><Check size={16} /> {toast}</motion.div>}</AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void }) {
  return <button className={`sidebar-item ${active ? "active" : ""}`} onClick={onClick}><span className="sidebar-item-icon">{icon}</span><span>{label}</span><small>{count}</small></button>;
}

function AppCard({ app, selected, index, onClick, onFavorite, onDelete, onDragStart, onDrop }: { app: AppItem; selected: boolean; index: number; onClick: (event: React.MouseEvent, app: AppItem) => void; onFavorite: () => void; onDelete: () => void; onDragStart: () => void; onDrop: () => void }) {
  return <motion.article className={`app-card ${selected ? "selected" : ""}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.25) }} draggable onDragStart={onDragStart} onDrop={onDrop} onDragOver={(event) => event.preventDefault()} onClick={(event) => onClick(event, app)}>
    <div className="card-topline"><span className="drag-handle" title="ドラッグして並べ替え"><GripVertical size={15} /></span><button className={`favorite-button ${app.favorite ? "is-favorite" : ""}`} onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label="お気に入り"><Star size={16} fill={app.favorite ? "currentColor" : "none"} /></button></div>
    <AppIcon app={app} />
    <div className="app-card-name">{app.name}</div><div className="app-card-meta"><span>{app.group}</span><span className="launch-mark"><Play size={10} fill="currentColor" /></span></div>
    <button className="card-menu" onClick={(event) => { event.stopPropagation(); onDelete(); }} aria-label="アプリを削除"><Trash2 size={14} /></button>
  </motion.article>;
}

function EmptyState({ query, onAdd }: { query: string; onAdd: () => void }) {
  return <div className="empty-state"><div className="empty-orbit"><Search size={24} /></div><h3>{query ? "見つかりませんでした" : "まだアプリがありません"}</h3><p>{query ? "別のキーワードで検索してみてください。" : "よく使うアプリを登録して、ここから始めましょう。"}</p><button className="secondary-button" onClick={onAdd}><Plus size={16} /> アプリを追加</button></div>;
}

function QueuePanel({ apps, onClear, onRun, onSave, onReorder, draggedIndex, setDraggedIndex }: { apps: AppItem[]; onClear: () => void; onRun: () => void; onSave: () => void; onReorder: (from: number, to: number) => void; draggedIndex: number | null; setDraggedIndex: (index: number | null) => void }) {
  return <motion.aside className="queue-panel" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 22 }}><div className="queue-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> 起動キュー</div><h2>まとめて起動</h2></div><button className="close-queue" onClick={onClear}><X size={17} /></button></div><div className="queue-summary"><span className="queue-number">{apps.length.toString().padStart(2, "0")}</span><span>アプリを選択中<br /><small>順番をドラッグして変更</small></span></div><div className="queue-list">{apps.map((app, index) => <div className={`queue-item ${draggedIndex === index ? "dragging" : ""}`} key={app.id} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedIndex !== null) onReorder(draggedIndex, index); setDraggedIndex(null); }}><span className="queue-order">{(index + 1).toString().padStart(2, "0")}</span><AppIcon app={app} small /><span className="queue-app-name">{app.name}</span><GripVertical className="queue-grip" size={16} /></div>)}</div><div className="delay-note"><Timer size={15} /><span>アプリ間ディレイ <strong>{apps.length > 1 ? "1.2秒" : "なし"}</strong></span><span className="info-dot">i</span></div><div className="queue-actions"><button className="secondary-button" onClick={onSave}><Download size={15} /> 保存</button><button className="primary-button queue-run" onClick={onRun}><Power size={16} /> 一括起動</button></div><button className="clear-selection" onClick={onClear}>選択を解除</button></motion.aside>;
}

function ModalFrame({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.div className={`modal-card ${wide ? "modal-wide" : ""}`} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</div><h2>{title}</h2></div><button className="close-queue" onClick={onClose}><X size={18} /></button></div>{children}</motion.div></motion.div>;
}

function AddModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (app: Omit<AppItem, "id" | "favorite" | "iconPath" | "runAsAdmin"> & Partial<Pick<AppItem, "favorite" | "iconPath" | "runAsAdmin">>) => void }) {
  const [name, setName] = useState(""); const [path, setPath] = useState(""); const [args, setArgs] = useState(""); const [group, setGroup] = useState("仕事"); const [icon, setIcon] = useState<IconName>("code");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim() || !path.trim()) return; onSubmit({ name: name.trim(), path: path.trim(), args: args.trim(), group, icon }); };
  return <ModalFrame title="アプリを追加" eyebrow="ライブラリに登録" onClose={onClose}><form onSubmit={submit} className="modal-form"><label>アプリ名<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例：Visual Studio Code" /></label><label>実行ファイル / URL<input value={path} onChange={(event) => setPath(event.target.value)} placeholder="C:\\Program Files\\...\\app.exe" /><small>exe、lnk、フォルダ、またはURLを指定できます</small></label><label>起動引数 <span className="optional">任意</span><input value={args} onChange={(event) => setArgs(event.target.value)} placeholder="--profile work" /></label><div className="form-row"><label>グループ<select value={group} onChange={(event) => setGroup(event.target.value)}><option>仕事</option><option>開発</option><option>デザイン</option><option>エンタメ</option><option>ユーティリティ</option></select></label><label>アイコン<select value={icon} onChange={(event) => setIcon(event.target.value as IconName)}><option value="code">コード</option><option value="browser">ブラウザ</option><option value="terminal">ターミナル</option><option value="music">音楽</option><option value="chat">チャット</option><option value="design">デザイン</option><option value="notes">ノート</option><option value="folder">フォルダ</option></select></label></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!name.trim() || !path.trim()}><Plus size={16} /> 追加する</button></div></form></ModalFrame>;
}

function PresetModal({ count, onClose, onSubmit }: { count: number; onClose: () => void; onSubmit: (name: string, delay: number) => void }) {
  const [name, setName] = useState(""); const [delay, setDelay] = useState("1200");
  return <ModalFrame title="プリセットを保存" eyebrow="起動キュー" onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSubmit(name.trim(), Math.max(0, Number(delay) || 0)); }}><div className="preset-save-callout"><Zap size={19} /><span><strong>{count} 個のアプリ</strong>を現在の順番で保存します</span></div><label>プリセット名<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例：朝の仕事セット" /></label><label>アプリ間ディレイ（ミリ秒）<input type="number" min="0" step="100" value={delay} onChange={(event) => setDelay(event.target.value)} /><small>2つ目以降のアプリを起動するまでの待ち時間</small></label><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!name.trim()}><Download size={16} /> 保存する</button></div></form></ModalFrame>;
}

function SettingsModal({ settings, onClose, onStartupToggle, onUpdate, presets, onRunPreset, onDeletePreset }: { settings: typeof defaultConfig.settings; onClose: () => void; onStartupToggle: (enabled: boolean) => void; onUpdate: (patch: Partial<typeof defaultConfig.settings>) => void; presets: Preset[]; onRunPreset: (preset: Preset) => void; onDeletePreset: (id: string) => void }) {
  return <ModalFrame title="環境設定" eyebrow="ORBIT SETTINGS" onClose={onClose} wide><div className="settings-layout"><div className="settings-main"><div className="setting-group"><div className="setting-heading"><div className="setting-icon"><Power size={17} /></div><div><strong>Windows起動時</strong><span>Orbitを自動的に起動します</span></div><Toggle checked={settings.launchOnStartup} onChange={onStartupToggle} /></div><div className="setting-heading"><div className="setting-icon"><PanelRight size={17} /></div><div><strong>タスクトレイに常駐</strong><span>閉じてもバックグラウンドで待機</span></div><Toggle checked={settings.startInTray} onChange={(value) => onUpdate({ startInTray: value })} /></div><div className="setting-heading"><div className="setting-icon"><Command size={17} /></div><div><strong>グローバルホットキー</strong><span>どこからでもランチャーを呼び出す</span></div><kbd className="hotkey-value">{settings.globalHotkey}</kbd></div></div><div className="setting-group"><div className="setting-group-title">表示</div><div className="theme-row"><button className="theme-choice selected-theme"><span className="theme-swatch dark-swatch" />ダーク</button><button className="theme-choice" onClick={() => onUpdate({ theme: "light" })}><span className="theme-swatch light-swatch" />ライト</button></div></div></div><div className="settings-presets"><div className="setting-group-title">保存済みプリセット</div>{presets.map((preset) => <div className="settings-preset" key={preset.id}><div><Zap size={14} /><span>{preset.name}</span></div><div><button onClick={() => onRunPreset(preset)} aria-label="実行"><Play size={14} fill="currentColor" /></button><button onClick={() => onDeletePreset(preset.id)} aria-label="削除"><Trash2 size={14} /></button></div></div>)}{!presets.length && <p className="muted-copy">保存されたプリセットはありません。</p>}</div></div><div className="modal-footer settings-footer"><span className="settings-version">ORBIT v0.1.0 · 設定は自動保存されます</span><button className="primary-button" onClick={onClose}>完了</button></div></ModalFrame>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) { return <button className={`toggle ${checked ? "checked" : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked}><span /></button>; }

export default App;
