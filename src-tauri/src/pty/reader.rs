use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use tauri::{AppHandle, Emitter};

use crate::state::app_state::{AgentExitedPayload, AgentStatusPayload, PtyOutputPayload};
use crate::pty::session::{STATUS_ACTIVE, STATUS_EXITED, STATUS_WAITING};

pub fn spawn_reader(
    app: AppHandle,
    agent_id: String,
    mut reader: Box<dyn Read + Send>,
    status: Arc<AtomicU8>,
    scrollback_path: PathBuf,
) {
    tokio::task::spawn_blocking(move || {
        let mut buf = [0u8; 4096];
        let mut last_output = Instant::now();

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
                    last_output = Instant::now();

                    // Persist to scrollback file
                    if let Some(ref mut f) = sb_file {
                        let _ = f.write_all(&buf[..n]);
                    }

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

            // Emit "waiting" if no output for >2s
            if last_output.elapsed() > Duration::from_secs(2)
                && status.load(Ordering::Relaxed) == STATUS_ACTIVE
            {
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
