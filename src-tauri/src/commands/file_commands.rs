use std::path::Path;
use anyhow::Result;

#[derive(serde::Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

/// List a single directory level. Directories are returned first (sorted),
/// then files (sorted). Hidden entries (starting with `.`) are included.
#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    let mut entries = std::fs::read_dir(dir)
        .map_err(|e| format!("read_dir failed: {e}"))?
        .filter_map(|res| res.ok())
        .map(|entry| {
            let p = entry.path();
            let is_dir = p.is_dir();
            FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: p.to_string_lossy().to_string(),
                is_dir,
            }
        })
        .collect::<Vec<_>>();

    // Sort: dirs first, then files; alphabetically within each group (case-insensitive)
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn read_file_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read_file_text failed: {e}"))
}

#[tauri::command]
pub fn write_file_text(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("write_file_text failed: {e}"))
}

/// Delete a file or a directory (recursively).
#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| format!("remove_dir_all failed: {e}"))
    } else {
        std::fs::remove_file(p).map_err(|e| format!("remove_file failed: {e}"))
    }
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    // Create parent dirs if needed, then create the file
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create parent dirs failed: {e}"))?;
    }
    std::fs::File::create(&path).map_err(|e| format!("create_file failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn create_dir_all(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("create_dir_all failed: {e}"))
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| format!("rename_path failed: {e}"))
}
