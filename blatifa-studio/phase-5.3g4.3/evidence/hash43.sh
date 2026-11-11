#!/bin/zsh
# usage: hash43.sh OUT_HASHES OUT_PROFILEMETA
cd "~/Developments/My Project/blatifa-studio"
find . -type f -not -path './.venv/*' -not -path '*/__pycache__/*' -not -path './.ruff_cache/*' -not -path './docs/phase-5.3g4.3/*' -not -path './.profiles/*' -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 > "$1"
(cd ~ && shasum -a 256 BlatifaStudio/experiments/phase-5.3g/p53g.db | sed 's#  #  ~/#') >> "$1"
find ./.profiles -type f -print0 | LC_ALL=C sort -z | xargs -0 stat -f '%z %m %N' > "$2"
