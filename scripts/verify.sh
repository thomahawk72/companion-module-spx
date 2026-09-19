#!/usr/bin/env bash
# Felles verifisering for agentteam og mennesker (generisk mal, kopiert inn av agentteam-skillen).
# Kontrakt (samme i alle repo):
#   - tar en lås, så to kjøringer aldri treffer test-DB/porter samtidig
#   - skriver .verify/<scope>-<git-hash>.md med faktisk output og linjen RESULTAT: GRØNT|RØDT
#   - exit 0 = grønt, ellers 1
#   - `focus <testfil>` kjører én testfil under samme lås (RØD/GRØNN for kodeagent)
#
# Repo-spesifikke kommandoer ligger i scripts/verify.conf (bash), som definerer:
#   SCOPES="backend frontend"          # gyldige scopes; "all" kjører alle
#   verify_<scope>() { run "<navn>" <dir> <kommando...>; ... }
#   focus_cmd <absolutt testfil>       # skal kalle run for riktig pakke, ellers return 1
#
# Bruk:
#   scripts/verify.sh [<scope>|all]        (default: all)
#   scripts/verify.sh focus <testfil>

set -u
SCOPE="${1:-all}"
FOCUS_FILE="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF="$ROOT/scripts/verify.conf"
[ -f "$CONF" ] || { echo "❌ mangler $CONF (se mal i agentteam-skillen)"; exit 2; }
if [ "$SCOPE" = focus ] && [ -z "$FOCUS_FILE" ]; then echo "bruk: scripts/verify.sh focus <testfil>"; exit 2; fi

REPO_SLUG="$(basename "$ROOT")"
LOCK_DIR="/tmp/${REPO_SLUG}-verify.lock"
OUT_DIR="$ROOT/.verify"
mkdir -p "$OUT_DIR"

WAITED=0
until mkdir "$LOCK_DIR" 2>/dev/null; do
  if [ $WAITED -eq 0 ]; then echo "⏳ verify.sh: en annen kjøring pågår, venter..."; fi
  sleep 5; WAITED=$((WAITED+5))
  if [ $WAITED -ge 1200 ]; then echo "❌ verify.sh: ga opp etter 20 min i kø"; exit 1; fi
done
echo $$ > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

HASH="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nohash)"
DIRTY="$(git -C "$ROOT" status --porcelain | wc -l | tr -d ' ')"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OUT="$OUT_DIR/${SCOPE}-${HASH}.md"
if [ "$SCOPE" = focus ]; then
  OUT="$OUT_DIR/focus-$(basename "$FOCUS_FILE" | sed 's/\.[^.]*$//')-${HASH}.md"
fi
STATUS=0

section() { printf '\n## %s\n\n```\n' "$1" >> "$OUT"; }
endsection() { printf '```\n' >> "$OUT"; }
run() { # run <navn> <dir> <kommando...>
  local name="$1" dir="$2"; shift 2
  section "$name"
  ( cd "$dir" && "$@" ) > "$OUT_DIR/.tmp" 2>&1
  local rc=$?
  tail -n 40 "$OUT_DIR/.tmp" >> "$OUT"
  endsection
  if [ $rc -ne 0 ]; then echo "- ❌ $name (exit $rc)" >> "$OUT_DIR/.summary"; STATUS=1
  else echo "- ✅ $name" >> "$OUT_DIR/.summary"; fi
  echo "$( [ $rc -eq 0 ] && echo ✅ || echo ❌ ) $name"
}

# shellcheck disable=SC1090
. "$CONF"

: > "$OUT_DIR/.summary"
{
  echo "# verify: $SCOPE @ $HASH"; echo
  echo "- tidspunkt: $STAMP"
  echo "- repo: $ROOT"
  echo "- git HEAD: $HASH, ustagede/uncommittede filer: $DIRTY"
  echo "- kjørt av: ${VERIFY_AGENT:-$(whoami)}"
} > "$OUT"

if [ "$SCOPE" = focus ]; then
  ABS="$(cd "$(dirname "$FOCUS_FILE")" 2>/dev/null && pwd)/$(basename "$FOCUS_FILE")"
  focus_cmd "$ABS" || { echo "❌ verify.sh focus: fant ikke pakken for $FOCUS_FILE"; STATUS=1; }
elif [ "$SCOPE" = all ]; then
  for s in $SCOPES; do "verify_$s"; done
else
  case " $SCOPES " in *" $SCOPE "*) "verify_$SCOPE";; *) echo "❌ ukjent scope: $SCOPE (gyldige: $SCOPES all focus)"; STATUS=1;; esac
fi

{
  echo; echo "## Oppsummering"; echo
  cat "$OUT_DIR/.summary"; echo
  echo "RESULTAT: $( [ $STATUS -eq 0 ] && echo GRØNT || echo RØDT )"
} >> "$OUT"
rm -f "$OUT_DIR/.tmp" "$OUT_DIR/.summary"
[ "$SCOPE" != focus ] && cp "$OUT" "$OUT_DIR/last.md"
echo "📄 $OUT"
exit $STATUS
