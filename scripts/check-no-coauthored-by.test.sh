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

# Push com before zerado, before ausente e hífen unicode sob LC_ALL=C.
pushd=$(mktemp -d)
bare=$(mktemp -d)
trap 'rm -rf "$td" "$pushd" "$bare"' EXIT
git -C "$pushd" init -q
git -C "$pushd" config user.name "Teste Local"
git -C "$pushd" config user.email "teste@example.com"
git -C "$bare" init -q --bare
git -C "$pushd" remote add origin "$bare"
echo a > "$pushd/f.txt"
git -C "$pushd" add f.txt
git -C "$pushd" commit -q --no-verify -m "ja no remoto"
git -C "$pushd" push -q origin HEAD:refs/heads/main
echo b >> "$pushd/f.txt"
git -C "$pushd" add f.txt
git -C "$pushd" commit -q --no-verify -m "$(printf '%s\n\n%s\n' 'fora do remoto' 'Co-authored-by: Ada')"
tip=$(git -C "$pushd" rev-parse HEAD)
zeros=0000000000000000000000000000000000000000

set +e
out=$(cd "$pushd" && sh "$script" --push "$zeros" "$tip")
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$tip"; then
  echo "before zerado deveria reprovar o commit fora dos remotes (saiu $rc)" >&2
  exit 1
fi
echo "ok: before zerado usa rev-list --not --remotes"

missing=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
set +e
out=$(cd "$pushd" && sh "$script" --push "$missing" "$tip" 2>/tmp/yield2pay-checks/before-ausente.txt)
rc=$?
set -e
if [ "$rc" -eq 2 ]; then
  echo "before ausente não pode sair 2" >&2
  exit 1
fi
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$tip"; then
  echo "before ausente deveria cair em --not --remotes e reprovar (saiu $rc)" >&2
  exit 1
fi
if ! grep -q 'before ausente' /tmp/yield2pay-checks/before-ausente.txt; then
  echo "before ausente deveria avisar" >&2
  exit 1
fi
echo "ok: before ausente não sai 2"

echo c >> "$pushd/f.txt"
git -C "$pushd" add f.txt
uni=$(python3 -c 'print("co\u2013authored\u2013by: Uni")')
git -C "$pushd" commit -q --no-verify -m "$(printf '%s\n\n%s\n' 'hifen unicode' "$uni")"
uni_tip=$(git -C "$pushd" rev-parse HEAD)
set +e
out=$(cd "$pushd" && LC_ALL=C sh "$script" --push "$zeros" "$uni_tip")
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$uni_tip"; then
  echo "LC_ALL=C deveria achar o hifen unicode (saiu $rc)" >&2
  exit 1
fi
echo "ok: hifen unicode com LC_ALL=C no script"

msg=$(mktemp)
python3 -c 'print("assunto que cita Co-authored-by: no titulo\n\nco\u2013authored\u2013by: Uni\nprosa Co-authored-by: fica\n")' > "$msg"
( cd "$root" && LC_ALL=C sh .githooks/commit-msg "$msg" )
if grep -q 'Uni' "$msg"; then
  echo "hook com LC_ALL=C deixou o hifen unicode" >&2
  exit 1
fi
if ! grep -q 'prosa Co-authored-by: fica' "$msg"; then
  echo "hook apagou a prosa" >&2
  exit 1
fi
if ! grep -q 'assunto que cita Co-authored-by: no titulo' "$msg"; then
  echo "hook apagou o assunto" >&2
  exit 1
fi
echo "ok: hook com LC_ALL=C tira o hifen unicode e deixa prosa e assunto"
