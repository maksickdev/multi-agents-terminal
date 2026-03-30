use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::pty::reader::spawn_reader;
use crate::pty::session::{AgentSession, STATUS_ACTIVE, STATUS_EXITED, STATUS_WAITING};
use crate::state::app_state::{AgentMeta, AgentStatus, AppState};

/// Find claude's absolute path and the user's shell PATH by running `zsh -il`.
fn find_claude_env() -> (String, String) {
    let output = std::process::Command::new("/bin/zsh")
        .args(["-il", "-c", "echo PATH=$PATH && which claude"])
        .output();

    let mut shell_path = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin".to_string();
    let mut claude_bin = String::new();

    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        eprintln!("[claude_env] zsh output: {}", stdout.trim());

        for line in stdout.lines() {
            if line.starts_with("PATH=") {
                shell_path = line[5..].to_string();
            } else if !line.is_empty() && !line.contains('=') {
                let candidate = line.trim().to_string();
                if std::path::Path::new(&candidate).exists() {
                    claude_bin = candidate;
                }
            }
        }
    }

    if claude_bin.is_empty() {
        let home = std::env::var("HOME").unwrap_or_default();
        let candidates = [
            format!("{}/.local/bin/claude", home),
            format!("{}/.npm-global/bin/claude", home),
            format!("{}/Library/pnpm/claude", home),
            "/opt/homebrew/bin/claude".to_string(),
            "/usr/local/bin/claude".to_string(),
        ];
        for p in &candidates {
            if std::path::Path::new(p).exists() {
                claude_bin = p.clone();
                break;
            }
        }
    }

    if claude_bin.is_empty() {
        eprintln!("[claude_env] WARNING: claude not found, falling back to 'claude'");
        claude_bin = "claude".to_string();
    } else {
        eprintln!("[claude_env] using claude at: {}", claude_bin);
    }

    (claude_bin, shell_path)
}

fn make_shell_pty_pair(
    cwd: &str,
    rows: u16,
    cols: u16,
) -> Result<
    (
        Box<dyn portable_pty::MasterPty + Send>,
        Box<dyn std::io::Write + Send>,
        Box<dyn portable_pty::Child + Send + Sync>,
        Box<dyn std::io::Read + Send>,
    ),
    String,
> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let (_, shell_path) = find_claude_env();

    // Fall back to HOME if cwd is empty or does not exist
    let cwd = if cwd.is_empty() || !std::path::Path::new(cwd).exists() {
        std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
    } else {
        cwd.to_string()
    };

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("openpty error: {e}"))?;

    // Inherit locale so zsh ZLE handles multi-byte UTF-8 (Cyrillic etc.) correctly.
    let lang = std::env::var("LANG").unwrap_or_else(|_| "en_US.UTF-8".to_string());
    let lc_all = std::env::var("LC_ALL").unwrap_or_else(|_| lang.clone());

    let mut cmd = CommandBuilder::new(&shell);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("PATH", &shell_path);
    cmd.env("LANG", &lang);
    cmd.env("LC_ALL", &lc_all);
    cmd.env("LC_CTYPE", &lc_all);
    cmd.cwd(&cwd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn error: {e}"))?;
    let reader = pair.master.try_clone_reader().map_err(|e| format!("clone_reader error: {e}"))?;
    let writer = pair.master.take_writer().map_err(|e| format!("take_writer error: {e}"))?;
    Ok((pair.master, writer, child, reader))
}

fn make_pty_pair_and_spawn(
    cwd: &str,
    rows: u16,
    cols: u16,
) -> Result<
    (
        Box<dyn portable_pty::MasterPty + Send>,
        Box<dyn std::io::Write + Send>,
        Box<dyn portable_pty::Child + Send + Sync>,
        Box<dyn std::io::Read + Send>,
    ),
    String,
> {
    eprintln!("[spawn] opening PTY, cwd={}", cwd);

    let (claude_bin, shell_path) = find_claude_env();

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("openpty error: {e}"))?;

    let mut cmd = CommandBuilder::new(&claude_bin);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("PATH", &shell_path);
    cmd.cwd(cwd);

    eprintln!("[spawn] spawning {} in {}", claude_bin, cwd);
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("spawn error: {e}"))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("clone_reader error: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("take_writer error: {e}"))?;

    eprintln!("[spawn] agent spawned successfully");
    Ok((pair.master, writer, child, reader))
}

#[tauri::command]
pub async fn spawn_agent(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    cwd: String,
    rows: Option<u16>,
    cols: Option<u16>,
    agent_id: Option<String>,
) -> Result<String, String> {
    let agent_id = agent_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);
    eprintln!("[spawn_agent] agent_id={} cwd={} size={}x{}", agent_id, cwd, cols, rows);

    std::fs::create_dir_all(&state.scrollback_dir)
        .map_err(|e| format!("create scrollback dir: {e}"))?;
    let scrollback_path = state.scrollback_dir.join(format!("{}.bin", agent_id));

    let (master, writer, child, reader) = make_pty_pair_and_spawn(&cwd, rows, cols)?;
    let session = AgentSession::new(master, writer, child, project_id, cwd);
    let status = session.status.clone();

    {
        let mut manager = state.pty_manager.lock().await;
        manager.insert(agent_id.clone(), session);
    }

    spawn_reader(app, agent_id.clone(), reader, status, scrollback_path);
    Ok(agent_id)
}

#[tauri::command]
pub async fn write_to_agent(
    state: State<'_, AppState>,
    agent_id: String,
    data: String,
) -> Result<(), String> {
    let bytes = B64.decode(&data).map_err(|e| e.to_string())?;
    let mut manager = state.pty_manager.lock().await;
    manager.write(&agent_id, &bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resize_agent(
    state: State<'_, AppState>,
    agent_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().await;
    manager
        .resize(&agent_id, rows, cols)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_agent(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<(), String> {
    {
        let mut manager = state.pty_manager.lock().await;
        manager.kill(&agent_id).map_err(|e| e.to_string())?;
    }
    // Remove scrollback on explicit kill (agent is gone for good)
    let sb = state.scrollback_dir.join(format!("{}.bin", agent_id));
    if sb.exists() {
        let _ = std::fs::remove_file(&sb);
    }
    Ok(())
}

#[tauri::command]
pub async fn restart_agent(
    app: AppHandle,
    state: State<'_, AppState>,
    agent_id: String,
    cwd: String,
    project_id: String,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    {
        let mut manager = state.pty_manager.lock().await;
        let _ = manager.kill(&agent_id);
    }

    // Clear old scrollback so the restarted session starts fresh
    let sb = state.scrollback_dir.join(format!("{}.bin", agent_id));
    if sb.exists() {
        let _ = std::fs::remove_file(&sb);
    }

    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);

    std::fs::create_dir_all(&state.scrollback_dir)
        .map_err(|e| format!("create scrollback dir: {e}"))?;
    let scrollback_path = state.scrollback_dir.join(format!("{}.bin", agent_id));

    let (master, writer, child, reader) = make_pty_pair_and_spawn(&cwd, rows, cols)?;
    let session = AgentSession::new(master, writer, child, project_id, cwd);
    let status = session.status.clone();

    {
        let mut manager = state.pty_manager.lock().await;
        manager.insert(agent_id.clone(), session);
    }

    spawn_reader(app, agent_id, reader, status, scrollback_path);
    Ok(())
}

#[tauri::command]
pub async fn get_agent_status(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<AgentStatus, String> {
    let manager = state.pty_manager.lock().await;
    match manager.get_status_u8(&agent_id) {
        Some(STATUS_ACTIVE) => Ok(AgentStatus::Active),
        Some(STATUS_WAITING) => Ok(AgentStatus::Waiting),
        Some(STATUS_EXITED) | None => Ok(AgentStatus::Exited),
        Some(_) => Ok(AgentStatus::Exited),
    }
}

// ─── Session persistence commands ────────────────────────────────────────────

#[tauri::command]
pub async fn load_agents(state: State<'_, AppState>) -> Result<Vec<AgentMeta>, String> {
    let path = state.config_path.join("agents.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_agents(
    state: State<'_, AppState>,
    agents: Vec<AgentMeta>,
) -> Result<(), String> {
    let dir = &state.config_path;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(&agents).map_err(|e| e.to_string())?;
    let tmp = dir.join("agents.json.tmp");
    std::fs::write(&tmp, &content).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, dir.join("agents.json")).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn spawn_shell(
    app: AppHandle,
    state: State<'_, AppState>,
    cwd: String,
    rows: Option<u16>,
    cols: Option<u16>,
    agent_id: Option<String>,
) -> Result<String, String> {
    let agent_id = agent_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);
    eprintln!("[spawn_shell] agent_id={} cwd={} size={}x{}", agent_id, cwd, cols, rows);

    std::fs::create_dir_all(&state.scrollback_dir)
        .map_err(|e| format!("create scrollback dir: {e}"))?;
    let scrollback_path = state.scrollback_dir.join(format!("{}.bin", agent_id));

    let (master, writer, child, reader) = make_shell_pty_pair(&cwd, rows, cols)?;
    let session = AgentSession::new(master, writer, child, "shell".to_string(), cwd);
    let status = session.status.clone();

    {
        let mut manager = state.pty_manager.lock().await;
        manager.insert(agent_id.clone(), session);
    }

    spawn_reader(app, agent_id.clone(), reader, status, scrollback_path);
    Ok(agent_id)
}

/// Returns base64-encoded raw PTY bytes saved for this agent.
/// Returns empty string if no scrollback exists.
#[tauri::command]
pub async fn load_scrollback(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<String, String> {
    let path = state.scrollback_dir.join(format!("{}.bin", agent_id));
    if !path.exists() {
        return Ok(String::new());
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(B64.encode(&bytes))
}

/// Deletes the scrollback file for an agent (called when user removes an agent).
#[tauri::command]
pub async fn delete_scrollback(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<(), String> {
    let path = state.scrollback_dir.join(format!("{}.bin", agent_id));
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
