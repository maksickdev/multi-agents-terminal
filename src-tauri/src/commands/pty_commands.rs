use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::pty::reader::spawn_reader;
use crate::pty::session::{AgentSession, STATUS_ACTIVE, STATUS_EXITED, STATUS_WAITING};
use crate::state::app_state::{AgentStatus, AppState};

/// Find claude's absolute path and the user's shell PATH by running `zsh -il`.
/// Returns (claude_path, shell_path).
fn find_claude_env() -> (String, String) {
    // Run zsh as interactive login to get the real PATH and claude location
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
                // last non-empty non-assignment line = which claude output
                let candidate = line.trim().to_string();
                if std::path::Path::new(&candidate).exists() {
                    claude_bin = candidate;
                }
            }
        }
    }

    if claude_bin.is_empty() {
        // Fallback: scan common install locations
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

    // Spawn claude directly — no shell wrapper, no double session
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
) -> Result<String, String> {
    let agent_id = Uuid::new_v4().to_string();
    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);
    eprintln!("[spawn_agent] agent_id={} cwd={} size={}x{}", agent_id, cwd, cols, rows);

    let (master, writer, child, reader) = make_pty_pair_and_spawn(&cwd, rows, cols)?;
    let session = AgentSession::new(master, writer, child, project_id, cwd);
    let status = session.status.clone();

    {
        let mut manager = state.pty_manager.lock().await;
        manager.insert(agent_id.clone(), session);
    }

    spawn_reader(app, agent_id.clone(), reader, status);
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
    let mut manager = state.pty_manager.lock().await;
    manager.kill(&agent_id).map_err(|e| e.to_string())
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

    let rows = rows.unwrap_or(24);
    let cols = cols.unwrap_or(80);
    let (master, writer, child, reader) = make_pty_pair_and_spawn(&cwd, rows, cols)?;
    let session = AgentSession::new(master, writer, child, project_id, cwd);
    let status = session.status.clone();

    {
        let mut manager = state.pty_manager.lock().await;
        manager.insert(agent_id.clone(), session);
    }

    spawn_reader(app, agent_id, reader, status);
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
