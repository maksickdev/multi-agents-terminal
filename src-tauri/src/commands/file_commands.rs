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
pub fn read_file_bytes_base64(path: String) -> Result<String, String> {
    use std::io::Read;
    let mut file = std::fs::File::open(&path)
        .map_err(|e| format!("read_file_bytes_base64 failed: {e}"))?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)
        .map_err(|e| format!("read_file_bytes_base64 failed: {e}"))?;
    Ok(base64_encode(&buf))
}

fn base64_encode(input: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(CHARS[((n >> 18) & 0x3f) as usize] as char);
        out.push(CHARS[((n >> 12) & 0x3f) as usize] as char);
        out.push(if chunk.len() > 1 { CHARS[((n >> 6) & 0x3f) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[(n & 0x3f) as usize] as char } else { '=' });
    }
    out
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

/// Copy a file or directory (recursively) from `src` to `dst`.
#[tauri::command]
pub fn copy_path(src: String, dst: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    if src_path.is_dir() {
        copy_dir_recursive(src_path, Path::new(&dst))
            .map_err(|e| format!("copy_path failed: {e}"))
    } else {
        std::fs::copy(&src, &dst)
            .map(|_| ())
            .map_err(|e| format!("copy_path failed: {e}"))
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_child = entry.path();
        let dst_child = dst.join(entry.file_name());
        if src_child.is_dir() {
            copy_dir_recursive(&src_child, &dst_child)?;
        } else {
            std::fs::copy(&src_child, &dst_child)?;
        }
    }
    Ok(())
}

/// Returns the Claude session ID for the given working directory by finding the
/// most-recently-modified `.jsonl` file under `~/.claude/projects/<encoded-cwd>/`.
/// Claude Code stores each conversation as `<session-uuid>.jsonl` in that directory.
/// The encoding maps every `/` in the cwd to `-` (e.g. `/Users/foo/bar` → `-Users-foo-bar`).
/// Returns `None` if the directory doesn't exist or has no session files.
#[tauri::command]
pub fn get_latest_session_id(cwd: String) -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let encoded = cwd.replace('/', "-");
    let project_dir = std::path::PathBuf::from(&home)
        .join(".claude")
        .join("projects")
        .join(&encoded);

    if !project_dir.exists() {
        return None;
    }

    let mut files: Vec<(std::time::SystemTime, std::ffi::OsString)> =
        std::fs::read_dir(&project_dir)
            .ok()?
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name();
                let s = name.to_string_lossy();
                s.ends_with(".jsonl") && !s.starts_with('.')
            })
            .filter_map(|e| {
                let mtime = e.metadata().ok()?.modified().ok()?;
                Some((mtime, e.file_name()))
            })
            .collect();

    // Newest file first
    files.sort_by(|a, b| b.0.cmp(&a.0));

    let name = files.first()?.1.to_string_lossy().to_string();
    Some(name.trim_end_matches(".jsonl").to_string())
}

/// Open the containing folder in Finder and select the item (macOS only).
#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| format!("reveal_in_finder failed: {e}"))?;
    Ok(())
}
