use axum::{body::Bytes, extract::State, http::StatusCode, routing::post, Json, Router};
use serde_json::{json, Value};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::net::TcpListener;

use crate::state::app_state::AgentMeta;

const PORT: u16 = 27123;
const HOST: &str = "127.0.0.1";

#[derive(Clone)]
struct ServerState {
    events_file: PathBuf,
    agents_file: PathBuf,
}

pub async fn start(config_dir: PathBuf) {
    let state = ServerState {
        events_file: config_dir.join("hook-events.jsonl"),
        agents_file: config_dir.join("agents.json"),
    };

    let app = Router::new()
        .route("/hook", post(handle_hook))
        .with_state(state);

    let addr = format!("{HOST}:{PORT}");
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            eprintln!("[hook_server] port {PORT} already in use — another instance running?");
            return;
        }
        Err(e) => {
            eprintln!("[hook_server] bind failed: {e}");
            return;
        }
    };

    println!("[hook_server] listening on http://{addr}");
    axum::serve(listener, app).await.ok();
}

async fn handle_hook(
    State(state): State<ServerState>,
    body: Bytes,
) -> (StatusCode, Json<Value>) {
    let parsed: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "ok": false, "error": "invalid JSON" })),
            )
        }
    };

    let agent_info = if let Some(mat_id) = parsed.get("mat_agent_id").and_then(|v| v.as_str()) {
        resolve_by_id(&state.agents_file, mat_id)
    } else {
        resolve_fallback(&state.agents_file, &parsed)
    };

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut record = parsed;
    record["_received_at"] = json!(ts);
    if let Some((id, name, project_id)) = &agent_info {
        record["agent_id"] = json!(id);
        record["agent_name"] = json!(name);
        record["project_id"] = json!(project_id);
    }

    let line = format!("{}\n", record);
    if let Err(e) = append_line(&state.events_file, &line) {
        eprintln!("[hook_server] write error: {e}");
    }

    (StatusCode::OK, Json(json!({ "ok": true })))
}

fn load_agents(path: &PathBuf) -> Vec<AgentMeta> {
    let Ok(data) = fs::read_to_string(path) else {
        return vec![];
    };
    serde_json::from_str(&data).unwrap_or_default()
}

fn resolve_by_id(agents_file: &PathBuf, id: &str) -> Option<(String, String, String)> {
    load_agents(agents_file)
        .into_iter()
        .find(|a| a.id == id)
        .map(|a| (a.id, a.name, a.project_id))
}

fn resolve_fallback(agents_file: &PathBuf, parsed: &Value) -> Option<(String, String, String)> {
    let agents = load_agents(agents_file);
    if agents.is_empty() {
        return None;
    }

    let session_id = parsed.get("session_id").and_then(|v| v.as_str());
    let cwd = parsed.get("cwd").and_then(|v| v.as_str());

    let agent = session_id
        .and_then(|sid| agents.iter().find(|a| a.session_id.as_deref() == Some(sid)))
        .or_else(|| cwd.and_then(|c| agents.iter().find(|a| a.cwd == c)));

    agent.map(|a| (a.id.clone(), a.name.clone(), a.project_id.clone()))
}

fn append_line(path: &PathBuf, line: &str) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    file.write_all(line.as_bytes())?;
    Ok(())
}
