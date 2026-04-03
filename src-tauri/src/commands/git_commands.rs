use std::process::Command;

// ── helpers ───────────────────────────────────────────────────────────────────

fn git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("git exec failed: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

// ── data types ────────────────────────────────────────────────────────────────

#[derive(serde::Serialize, Debug)]
pub struct GitFileStatus {
    pub path: String,
    pub staged_status: String,   // X character from porcelain
    pub unstaged_status: String, // Y character from porcelain
}

#[derive(serde::Serialize, Debug)]
pub struct GitBranchInfo {
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub has_remote: bool,
}

#[derive(serde::Serialize, Debug)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(serde::Serialize, Debug)]
pub struct GitStatus {
    pub branch: GitBranchInfo,
    pub files: Vec<GitFileStatus>,
    pub is_git_repo: bool,
}

// ── commands ──────────────────────────────────────────────────────────────────

/// Returns current branch + changed files. Safe to call on non-git dirs.
#[tauri::command]
pub fn git_status(cwd: String) -> Result<GitStatus, String> {
    // Check if this is a git repo first
    let check = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("git exec failed: {e}"))?;

    if !check.status.success() {
        return Ok(GitStatus {
            branch: GitBranchInfo { branch: String::new(), ahead: 0, behind: 0, has_remote: false },
            files: vec![],
            is_git_repo: false,
        });
    }

    // Branch info from `git status -b --porcelain=v1`
    let status_out = git(&cwd, &["status", "-b", "--porcelain=v1"])?;
    let mut lines = status_out.lines();

    // Parse branch line: ## main...origin/main [ahead 1, behind 2]
    let branch_line = lines.next().unwrap_or("").trim_start_matches("## ");
    let (branch_name, ahead, behind, has_remote) = parse_branch_line(branch_line);

    // Parse file lines
    let files: Vec<GitFileStatus> = lines
        .filter(|l| l.len() >= 3)
        .map(|l| {
            let staged = l.chars().next().unwrap_or(' ').to_string();
            let unstaged = l.chars().nth(1).unwrap_or(' ').to_string();
            // Path starts at col 3; handle rename "old -> new" (porcelain v1 uses NUL in -z mode)
            let path = l[3..].trim().to_string();
            GitFileStatus {
                path,
                staged_status: staged,
                unstaged_status: unstaged,
            }
        })
        .collect();

    Ok(GitStatus {
        branch: GitBranchInfo { branch: branch_name, ahead, behind, has_remote },
        files,
        is_git_repo: true,
    })
}

fn parse_branch_line(line: &str) -> (String, i32, i32, bool) {
    // "main...origin/main [ahead 1, behind 2]"
    // "main" (no remote)
    // "No commits yet on main"
    if line.starts_with("No commits yet on ") {
        return (line["No commits yet on ".len()..].to_string(), 0, 0, false);
    }

    let (tracking_part, counts_part) = if let Some(idx) = line.find(" [") {
        (&line[..idx], Some(&line[idx + 2..line.len() - 1]))
    } else {
        (line, None)
    };

    let (branch, has_remote) = if let Some(idx) = tracking_part.find("...") {
        (tracking_part[..idx].to_string(), true)
    } else {
        (tracking_part.to_string(), false)
    };

    let (mut ahead, mut behind) = (0i32, 0i32);
    if let Some(counts) = counts_part {
        for part in counts.split(", ") {
            if let Some(n) = part.strip_prefix("ahead ") {
                ahead = n.trim().parse().unwrap_or(0);
            } else if let Some(n) = part.strip_prefix("behind ") {
                behind = n.trim().parse().unwrap_or(0);
            }
        }
    }

    (branch, ahead, behind, has_remote)
}

/// Unified diff for a single file. staged=true → diff --staged.
#[tauri::command]
pub fn git_diff(cwd: String, path: String, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff", "--no-color"];
    if staged {
        args.push("--staged");
    }
    args.push("--");
    args.push(&path);
    git(&cwd, &args)
}

/// Stage a file (git add).
#[tauri::command]
pub fn git_stage(cwd: String, path: String) -> Result<(), String> {
    git(&cwd, &["add", "--", &path]).map(|_| ())
}

/// Stage all changes (git add -A).
#[tauri::command]
pub fn git_stage_all(cwd: String) -> Result<(), String> {
    git(&cwd, &["add", "-A"]).map(|_| ())
}

/// Unstage a file (git restore --staged).
#[tauri::command]
pub fn git_unstage(cwd: String, path: String) -> Result<(), String> {
    git(&cwd, &["restore", "--staged", "--", &path]).map(|_| ())
}

/// Unstage all staged files.
#[tauri::command]
pub fn git_unstage_all(cwd: String) -> Result<(), String> {
    git(&cwd, &["restore", "--staged", "."]).map(|_| ())
}

/// Discard unstaged changes for a file (git restore).
#[tauri::command]
pub fn git_discard(cwd: String, path: String) -> Result<(), String> {
    git(&cwd, &["restore", "--", &path]).map(|_| ())
}

/// Commit staged changes.
#[tauri::command]
pub fn git_commit(cwd: String, message: String) -> Result<(), String> {
    git(&cwd, &["commit", "-m", &message]).map(|_| ())
}

/// Recent commits.
#[tauri::command]
pub fn git_log(cwd: String, limit: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    let limit_str = limit.unwrap_or(20).to_string();
    let out = git(
        &cwd,
        &["log", &format!("-{}", limit_str), "--format=%H|%h|%s|%an|%ar"],
    )?;
    let entries = out
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| {
            let parts: Vec<&str> = l.splitn(5, '|').collect();
            GitLogEntry {
                hash:       parts.first().unwrap_or(&"").to_string(),
                short_hash: parts.get(1).unwrap_or(&"").to_string(),
                message:    parts.get(2).unwrap_or(&"").to_string(),
                author:     parts.get(3).unwrap_or(&"").to_string(),
                date:       parts.get(4).unwrap_or(&"").to_string(),
            }
        })
        .collect();
    Ok(entries)
}

/// Pull from remote.
#[tauri::command]
pub fn git_pull(cwd: String) -> Result<String, String> {
    git(&cwd, &["pull"])
}

/// Push to remote.
#[tauri::command]
pub fn git_push(cwd: String) -> Result<String, String> {
    git(&cwd, &["push"])
}
