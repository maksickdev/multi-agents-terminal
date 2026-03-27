mod commands;
mod pty;
mod state;

use state::app_state::AppState;
use commands::pty_commands::{
    delete_scrollback, get_agent_status, kill_agent, load_agents, load_scrollback, resize_agent,
    restart_agent, save_agents, spawn_agent, write_to_agent,
};
use commands::project_commands::{load_projects, pick_folder, save_projects};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_path = dirs_next::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("multi-agents-terminal");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new(config_path))
        .invoke_handler(tauri::generate_handler![
            // PTY
            spawn_agent,
            write_to_agent,
            resize_agent,
            kill_agent,
            restart_agent,
            get_agent_status,
            // Projects
            load_projects,
            save_projects,
            pick_folder,
            // Session persistence
            load_agents,
            save_agents,
            load_scrollback,
            delete_scrollback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
