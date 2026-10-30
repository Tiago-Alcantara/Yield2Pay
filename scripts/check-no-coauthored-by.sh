#!/bin/sh
# Falha se algum commit do intervalo tiver trailer Co-authored-by.
# Pull request: check-no-coauthored-by.sh <base> <head>
#   só o first-parent a partir do merge-base (o que ainda não está na base).
# Push: check-no-coauthored-by.sh --push <before> <after>
#   before..after, todos os pais.
set -eu

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
pattern_file="$script_dir/co-authored-by.pattern"
if [ ! -f "$pattern_file" ]; then
  echo "padrão ausente: $pattern_file" >&2
  exit 2
fi
pattern=$(tr -d '\r\n' < "$pattern_file")
# GNU grep aceita o hífen unicode. Se o grep local recusar o padrão, fica o ASCII.
probe=0
printf 'x\n' | grep -E "$pattern" >/dev/null 2>&1 || probe=$?
if [ "$probe" -gt 1 ]; then
  pattern='^[[:space:]]*co-authored-by[[:space:]]*:'
fi

mode=pr
if [ "${1:-}" = "--push" ]; then
  mode=push
  shift
fi

if [ "$#" -ne 2 ]; then
  echo "uso: check-no-coauthored-by.sh [--push] <base-ou-before> <head-ou-after>" >&2
  exit 2
fi

left=$1
right=$2

if [ "$mode" = "push" ]; then
  if [ "$left" = "0000000000000000000000000000000000000000" ]; then
    echo "Push sem commit anterior. Nada a verificar."
    exit 0
  fi
fi

if ! git rev-parse --verify "${left}^{commit}" >/dev/null 2>&1; then
  echo "commit inexistente: ${left}" >&2
  exit 2
fi

if ! git rev-parse --verify "${right}^{commit}" >/dev/null 2>&1; then
  echo "commit inexistente: ${right}" >&2
  exit 2
fi

revs=$(mktemp)
trap 'rm -f "$revs"' EXIT

if [ "$mode" = "push" ]; then
  git rev-list "${left}..${right}" > "$revs"
else
  mb=$(git merge-base "$left" "$right")
  git rev-list --first-parent "${mb}..${right}" > "$revs"
fi

found=0
while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  msg=$(git log -1 --format=%B "$sha")
  if printf '%s\n' "$msg" | grep -qiE "$pattern"; then
    if [ "$found" -eq 0 ]; then
      echo "Commits com Co-authored-by:"
    fi
    echo "$sha"
    found=1
  fi
done < "$revs"

if [ "$found" -ne 0 ]; then
  exit 1
fi

echo "Nenhum commit do intervalo tem Co-authored-by."
exit 0
