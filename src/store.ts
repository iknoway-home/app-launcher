import { create } from "zustand";
import { defaultConfig, defaultSettings, type AppItem, type Config, type Preset, type Settings } from "./types";

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type LauncherState = {
  config: Config;
  hydrated: boolean;
  selectedIds: string[];
  activeGroup: string;
  searchQuery: string;
  setConfig: (config: Config) => void;
  markHydrated: () => void;
  setSearchQuery: (value: string) => void;
  setActiveGroup: (group: string) => void;
  toggleSelected: (id: string) => void;
  selectOnly: (id: string) => void;
  clearSelection: () => void;
  addApp: (app: Omit<AppItem, "id" | "favorite" | "iconPath" | "runAsAdmin"> & Partial<Pick<AppItem, "favorite" | "iconPath" | "runAsAdmin">>) => void;
  updateApp: (id: string, patch: Partial<AppItem>) => void;
  removeApp: (id: string) => void;
  reorderApps: (fromId: string, toId: string) => void;
  reorderSelection: (fromIndex: number, toIndex: number) => void;
  savePreset: (name: string, delayMs: number) => void;
  removePreset: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
};

export const useLauncherStore = create<LauncherState>((set) => ({
  config: defaultConfig,
  hydrated: false,
  selectedIds: [],
  activeGroup: "すべて",
  searchQuery: "",
  setConfig: (config) => set({ config: { ...config, settings: { ...defaultSettings, ...config.settings } } }),
  markHydrated: () => set({ hydrated: true }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveGroup: (activeGroup) => set({ activeGroup, searchQuery: "" }),
  toggleSelected: (id) => set((state) => ({ selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id] })),
  selectOnly: (id) => set({ selectedIds: [id] }),
  clearSelection: () => set({ selectedIds: [] }),
  addApp: (app) => set((state) => ({ config: { ...state.config, apps: [...state.config.apps, { ...app, id: makeId(), favorite: app.favorite ?? false, iconPath: app.iconPath ?? "auto", runAsAdmin: app.runAsAdmin ?? false }] } })),
  updateApp: (id, patch) => set((state) => ({ config: { ...state.config, apps: state.config.apps.map((app) => app.id === id ? { ...app, ...patch } : app) } })),
  removeApp: (id) => set((state) => ({ config: { ...state.config, apps: state.config.apps.filter((app) => app.id !== id), presets: state.config.presets.map((preset) => ({ ...preset, items: preset.items.filter((item) => item.appId !== id) })) }, selectedIds: state.selectedIds.filter((item) => item !== id) })),
  reorderApps: (fromId, toId) => set((state) => {
    const from = state.config.apps.findIndex((app) => app.id === fromId);
    const to = state.config.apps.findIndex((app) => app.id === toId);
    if (from < 0 || to < 0 || from === to) return state;
    const apps = [...state.config.apps];
    const [moved] = apps.splice(from, 1);
    apps.splice(to, 0, moved);
    return { config: { ...state.config, apps } };
  }),
  reorderSelection: (fromIndex, toIndex) => set((state) => {
    const selectedIds = [...state.selectedIds];
    const [moved] = selectedIds.splice(fromIndex, 1);
    selectedIds.splice(toIndex, 0, moved);
    return { selectedIds };
  }),
  savePreset: (name, delayMs) => set((state) => ({ config: { ...state.config, presets: [...state.config.presets, { id: makeId(), name, items: state.selectedIds.map((appId, index) => ({ appId, order: index + 1, delayMs: index === 0 ? 0 : delayMs })), runOnStartup: false }] } })),
  removePreset: (id) => set((state) => ({ config: { ...state.config, presets: state.config.presets.filter((preset) => preset.id !== id) } })),
  updateSettings: (patch) => set((state) => ({ config: { ...state.config, settings: { ...state.config.settings, ...patch } } })),
}));

export const getPresetApps = (preset: Preset, apps: AppItem[]) => preset.items
  .sort((a, b) => a.order - b.order)
  .map((item) => apps.find((app) => app.id === item.appId))
  .filter((app): app is AppItem => Boolean(app));
