use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const MAX_ARCHIVE_BYTES: u64 = 500 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_FILES: usize = 50_000;

#[derive(Debug, Clone)]
struct ScanFile {
    path: String,
    size: u64,
    sha256: String,
}

#[derive(Debug)]
pub struct BuildPackage {
    pub path: PathBuf,
    pub size: u64,
    pub sha256: String,
    pub files: u64,
    pub bytes: u64,
    pub manifest: Value,
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|e| format!("Не удалось открыть {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("Не удалось прочитать {}: {e}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn valid_rel_path(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    let path = Path::new(value);
    !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn skipped_dir(name: &str) -> bool {
    matches!(name, ".git" | "__MACOSX" | ".idea" | "node_modules")
}

fn skipped_file(name: &str) -> bool {
    matches!(
        name,
        ".DS_Store" | "Thumbs.db" | "desktop.ini" | "manifest.json"
    ) || name.ends_with(".tmp")
        || name.ends_with(".log")
}

fn scan_folder(root: &Path) -> Result<Vec<ScanFile>, String> {
    if !root.is_dir() {
        return Err("Папка сборки не найдена".to_string());
    }
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    let mut total_bytes = 0u64;

    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir)
            .map_err(|e| format!("Не удалось прочитать папку {}: {e}", dir.display()))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Ошибка чтения папки: {e}"))?;
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Не удалось определить тип файла: {e}"))?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if file_type.is_dir() {
                if !skipped_dir(&name) {
                    stack.push(path);
                }
                continue;
            }
            if !file_type.is_file() || skipped_file(&name) {
                continue;
            }

            let relative = path
                .strip_prefix(root)
                .map_err(|_| "Некорректный путь файла".to_string())?;
            let relative = relative
                .components()
                .map(|component| component.as_os_str().to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join("/");
            if !valid_rel_path(&relative) {
                continue;
            }

            let size = entry
                .metadata()
                .map_err(|e| format!("Не удалось прочитать {relative}: {e}"))?
                .len();
            total_bytes = total_bytes.saturating_add(size);
            if total_bytes > MAX_UNCOMPRESSED_BYTES {
                return Err("Сборка слишком большая: больше 2 ГБ".to_string());
            }
            if files.len() >= MAX_FILES {
                return Err(format!("В сборке больше {MAX_FILES} файлов"));
            }

            files.push(ScanFile {
                path: relative,
                size,
                sha256: sha256_file(&path)?,
            });
        }
    }

    files.sort_by(|a, b| a.path.cmp(&b.path));
    if files.is_empty() {
        return Err("В сборке нет файлов".to_string());
    }
    Ok(files)
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = File::open(zip_path)
        .map_err(|e| format!("Не удалось открыть архив {}: {e}", zip_path.display()))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Некорректный ZIP-архив: {e}"))?;
    let mut total = 0u64;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("Ошибка чтения архива: {e}"))?;
        let Some(relative) = entry.enclosed_name() else {
            continue;
        };
        if relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        }) {
            continue;
        }
        let out_path = dest.join(&relative);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| format!("Не удалось создать папку: {e}"))?;
            continue;
        }
        total = total.saturating_add(entry.size());
        if total > MAX_UNCOMPRESSED_BYTES {
            return Err("Архив распаковывается больше чем на 2 ГБ".to_string());
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Не удалось создать папку: {e}"))?;
        }
        let mut out_file =
            File::create(&out_path).map_err(|e| format!("Не удалось создать файл: {e}"))?;
        std::io::copy(&mut entry, &mut out_file)
            .map_err(|e| format!("Ошибка распаковки архива: {e}"))?;
    }
    Ok(())
}

fn build_zip(root: &Path, files: &[ScanFile], dest: &Path) -> Result<(), String> {
    let file = File::create(dest).map_err(|e| format!("Не удалось создать архив: {e}"))?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    for entry in files {
        let source = root.join(&entry.path);
        let mut input = File::open(&source)
            .map_err(|e| format!("Не удалось открыть {}: {e}", source.display()))?;
        writer
            .start_file(entry.path.replace('\\', "/"), options)
            .map_err(|e| format!("Не удалось добавить файл в архив: {e}"))?;
        std::io::copy(&mut input, &mut writer)
            .map_err(|e| format!("Не удалось записать архив: {e}"))?;
    }

    writer
        .finish()
        .map_err(|e| format!("Не удалось завершить архив: {e}"))?;
    Ok(())
}

pub fn build_package(source: &Path, mode_id: &str, version: &str) -> Result<BuildPackage, String> {
    if !source.exists() {
        return Err("Файл или папка сборки не найдены".to_string());
    }

    let work_dir = std::env::temp_dir().join(format!(
        "lavunio-publish-{}-{}",
        std::process::id(),
        Uuid::new_v4().simple()
    ));
    fs::create_dir_all(&work_dir)
        .map_err(|e| format!("Не удалось создать временную папку: {e}"))?;

    let result = (|| {
        let root = if source.is_dir() {
            source.to_path_buf()
        } else {
            let is_zip = source
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.eq_ignore_ascii_case("zip"))
                .unwrap_or(false);
            if !is_zip {
                return Err("Выбери папку или ZIP-архив".to_string());
            }
            let extracted = work_dir.join("extracted");
            fs::create_dir_all(&extracted)
                .map_err(|e| format!("Не удалось создать папку распаковки: {e}"))?;
            extract_zip(source, &extracted)?;
            extracted
        };

        let files = scan_folder(&root)?;
        let total_bytes = files.iter().map(|file| file.size).sum::<u64>();
        let zip_path = work_dir.join("build.zip");
        build_zip(&root, &files, &zip_path)?;

        let size = fs::metadata(&zip_path)
            .map_err(|e| format!("Не удалось прочитать архив: {e}"))?
            .len();
        if size > MAX_ARCHIVE_BYTES {
            return Err(format!(
                "Архив получился больше 500 МБ ({}). Уменьши сборку.",
                human_size(size)
            ));
        }
        let sha256 = sha256_file(&zip_path)?;
        let files_count = files.len() as u64;

        let mut file_map = serde_json::Map::new();
        for file in &files {
            file_map.insert(
                file.path.clone(),
                json!({ "sha256": file.sha256, "size": file.size }),
            );
        }
        let manifest = json!({
            "mode": mode_id,
            "version": version,
            "generatedAt": chrono::Utc::now().to_rfc3339(),
            "archive": {
                "path": "build.zip",
                "size": size,
                "sha256": sha256,
                "files": files_count,
                "bytes": total_bytes,
                "parts": []
            },
            "files": file_map
        });

        Ok(BuildPackage {
            path: zip_path,
            size,
            sha256,
            files: files_count,
            bytes: total_bytes,
            manifest,
        })
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&work_dir);
    }
    result
}

pub fn cleanup_package(package: &BuildPackage) {
    let _ = fs::remove_file(&package.path);
    if let Some(parent) = package.path.parent() {
        let _ = fs::remove_dir_all(parent);
    }
}

pub fn human_size(bytes: u64) -> String {
    let mb = bytes as f64 / 1024.0 / 1024.0;
    if mb >= 10.0 {
        format!("{mb:.0} МБ")
    } else if mb >= 1.0 {
        format!("{mb:.1} МБ")
    } else {
        format!("{:.0} КБ", bytes as f64 / 1024.0)
    }
}
