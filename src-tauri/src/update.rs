use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const REPO: &str = "tommy-whinston/Lavunio";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub available: bool,
    pub current: String,
    pub latest: String,
    pub url: String,
    pub notes: String,
    pub installer_url: Option<String>,
}

fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("Lavunio/1.0 (Rust)")
        .build()
        .unwrap_or_else(|_| Client::new())
}

fn version_parts(value: &str) -> Vec<u64> {
    value
        .trim()
        .trim_start_matches(['v', 'V'])
        .split(['.', '-', '+'])
        .take(3)
        .map(|part| part.parse::<u64>().unwrap_or(0))
        .collect()
}

fn is_newer(latest: &str, current: &str) -> bool {
    let mut left = version_parts(latest);
    let mut right = version_parts(current);
    while left.len() < 3 {
        left.push(0);
    }
    while right.len() < 3 {
        right.push(0);
    }
    left > right
}

#[tauri::command]
pub async fn check_update() -> Result<UpdateInfo, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let current = env!("CARGO_PKG_VERSION").to_string();
        let url = format!("https://api.github.com/repos/{REPO}/releases?per_page=20");
        let response = client()
            .get(&url)
            .send()
            .map_err(|e| format!("Не удалось проверить обновление: {e}"))?;
        if !response.status().is_success() {
            return Err(format!("GitHub ответил {}", response.status()));
        }
        let data: Value = response
            .json()
            .map_err(|e| format!("Некорректный ответ GitHub: {e}"))?;
        let releases = data
            .as_array()
            .ok_or_else(|| "GitHub вернул не список релизов".to_string())?;

        let mut best: Option<(Vec<u64>, usize)> = None;
        for (index, release) in releases.iter().enumerate() {
            if release
                .get("draft")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                continue;
            }
            let tag = release
                .get("tag_name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim()
                .trim_start_matches(['v', 'V']);
            if tag.is_empty() || installer_url(release).is_none() {
                continue;
            }
            let parts = version_parts(tag);
            if best
                .as_ref()
                .map(|(best_parts, _)| parts.as_slice() > best_parts.as_slice())
                .unwrap_or(true)
            {
                best = Some((parts, index));
            }
        }

        let Some((_, index)) = best else {
            return Ok(UpdateInfo {
                available: false,
                current,
                latest: String::new(),
                url: String::new(),
                notes: String::new(),
                installer_url: None,
            });
        };
        let release = &releases[index];
        let latest = release
            .get("tag_name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .trim_start_matches(['v', 'V'])
            .to_string();
        let html_url = release
            .get("html_url")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let notes = release
            .get("body")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        Ok(UpdateInfo {
            available: is_newer(&latest, &current),
            current,
            latest,
            url: html_url,
            notes,
            installer_url: installer_url(release),
        })
    })
    .await
    .map_err(|e| format!("Не удалось проверить обновление: {e}"))?
}

fn installer_url(release: &Value) -> Option<String> {
    release
        .get("assets")
        .and_then(Value::as_array)
        .and_then(|assets| {
            assets.iter().find_map(|asset| {
                let name = asset.get("name").and_then(Value::as_str)?.to_lowercase();
                if !name.contains("setup") || !name.ends_with(".exe") {
                    return None;
                }
                asset
                    .get("browser_download_url")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
        })
}

fn download_installer(url: &str, mut on_progress: impl FnMut(u64, u64)) -> Result<PathBuf, String> {
    if !url.starts_with("https://github.com/") {
        return Err("Некорректная ссылка на обновление".to_string());
    }
    let path: PathBuf = std::env::temp_dir().join("Lavunio-Setup-latest.exe");
    let mut response = client()
        .get(url)
        .send()
        .map_err(|e| format!("Не удалось скачать установщик: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("GitHub ответил {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut file = File::create(&path).map_err(|e| format!("Не удалось создать файл: {e}"))?;
    let mut downloaded = 0u64;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|e| format!("Не удалось скачать установщик: {e}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|e| format!("Не удалось сохранить установщик: {e}"))?;
        downloaded += read as u64;
        on_progress(downloaded, total);
    }
    file.flush()
        .map_err(|e| format!("Не удалось сохранить установщик: {e}"))?;
    Ok(path)
}

#[tauri::command]
pub async fn download_update(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = download_installer(&url, |_, _| {})?;
        open::that(&path).map_err(|e| format!("Не удалось запустить установщик: {e}"))?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Не удалось скачать обновление: {e}"))?
}

#[tauri::command]
pub async fn install_update(app: AppHandle, url: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app.clone();
        let installer = download_installer(&url, move |downloaded, total| {
            let _ = progress_app.emit(
                "update:progress",
                json!({ "downloaded": downloaded, "total": total }),
            );
        })?;

        let installer_path = installer.to_string_lossy().replace('\'', "''");
        let pid = std::process::id();
        let installed = dirs::data_local_dir()
            .map(|dir| dir.join("Lavunio").join("Lavunio.exe"))
            .map(|path| path.to_string_lossy().to_string());
        let current = std::env::current_exe()
            .ok()
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| {
                        name.eq_ignore_ascii_case("lavunio.exe")
                            || name.eq_ignore_ascii_case("tmstore.exe")
                            || name.eq_ignore_ascii_case("tm-launcher.exe")
                    })
                    .unwrap_or(false)
            })
            .map(|path| path.to_string_lossy().to_string());
        let restart = installed
            .as_deref()
            .map(|installed| {
                let installed = installed.replace('\'', "''");
                match current.as_deref() {
                    Some(current) => format!(
                        " Start-Sleep -Milliseconds 150; if (Test-Path '{}') {{ Start-Process -FilePath '{}' }} else {{ Start-Process -FilePath '{}' }};",
                        installed,
                        installed,
                        current.replace('\'', "''")
                    ),
                    None => format!(
                        " Start-Sleep -Milliseconds 150; Start-Process -FilePath '{}';",
                        installed
                    ),
                }
            })
            .unwrap_or_default();
        let script = format!(
            "Wait-Process -Id {} -Timeout 20 -ErrorAction SilentlyContinue; Start-Process -FilePath '{}' -ArgumentList '/S' -Wait;{} Remove-Item -LiteralPath '{}' -Force -ErrorAction SilentlyContinue",
            pid, installer_path, restart, installer_path
        );

        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        command
            .spawn()
            .map_err(|e| format!("Не удалось запустить установщик: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Не удалось установить обновление: {e}"))?
}
