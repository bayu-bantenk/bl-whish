#!/usr/bin/env bash
# Copy review file from My ERP docs into ERP/reviews/.
# Usage: ./copy-blatifa-studio.sh <filename> [<filename> ...]
set -euo pipefail

SRC_DIR="$HOME/Developments/My Project/blatifa-studio/docs"
DEST_DIR="$(cd "$(dirname "$0")" && pwd)/blatifa-studio"

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <filename> [<filename> ...]" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

for name in "$@"; do
  src="$SRC_DIR/$name"
  if [ ! -f "$src" ]; then
    echo "File not found: $src" >&2
    exit 1
  fi
  cp "$src" "$DEST_DIR/"
  echo "Copied: $name -> $DEST_DIR/"
done

git status
git add .
git commit -m "BLatifa"
git push

