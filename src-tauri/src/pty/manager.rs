use std::collections::HashMap;
use std::io::Write;

use anyhow::Result;
use portable_pty::PtySize;

use super::session::AgentSession;

pub struct PtyManager {
    sessions: HashMap<String, AgentSession>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn insert(&mut self, agent_id: String, session: AgentSession) {
        self.sessions.insert(agent_id, session);
    }

    pub fn remove(&mut self, agent_id: &str) -> Option<AgentSession> {
        self.sessions.remove(agent_id)
    }

    pub fn write(&mut self, agent_id: &str, data: &[u8]) -> Result<()> {
        let session = self
            .sessions
            .get_mut(agent_id)
            .ok_or_else(|| anyhow::anyhow!("Agent not found: {}", agent_id))?;
        session.writer.write_all(data)?;
        session.writer.flush()?;
        Ok(())
    }

    pub fn resize(&mut self, agent_id: &str, rows: u16, cols: u16) -> Result<()> {
        let session = self
            .sessions
            .get_mut(agent_id)
            .ok_or_else(|| anyhow::anyhow!("Agent not found: {}", agent_id))?;
        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }

    pub fn kill(&mut self, agent_id: &str) -> Result<()> {
        if let Some(session) = self.sessions.get_mut(agent_id) {
            let _ = session.child.kill();
        }
        self.sessions.remove(agent_id);
        Ok(())
    }

    pub fn get_status_u8(&self, agent_id: &str) -> Option<u8> {
        self.sessions.get(agent_id).map(|s| s.get_status_u8())
    }
}
