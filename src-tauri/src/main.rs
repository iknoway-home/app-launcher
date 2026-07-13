use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, process::Command};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppItem {
    id: String,
    name: String,
    path: String,
    #[serde(default)]
    args: String,
    #[serde(default = "default_icon_path")]
    icon_path: String,
    #[serde(default = "default_icon")]
    icon: String,
    #[serde(default)]
    run_as_admin: bool,
    #[serde(default)]
    group: String,
    #[serde(default)]
    favorite: bool,
    #[serde(default)]
    last_launched: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PresetItem {
    app_id: String,
    order: u32,
    #[serde(default)]
    delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Preset {
    id: String,
    name: String,
    items: Vec<PresetItem>,
    #[serde(default)]
    run_on_startup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default)]
    launch_on_startup: bool,
    #[serde(default = "default_hotkey")]
    global_hotkey: String,
    #[serde(default = "default_true")]
    start_in_tray: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    #[serde(default)]
    apps: Vec<AppItem>,
    #[serde(default)]
    presets: Vec<Preset>,
    #[serde(default = "default_settings")]
    settings: Settings,
}

fn default_icon_path() -> String { "auto".into() }
fn default_icon() -> String { "folder".into() }
fn default_theme() -> String { "dark".into() }
fn default_hotkey() -> String { "Alt+Space".into() }
fn default_true() -> bool { true }
fn default_settings() -> Settings {
    Settings { theme: default_theme(), launch_on_startup: false, global_hotkey: default_hotkey(), start_in_tray: true }
}

fn config_file() -> Result<PathBuf, String> {
    let mut path = dirs::config_dir().ok_or_else(|| "設定フォルダを取得できませんでした".to_string())?;
    path.push("app-launcher");
    fs::create_dir_all(&path).map_err(|error| format!("設定フォルダを作成できませんでした: {error}"))?;
    path.push("config.json");
    Ok(path)
}

#[tauri::command]
fn load_config() -> Result<Config, String> {
    let path = config_file()?;
    if !path.exists() {
        return Ok(Config { apps: vec![], presets: vec![], settings: default_settings() });
    }
    let raw = fs::read_to_string(path).map_err(|error| format!("設定を読み込めませんでした: {error}"))?;
    serde_json::from_str(&raw).map_err(|error| format!("設定の形式が不正です: {error}"))
}

#[tauri::command]
fn save_config(config: Config) -> Result<(), String> {
    let path = config_file()?;
    let raw = serde_json::to_string_pretty(&config).map_err(|error| format!("設定を変換できませんでした: {error}"))?;
    fs::write(path, raw).map_err(|error| format!("設定を保存できませんでした: {error}"))
}

#[tauri::command]
fn launch_app(path: String, args: String, run_as_admin: bool) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("実行パスが空です".into());
    }

    #[cfg(windows)]
    {
        if run_as_admin {
            let mut command = Command::new("powershell");
            command.args(["-NoProfile", "-Command", "Start-Process", "-Verb", "RunAs", "-FilePath"]);
            command.arg(&path);
            if !args.trim().is_empty() { command.args(["-ArgumentList", &args]); }
            command.spawn().map_err(|error| format!("管理者権限で起動できませんでした: {error}"))?;
            return Ok(());
        }
    }

    let mut command = Command::new(&path);
    if !args.trim().is_empty() {
        command.args(args.split_whitespace());
    }
    command.spawn().map_err(|error| format!("アプリを起動できませんでした: {error}"))?;
    Ok(())
}

#[tauri::command]
fn set_startup(enabled: bool, app: AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (run_key, _) = hkcu.create_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
            .map_err(|error| format!("スタートアップ設定を開けませんでした: {error}"))?;
        let value_name = "OrbitAppLauncher";
        if enabled {
            let exe = std::env::current_exe().map_err(|error| format!("実行ファイルの場所を取得できませんでした: {error}"))?;
            let value = format!("\"{}\"", exe.display());
            run_key.set_value(value_name, &value).map_err(|error| format!("自動起動を登録できませんでした: {error}"))?;
        } else {
            let _ = run_key.delete_value(value_name);
        }
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        let _ = (enabled, app);
        Ok(())
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_config, save_config, launch_app, set_startup])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
