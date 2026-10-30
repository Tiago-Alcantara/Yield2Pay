#!/bin/sh
# Cobre o modo pull request: um merge que traz o trailer pelo segundo pai
# tem que reprovar. Roda num repositório temporário.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
script="$root/scripts/check-no-coauthored-by.sh"
td=$(mktemp -d)
trap 'rm -rf "$td"' EXIT

git -C "$td" init -q
git -C "$td" config user.name "Teste Local"
git -C "$td" config user.email "teste@example.com"

echo base > "$td/f.txt"
git -C "$td" add f.txt
git -C "$td" commit -q --no-verify -m "base"
base=$(git -C "$td" rev-parse HEAD)

git -C "$td" checkout -q -b lado
echo lado > "$td/f.txt"
git -C "$td" add f.txt
git -C "$td" commit -q --no-verify -m "$(printf '%s\n\n%s\n' 'lado' 'Co-authored-by: Ada')"
lado=$(git -C "$td" rev-parse HEAD)

git -C "$td" checkout -q master 2>/dev/null || git -C "$td" checkout -q main
echo principal > "$td/g.txt"
git -C "$td" add g.txt
git -C "$td" commit -q --no-verify -m "principal"
antes=$(git -C "$td" rev-parse HEAD)

git -C "$td" merge --no-ff --no-verify -q -m "merge do lado" "$lado"
merge=$(git -C "$td" rev-parse HEAD)

set +e
out=$(cd "$td" && sh "$script" "$antes" "$merge")
rc=$?
set -e

printf '%s\n' "$out"
if [ "$rc" -ne 1 ]; then
  echo "modo PR deveria sair 1 e saiu $rc" >&2
  exit 1
fi
if ! printf '%s\n' "$out" | grep -qx "$lado"; then
  echo "modo PR não listou o commit do segundo pai $lado" >&2
  exit 1
fi
if printf '%s\n' "$out" | grep -qx "$base"; then
  echo "modo PR listou a base, que já estava no intervalo de fora" >&2
  exit 1
fi
if printf '%s\n' "$out" | grep -qx "$antes"; then
  echo "modo PR listou o primeiro pai, que não tem trailer" >&2
  exit 1
fi

echo "ok: merge pelo segundo pai reprova no modo PR"
