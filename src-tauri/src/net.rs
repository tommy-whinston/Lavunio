use crate::events::GameEvent;
use crate::models::{Author, BuildInfo, Mode, Settings};
use crate::util::{format_error, safe_join, sha256_file, write_json};
use reqwest::blocking::{Client, Response};
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;
use url::Url;

pub const API: &str = "https://api.github.com";
pub const CATALOG_URL: &str =
    "https://raw.githubusercontent.com/tommy-whinston/Lavunio-Catalog/main/modes/modes.json";
pub const RAW: &str = "https://raw.githubusercontent.com";

pub fn api_base_url() -> Option<String> {
    std::env::var("LAVUNIO_API_URL")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
}

fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Lavunio/1.0 (Rust)")
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

fn download_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(600))
            .user_agent("Lavunio/1.0 (Rust)")
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

pub fn raw_url(repo: &str, branch: &str, segments: &[&str]) -> Result<String, String> {
    let mut url = Url::parse(&format!("{RAW}/{repo}/{branch}/"))
        .map_err(|e| format!("Некорректный адрес GitHub: {e}"))?;
    {
        let mut path = url
            .path_segments_mut()
            .map_err(|_| "Некорректный адрес GitHub".to_string())?;
        for segment in segments {
            path.push(segment);
        }
    }
    Ok(url.to_string())
}

pub fn api_url(repo: &str, tail: &[&str]) -> Result<Url, String> {
    let mut url = Url::parse(&format!("{API}/repos/{repo}/"))
        .map_err(|e| format!("Некорректный репозиторий: {e}"))?;
    {
        let mut path = url
            .path_segments_mut()
            .map_err(|_| "Некорректный репозиторий".to_string())?;
        for segment in tail {
            path.push(segment);
        }
    }
    Ok(url)
}

fn auth_headers(token: Option<&str>) -> Vec<(&'static str, String)> {
    let mut headers = vec![(USER_AGENT.as_str(), "Lavunio".to_string())];
    if let Some(token) = token.filter(|t| !t.trim().is_empty()) {
        headers.push((AUTHORIZATION.as_str(), format!("Bearer {}", token.trim())));
    }
    headers
}

fn get_json(url: &str, token: Option<&str>) -> Result<Value, String> {
    let mut req = client()
        .get(url)
        .header(ACCEPT, "application/vnd.github+json");
    for (k, v) in auth_headers(token) {
        req = req.header(k, v);
    }
    let res = req
        .send()
        .map_err(|e| format!("Нет связи с GitHub: {}", format_error(e)))?;
    let status = res.status();
    let data: Value = res.json().unwrap_or_else(|_| Value::Null);
    if !status.is_success() {
        let message = data
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("ошибка GitHub API");
        return Err(format!("GitHub API ({status}): {message}"));
    }
    Ok(data)
}

pub fn api_request_json(
    api_base: &str,
    method: &str,
    path: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else {
        format!("{}{}", api_base.trim_end_matches('/'), path)
    };
    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|_| "Некорректный HTTP-метод".to_string())?;
    let mut req = client()
        .request(method, &url)
        .header(ACCEPT, "application/json");
    if let Some(token) = token.filter(|value| !value.trim().is_empty()) {
        req = req.header(AUTHORIZATION, format!("Bearer {}", token.trim()));
    }
    if let Some(body) = body {
        req = req.json(&body);
    }
    let res = req
        .send()
        .map_err(|e| format!("Нет связи с Lavunio API: {}", format_error(e)))?;
    let status = res.status();
    let data: Value = res.json().unwrap_or_else(|_| Value::Null);
    if !status.is_success() {
        let message = data
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("Ошибка Lavunio API");
        return Err(message.to_string());
    }
    Ok(data)
}

pub fn upload_file(
    url: &str,
    path: &Path,
    token: Option<&str>,
    total: u64,
    on_progress: impl FnMut(u64, u64) + Send + 'static,
) -> Result<(), String> {
    struct ProgressReader<R> {
        inner: R,
        done: u64,
        total: u64,
        on_progress: Box<dyn FnMut(u64, u64) + Send>,
    }

    impl<R: Read> Read for ProgressReader<R> {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            let read = self.inner.read(buf)?;
            self.done = self.done.saturating_add(read as u64);
            (self.on_progress)(self.done, self.total);
            Ok(read)
        }
    }

    let file = File::open(path).map_err(|e| format!("Не удалось открыть файл загрузки: {e}"))?;
    let size = if total > 0 {
        total
    } else {
        file.metadata()
            .map_err(|e| format!("Не удалось прочитать размер файла: {e}"))?
            .len()
    };

    let mut req = download_client()
        .put(url)
        .header(CONTENT_LENGTH, size.to_string())
        .body(reqwest::blocking::Body::new(ProgressReader {
            inner: file,
            done: 0,
            total: size,
            on_progress: Box::new(on_progress),
        }));
    if let Some(token) = token.filter(|value| !value.trim().is_empty()) {
        req = req.header(AUTHORIZATION, format!("Bearer {}", token.trim()));
    }

    let res = req
        .send()
        .map_err(|e| format!("Ошибка загрузки: {}", format_error(e)))?;
    let status = res.status();
    if !status.is_success() {
        let text = res.text().unwrap_or_default();
        let message = serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|value| {
                value
                    .get("error")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .unwrap_or_else(|| format!("Сервер ответил {status}"));
        return Err(message);
    }
    Ok(())
}

pub fn api_request_bytes(
    api_base: &str,
    method: &str,
    path: &str,
    token: Option<&str>,
    bytes: Vec<u8>,
    content_type: &str,
) -> Result<Value, String> {
    let url = if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else {
        format!("{}{}", api_base.trim_end_matches('/'), path)
    };
    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|_| "Некорректный HTTP-метод".to_string())?;
    let mut req = client()
        .request(method, &url)
        .header(ACCEPT, "application/json")
        .header(CONTENT_TYPE, content_type)
        .body(bytes);
    if let Some(token) = token.filter(|value| !value.trim().is_empty()) {
        req = req.header(AUTHORIZATION, format!("Bearer {}", token.trim()));
    }
    let res = req
        .send()
        .map_err(|e| format!("Нет связи с Lavunio API: {}", format_error(e)))?;
    let status = res.status();
    let data: Value = res.json().unwrap_or_else(|_| Value::Null);
    if !status.is_success() {
        let message = data
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("Ошибка Lavunio API");
        return Err(message.to_string());
    }
    Ok(data)
}

/// Читает modes.json из настроенного источника. Сначала catalogUrl, затем GitHub как резерв.
pub fn fetch_remote_modes(
    repo: &str,
    catalog_url: &str,
    token: Option<&str>,
) -> Result<Vec<Mode>, String> {
    let catalog_url = catalog_url.trim();
    let mut catalog_error: Option<String> = None;

    if !catalog_url.is_empty() {
        match fetch_catalog(catalog_url, token) {
            Ok(modes) => return Ok(modes),
            Err(err) => catalog_error = Some(err),
        }
    }

    if repo.trim().is_empty() {
        return match catalog_error {
            Some(err) => Err(err),
            None => Ok(Vec::new()),
        };
    }

    match fetch_repo_modes(repo) {
        Ok(modes) if !modes.is_empty() => Ok(modes),
        Ok(_) => match catalog_error {
            Some(err) => Err(err),
            None => Ok(Vec::new()),
        },
        Err(err) => match catalog_error {
            Some(catalog_err) => Err(format!("{catalog_err}; резервный GitHub: {err}")),
            None => Err(err),
        },
    }
}

fn fetch_catalog(url: &str, token: Option<&str>) -> Result<Vec<Mode>, String> {
    let mut request = client().get(url);
    let github = Url::parse(url)
        .ok()
        .and_then(|parsed| parsed.host_str().map(str::to_owned))
        .map(|host| {
            host.eq_ignore_ascii_case("raw.githubusercontent.com")
                || host.eq_ignore_ascii_case("api.github.com")
        })
        .unwrap_or(false);
    for (key, value) in auth_headers(token.filter(|_| github)) {
        request = request.header(key, value);
    }
    let res = request
        .send()
        .map_err(|err| format!("Не удалось загрузить каталог: {}", format_error(err)))?;
    let status = res.status();
    if !status.is_success() {
        return Err(format!("Каталог: HTTP {status}"));
    }
    let data: Value = res
        .json()
        .map_err(|e| format!("Не удалось прочитать каталог: {e}"))?;
    parse_modes(data)
}

fn fetch_repo_modes(repo: &str) -> Result<Vec<Mode>, String> {
    let mut not_found = false;
    let mut last_error: Option<String> = None;
    for branch in ["main", "master"] {
        for segments in [&["modes", "modes.json"][..], &["modes.json"][..]] {
            let url = raw_url(repo, branch, segments)?;
            match client().get(&url).send() {
                Ok(res) => {
                    let status = res.status();
                    if status == reqwest::StatusCode::NOT_FOUND {
                        not_found = true;
                        continue;
                    }
                    if !status.is_success() {
                        last_error = Some(format!("GitHub ответил {status}"));
                        continue;
                    }
                    let data: Value = res
                        .json()
                        .map_err(|e| format!("Не удалось прочитать modes.json: {e}"))?;
                    return parse_modes(data);
                }
                Err(err) => {
                    last_error = Some(format!("Ошибка запроса к GitHub: {}", format_error(err)));
                }
            }
        }
    }
    if not_found {
        return Ok(Vec::new());
    }
    Err(last_error.unwrap_or_else(|| "Не удалось загрузить modes.json".to_string()))
}

fn parse_modes(data: Value) -> Result<Vec<Mode>, String> {
    let Some(items) = data.get("modes").and_then(Value::as_array) else {
        return Err("В каталоге нет массива modes".to_string());
    };
    let mut modes = Vec::new();
    for item in items {
        match serde_json::from_value::<Mode>(item.clone()) {
            Ok(mode) if !mode.id.trim().is_empty() => modes.push(mode),
            _ => {}
        }
    }
    Ok(modes)
}

pub fn fetch_api_modes(api_base: &str) -> Result<Vec<Mode>, String> {
    let url = format!(
        "{}/v1/catalog?page=1&limit=100",
        api_base.trim_end_matches('/')
    );
    let response = client()
        .get(&url)
        .header(ACCEPT, "application/json")
        .send()
        .map_err(|error| format!("Не удалось загрузить API-каталог: {}", format_error(error)))?;
    if !response.status().is_success() {
        return Err(format!("API-каталог: HTTP {}", response.status()));
    }
    let data: Value = response
        .json()
        .map_err(|error| format!("Не удалось прочитать API-каталог: {error}"))?;
    let Some(items) = data.get("items").and_then(Value::as_array) else {
        return Err("В API-каталоге нет массива items".to_string());
    };
    let mut modes = Vec::new();
    for item in items {
        if let Some(mode) = api_mode(item) {
            modes.push(mode);
        }
    }
    Ok(modes)
}

pub fn fetch_api_collections(api_base: &str) -> Result<Value, String> {
    let url = format!("{}/v1/collections", api_base.trim_end_matches('/'));
    let response = client()
        .get(&url)
        .header(ACCEPT, "application/json")
        .send()
        .map_err(|error| format!("Не удалось загрузить подборки: {}", format_error(error)))?;
    if !response.status().is_success() {
        return Err(format!("Подборки: HTTP {}", response.status()));
    }
    response
        .json()
        .map_err(|error| format!("Не удалось разобрать подборки: {error}"))
}

fn api_mode(item: &Value) -> Option<Mode> {
    let id = item.get("slug").and_then(Value::as_str)?.trim().to_string();
    if id.is_empty() {
        return None;
    }
    let title = item
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or(&id)
        .to_string();
    let author = item.get("author").and_then(|author| {
        let username = author.get("username").and_then(Value::as_str)?;
        let name = author
            .get("displayName")
            .and_then(Value::as_str)
            .unwrap_or(username);
        Some(Author {
            id: username.to_string(),
            name: name.to_string(),
            avatar: author
                .get("avatarUrl")
                .and_then(Value::as_str)
                .map(str::to_string),
            verified: false,
        })
    });
    let latest = item.get("latestRelease");
    let version = latest
        .and_then(|release| release.get("version"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let release_date = latest
        .and_then(|release| release.get("publishedAt"))
        .and_then(Value::as_str)
        .map(|value| value.chars().take(10).collect::<String>());
    let build = item.get("build").and_then(|build| {
        let files = build.get("files").and_then(Value::as_u64).unwrap_or(0);
        let bytes = build.get("bytes").and_then(Value::as_u64).unwrap_or(0);
        if files == 0 && bytes == 0 {
            return None;
        }
        Some(BuildInfo {
            files,
            bytes,
            version: build
                .get("version")
                .and_then(Value::as_str)
                .map(str::to_string),
        })
    });
    let tags = item
        .get("tags")
        .and_then(Value::as_array)
        .map(|tags| {
            tags.iter()
                .filter_map(|tag| tag.get("name").and_then(Value::as_str))
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let authors = author.clone().into_iter().collect();

    Some(Mode {
        id,
        title,
        mc_version: item
            .get("mcVersion")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        version,
        release_date,
        version_id: None,
        loader: item
            .get("loader")
            .and_then(Value::as_str)
            .unwrap_or("vanilla")
            .to_string(),
        loader_version: item
            .get("loaderVersion")
            .and_then(Value::as_str)
            .map(str::to_string),
        size: item.get("size").and_then(Value::as_str).map(str::to_string),
        players: None,
        accent: None,
        tags,
        image_url: item
            .get("coverUrl")
            .and_then(Value::as_str)
            .map(str::to_string),
        image: None,
        trailer_url: item
            .get("trailerUrl")
            .and_then(Value::as_str)
            .map(str::to_string),
        screenshots: item
            .get("screenshots")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
        installs: item.get("installs").and_then(Value::as_u64),
        rating: item.get("rating").and_then(Value::as_f64),
        reviews_count: item.get("reviewsCount").and_then(Value::as_u64),
        author,
        authors,
        description: item
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        short_description: item
            .get("shortDescription")
            .and_then(Value::as_str)
            .map(str::to_string),
        status: item
            .get("status")
            .and_then(Value::as_str)
            .map(str::to_string),
        changelog: String::new(),
        history: Vec::new(),
        build,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct FileMeta {
    pub sha256: Option<String>,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ArchivePart {
    pub path: String,
    pub size: u64,
    pub sha256: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ArchiveMeta {
    pub path: String,
    pub size: u64,
    pub sha256: Option<String>,
    pub files: u64,
    pub bytes: u64,
    pub parts: Vec<ArchivePart>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Manifest {
    pub mode: String,
    pub version: String,
    pub generated_at: Option<String>,
    pub archive: Option<ArchiveMeta>,
    pub files: HashMap<String, FileMeta>,
    #[serde(skip)]
    pub branch: String,
}

fn parse_manifest(value: Value) -> Result<Manifest, String> {
    let mut manifest: Manifest =
        serde_json::from_value(value).map_err(|e| format!("Некорректный manifest.json: {e}"))?;
    // На всякий случай нормализуем относительные пути.
    manifest.files = manifest
        .files
        .into_iter()
        .filter_map(|(path, meta)| {
            let clean = path.replace('\\', "/");
            let clean = clean.trim_start_matches("./").to_string();
            if clean.is_empty() || clean == "manifest.json" {
                None
            } else {
                Some((clean, meta))
            }
        })
        .collect();
    if let Some(archive) = manifest.archive.as_mut() {
        archive.path = archive
            .path
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_string();
        if archive.path.is_empty() {
            archive.path = "build.zip".to_string();
        }
    }
    Ok(manifest)
}

pub fn fetch_manifest(
    repo: &str,
    token: Option<&str>,
    mode_id: &str,
    mode_title: &str,
) -> Result<Manifest, String> {
    let mut last_error: Option<String> = None;

    for branch in ["main", "master"] {
        let url = raw_url(repo, branch, &["modes", mode_id, "manifest.json"])?;
        let mut req = client().get(&url);
        for (k, v) in auth_headers(token) {
            req = req.header(k, v);
        }
        match req.send() {
            Ok(res) => {
                if res.status().is_success() {
                    let data: Value = res
                        .json()
                        .map_err(|e| format!("Некорректный manifest.json: {e}"))?;
                    let mut manifest = parse_manifest(data)?;
                    manifest.branch = branch.to_string();
                    return Ok(manifest);
                }
                last_error = Some(format!("manifest.json ({})", res.status()));
            }
            Err(err) => last_error = Some(format_error(err)),
        }
    }

    Err(format!(
        "Сборка «{mode_title}» не найдена в репозитории. Залей файлы в modes/{mode_id}/ или публикуй кнопкой «+».{}",
        last_error
            .map(|e| format!(" ({e})"))
            .unwrap_or_default()
    ))
}

pub fn fetch_api_build(api_base: &str, mode_id: &str) -> Result<(Manifest, ArchiveMeta), String> {
    let url = format!(
        "{}/v1/modes/{mode_id}/releases",
        api_base.trim_end_matches('/')
    );
    let response = client()
        .get(&url)
        .header(ACCEPT, "application/json")
        .send()
        .map_err(|error| {
            format!(
                "Не удалось загрузить сборку из API: {}",
                format_error(error)
            )
        })?;
    if !response.status().is_success() {
        return Err(format!("API сборки: HTTP {}", response.status()));
    }
    let data: Value = response
        .json()
        .map_err(|error| format!("Не удалось прочитать сборку из API: {error}"))?;
    let Some(releases) = data.as_array() else {
        return Err("API вернул не массив релизов".to_string());
    };

    for release in releases {
        if release.get("status").and_then(Value::as_str) != Some("published") {
            continue;
        }
        let version = release
            .get("version")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let Some(asset) = release
            .get("assets")
            .and_then(Value::as_array)
            .and_then(|assets| {
                assets.iter().find(|asset| {
                    asset.get("kind").and_then(Value::as_str) == Some("archive")
                        && asset
                            .get("url")
                            .and_then(Value::as_str)
                            .map(|url| !url.is_empty())
                            .unwrap_or(false)
                })
            })
        else {
            continue;
        };

        let asset_url = asset
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| "У сборки нет URL".to_string())?;
        let mut manifest = match asset.get("manifest").filter(|value| !value.is_null()) {
            Some(manifest) => parse_manifest(manifest.clone())?,
            None => Manifest::default(),
        };
        if manifest.version.is_empty() {
            manifest.version = version.to_string();
        }
        let mut archive = manifest.archive.clone().unwrap_or_default();
        archive.url = Some(asset_url.to_string());
        archive.size = asset
            .get("size")
            .and_then(Value::as_u64)
            .unwrap_or(archive.size);
        archive.sha256 = asset
            .get("sha256")
            .and_then(Value::as_str)
            .map(str::to_string)
            .or(archive.sha256);
        let base = asset_url
            .rsplit_once('/')
            .map(|(base, _)| base)
            .unwrap_or(asset_url);
        let parts = asset
            .get("parts")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if !parts.is_empty() {
            archive.parts = parts
                .iter()
                .map(|part| {
                    let path = part
                        .get("path")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string();
                    let url = part
                        .get("url")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .or_else(|| {
                            if path.is_empty() {
                                None
                            } else {
                                Some(format!("{base}/{path}"))
                            }
                        });
                    ArchivePart {
                        path,
                        size: part.get("size").and_then(Value::as_u64).unwrap_or(0),
                        sha256: part
                            .get("sha256")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                        url,
                    }
                })
                .collect();
        } else {
            archive.parts.clear();
        }
        manifest.archive = Some(archive.clone());
        return Ok((manifest, archive));
    }

    Err("В API нет опубликованной сборки".to_string())
}

pub fn download_file(
    url: &str,
    dest: &Path,
    token: Option<&str>,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<(), String> {
    if cancel.load(Ordering::Relaxed) {
        return Err("Операция отменена".to_string());
    }
    let mut req = download_client().get(url);
    for (k, v) in auth_headers(token) {
        req = req.header(k, v);
    }
    let mut res: Response = req
        .send()
        .map_err(|e| format!("Ошибка скачивания: {}", format_error(e)))?;
    let status = res.status();
    if !status.is_success() {
        return Err(format!(
            "Ошибка скачивания {} ({status})",
            dest.file_name().and_then(|n| n.to_str()).unwrap_or("файла")
        ));
    }
    let total = res.content_length().unwrap_or(0);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Не удалось создать папку: {e}"))?;
    }
    let part = dest.with_extension(format!(
        "{}tm-part",
        dest.extension()
            .and_then(|e| e.to_str())
            .map(|e| format!("{e}."))
            .unwrap_or_default()
    ));
    let result = (|| -> Result<(), String> {
        let mut file = File::create(&part)
            .map_err(|e| format!("Не удалось создать {}: {e}", part.display()))?;
        let mut buf = [0u8; 64 * 1024];
        let mut done = 0u64;
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err("Операция отменена".to_string());
            }
            let n = res
                .read(&mut buf)
                .map_err(|e| format!("Ошибка чтения ответа: {e}"))?;
            if n == 0 {
                break;
            }
            file.write_all(&buf[..n])
                .map_err(|e| format!("Ошибка записи файла: {e}"))?;
            done += n as u64;
            on_progress(done, total.max(done));
        }
        file.flush()
            .map_err(|e| format!("Ошибка записи файла: {e}"))?;
        Ok(())
    })();
    if let Err(err) = result {
        let _ = fs::remove_file(&part);
        return Err(err);
    }
    fs::rename(&part, dest).map_err(|e| format!("Не удалось переименовать файл: {e}"))?;
    Ok(())
}

/// Инкрементальный синк сборки по манифесту: качаем изменённое, удаляем лишнее.
fn extract_archive(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Не удалось открыть архив: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Не удалось прочитать архив: {e}"))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("Ошибка файла архива: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let Some(relative) = entry.enclosed_name() else {
            continue;
        };
        let relative = relative.to_string_lossy().replace('\\', "/");
        let Some(out) = safe_join(dest, &relative) else {
            continue;
        };
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Не удалось создать папку: {e}"))?;
        }
        let mut target =
            fs::File::create(&out).map_err(|e| format!("Не удалось создать файл: {e}"))?;
        std::io::copy(&mut entry, &mut target)
            .map_err(|e| format!("Не удалось распаковать файл: {e}"))?;
    }
    Ok(())
}

fn sync_build_archive(
    mode: &Mode,
    settings: &Settings,
    game_dir: &Path,
    manifest: &Manifest,
    archive: &ArchiveMeta,
    branch: &str,
    local_path: &Path,
    local: &Manifest,
    cancel: &AtomicBool,
    on_event: &mut dyn FnMut(GameEvent),
) -> Result<(), String> {
    let same = local.version == manifest.version
        && local
            .archive
            .as_ref()
            .and_then(|item| item.sha256.as_deref())
            == archive.sha256.as_deref()
        && local.files.len() == manifest.files.len();
    if same {
        on_event(GameEvent::Status("Режим готов".into()));
        return Ok(());
    }

    let mut to_delete: Vec<String> = local
        .files
        .keys()
        .filter(|rel| !manifest.files.contains_key(*rel))
        .cloned()
        .collect();
    to_delete.sort();
    if !to_delete.is_empty() {
        on_event(GameEvent::Status("Установка режима".into()));
        for rel in &to_delete {
            if let Some(path) = safe_join(game_dir, rel) {
                let _ = fs::remove_file(path);
            }
        }
        crate::util::prune_empty_dirs(game_dir);
    }

    on_event(GameEvent::Status("Установка режима".into()));
    let parts = if archive.parts.is_empty() {
        vec![ArchivePart {
            path: archive.path.clone(),
            size: archive.size,
            sha256: archive.sha256.clone(),
            url: archive.url.clone(),
        }]
    } else {
        archive.parts.clone()
    };
    let total_bytes = parts
        .iter()
        .map(|part| part.size)
        .sum::<u64>()
        .max(archive.size)
        .max(1);
    let temp = std::env::temp_dir().join(format!("lavunio-{}-{}.zip", mode.id, std::process::id()));
    let mut combined =
        fs::File::create(&temp).map_err(|e| format!("Не удалось создать файл: {e}"))?;
    let mut offset = 0u64;
    for (index, part) in parts.iter().enumerate() {
        let part_path = std::env::temp_dir().join(format!(
            "lavunio-{}-{}.part{}",
            mode.id,
            std::process::id(),
            index + 1
        ));
        let url = if let Some(url) = part.url.as_deref().filter(|url| !url.is_empty()) {
            url.to_string()
        } else {
            raw_url(
                &settings.github_repo,
                branch,
                &["modes", &mode.id, &part.path],
            )?
        };
        let token = if url.starts_with("https://raw.githubusercontent.com/")
            || url.starts_with("https://api.github.com/")
        {
            Some(settings.github_token.as_str())
        } else {
            None
        };
        let mut last_emit = 0u64;
        let download = download_file(&url, &part_path, token, cancel, |done, _| {
            if done == part.size || done.saturating_sub(last_emit) >= 256 * 1024 {
                last_emit = done;
                on_event(GameEvent::Progress {
                    task: offset.saturating_add(done),
                    total: total_bytes,
                });
            }
        });
        if let Err(err) = download {
            let _ = fs::remove_file(&part_path);
            let _ = fs::remove_file(&temp);
            return Err(err);
        }
        let mut downloaded = fs::File::open(&part_path)
            .map_err(|e| format!("Не удалось открыть часть архива: {e}"))?;
        std::io::copy(&mut downloaded, &mut combined)
            .map_err(|e| format!("Не удалось собрать архив: {e}"))?;
        offset = offset.saturating_add(
            fs::metadata(&part_path)
                .map(|meta| meta.len())
                .unwrap_or(part.size),
        );
        let _ = fs::remove_file(&part_path);
        on_event(GameEvent::Progress {
            task: offset,
            total: total_bytes,
        });
    }
    drop(combined);

    if let Some(expected) = archive.sha256.as_deref().filter(|hash| !hash.is_empty()) {
        let actual = sha256_file(&temp)?;
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = fs::remove_file(&temp);
            return Err("Файлы режима повреждены".to_string());
        }
    }

    on_event(GameEvent::Status("Распаковка файлов".into()));
    let extracted = extract_archive(&temp, game_dir);
    let _ = fs::remove_file(&temp);
    extracted?;
    write_json(local_path, manifest)?;
    Ok(())
}

fn fetch_github_build(
    mode: &Mode,
    settings: &Settings,
) -> Result<(Manifest, ArchiveMeta, String), String> {
    let mut manifest = fetch_manifest(
        &settings.github_repo,
        Some(&settings.github_token),
        &mode.id,
        &mode.title,
    )?;
    if manifest.version.is_empty() {
        manifest.version = mode.version.clone();
    }
    let branch = if manifest.branch.is_empty() {
        "main".to_string()
    } else {
        manifest.branch.clone()
    };
    let Some(archive) = manifest.archive.clone() else {
        return Err(
            "Этот режим использует старый формат. Перепубликуйте его в Lavunio Publisher."
                .to_string(),
        );
    };
    Ok((manifest, archive, branch))
}

pub fn sync_build(
    mode: &Mode,
    settings: &Settings,
    game_dir: &Path,
    cancel: &AtomicBool,
    on_event: &mut dyn FnMut(GameEvent),
) -> Result<(), String> {
    on_event(GameEvent::Status("Проверка режима".into()));

    let manifest;
    let archive;
    let mut branch = String::new();
    if let Some(api_base) = api_base_url() {
        match fetch_api_build(&api_base, &mode.id) {
            Ok((api_manifest, api_archive)) => {
                crate::logging::log(format!(
                    "build: api mode={} version={}",
                    mode.id, api_manifest.version
                ));
                manifest = api_manifest;
                archive = api_archive;
            }
            Err(err) => {
                crate::logging::error("api build", &err);
                let (github_manifest, github_archive, github_branch) =
                    fetch_github_build(mode, settings)?;
                manifest = github_manifest;
                archive = github_archive;
                branch = github_branch;
            }
        }
    } else {
        let (github_manifest, github_archive, github_branch) = fetch_github_build(mode, settings)?;
        manifest = github_manifest;
        archive = github_archive;
        branch = github_branch;
    }

    let local_path = game_dir.join(".manifest.json");
    let local: Manifest = crate::util::read_json(&local_path).unwrap_or_default();
    sync_build_archive(
        mode,
        settings,
        game_dir,
        &manifest,
        &archive,
        &branch,
        &local_path,
        &local,
        cancel,
        on_event,
    )
}
