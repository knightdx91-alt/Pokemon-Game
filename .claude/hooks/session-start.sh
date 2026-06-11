#!/bin/bash
# SessionStart hook: keep the local checkout in sync with remote main so
# Claude never works against a stale tree (missing/old files).
set -euo pipefail

# Only run in the Claude Code on the web remote environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Don't touch a dirty tree — surface it instead of clobbering work.
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted changes; skipping auto-sync." >&2
  exit 0
fi

git fetch origin main --quiet || exit 0

# Make sure we're on main, then fast-forward to the latest remote main.
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  git checkout main --quiet || exit 0
fi

git merge --ff-only origin/main --quiet || {
  echo "Could not fast-forward main (diverged); leaving tree as-is." >&2
  exit 0
}

echo "Synced local main to origin/main ($(git rev-parse --short HEAD))."
