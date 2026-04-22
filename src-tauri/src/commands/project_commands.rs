use std::fs;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::state::app_state::{AppState, Project};

#[tauri::command]
pub async fn load_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let path = state.config_path.join("projects.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let projects: Vec<Project> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(projects)
}

#[tauri::command]
pub async fn save_projects(
    state: State<'_, AppState>,
    projects: Vec<Project>,
) -> Result<(), String> {
    let config_dir = &state.config_path;
    fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;

    let tmp_path = config_dir.join("projects.json.tmp");
    let final_path = config_dir.join("projects.json");

    let content = serde_json::to_string_pretty(&projects).map_err(|e| e.to_string())?;
    fs::write(&tmp_path, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &final_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_config_dir(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.config_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog().file().pick_folder(move |result| {
        let _ = tx.send(result);
    });

    let result = rx.await.map_err(|e| e.to_string())?;
    Ok(result.map(|p| p.to_string()))
}
