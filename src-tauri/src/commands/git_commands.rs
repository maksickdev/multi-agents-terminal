use git2::{
    build::CheckoutBuilder, DiffFormat, DiffOptions, IndexAddOption,
    Repository, ResetType, Sort, StatusOptions,
};
use std::path::Path;
use std::process::Command;

// ── data types ────────────────────────────────────────────────────────────────

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub staged_status: String,
    pub unstaged_status: String,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub has_remote: bool,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: GitBranchInfo,
    pub files: Vec<GitFileStatus>,
    pub is_git_repo: bool,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    /// Commit body — everything after the first blank line (may be empty)
    pub body: String,
    pub author: String,
    pub date: String,
    /// Full hashes of parent commits (0 = root, 1 = first parent, 2+ = merge parents)
    pub parents: Vec<String>,
    /// Ref labels pointing at this commit: local branches, remote branches, tags, HEAD
    pub refs: Vec<String>,
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn open_repo(cwd: &str) -> Result<Repository, String> {
    Repository::discover(cwd).map_err(|e| e.to_string())
}

fn staged_char(s: git2::Status) -> &'static str {
    if s.contains(git2::Status::INDEX_NEW)        { "A" }
    else if s.contains(git2::Status::INDEX_MODIFIED)  { "M" }
    else if s.contains(git2::Status::INDEX_DELETED)   { "D" }
    else if s.contains(git2::Status::INDEX_RENAMED)   { "R" }
    else                                               { " " }
}

fn unstaged_char(s: git2::Status) -> &'static str {
    if s.contains(git2::Status::WT_NEW)          { "?" }
    else if s.contains(git2::Status::WT_MODIFIED) { "M" }
    else if s.contains(git2::Status::WT_DELETED)  { "D" }
    else                                           { " " }
}

fn branch_info(repo: &Repository) -> GitBranchInfo {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return GitBranchInfo {
            branch: "(no commits)".into(), ahead: 0, behind: 0, has_remote: false,
        },
    };
    let branch = head.shorthand().unwrap_or("HEAD").to_string();
    let local_oid = match head.target() {
        Some(o) => o,
        None => return GitBranchInfo { branch, ahead: 0, behind: 0, has_remote: false },
    };

    // Try refs/remotes/origin/<branch>
    let upstream_ref = format!("refs/remotes/origin/{branch}");
    let upstream_oid = match repo.find_reference(&upstream_ref).ok().and_then(|r| r.target()) {
        Some(o) => o,
        None => return GitBranchInfo { branch, ahead: 0, behind: 0, has_remote: false },
    };

    match repo.graph_ahead_behind(local_oid, upstream_oid) {
        Ok((a, b)) => GitBranchInfo { branch, ahead: a as i32, behind: b as i32, has_remote: true },
        Err(_)     => GitBranchInfo { branch, ahead: 0, behind: 0, has_remote: true },
    }
}

fn is_auth_error(stderr: &str) -> bool {
    let s = stderr.to_lowercase();
    s.contains("permission denied (publickey)")
        || s.contains("could not read username")
        || s.contains("authentication failed")
        || s.contains("invalid credentials")
        || s.contains("error: 403")
}

/// Run git through the user's login shell — only used for network ops (pull/push).
/// On macOS, tries to load SSH keys from the Keychain first (silent best-effort).
/// Returns Err("AUTH_REQUIRED: <original stderr>") when git asks for credentials.
fn shell_git(cwd: &str, subcmd: &str) -> Result<String, String> {
    // macOS: silently load keys from Keychain so GUI apps can authenticate
    let _ = Command::new("/usr/bin/ssh-add")
        .args(["--apple-load-keychain"])
        .env_remove("GIT_DIR")
        .output();

    let out = Command::new("/bin/zsh")
        .args(["-l", "-c", &format!("git -c core.askPass= {subcmd}")])
        .current_dir(cwd)
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("shell exec failed: {e}"))?;

    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        if is_auth_error(&stderr) {
            Err(format!("AUTH_REQUIRED: {stderr}"))
        } else {
            Err(stderr)
        }
    }
}

/// Run git with an askpass script that echoes the given passphrase/token.
/// Works for both SSH key passphrases and HTTPS tokens.
fn shell_git_with_askpass(cwd: &str, subcmd: &str, secret: &str) -> Result<String, String> {
    use std::os::unix::fs::PermissionsExt;

    let script_path = std::env::temp_dir().join("mat_git_askpass.sh");
    // Escape single quotes inside the secret
    let escaped = secret.replace('\'', "'\\''");
    std::fs::write(&script_path, format!("#!/bin/sh\necho '{}'\n", escaped))
        .map_err(|e| format!("askpass write: {e}"))?;
    std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755))
        .map_err(|e| format!("askpass chmod: {e}"))?;

    let script_str = script_path.to_string_lossy().to_string();

    let out = Command::new("/bin/zsh")
        .args(["-l", "-c", &format!("git {subcmd}")])
        .current_dir(cwd)
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env("SSH_ASKPASS", &script_str)
        .env("SSH_ASKPASS_REQUIRE", "force")
        .env("GIT_ASKPASS", &script_str)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("shell exec failed: {e}"))?;

    let _ = std::fs::remove_file(&script_path);

    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        if is_auth_error(&stderr) {
            Err(format!("AUTH_REQUIRED: {stderr}"))
        } else {
            Err(stderr)
        }
    }
}

// ── commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn git_status(cwd: String) -> Result<GitStatus, String> {
    let discover = Repository::discover(&cwd);
    eprintln!("[git_status] cwd={cwd:?} discover={}", if discover.is_ok() { "OK" } else { "ERR" });
    let repo = match discover {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[git_status] discover error: {e}");
            return Ok(GitStatus {
                branch: GitBranchInfo { branch: String::new(), ahead: 0, behind: 0, has_remote: false },
                files: vec![],
                is_git_repo: false,
            });
        }
    };

    let branch = branch_info(&repo);

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let files = statuses.iter().filter_map(|entry| {
        let path = entry.path()?.to_string();
        let s = entry.status();
        let staged   = staged_char(s);
        let unstaged = unstaged_char(s);
        if staged == " " && unstaged == " " { return None; }
        Some(GitFileStatus {
            path,
            staged_status:   staged.into(),
            unstaged_status: unstaged.into(),
        })
    }).collect();

    Ok(GitStatus { branch, files, is_git_repo: true })
}

#[tauri::command]
pub fn git_diff(cwd: String, path: String, staged: bool) -> Result<String, String> {
    let repo = open_repo(&cwd)?;
    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(&path);

    let diff = if staged {
        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
            .map_err(|e| e.to_string())?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| e.to_string())?
    };

    let mut patch = String::new();
    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        match line.origin() {
            '+' | '-' | ' ' => patch.push(line.origin()),
            _ => {}
        }
        if let Ok(s) = std::str::from_utf8(line.content()) {
            patch.push_str(s);
        }
        true
    }).map_err(|e| e.to_string())?;

    Ok(patch)
}

#[tauri::command]
pub fn git_stage(cwd: String, path: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_path(Path::new(&path)).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_stage_all(cwd: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(cwd: String, path: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    match repo.head() {
        Ok(head) => {
            let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
            repo.reset_default(Some(commit.as_object()), std::iter::once(path.as_str()))
                .map_err(|e| e.to_string())?;
        }
        Err(_) => {
            // No commits yet — just remove from index
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index.remove_path(Path::new(&path)).map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_unstage_all(cwd: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    match repo.head() {
        Ok(head) => {
            let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
            repo.reset(commit.as_object(), ResetType::Mixed, None)
                .map_err(|e| e.to_string())?;
        }
        Err(_) => {
            // No commits yet — clear index
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index.clear().map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_discard(cwd: String, path: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    // Restore working tree from index (matches `git restore <path>`)
    let mut cb = CheckoutBuilder::new();
    cb.path(path.as_str()).force();
    repo.checkout_index(None, Some(&mut cb)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(cwd: String, message: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    let sig  = repo.signature().map_err(|e| format!("git user not configured: {e}"))?;

    let mut index   = repo.index().map_err(|e| e.to_string())?;
    let tree_oid    = index.write_tree().map_err(|e| e.to_string())?;
    let tree        = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let parents: Vec<git2::Commit> = repo.head().ok()
        .and_then(|h| h.peel_to_commit().ok())
        .into_iter()
        .collect();
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_log(cwd: String, limit: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    let repo = open_repo(&cwd)?;
    if repo.head().is_err() { return Ok(vec![]); }

    // ── Build oid → ref-label map ─────────────────────────────────────────────
    let mut ref_map: std::collections::HashMap<String, Vec<String>> = Default::default();

    // Determine which oid HEAD points to (for "HEAD" label)
    let head_ref  = repo.head().ok();
    let head_oid  = head_ref.as_ref().and_then(|h| h.target()).map(|o| o.to_string());
    // Short name of the branch HEAD is on (to avoid duplicating it as "HEAD -> main")
    let head_branch = head_ref.as_ref()
        .and_then(|h| h.shorthand())
        .map(|s| s.to_string());

    if let Ok(refs) = repo.references() {
        for r in refs.flatten() {
            // Resolve to direct OID (dereference tags)
            let oid = r.resolve().ok()
                .and_then(|rr| rr.target())
                .or_else(|| r.target());
            if let Some(oid) = oid {
                let key = oid.to_string();
                if let Some(name) = r.shorthand() {
                    let label = name.to_string();
                    ref_map.entry(key).or_default().push(label);
                }
            }
        }
    }

    // Prepend "HEAD" to whichever commit HEAD points at
    if let Some(ref oid_str) = head_oid {
        let labels = ref_map.entry(oid_str.clone()).or_default();
        // Remove the branch name if it's already there; we'll add "HEAD → branch"
        if let Some(ref branch) = head_branch {
            labels.retain(|l| l != branch);
            labels.insert(0, format!("HEAD → {}", branch));
        } else {
            labels.insert(0, "HEAD".to_string());
        }
    }

    // ── Walk all local branches + remote tracking branches ────────────────────
    let mut walk = repo.revwalk().map_err(|e| e.to_string())?;
    // Push every local branch tip
    if repo.branches(Some(git2::BranchType::Local)).is_ok() {
        let _ = walk.push_glob("refs/heads/*");
    }
    // Push remote tips too so we see diverged remote commits
    let _ = walk.push_glob("refs/remotes/*");
    // Fallback in case there are no refs
    if walk.push_head().is_err() { return Ok(vec![]); }

    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME).map_err(|e| e.to_string())?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let entries = walk
        .take(limit.unwrap_or(150) as usize)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|c| {
            let hash       = c.id().to_string();
            let short_hash = hash[..7].to_string();
            let message    = c.summary().unwrap_or("").to_string();
            let body       = c.body().unwrap_or("").trim().to_string();
            let author     = c.author().name().unwrap_or("Unknown").to_string();
            let parents: Vec<String> = c.parent_ids().map(|id| id.to_string()).collect();
            let refs       = ref_map.get(&hash).cloned().unwrap_or_default();
            let diff       = now - c.time().seconds();
            let date = if diff < 60          { "just now".into() }
                else if diff < 3600          { format!("{} min ago", diff / 60) }
                else if diff < 86400         { format!("{} hr ago", diff / 3600) }
                else if diff < 86400 * 30    { format!("{} days ago", diff / 86400) }
                else                         { format!("{} mo ago", diff / (86400 * 30)) };
            GitLogEntry { hash, short_hash, message, body, author, date, parents, refs }
        })
        .collect();

    Ok(entries)
}

/// Returns the list of files changed in a specific commit.
#[tauri::command]
pub fn git_commit_files(cwd: String, hash: String) -> Result<Vec<serde_json::Value>, String> {
    let repo = open_repo(&cwd)?;
    let oid  = git2::Oid::from_str(&hash).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree   = commit.tree().map_err(|e| e.to_string())?;

    let diff = if commit.parent_count() == 0 {
        // Root commit — diff against empty tree
        repo.diff_tree_to_tree(None, Some(&tree), None)
    } else {
        let parent_tree = commit.parent(0)
            .and_then(|p| p.tree())
            .map_err(|e| e.to_string())?;
        repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), None)
    }.map_err(|e| e.to_string())?;

    let mut files: Vec<serde_json::Value> = Vec::new();
    diff.foreach(
        &mut |delta, _| {
            let status = match delta.status() {
                git2::Delta::Added    => "A",
                git2::Delta::Deleted  => "D",
                git2::Delta::Modified => "M",
                git2::Delta::Renamed  => "R",
                git2::Delta::Copied   => "C",
                _                     => "?",
            };
            let path = delta.new_file().path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            files.push(serde_json::json!({ "path": path, "status": status }));
            true
        },
        None, None, None,
    ).map_err(|e| e.to_string())?;

    Ok(files)
}

/// Initialize a new git repository.
#[tauri::command]
pub fn git_init(cwd: String) -> Result<(), String> {
    Repository::init(&cwd).map(|_| ()).map_err(|e| e.to_string())
}

/// Pull via shell — needs credential helpers / SSH agent from user's env.
#[tauri::command]
pub fn git_pull(cwd: String) -> Result<String, String> {
    shell_git(&cwd, "pull")
}

/// Push via shell — needs credential helpers / SSH agent from user's env.
#[tauri::command]
pub fn git_push(cwd: String) -> Result<String, String> {
    shell_git(&cwd, "push")
}

/// Pull with an explicit passphrase/token (used after AUTH_REQUIRED error).
#[tauri::command]
pub fn git_pull_with_passphrase(cwd: String, passphrase: String) -> Result<String, String> {
    shell_git_with_askpass(&cwd, "pull", &passphrase)
}

/// Push with an explicit passphrase/token (used after AUTH_REQUIRED error).
#[tauri::command]
pub fn git_push_with_passphrase(cwd: String, passphrase: String) -> Result<String, String> {
    shell_git_with_askpass(&cwd, "push", &passphrase)
}
