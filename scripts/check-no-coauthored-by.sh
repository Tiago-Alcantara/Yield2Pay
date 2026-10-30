#!/bin/sh
# Falha se algum commit do intervalo tiver trailer Co-authored-by.
# Pull request: check-no-coauthored-by.sh <base> <head>
#   todos os pais a partir do merge-base.
# Push: check-no-coauthored-by.sh --push <before> <after>
#   before..after, todos os pais.
#   before zerado, ou ausente mesmo depois do fetch: commits fora dos remotes.
set -eu
LC_ALL=C.UTF-8
export LC_ALL

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
pattern_file="$script_dir/co-authored-by.pattern"
if [ ! -f "$pattern_file" ]; then
  echo "padrão ausente: $pattern_file" >&2
  exit 2
fi
pattern=$(tr -d '\r\n' < "$pattern_file")

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
zeros=0000000000000000000000000000000000000000

if ! git rev-parse --verify "${right}^{commit}" >/dev/null 2>&1; then
  echo "commit inexistente: ${right}" >&2
  exit 2
fi

revs=$(mktemp)
trap 'rm -f "$revs"' EXIT

if [ "$mode" = "push" ]; then
  if [ "$left" = "$zeros" ]; then
    git rev-list "$right" --not --remotes > "$revs"
  elif git rev-parse --verify "${left}^{commit}" >/dev/null 2>&1; then
    git rev-list "${left}..${right}" > "$revs"
  else
    fetched=0
    if git fetch --no-tags origin "$left" >/dev/null 2>&1; then
      fetched=1
    fi
    if [ "$fetched" -eq 1 ] && git rev-parse --verify "${left}^{commit}" >/dev/null 2>&1; then
      git rev-list "${left}..${right}" > "$revs"
    else
      echo "before ausente no clone. Conferindo commits fora dos remotes." >&2
      git rev-list "$right" --not --remotes > "$revs"
    fi
  fi
else
  if ! git rev-parse --verify "${left}^{commit}" >/dev/null 2>&1; then
    echo "commit inexistente: ${left}" >&2
    exit 2
  fi
  mb=$(git merge-base "$left" "$right")
  git rev-list "${mb}..${right}" > "$revs"
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
