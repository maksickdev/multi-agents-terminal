# multi-agents-terminal: zsh wrapper rc.
# Loaded via ZDOTDIR override at shell spawn time. Restores the user's
# real ZDOTDIR, sources their .zshrc untouched, then layers standard
# line-editing keybindings on top so macOS shortcuts (Option+Delete,
# Option+Left/Right, etc.) work in both emacs- and vi-mode.

# 1. Restore real ZDOTDIR for child shells / scripts.
if [[ -n "$MAT_USER_ZDOTDIR" ]]; then
  export ZDOTDIR="$MAT_USER_ZDOTDIR"
else
  unset ZDOTDIR
fi
unset MAT_USER_ZDOTDIR

# 2. Source the user's real .zshrc, if present.
__mat_user_rc="${ZDOTDIR:-$HOME}/.zshrc"
[[ -f "$__mat_user_rc" ]] && source "$__mat_user_rc"
unset __mat_user_rc

# 3. Apply macOS-style line-editing bindings to BOTH keymaps so users who
#    deliberately chose vi-mode keep it, but standard shortcuts still work.
#    Shift+Arrow bindings are explicit so vi-mode doesn't split the escape
#    sequence into ESC+commands (e.g. ^[[1;2C = ESC then "C" = vi-change-eol).
for __mat_km in emacs viins; do
  bindkey -M $__mat_km '^[^?'    backward-kill-word    2>/dev/null
  bindkey -M $__mat_km '^W'      backward-kill-word    2>/dev/null
  bindkey -M $__mat_km '^[b'     backward-word         2>/dev/null
  bindkey -M $__mat_km '^[f'     forward-word          2>/dev/null
  bindkey -M $__mat_km '^[[1;3D' backward-word         2>/dev/null
  bindkey -M $__mat_km '^[[1;3C' forward-word          2>/dev/null
  bindkey -M $__mat_km '^A'      beginning-of-line     2>/dev/null
  bindkey -M $__mat_km '^E'      end-of-line           2>/dev/null
  # Shift+Arrow — shells have no in-line selection; make them behave like
  # plain Arrow keys instead of being parsed as destructive vi commands.
  bindkey -M $__mat_km '^[[1;2D' backward-char         2>/dev/null
  bindkey -M $__mat_km '^[[1;2C' forward-char          2>/dev/null
  bindkey -M $__mat_km '^[[1;2A' up-line-or-history    2>/dev/null
  bindkey -M $__mat_km '^[[1;2B' down-line-or-history  2>/dev/null
done
unset __mat_km
