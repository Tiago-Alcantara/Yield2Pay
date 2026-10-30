#!/bin/sh
# Falha se algum commit do intervalo tiver trailer Co-authored-by.
# Pull request: check-no-coauthored-by.sh <base> <head>
#   todos os pais a partir do merge-base.
# Push: check-no-coauthored-by.sh --push <before> <after>
#   before..after, todos os pais.
#   before zerado, ou ausente mesmo depois do fetch: origin/main..after.
#   Sem origin/main, sai 2. GITHUB_REF_NAME é validado antes disso.
set -eu

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

contains_break() {
  stripped=$(printf '%s' "$1" | tr -d '\r\n')
  [ "$stripped" != "$1" ]
}

if contains_break "$left"; then
  echo "before inválido: quebra de linha" >&2
  exit 2
fi
if contains_break "$right"; then
  echo "after inválido: quebra de linha" >&2
  exit 2
fi

if ! printf '%s' "$left" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "before inválido: esperado SHA de 40 hex" >&2
  exit 2
fi
if ! printf '%s' "$right" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "after inválido: esperado SHA de 40 hex" >&2
  exit 2
fi

if ! git rev-parse --verify "${right}^{commit}" >/dev/null 2>&1; then
  echo "commit inexistente: ${right}" >&2
  exit 2
fi

revs=$(mktemp)
trap 'rm -f "$revs"' EXIT

# Before zerado ou ausente não olha as outras refs remotas: um coautor
# que já esteja nelas ainda entra se não estiver em origin/main.
list_since_main() {
  ref=${GITHUB_REF_NAME:-}
  if contains_break "$ref"; then
    echo "GITHUB_REF_NAME inválido: quebra de linha" >&2
    exit 2
  fi
  if ! printf '%s' "$ref" | grep -Eq '^[A-Za-z0-9._/-]+$'; then
    echo "não dá para determinar o intervalo do push: GITHUB_REF_NAME ausente ou inválido" >&2
    exit 2
  fi
  case "$ref" in
    *..*|-*|*/-*|*/|/*)
      echo "não dá para determinar o intervalo do push: GITHUB_REF_NAME ausente ou inválido" >&2
      exit 2
      ;;
  esac
  if ! git rev-parse --verify "origin/main^{commit}" >/dev/null 2>&1; then
    echo "origin/main ausente. Não dá para determinar o intervalo do push." >&2
    exit 2
  fi
  if ! git rev-list "origin/main..${right}" >"$revs"; then
    echo "não dá para determinar o intervalo do push" >&2
    exit 2
  fi
}

if [ "$mode" = "push" ]; then
  if [ "$left" = "$zeros" ]; then
    list_since_main
  elif git rev-parse --verify "${left}^{commit}" >/dev/null 2>&1; then
    if ! git rev-list "${left}..${right}" >"$revs"; then
      echo "não dá para determinar o intervalo do push" >&2
      exit 2
    fi
  else
    fetched=0
    if GIT_TERMINAL_PROMPT=0 git fetch --no-tags origin -- "$left" >/dev/null 2>&1; then
      fetched=1
    fi
    if [ "$fetched" -eq 1 ] && git rev-parse --verify "${left}^{commit}" >/dev/null 2>&1; then
      if ! git rev-list "${left}..${right}" >"$revs"; then
        echo "não dá para determinar o intervalo do push" >&2
        exit 2
      fi
    else
      echo "before ausente no clone. Conferindo commits desde origin/main." >&2
      list_since_main
    fi
  fi
else
  if ! git rev-parse --verify "${left}^{commit}" >/dev/null 2>&1; then
    echo "commit inexistente: ${left}" >&2
    exit 2
  fi
  mb=$(git merge-base "$left" "$right")
  git rev-list "${mb}..${right}" >"$revs"
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
done <"$revs"

if [ "$found" -ne 0 ]; then
  exit 1
fi

echo "Nenhum commit do intervalo tem Co-authored-by."
exit 0
