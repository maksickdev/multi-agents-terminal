mod commands;
mod pty;
mod state;

use state::app_state::AppState;
use commands::pty_commands::{
    delete_scrollback, get_agent_status, kill_agent, load_agents, load_scrollback, resize_agent,
    restart_agent, save_agents, spawn_agent, spawn_shell, write_to_agent,
};
use commands::project_commands::{load_projects, pick_folder, save_projects};
use commands::file_commands::{
    read_dir, read_file_text, write_file_text, delete_path,
    create_file, create_dir_all, rename_path, reveal_in_finder,
};
use commands::usage_commands::fetch_usage;
use commands::git_commands::{
    git_status, git_diff, git_stage, git_stage_all,
    git_unstage, git_unstage_all, git_discard,
    git_commit, git_log, git_commit_files, git_commit_file_diff,
    git_branches, git_checkout, git_create_branch,
    git_remotes, git_add_remote, git_remove_remote, git_push_upstream,
    git_init, git_pull, git_push,
    git_pull_with_passphrase, git_push_with_passphrase,
};

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
            spawn_shell,
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
            // File manager
            read_dir,
            read_file_text,
            write_file_text,
            delete_path,
            create_file,
            create_dir_all,
            rename_path,
            reveal_in_finder,
            // Git
            git_status,
            git_diff,
            git_stage,
            git_stage_all,
            git_unstage,
            git_unstage_all,
            git_discard,
            git_commit,
            git_log,
            git_commit_files,
            git_commit_file_diff,
            git_branches,
            git_checkout,
            git_create_branch,
            git_remotes,
            git_add_remote,
            git_remove_remote,
            git_push_upstream,
            git_init,
            git_pull,
            git_push,
            git_pull_with_passphrase,
            git_push_with_passphrase,
            // Usage
            fetch_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
