use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use ed25519_dalek::{Signature, VerifyingKey};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const REPO: &str = "tommy-whinston/Lavunio";
const RELEASE_DOWNLOAD_PREFIX: &str =
    "https://github.com/tommy-whinston/Lavunio/releases/download/";
const UPDATE_MANIFEST_NAME: &str = "lavunio-update.json";
const UPDATE_SIGNATURE_NAME: &str = "lavunio-update.json.sig";
const UPDATE_PUBLIC_KEY: &str = "n-1tsam-66L5uv5jBQoRapBQA6XIEBjSroOSbWwdALQ";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub available: bool,
    pub current: String,
    pub latest: String,
    pub url: String,
    pub notes: String,
    pub installer_url: Option<String>,
    pub installer_sha256: Option<String>,
    pub installer_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignedManifest {
    version: String,
    portable: Option<ManifestAsset>,
    installer: Option<ManifestAsset>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestAsset {
    name: String,
    sha256: String,
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

fn is_release_download_url(url: &str) -> bool {
    url.starts_with(RELEASE_DOWNLOAD_PREFIX)
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|ch| ch.is_ascii_hexdigit())
}

fn valid_manifest_asset(asset: &ManifestAsset, portable: bool) -> bool {
    let name = asset.name.trim();
    let lower = name.to_lowercase();
    if name.is_empty()
        || name.len() > 120
        || name.contains('/')
        || name.contains('\\')
        || !lower.ends_with(".exe")
    {
        return false;
    }
    if portable {
        lower == "lavunio.exe"
    } else {
        lower.starts_with("lavunio.setup") || lower.starts_with("lavunio setup")
    }
}

fn is_valid_manifest(manifest: &SignedManifest) -> bool {
    if let Some(portable) = manifest.portable.as_ref() {
        if !valid_manifest_asset(portable, true) || !valid_sha256(&portable.sha256) {
            return false;
        }
    }
    if let Some(installer) = manifest.installer.as_ref() {
        if !valid_manifest_asset(installer, false) || !valid_sha256(&installer.sha256) {
            return false;
        }
    }
    manifest.portable.is_some() || manifest.installer.is_some()
}

fn verify_manifest_with_key(
    tag: &str,
    bytes: &[u8],
    signature_text: &str,
    public_key: &str,
) -> Result<SignedManifest, String> {
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature_text.trim())
        .map_err(|_| "Некорректная подпись обновления".to_string())?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "Некорректная подпись обновления".to_string())?;

    let key_bytes = URL_SAFE_NO_PAD
        .decode(public_key.trim())
        .map_err(|_| "Некорректный ключ проверки обновлений".to_string())?;
    let key_array: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| "Некорректный ключ проверки обновлений".to_string())?;
    let verifying_key = VerifyingKey::from_bytes(&key_array)
        .map_err(|_| "Некорректный ключ проверки обновлений".to_string())?;

    verifying_key
        .verify_strict(bytes, &signature)
        .map_err(|_| "Подпись обновления недействительна".to_string())?;

    let manifest: SignedManifest = serde_json::from_slice(bytes)
        .map_err(|_| "Некорректный манифест обновления".to_string())?;
    if !manifest.version.trim().eq_ignore_ascii_case(tag.trim_start_matches(['v', 'V'])) {
        return Err("Версия в манифесте не совпадает с релизом".to_string());
    }
    if !is_valid_manifest(&manifest) {
        return Err("Манифест обновления содержит недопустимые файлы".to_string());
    }
    Ok(manifest)
}

fn find_asset<'a>(release: &'a Value, name: &str) -> Option<&'a Value> {
    release
        .get("assets")
        .and_then(Value::as_array)
        .and_then(|assets| {
            assets
                .iter()
                .find(|asset| asset.get("name").and_then(Value::as_str) == Some(name))
        })
}

fn asset_url(release: &Value, name: &str) -> Option<String> {
    let url = find_asset(release, name)?
        .get("browser_download_url")
        .and_then(Value::as_str)?
        .trim()
        .to_string();
    if !is_release_download_url(&url) {
        return None;
    }
    Some(url)
}

fn download_small(url: &str, limit: usize) -> Result<Vec<u8>, String> {
    if !is_release_download_url(url) {
        return Err("Некорректная ссылка на файл обновления".to_string());
    }
    let response = client()
        .get(url)
        .send()
        .map_err(|e| format!("Не удалось скачать данные обновления: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("GitHub ответил {}", response.status()));
    }
    if response
        .content_length()
        .map(|length| length as usize > limit)
        .unwrap_or(false)
    {
        return Err("Файл обновления слишком большой".to_string());
    }
    let mut bytes = Vec::new();
    response
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Не удалось прочитать данные обновления: {e}"))?;
    if bytes.len() > limit {
        return Err("Файл обновления слишком большой".to_string());
    }
    Ok(bytes)
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

        let mut best: Option<(Vec<u64>, UpdateInfo)> = None;
        for release in releases {
            if release
                .get("draft")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                continue;
            }
            if release
                .get("prerelease")
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
                .trim_start_matches(['v', 'V'])
                .to_string();
            if tag.is_empty() || !is_newer(&tag, &current) {
                continue;
            }
            let Some(manifest_url) = asset_url(release, UPDATE_MANIFEST_NAME) else {
                continue;
            };
            let Some(signature_url) = asset_url(release, UPDATE_SIGNATURE_NAME) else {
                continue;
            };
            let manifest_bytes = match download_small(&manifest_url, 256 * 1024) {
                Ok(bytes) => bytes,
                Err(_) => continue,
            };
            let signature_bytes = match download_small(&signature_url, 8 * 1024) {
                Ok(bytes) => bytes,
                Err(_) => continue,
            };
            let signature_text = match String::from_utf8(signature_bytes) {
                Ok(text) => text,
                Err(_) => continue,
            };
            let manifest = match verify_manifest_with_key(
                &tag,
                &manifest_bytes,
                &signature_text,
                UPDATE_PUBLIC_KEY,
            ) {
                Ok(manifest) => manifest,
                Err(_) => continue,
            };
            let chosen = manifest.portable.as_ref().or(manifest.installer.as_ref());
            let Some(asset) = chosen else {
                continue;
            };
            let Some(download_url) = asset_url(release, &asset.name) else {
                continue;
            };
            let parts = version_parts(&manifest.version);
            let info = UpdateInfo {
                available: true,
                current: current.clone(),
                latest: manifest.version.clone(),
                url: release
                    .get("html_url")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                notes: release
                    .get("body")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                installer_url: Some(download_url),
                installer_sha256: Some(asset.sha256.clone()),
                installer_name: Some(asset.name.clone()),
            };
            if best
                .as_ref()
                .map(|(best_parts, _)| parts > *best_parts)
                .unwrap_or(true)
            {
                best = Some((parts, info));
            }
        }

        Ok(best.map(|(_, info)| info).unwrap_or(UpdateInfo {
            available: false,
            current,
            latest: String::new(),
            url: String::new(),
            notes: String::new(),
            installer_url: None,
            installer_sha256: None,
            installer_name: None,
        }))
    })
    .await
    .map_err(|e| format!("Не удалось проверить обновление: {e}"))?
}

fn is_setup_asset(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("setup") && lower.ends_with(".exe")
}

fn download_file(
    url: &str,
    file_name: &str,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<PathBuf, String> {
    if !is_release_download_url(url) {
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

fn validate_exe(path: &PathBuf) -> Result<(), String> {
    let meta =
        std::fs::metadata(path).map_err(|e| format!("Не удалось проверить обновление: {e}"))?;
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
pub async fn install_update(
    app: AppHandle,
    url: String,
    sha256: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !is_release_download_url(&url) {
            return Err("Некорректная ссылка на обновление".to_string());
        }
        if !valid_sha256(&sha256) {
            return Err("Не указан корректный SHA-256 обновления".to_string());
        }
        let asset_name = url.rsplit('/').next().unwrap_or("").to_string();
        if !asset_name.to_lowercase().ends_with(".exe") {
            return Err("Ссылка ведёт не на exe-файл".to_string());
        }
        let setup = is_setup_asset(&asset_name);
        let progress_app = app.clone();
        let progress = move |downloaded, total| {
            let _ = progress_app.emit(
                "update:progress",
                json!({ "downloaded": downloaded, "total": total }),
            );
        };
        let file_name = if setup {
            "Lavunio-Setup-latest.exe"
        } else {
            "Lavunio-update.exe"
        };
        let path = download_file(&url, file_name, progress)?;
        validate_exe(&path)?;
        let actual = crate::util::sha256_file(&path)?;
        if !actual.eq_ignore_ascii_case(&sha256) {
            let _ = std::fs::remove_file(&path);
            return Err("Файл обновления повреждён или подменён".to_string());
        }
        if setup {
            install_setup(&path)
        } else {
            let target = std::env::current_exe()
                .map_err(|e| format!("Не удалось определить файл лаунчера: {e}"))?;
            ensure_target_writable(&target)?;
            let script = build_portable_update_script(std::process::id(), &path, &target, true);
            spawn_hidden_powershell(&script)
        }
    })
    .await
    .map_err(|e| format!("Не удалось установить обновление: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn release_json(assets: Value) -> Value {
        json!({ "assets": assets })
    }

    #[test]
    fn version_comparison_handles_prefixes_and_patch_versions() {
        assert!(is_newer("0.23.35", "0.23.34"));
        assert!(is_newer("v0.24.0", "0.23.99"));
        assert!(!is_newer("0.23.35", "0.23.35"));
        assert!(!is_newer("0.23.34", "0.23.35"));
        assert_eq!(version_parts("v1.2.3"), vec![1, 2, 3]);
    }

    #[test]
    fn update_urls_must_stay_in_the_release_repository() {
        assert!(is_release_download_url(
            "https://github.com/tommy-whinston/Lavunio/releases/download/v0.23.58/Lavunio.exe"
        ));
        assert!(!is_release_download_url(
            "https://github.com/other/Lavunio/releases/download/v0.23.58/Lavunio.exe"
        ));
        assert!(!is_release_download_url(
            "https://github.com.evil/Lavunio/releases/download/v0.23.58/Lavunio.exe"
        ));
    }

    #[test]
    fn manifest_signature_roundtrip_and_rejects_tampering() {
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let public_key = URL_SAFE_NO_PAD.encode(signing_key.verifying_key().as_bytes());
        let manifest = br#"{"version":"0.23.58","portable":{"name":"Lavunio.exe","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"installer":{"name":"Lavunio.Setup.exe","sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}"#;
        let signature = signing_key.sign(manifest);
        let signature_text = URL_SAFE_NO_PAD.encode(signature.to_bytes());

        let parsed =
            verify_manifest_with_key("0.23.58", manifest, &signature_text, &public_key).unwrap();
        assert_eq!(parsed.version, "0.23.58");
        assert_eq!(parsed.portable.unwrap().name, "Lavunio.exe");

        let mut tampered = manifest.to_vec();
        tampered[20] = b'9';
        assert!(verify_manifest_with_key("0.23.58", &tampered, &signature_text, &public_key).is_err());
    }

    #[test]
    fn manifest_rejects_wrong_release_version() {
        let signing_key = SigningKey::from_bytes(&[9u8; 32]);
        let public_key = URL_SAFE_NO_PAD.encode(signing_key.verifying_key().as_bytes());
        let manifest = br#"{"version":"0.23.58","portable":{"name":"Lavunio.exe","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"installer":null}"#;
        let signature = signing_key.sign(manifest);
        let signature_text = URL_SAFE_NO_PAD.encode(signature.to_bytes());
        assert!(
            verify_manifest_with_key("0.23.59", manifest, &signature_text, &public_key).is_err()
        );
    }

    #[test]
    fn update_assets_are_found_by_exact_name() {
        let release = release_json(json!([
            { "name": "Lavunio.exe", "browser_download_url": "https://github.com/tommy-whinston/Lavunio/releases/download/v0.23.58/Lavunio.exe" },
            { "name": "Lavunio.Setup.exe", "browser_download_url": "https://github.com/tommy-whinston/Lavunio/releases/download/v0.23.58/Lavunio.Setup.exe" }
        ]));
        assert_eq!(asset_url(&release, "Lavunio.exe").as_deref(), Some("https://github.com/tommy-whinston/Lavunio/releases/download/v0.23.58/Lavunio.exe"));
        assert!(asset_url(&release, "Other.exe").is_none());
    }

    #[test]
    fn installer_names_are_detected() {
        assert!(is_setup_asset("Lavunio.Setup.exe"));
        assert!(is_setup_asset("Lavunio Setup 0.23.58.exe"));
        assert!(!is_setup_asset("Lavunio.exe"));
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
        assert!(
            script.contains("Start-Process -FilePath 'C:\\Program Files\\Lavunio\\Lavunio.exe'")
        );
    }

    #[cfg(windows)]
    #[test]
    fn portable_script_replaces_target_after_process_exit() {
        use std::os::windows::process::CommandExt;

        let base =
            std::env::temp_dir().join(format!("lavunio updater test {}", std::process::id()));
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
