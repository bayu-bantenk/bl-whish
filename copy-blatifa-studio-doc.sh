#!/usr/bin/env bash
# Copy every docs/phase-5.*/*.md and everything under docs/phase-5.*/evidence/ (recursively) from blatifa-studio
# into ./blatifa-studio/<phase>/..., commit, push, and print the GitHub URL of every file in that commit.
# The phase folders are kept, so files with the same name in different phases no longer overwrite each other.
#
# Usage: ./copy-blatifa-studio-doc.sh ["commit message"]
set -euo pipefail

SRC_DIR="$HOME/Developments/My Project/blatifa-studio/docs"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST_DIR="$REPO_DIR/blatifa-studio"
REPO_URL="https://github.com/bayu-bantenk/bl-whish/blob/main"
MESSAGE="${1:-BLatifa docs $(date '+%Y-%m-%d %H:%M')}"

cd "$REPO_DIR"
[ -d "$SRC_DIR" ] || { echo "Source not found: $SRC_DIR" >&2; exit 1; }

echo "========================================"
echo "GIT PULL"
echo "========================================"
git pull --ff-only

echo ""
echo "========================================"
echo "COPY  $SRC_DIR/phase-5.*  ->  $DEST_DIR"
echo "========================================"
mkdir -p "$DEST_DIR"
shopt -s nullglob
phases=("$SRC_DIR"/phase-5.*/)
[ "${#phases[@]}" -gt 0 ] || { echo "No phase-5.* folders in $SRC_DIR" >&2; exit 1; }
for dir in "${phases[@]}"; do
    phase="$(basename "$dir")"
    # md files directly in the phase folder + the whole evidence tree; skip caches and Finder files
    rsync -a --prune-empty-dirs \
        --exclude='__pycache__/' --exclude='.DS_Store' \
        --include='/*.md' --include='/evidence/' --include='/evidence/**' --exclude='*' \
        "$dir" "$DEST_DIR/$phase/"
    echo "  $phase: $(find "$DEST_DIR/$phase" -type f | wc -l | tr -d ' ') files"
done

echo ""
echo "========================================"
echo "GIT STATUS"
echo "========================================"
git add -A -- blatifa-studio           # only this folder (no .swp / .bak / other folders)
git status --short -- blatifa-studio

if git diff --cached --quiet -- blatifa-studio; then
    echo ""
    echo "Nothing changed: no commit."
    exit 0
fi

git commit -m "$MESSAGE" -- blatifa-studio
git push

echo ""
echo "========================================"
echo "FILES IN COMMIT $(git rev-parse --short HEAD) WITH GITHUB URL"
echo "========================================"
# Exactly the files of this commit (added/modified; deleted ones have no page), path URL-encoded per segment
git diff-tree --no-commit-id -r --name-only --diff-filter=AMR -z HEAD | while IFS= read -r -d '' file; do
    encoded="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$file")"
    echo "${REPO_URL}/${encoded}"
done

echo ""
echo "========================================"
echo "DONE"
echo "========================================"
