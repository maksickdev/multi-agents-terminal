mod commands;
mod hook_server;
mod pty;
mod state;

use state::app_state::AppState;
use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager};
use commands::pty_commands::{
    exit_app, get_agent_session_id, get_agent_status, is_session_nonempty, kill_agent,
    load_agents, resize_agent, restart_agent, save_agents, spawn_agent, spawn_shell,
    write_to_agent,
};
use commands::project_commands::{load_projects, pick_folder, save_projects, get_config_dir};
use commands::file_commands::{
    read_dir, read_file_text, read_file_bytes_base64, write_file_text, delete_path,
    create_file, create_dir_all, rename_path, copy_path, reveal_in_finder,
    get_latest_session_id, get_home_dir, set_executable,
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
    git_ls_remote,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_path = dirs_next::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("multi-agents-terminal");

    let hook_server_path = config_path.clone();

    // Truncate the hook events log on startup. The file is only used at runtime
    // (LogsPanel + agent attention badges) and does not need to persist across
    // sessions. Without this, the file grows unbounded and useHookEvents reads
    // the entire blob on every poll, freezing the main thread once it crosses
    // tens of MB. Truncating on startup also covers the post-crash case where
    // a clean shutdown didn't run.
    let events_file = config_path.join("hook-events.jsonl");
    if events_file.exists() {
        let _ = std::fs::write(&events_file, b"");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new(config_path))
        .setup(move |app| {
            // Start the hook receiver HTTP server embedded in the app process.
            tauri::async_runtime::spawn(hook_server::start(hook_server_path));

            // Intercept window X-button close → prevent and let frontend handle it,
            // unless exit_app already set confirmed_exit (then allow the close through).
            let confirmed_exit = app.state::<AppState>().confirmed_exit.clone();
            let handle = app.handle().clone();
            app.get_webview_window("main")
                .expect("no main window")
                .on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if confirmed_exit.load(Ordering::SeqCst) {
                            return; // exit_app already confirmed — allow close
                        }
                        api.prevent_close();
                        handle.emit("close-requested", ()).ok();
                    }
                });
            Ok(())
        })
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
            get_config_dir,
            // Session persistence
            load_agents,
            save_agents,
            // File manager
            read_dir,
            read_file_text,
            read_file_bytes_base64,
            write_file_text,
            delete_path,
            create_file,
            copy_path,
            create_dir_all,
            rename_path,
            reveal_in_finder,
            get_latest_session_id,
            get_home_dir,
            set_executable,
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
            git_ls_remote,
            // Usage
            fetch_usage,
            // App lifecycle
            get_agent_session_id,
            is_session_nonempty,
            exit_app,
        ])
        // Use .build().run() so we can also intercept Cmd+Q (RunEvent::ExitRequested)
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app, event| {
            // Cmd+Q on macOS fires ExitRequested at the app level.
            // Prevent it and show the save-sessions modal — unless exit_app already
            // set confirmed_exit, in which case we allow the exit through.
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let confirmed = app.state::<AppState>().confirmed_exit.load(Ordering::SeqCst);
                if !confirmed {
                    api.prevent_exit();
                    app.emit("close-requested", ()).ok();
                }
            }
        });
}
