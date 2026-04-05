use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use tauri::{AppHandle, Emitter};

use crate::state::app_state::{AgentExitedPayload, AgentStatusPayload, PtyOutputPayload};
use crate::pty::session::{STATUS_ACTIVE, STATUS_EXITED, STATUS_WAITING};

/// Returns current time as milliseconds since the Unix epoch (fits safely in u64).
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn spawn_reader(
    app: AppHandle,
    agent_id: String,
    mut reader: Box<dyn Read + Send>,
    status: Arc<AtomicU8>,
    scrollback_path: PathBuf,
) {
    // Shared timestamp of the last PTY byte received (ms since epoch).
    // Both the blocking reader task and the async inactivity monitor share this.
    let last_output = Arc::new(AtomicU64::new(now_ms()));

    // ── Inactivity monitor (async task) ──────────────────────────────────────
    // Runs every 500 ms independently of the blocking read loop.
    // This is the ONLY reliable way to detect silence: the blocking read() loop
    // resets last_output right before checking elapsed(), so elapsed ≈ 0 there.
    {
        let last_output = Arc::clone(&last_output);
        let status     = Arc::clone(&status);
        let app        = app.clone();
        let agent_id   = agent_id.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(500));
            loop {
                interval.tick().await;

                match status.load(Ordering::Relaxed) {
                    STATUS_EXITED => break, // process gone — stop monitoring
                    STATUS_WAITING => continue, // already waiting, nothing to do
                    _ => {}
                }

                let elapsed_ms = now_ms().saturating_sub(last_output.load(Ordering::Relaxed));
                if elapsed_ms > 2000 {
                    status.store(STATUS_WAITING, Ordering::Relaxed);
                    let _ = app.emit(
                        "agent-status",
                        AgentStatusPayload {
                            agent_id: agent_id.clone(),
                            status: crate::state::app_state::AgentStatus::Waiting,
                        },
                    );
                }
            }
        });
    }

    // ── Blocking reader task ──────────────────────────────────────────────────
    tokio::task::spawn_blocking(move || {
        let mut buf = [0u8; 4096];

        // Open scrollback file for appending (created if missing)
        let mut sb_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&scrollback_path)
            .map_err(|e| eprintln!("[reader] scrollback open error: {e}"))
            .ok();

        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    status.store(STATUS_EXITED, Ordering::Relaxed);
                    let _ = app.emit(
                        "agent-exited",
                        AgentExitedPayload {
                            agent_id: agent_id.clone(),
                            exit_code: None,
                        },
                    );
                    break;
                }
                Ok(n) => {
                    // Update the shared timestamp — the inactivity monitor reads this.
                    last_output.store(now_ms(), Ordering::Relaxed);

                    // Persist to scrollback file
                    if let Some(ref mut f) = sb_file {
                        let _ = f.write_all(&buf[..n]);
                    }

                    // Transition back to active if we were waiting
                    if status.load(Ordering::Relaxed) != STATUS_ACTIVE {
                        status.store(STATUS_ACTIVE, Ordering::Relaxed);
                        let _ = app.emit(
                            "agent-status",
                            AgentStatusPayload {
                                agent_id: agent_id.clone(),
                                status: crate::state::app_state::AgentStatus::Active,
                            },
                        );
                    }

                    let encoded = B64.encode(&buf[..n]);
                    let _ = app.emit(
                        "pty-output",
                        PtyOutputPayload {
                            agent_id: agent_id.clone(),
                            data: encoded,
                        },
                    );
                }
                Err(_) => {
                    status.store(STATUS_EXITED, Ordering::Relaxed);
                    let _ = app.emit(
                        "agent-exited",
                        AgentExitedPayload {
                            agent_id: agent_id.clone(),
                            exit_code: None,
                        },
                    );
                    break;
                }
            }
        }
    });
}
