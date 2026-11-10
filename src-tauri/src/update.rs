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
            if tag.is_empty() || update_url(release).is_none() {
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
            installer_url: update_url(release),
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

fn portable_url(release: &Value) -> Option<String> {
    release
        .get("assets")
        .and_then(Value::as_array)
        .and_then(|assets| {
            assets.iter().find_map(|asset| {
                let name = asset.get("name").and_then(Value::as_str)?.trim().to_lowercase();
                if name != "lavunio.exe" {
                    return None;
                }
                asset
                    .get("browser_download_url")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
        })
}

fn update_url(release: &Value) -> Option<String> {
    portable_url(release).or_else(|| installer_url(release))
}

fn is_setup_url(url: &str) -> bool {
    url.to_lowercase().contains("setup")
}

fn download_file(
    url: &str,
    file_name: &str,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<PathBuf, String> {
    if !url.starts_with("https://github.com/") {
        return Err("Некорректная ссылка на обновление".to_string());
    }
    let path: PathBuf = std::env::temp_dir().join(file_name);
    let mut response = client()
        .get(url)
        .send()
        .map_err(|e| format!("Не удалось скачать обновление: {e}"))?;
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
            .map_err(|e| format!("Не удалось скачать обновление: {e}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|e| format!("Не удалось сохранить обновление: {e}"))?;
        downloaded += read as u64;
        on_progress(downloaded, total);
    }
    file.flush()
        .map_err(|e| format!("Не удалось сохранить обновление: {e}"))?;
    Ok(path)
}

fn validate_portable(path: &PathBuf) -> Result<(), String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("Не удалось проверить обновление: {e}"))?;
    if meta.len() < 1_000_000 {
        return Err("Скачанный файл обновления слишком маленький".to_string());
    }
    let mut file = File::open(path).map_err(|e| format!("Не удалось открыть обновление: {e}"))?;
    let mut header = [0u8; 2];
    file.read_exact(&mut header)
        .map_err(|e| format!("Не удалось проверить обновление: {e}"))?;
    if &header != b"MZ" {
        return Err("Скачанный файл не является приложением Windows".to_string());
    }
    Ok(())
}

fn ensure_target_writable(target: &PathBuf) -> Result<(), String> {
    let Some(dir) = target.parent() else {
        return Err("Не удалось определить папку лаунчера".to_string());
    };
    let probe = dir.join(".lavunio-update-write-test");
    std::fs::write(&probe, b"ok")
        .map_err(|e| format!("Нет прав на обновление в папке лаунчера: {e}"))?;
    let _ = std::fs::remove_file(probe);
    Ok(())
}

fn ps_escape(path: &PathBuf) -> String {
    path.to_string_lossy().replace('\'', "''")
}

fn build_portable_update_script(
    pid: u32,
    source: &PathBuf,
    target: &PathBuf,
    restart: bool,
) -> String {
    let source = ps_escape(source);
    let target = ps_escape(target);
    let backup = format!("{target}.old");
    let restart_line = if restart {
        format!("Start-Process -FilePath '{target}'")
    } else {
        String::new()
    };
    format!(
        "Wait-Process -Id {pid} -Timeout 60 -ErrorAction SilentlyContinue; \
$source = '{source}'; $target = '{target}'; $backup = '{backup}'; \
Copy-Item -LiteralPath $target -Destination $backup -Force -ErrorAction SilentlyContinue; \
$done = $false; \
for ($i = 0; $i -lt 120; $i++) {{ \
  try {{ Copy-Item -LiteralPath $source -Destination $target -Force -ErrorAction Stop; $done = $true; break }} \
  catch {{ Start-Sleep -Milliseconds 250 }} \
}}; \
if ($done) {{ Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue }}; \
{restart_line}; \
Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue"
    )
}

fn spawn_hidden_powershell(script: &str) -> Result<(), String> {
    let mut command = Command::new("powershell");
    command.args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
        .spawn()
        .map_err(|e| format!("Не удалось запустить обновление: {e}"))?;
    Ok(())
}

fn install_setup(installer: &PathBuf) -> Result<(), String> {
    let installer_path = ps_escape(installer);
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
    spawn_hidden_powershell(&script)
}

#[tauri::command]
pub async fn install_update(app: AppHandle, url: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app.clone();
        let progress = move |downloaded, total| {
            let _ = progress_app.emit(
                "update:progress",
                json!({ "downloaded": downloaded, "total": total }),
            );
        };

        if is_setup_url(&url) {
            let installer = download_file(&url, "Lavunio-Setup-latest.exe", progress)?;
            return install_setup(&installer);
        }

        let update = download_file(&url, "Lavunio-update.exe", progress)?;
        validate_portable(&update)?;
        let target = std::env::current_exe()
            .map_err(|e| format!("Не удалось определить файл лаунчера: {e}"))?;
        ensure_target_writable(&target)?;
        let script = build_portable_update_script(std::process::id(), &update, &target, true);
        spawn_hidden_powershell(&script)
    })
    .await
    .map_err(|e| format!("Не удалось установить обновление: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release_json(assets: Value) -> Value {
        json!({ "assets": assets })
    }

    #[test]
    fn prefers_portable_asset() {
        let release = release_json(json!([
            { "name": "Lavunio Setup.exe", "browser_download_url": "https://github.com/setup.exe" },
            { "name": "Lavunio.exe", "browser_download_url": "https://github.com/Lavunio.exe" }
        ]));
        assert_eq!(
            update_url(&release).as_deref(),
            Some("https://github.com/Lavunio.exe")
        );
    }

    #[test]
    fn falls_back_to_setup_asset() {
        let release = release_json(json!([
            { "name": "Lavunio Setup.exe", "browser_download_url": "https://github.com/setup.exe" }
        ]));
        assert_eq!(
            update_url(&release).as_deref(),
            Some("https://github.com/setup.exe")
        );
        assert!(is_setup_url("https://github.com/setup.exe"));
        assert!(!is_setup_url("https://github.com/Lavunio.exe"));
    }

    #[test]
    fn portable_script_escapes_paths() {
        let script = build_portable_update_script(
            42,
            &PathBuf::from("C:\\Temp\\new's exe.exe"),
            &PathBuf::from("C:\\Program Files\\Lavunio\\Lavunio.exe"),
            true,
        );
        assert!(script.contains("Wait-Process -Id 42"));
        assert!(script.contains("new''s exe.exe"));
        assert!(script.contains("Start-Process -FilePath 'C:\\Program Files\\Lavunio\\Lavunio.exe'"));
    }

    #[cfg(windows)]
    #[test]
    fn portable_script_replaces_target_after_process_exit() {
        use std::os::windows::process::CommandExt;

        let base = std::env::temp_dir()
            .join(format!("lavunio updater test {}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).unwrap();
        let source = base.join("new exe.exe");
        let target = base.join("Lavunio.exe");
        std::fs::write(&source, b"new-version").unwrap();
        std::fs::write(&target, b"old-version").unwrap();

        let mut dummy = Command::new("cmd")
            .args(["/C", "ping", "-n", "2", "127.0.0.1"])
            .creation_flags(0x08000000)
            .spawn()
            .unwrap();
        let script = build_portable_update_script(dummy.id(), &source, &target, false);

        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script]);
        command.creation_flags(0x08000000);
        let status = command.status().unwrap();
        let _ = dummy.wait();

        assert!(status.success(), "powershell updater failed");
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "new-version");
        assert!(!source.exists(), "downloaded update should be removed");
        let _ = std::fs::remove_dir_all(&base);
    }
}
