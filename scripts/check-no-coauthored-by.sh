#!/bin/sh
# Falha se algum commit no intervalo base..head tiver Co-authored-by na mensagem.
# Uso: scripts/check-no-coauthored-by.sh <base-sha> <head-sha>
# Lista o SHA de cada commit culpado e sai com código 1.
set -eu

if [ "$#" -ne 2 ]; then
  echo "uso: check-no-coauthored-by.sh <base-sha> <head-sha>" >&2
  exit 2
fi

base=$1
head=$2

if ! git rev-parse --verify "${base}^{commit}" >/dev/null 2>&1; then
  echo "commit base inexistente: ${base}" >&2
  exit 2
fi

if ! git rev-parse --verify "${head}^{commit}" >/dev/null 2>&1; then
  echo "commit head inexistente: ${head}" >&2
  exit 2
fi

revs=$(mktemp)
trap 'rm -f "$revs"' EXIT
git rev-list "${base}..${head}" > "$revs"

found=0
while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  msg=$(git log -1 --format=%B "$sha")
  if printf '%s\n' "$msg" | grep -qi 'co-authored-by:'; then
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
