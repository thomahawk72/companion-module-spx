#!/usr/bin/env bash
# Lager en diff-pakke for reviewer: status, stat og full diff mot HEAD med utvidet kontekst,
# inkludert nye (untracked) filer. Agentene committer ikke, så «diffen for steget» er
# arbeidstreet mot HEAD.
#
# Bruk:
#   scripts/diff-pakke.sh <steg> [--base <ref>]
# Resultat: .agentteam/<steg>/diff-<n>.diff  (n økes automatisk), stien skrives ut.
set -u
STEG="${1:?bruk: scripts/diff-pakke.sh <steg> [--base <ref>]}"
BASE="HEAD"
[ "${2:-}" = "--base" ] && BASE="${3:?mangler ref etter --base}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.agentteam/$STEG"
mkdir -p "$DIR"
N=1; while [ -e "$DIR/diff-$N.diff" ]; do N=$((N+1)); done
OUT="$DIR/diff-$N.diff"
cd "$ROOT"
{
  echo "# diff-pakke: steg $STEG, nr $N, base $BASE, $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# HEAD: $(git rev-parse --short HEAD)"
  echo
  echo "## git status --short"
  git status --short
  echo
  echo "## git diff --stat $BASE"
  git diff --stat "$BASE"
  echo
  echo "## git diff -U10 $BASE"
  git diff -U10 "$BASE"
  UNTRACKED="$(git ls-files --others --exclude-standard)"
  if [ -n "$UNTRACKED" ]; then
    echo
    echo "## nye filer (untracked)"
    while IFS= read -r f; do
      [ -f "$f" ] || continue
      echo
      echo "### $f"
      diff -u /dev/null "$f" | sed '1,2d'
    done <<< "$UNTRACKED"
  fi
} > "$OUT"
echo "$OUT"
