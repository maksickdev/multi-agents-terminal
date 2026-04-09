use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tokio::sync::Mutex;

use crate::pty::manager::PtyManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
}

/// Persisted metadata for a single agent (saved to agents.json).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMeta {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub cwd: String,
    pub created_at: u64,
    /// Claude session ID (from `/status` output) — used to resume via `claude <id>`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Active,
    Waiting,
    Exited,
}

#[derive(Clone, Serialize)]
pub struct PtyOutputPayload {
    pub agent_id: String,
    pub data: String, // base64-encoded
}

#[derive(Clone, Serialize)]
pub struct AgentExitedPayload {
    pub agent_id: String,
    pub exit_code: Option<i32>,
}

#[derive(Clone, Serialize)]
pub struct AgentStatusPayload {
    pub agent_id: String,
    pub status: AgentStatus,
}

pub struct AppState {
    pub pty_manager: Arc<Mutex<PtyManager>>,
    pub config_path: PathBuf,
    pub scrollback_dir: PathBuf,
    /// Set to true by `exit_app` so that the CloseRequested / ExitRequested
    /// handlers know the exit was initiated by us (not by the OS), and should
    /// not be prevented.
    pub confirmed_exit: Arc<AtomicBool>,
    /// Snapshots of existing Claude session files (.jsonl names) taken just
    /// before each agent is spawned.  Used to identify which new session file
    /// belongs to a specific agent when multiple agents share the same cwd.
    /// agent_id → set of .jsonl file-stems that existed BEFORE this agent spawned.
    pub session_snapshots: Arc<Mutex<HashMap<String, HashSet<String>>>>,
}

impl AppState {
    pub fn new(config_path: PathBuf) -> Self {
        let scrollback_dir = config_path.join("scrollback");
        Self {
            pty_manager: Arc::new(Mutex::new(PtyManager::new())),
            scrollback_dir,
            config_path,
            confirmed_exit: Arc::new(AtomicBool::new(false)),
            session_snapshots: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
