use portable_pty::{Child, MasterPty};
use std::io::Write;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;

pub const STATUS_ACTIVE: u8 = 0;
pub const STATUS_WAITING: u8 = 1;
pub const STATUS_EXITED: u8 = 2;

pub struct AgentSession {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn Child + Send + Sync>,
    pub status: Arc<AtomicU8>,
    pub project_id: String,
    pub cwd: String,
}

impl AgentSession {
    pub fn new(
        master: Box<dyn MasterPty + Send>,
        writer: Box<dyn Write + Send>,
        child: Box<dyn Child + Send + Sync>,
        project_id: String,
        cwd: String,
    ) -> Self {
        Self {
            master,
            writer,
            child,
            status: Arc::new(AtomicU8::new(STATUS_ACTIVE)),
            project_id,
            cwd,
        }
    }

    pub fn get_status_u8(&self) -> u8 {
        self.status.load(Ordering::Relaxed)
    }
}
