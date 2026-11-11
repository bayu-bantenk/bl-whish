#!/usr/bin/env bash
# Copy review file from My ERP docs into ERP/reviews/.
# Usage: ./copy-blatifa-studio.sh <filename> [<filename> ...]
set -euo pipefail

SRC_DIR="$HOME/Developments/My\ Project/blatifa-studio/docs"
DEST_DIR="$(cd "$(dirname "$0")" && pwd)/blatifa-studio"
REPO_URL="https://github.com/bayu-bantenk/bl-whish/blob/main"

#if [ "$#" -eq 0 ]; then
#  echo "Usage: $0 <filename> [<filename> ...]" >&2
#  exit 1
#fi

#mkdir -p "$DEST_DIR"

#for name in "$@"; do
#  src="$SRC_DIR/$name"
#  if [ ! -f "$src" ]; then
#    echo "File not found: $src" >&2
#    exit 1
#  fi
#  cp "$src" "$DEST_DIR/"
#  echo "Copied: $name -> $DEST_DIR/"
#done

cp /Users/bayu.rieswanto_mdp/Developments/My\ Project/blatifa-studio/docs/phase-5.*/*.md blatifa-studio
cp /Users/bayu.rieswanto_mdp/Developments/My\ Project/blatifa-studio/docs/phase-5.*/evidence/*.* blatifa-studio/evidence

echo "========================================"
echo "GIT STATUS"
echo "========================================"

git status

echo ""
echo "========================================"
echo "FILE LIST WITH GITHUB URL"
echo "========================================"

git status --porcelain=v1 -uall | while IFS= read -r line; do
    status="${line:0:2}"
    file="${line:3}"

    # Handle renamed files
    if [[ "$file" == *" -> "* ]]; then
        file="${file##* -> }"
    fi

    # Remove surrounding quotes if Git quotes the filename
    file="${file#\"}"
    file="${file%\"}"

    echo "${REPO_URL}/${file}"
done

git add .
git commit -m "BLatifa"
git push


echo ""
echo "========================================"
echo "DONE"
echo "========================================"
