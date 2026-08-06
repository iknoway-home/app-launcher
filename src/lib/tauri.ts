import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Config } from "../types";

const LOCAL_CONFIG_KEY = "orbit-launcher-config";

export async function loadConfig(): Promise<Config | null> {
  try {
    return await invoke<Config>("load_config");
  } catch {
    const saved = localStorage.getItem(LOCAL_CONFIG_KEY);
    return saved ? (JSON.parse(saved) as Config) : null;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
  try {
    await invoke("save_config", { config });
  } catch {
    // The browser preview intentionally uses localStorage as its persistence layer.
  }
}

export async function launchPath(path: string, args: string, runAsAdmin: boolean): Promise<void> {
  if (/^(https?:\/\/|file:\/\/)/.test(path)) {
    window.open(path, "_blank", "noopener,noreferrer");
    return;
  }
  await invoke("launch_app", { path, args, runAsAdmin });
}

export async function setStartup(enabled: boolean): Promise<void> {
  try {
    await invoke("set_startup", { enabled });
  } catch {
    // Startup integration is only available inside the Tauri desktop shell.
  }
}

export async function closeLauncher(): Promise<void> {
  try {
    await getCurrentWindow().close();
  } catch {
    window.close();
  }
}
