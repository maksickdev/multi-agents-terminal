use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
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
}

impl AppState {
    pub fn new(config_path: PathBuf) -> Self {
        let scrollback_dir = config_path.join("scrollback");
        Self {
            pty_manager: Arc::new(Mutex::new(PtyManager::new())),
            scrollback_dir,
            config_path,
        }
    }
}
