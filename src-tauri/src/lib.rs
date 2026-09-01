use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{BufReader, Read},
    path::{Component, Path},
};
use tauri::Manager;

#[tauri::command]
fn sha256_app_local_file(app: tauri::AppHandle, relative_path: String) -> Result<String, String> {
    let relative_path = Path::new(&relative_path);
    let is_unsafe_path = relative_path.is_absolute()
        || relative_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        });

    if is_unsafe_path {
        return Err("アプリデータディレクトリ外のパスは検証できません".to_string());
    }

    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("アプリデータディレクトリの取得に失敗しました: {error}"))?
        .join(relative_path);
    let file = File::open(&path).map_err(|error| {
        format!(
            "SHA-256検証用ファイルを開けませんでした ({}): {error}",
            path.display()
        )
    })?;
    let mut reader = BufReader::with_capacity(8 * 1024 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 8 * 1024 * 1024];

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|error| format!("SHA-256検証中の読み込みに失敗しました: {error}"))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![sha256_app_local_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
