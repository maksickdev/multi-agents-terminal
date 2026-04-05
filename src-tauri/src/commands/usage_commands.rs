use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Parsed Claude Code usage data.
#[derive(Debug, Serialize, Clone)]
pub struct UsageData {
    pub session_pct: Option<u32>,
    pub week_all_pct: Option<u32>,
    pub week_sonnet_pct: Option<u32>,
    pub extra_pct: Option<u32>,
}

/// Strip ANSI/VT escape sequences from a string.
/// Operates on Unicode chars to correctly handle multi-byte UTF-8 (box-drawing, etc.).
fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            match chars.peek().copied() {
                Some('[') => {
                    chars.next(); // consume '['
                    // CSI — skip until ASCII final byte (0x40–0x7e)
                    for nc in chars.by_ref() {
                        if ('\x40'..='\x7e').contains(&nc) {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next(); // consume ']'
                    // OSC — skip until BEL or ESC '\'
                    while let Some(nc) = chars.next() {
                        if nc == '\x07' {
                            break;
                        }
                        if nc == '\x1b' {
                            if chars.peek() == Some(&'\\') {
                                chars.next();
                            }
                            break;
                        }
                    }
                }
                _ => {
                    chars.next(); // two-char sequence — skip one
                }
            }
        } else if c != '\r' {
            out.push(c);
        }
    }
    out
}

/// Extract the first `NN%` pattern from `text` (up to `window` chars after start).
fn pct_after(text: &str, byte_start: usize, window_chars: usize) -> Option<u32> {
    let slice: String = text[byte_start..].chars().take(window_chars).collect();
    let mut num_start: Option<usize> = None;
    let chars: Vec<char> = slice.chars().collect();
    for i in 0..chars.len() {
        if chars[i].is_ascii_digit() {
            if num_start.is_none() {
                num_start = Some(i);
            }
        } else if chars[i] == '%' {
            if let Some(start) = num_start {
                let n: String = chars[start..i].iter().collect();
                if let Ok(n) = n.parse::<u32>() {
                    if n <= 200 {
                        return Some(n);
                    }
                }
            }
            num_start = None;
        } else {
            num_start = None;
        }
    }
    None
}

fn parse_usage(text: &str) -> UsageData {
    // TUI uses cursor positioning — rows may end up on one "line" in the stripped text.
    // Join all lines into a single flat string so keyword searches span line breaks.
    let flat: String = text.lines().collect::<Vec<_>>().join(" ");
    let lower = flat.to_lowercase();

    let mut data = UsageData {
        session_pct: None,
        week_all_pct: None,
        week_sonnet_pct: None,
        extra_pct: None,
    };

    // Current session
    if let Some(pos) = lower.find("current session") {
        data.session_pct = pct_after(&lower, pos, 300);
    }

    // Current week — find all occurrences, classify by "sonnet" within next 60 chars
    let mut search = 0;
    while let Some(rel) = lower[search..].find("current week") {
        let pos = search + rel;
        // peek at next 80 chars to detect "sonnet"
        let peek: String = lower[pos..].chars().take(80).collect();
        if peek.contains("sonnet") {
            if data.week_sonnet_pct.is_none() {
                data.week_sonnet_pct = pct_after(&lower, pos, 400);
            }
        } else if data.week_all_pct.is_none() {
            data.week_all_pct = pct_after(&lower, pos, 400);
        }
        search = pos + "current week".len();
    }

    // Extra usage
    if let Some(pos) = lower.find("extra usage").or_else(|| lower.find("extra ")) {
        data.extra_pct = pct_after(&lower, pos, 300);
    }

    data
}

fn find_claude_bin() -> (String, String) {
    let output = std::process::Command::new("/bin/zsh")
        .args(["-il", "-c", "echo PATH=$PATH && which claude"])
        .output();

    let mut shell_path = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin".to_string();
    let mut claude_bin = String::new();

    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
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
        claude_bin = "claude".to_string();
    }

    (claude_bin, shell_path)
}

#[tauri::command]
pub async fn fetch_usage(cwd: String) -> Result<UsageData, String> {
    let (claude_bin, shell_path) = find_claude_bin();

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows: 40, cols: 160, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let home_dir = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

    // Use project path (already trusted by user), fall back to home
    let work_dir = if !cwd.is_empty() && std::path::Path::new(&cwd).exists() {
        cwd
    } else {
        home_dir.clone()
    };

    let mut cmd = CommandBuilder::new(&claude_bin);
    cmd.arg("/usage");
    cmd.env("TERM", "xterm-256color");
    cmd.env("PATH", &shell_path);
    cmd.env("HOME", &home_dir);
    cmd.cwd(&work_dir);

    let mut child = pair.slave
        .spawn_command(cmd)
        .map_err(|e| format!("failed to spawn claude /usage: {e}"))?;

    drop(pair.slave);

    // Take writer before reader (portable_pty requirement on some platforms)
    let mut writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    // Accumulate output continuously in shared buffer — never wait for EOF
    let raw_data: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));
    let raw_data_clone = Arc::clone(&raw_data);

    tokio::task::spawn_blocking(move || {
        let mut chunk = [0u8; 4096];
        loop {
            match reader.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if let Ok(mut guard) = raw_data_clone.lock() {
                        guard.extend_from_slice(&chunk[..n]);
                    }
                }
            }
        }
    });

    // 1. Accept the workspace-trust prompt (default = Yes, Enter confirms it)
    tokio::time::sleep(Duration::from_millis(800)).await;
    let _ = writer.write_all(b"\n");

    // 2. Wait for the /usage TUI to render
    tokio::time::sleep(Duration::from_millis(2500)).await;

    // 3. Exit the TUI gracefully ('q', then ESC as fallback)
    let _ = writer.write_all(b"q");
    tokio::time::sleep(Duration::from_millis(300)).await;
    let _ = writer.write_all(b"\x1b");

    tokio::time::sleep(Duration::from_millis(300)).await;

    // Force kill if still alive
    let _ = child.kill();
    let _ = child.wait();

    // Give reader task a moment to process the EIO from kill
    tokio::time::sleep(Duration::from_millis(150)).await;

    let bytes = raw_data.lock().map_err(|e| e.to_string())?.clone();
    let raw_str = String::from_utf8_lossy(&bytes).into_owned();
    let stripped = strip_ansi(&raw_str);

    let preview: String = stripped.chars().take(1000).collect();
    eprintln!("[usage] raw bytes: {}, stripped chars: {}", bytes.len(), stripped.len());
    eprintln!("[usage] stripped:\n{}", preview);

    let data = parse_usage(&stripped);
    Ok(data)
}
