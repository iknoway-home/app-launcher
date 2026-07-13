export type IconName = "code" | "browser" | "terminal" | "music" | "chat" | "design" | "notes" | "folder";

export type AppItem = {
  id: string;
  name: string;
  path: string;
  args: string;
  iconPath: "auto" | string;
  icon: IconName;
  runAsAdmin: boolean;
  group: string;
  favorite: boolean;
  lastLaunched?: string;
};

export type PresetItem = {
  appId: string;
  order: number;
  delayMs: number;
};

export type Preset = {
  id: string;
  name: string;
  items: PresetItem[];
  runOnStartup: boolean;
};

export type Settings = {
  theme: "dark" | "light";
  launchOnStartup: boolean;
  globalHotkey: string;
  startInTray: boolean;
};

export type Config = {
  apps: AppItem[];
  presets: Preset[];
  settings: Settings;
};

export const defaultSettings: Settings = {
  theme: "dark",
  launchOnStartup: false,
  globalHotkey: "Alt+Space",
  startInTray: true,
};

export const demoApps: AppItem[] = [
  { id: "demo-vscode", name: "Visual Studio Code", path: "Code.exe", args: "", iconPath: "auto", icon: "code", runAsAdmin: false, group: "開発", favorite: true },
  { id: "demo-edge", name: "Microsoft Edge", path: "msedge.exe", args: "", iconPath: "auto", icon: "browser", runAsAdmin: false, group: "仕事", favorite: true },
  { id: "demo-terminal", name: "Windows Terminal", path: "wt.exe", args: "", iconPath: "auto", icon: "terminal", runAsAdmin: false, group: "開発", favorite: false },
  { id: "demo-spotify", name: "Spotify", path: "spotify.exe", args: "", iconPath: "auto", icon: "music", runAsAdmin: false, group: "エンタメ", favorite: false },
  { id: "demo-slack", name: "Slack", path: "slack.exe", args: "", iconPath: "auto", icon: "chat", runAsAdmin: false, group: "仕事", favorite: true },
  { id: "demo-figma", name: "Figma", path: "Figma.exe", args: "", iconPath: "auto", icon: "design", runAsAdmin: false, group: "デザイン", favorite: false },
  { id: "demo-notion", name: "Notion", path: "notion.exe", args: "", iconPath: "auto", icon: "notes", runAsAdmin: false, group: "仕事", favorite: false },
  { id: "demo-explorer", name: "エクスプローラー", path: "explorer.exe", args: "", iconPath: "auto", icon: "folder", runAsAdmin: false, group: "ユーティリティ", favorite: false },
];

export const defaultConfig: Config = {
  apps: demoApps,
  presets: [
    {
      id: "preset-work",
      name: "朝の仕事セット",
      items: [
        { appId: "demo-edge", order: 1, delayMs: 0 },
        { appId: "demo-slack", order: 2, delayMs: 1500 },
        { appId: "demo-vscode", order: 3, delayMs: 2500 },
      ],
      runOnStartup: false,
    },
  ],
  settings: defaultSettings,
};
