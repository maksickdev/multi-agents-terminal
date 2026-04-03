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
    pub author: String,
    pub date: String,
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

/// Run git through the user's login shell — only used for network ops (pull/push)
/// where credential helpers and SSH agent setup matters.
fn shell_git(cwd: &str, subcmd: &str) -> Result<String, String> {
    let out = Command::new("/bin/zsh")
        .args(["-l", "-c", &format!("git {subcmd}")])
        .current_dir(cwd)
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .output()
        .map_err(|e| format!("shell exec failed: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().into())
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
        .recurse_untracked_dirs(false)
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

    let mut walk = repo.revwalk().map_err(|e| e.to_string())?;
    walk.push_head().map_err(|e| e.to_string())?;
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME).map_err(|e| e.to_string())?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let entries = walk
        .take(limit.unwrap_or(20) as usize)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|c| {
            let hash      = c.id().to_string();
            let short_hash = hash[..7].to_string();
            let message   = c.summary().unwrap_or("").to_string();
            let author    = c.author().name().unwrap_or("Unknown").to_string();
            let diff      = now - c.time().seconds();
            let date = if diff < 60          { "just now".into() }
                else if diff < 3600          { format!("{} min ago", diff / 60) }
                else if diff < 86400         { format!("{} hr ago", diff / 3600) }
                else if diff < 86400 * 30    { format!("{} days ago", diff / 86400) }
                else                         { format!("{} mo ago", diff / (86400 * 30)) };
            GitLogEntry { hash, short_hash, message, author, date }
        })
        .collect();

    Ok(entries)
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
