use crate::models::{LavunioSession, Mode, ModeState, ModeStates, RemoteCache, Settings};
use crate::secrets;
use crate::util::{now_ms, read_json, write_bytes, write_json};
use std::fs;
use std::path::{Path, PathBuf};

const SESSION_FILE: &str = "lavunio-session.dat";
const LEGACY_SESSION_FILE: &str = "lavunio-session.json";

pub fn app_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Lavunio")
}

/// Переносит настройки и аккаунты из папки старого имени при первом запуске.
fn migrate_legacy_data(new_dir: &Path) {
    if new_dir.join("settings.json").exists() {
        return;
    }
    let Some(base) = dirs::data_dir() else {
        return;
    };
    for old_name in ["TMStore", "TMLauncher", "TM Launcher", "TDEV Launcher"] {
        let old_dir = base.join(old_name);
        if !old_dir.is_dir() {
            continue;
        }
        let has_data = ["settings.json", "accounts.json", "mode-state.json"]
            .iter()
            .any(|name| old_dir.join(name).exists());
        if !has_data {
            continue;
        }
        for name in ["settings.json", "mode-state.json", "remote-modes.json"] {
            let source = old_dir.join(name);
            if !source.is_file() {
                continue;
            }
            let dest = new_dir.join(name);
            if !dest.exists() {
                let _ = fs::copy(&source, &dest);
            }
        }
        break;
    }
}

pub fn default_game_dir() -> PathBuf {
    app_data_dir().join("games")
}

fn load_lavunio_session(dir: &Path) -> LavunioSession {
    let encrypted_path = dir.join(SESSION_FILE);
    if let Ok(bytes) = fs::read(&encrypted_path) {
        if let Ok(plain) = secrets::unprotect(&bytes) {
            if let Ok(session) = serde_json::from_slice::<LavunioSession>(&plain) {
                return session;
            }
        }
    }

    let legacy_path = dir.join(LEGACY_SESSION_FILE);
    if let Some(session) = read_json::<LavunioSession>(&legacy_path) {
        if save_lavunio_session(dir, &session).is_ok() {
            let _ = fs::remove_file(&legacy_path);
        }
        return session;
    }

    LavunioSession::default()
}

fn save_lavunio_session(dir: &Path, session: &LavunioSession) -> Result<(), String> {
    let plain = serde_json::to_vec(session).map_err(|error| error.to_string())?;
    let encrypted = secrets::protect(&plain)?;
    write_bytes(&dir.join(SESSION_FILE), &encrypted)?;
    let _ = fs::remove_file(dir.join(LEGACY_SESSION_FILE));
    Ok(())
}

pub struct Store {
    pub dir: PathBuf,
    pub settings: Settings,
    pub state: ModeStates,
    pub lavunio: LavunioSession,
}

impl Store {
    pub fn new() -> Self {
        let dir = app_data_dir();
        let _ = std::fs::create_dir_all(&dir);
        migrate_legacy_data(&dir);
        let default_dir = default_game_dir().to_string_lossy().to_string();

        let mut settings: Settings = read_json(&dir.join("settings.json"))
            .unwrap_or_else(|| Settings::with_default_dir(&default_dir));
        crate::logging::log(format!(
            "store: dir={} repo={}",
            dir.display(),
            settings.github_repo
        ));
        if settings.dir.trim().is_empty() {
            settings.dir = default_dir.clone();
        }
        settings.remember_install_dir();
        if settings.github_repo.trim().is_empty()
            || settings.github_repo == "tommy-whinston/TMLauncher"
            || settings.github_repo == "tommy-whinston/TMStore"
            || settings.github_repo == "tommy-whinston/TMStore-Catalog"
        {
            settings.github_repo = "tommy-whinston/Lavunio-Catalog".to_string();
        }
        if settings.launcher_width < 980.0 {
            settings.launcher_width = 1200.0;
        }
        if settings.launcher_height < 640.0 {
            settings.launcher_height = 740.0;
        }
        if settings.ram_gb == 0 {
            settings.ram_gb = 4;
        }
        if settings.width == 0 {
            settings.width = 925;
        }
        if settings.height == 0 {
            settings.height = 530;
        }
        let _ = write_json(&dir.join("settings.json"), &settings);

        let mut state: ModeStates = read_json(&dir.join("mode-state.json")).unwrap_or_default();
        let mut migrated = false;
        for mode_state in state.values_mut() {
            if mode_state.library.is_none() {
                mode_state.library = Some(mode_state.installed && !mode_state.hidden);
                migrated = true;
            }
        }
        if migrated {
            let _ = write_json(&dir.join("mode-state.json"), &state);
        }
        let lavunio = load_lavunio_session(&dir);
        Self {
            dir,
            settings,
            state,
            lavunio,
        }
    }

    fn path(&self, name: &str) -> PathBuf {
        self.dir.join(name)
    }

    pub fn save_settings(&self) -> Result<(), String> {
        write_json(&self.path("settings.json"), &self.settings)
    }

    pub fn save_lavunio(&self) -> Result<(), String> {
        save_lavunio_session(&self.dir, &self.lavunio)
    }

    pub fn save_state(&self) -> Result<(), String> {
        write_json(&self.path("mode-state.json"), &self.state)
    }

    pub fn set_mode_installed(
        &mut self,
        mode_id: &str,
        version: &str,
        install_dir: Option<&str>,
    ) -> Result<(), String> {
        let (playtime_secs, last_played_at, sessions) = self
            .state
            .get(mode_id)
            .map(|state| {
                (
                    state.playtime_secs,
                    state.last_played_at,
                    state.sessions.clone(),
                )
            })
            .unwrap_or_default();
        self.state.insert(
            mode_id.to_string(),
            ModeState {
                installed: true,
                version: Some(version.to_string()),
                installed_at: now_ms(),
                hidden: false,
                library: Some(true),
                playtime_secs,
                last_played_at,
                sessions,
                skipped_version: None,
                install_dir: install_dir.map(str::to_string),
            },
        );
        self.save_state()
    }

    pub fn set_mode_library(&mut self, mode_id: &str, library: bool) -> Result<(), String> {
        let state = self
            .state
            .entry(mode_id.to_string())
            .or_insert_with(ModeState::default);
        state.library = Some(library);
        state.hidden = false;
        self.save_state()
    }

    pub fn set_mode_hidden(&mut self, mode_id: &str, hidden: bool) -> Result<(), String> {
        let state = self
            .state
            .entry(mode_id.to_string())
            .or_insert_with(ModeState::default);
        state.hidden = hidden;
        if hidden {
            if state.library.is_none() {
                state.library = Some(state.installed);
            }
        } else {
            state.library = Some(true);
        }
        self.save_state()
    }

    pub fn remote_cache_path(&self) -> PathBuf {
        self.path("remote-modes.json")
    }

    pub fn read_cached_modes(&self) -> Vec<Mode> {
        read_json::<RemoteCache>(&self.remote_cache_path())
            .map(|c| c.modes)
            .unwrap_or_default()
    }

    pub fn cache_modes(&self, modes: &[Mode]) -> Result<(), String> {
        write_json(
            &self.remote_cache_path(),
            &RemoteCache {
                fetched_at: now_ms(),
                modes: modes.to_vec(),
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_plaintext_session_to_encrypted_file() {
        let dir = std::env::temp_dir().join(format!(
            "lavunio-session-test-{}-{}",
            std::process::id(),
            now_ms()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let mut session = LavunioSession::default();
        session.access_token = "access-token".to_string();
        session.refresh_token = "refresh-token".to_string();
        write_json(&dir.join(LEGACY_SESSION_FILE), &session).unwrap();

        let loaded = load_lavunio_session(&dir);
        assert_eq!(loaded.access_token, "access-token");
        assert_eq!(loaded.refresh_token, "refresh-token");
        assert!(dir.join(SESSION_FILE).exists());
        assert!(!dir.join(LEGACY_SESSION_FILE).exists());
        let encrypted = fs::read(dir.join(SESSION_FILE)).unwrap();
        assert_ne!(encrypted.first(), Some(&b'{'));

        let loaded_again = load_lavunio_session(&dir);
        assert_eq!(loaded_again.access_token, "access-token");
        let _ = fs::remove_dir_all(&dir);
    }
}
