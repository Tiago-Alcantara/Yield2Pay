#!/bin/sh
# Cobre o modo pull request e o push quando o clone da CI já tem o tip.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
script="$root/scripts/check-no-coauthored-by.sh"
td=$(mktemp -d)
pushd=$(mktemp -d)
bare=$(mktemp -d)
msg=$(mktemp)
ci_remote=$(mktemp -d)
ci_build=$(mktemp -d)
ci_clone=$(mktemp -d)
lonely=$(mktemp -d)
trap 'rm -rf "$td" "$pushd" "$bare" "$msg" "$ci_remote" "$ci_build" "$ci_clone" "$lonely"' EXIT

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
refname=$(git -C "$pushd" branch --show-current)
zeros=0000000000000000000000000000000000000000

set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$refname" sh "$script" --push "$zeros" "$tip")
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$tip"; then
  echo "before zerado deveria reprovar o commit fora dos remotes (saiu $rc)" >&2
  exit 1
fi
echo "ok: before zerado usa a ref empurrada"

set +e
out=$(cd "$pushd" && env -u GITHUB_REF_NAME sh "$script" --push "$zeros" "$tip" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'GITHUB_REF_NAME'; then
  echo "sem GITHUB_REF_NAME deveria falhar fechado (saiu $rc)" >&2
  exit 1
fi
echo "ok: sem nome da ref o push falha fechado"

missing=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$refname" sh "$script" --push "$missing" "$tip" 2>"$pushd/before-ausente.txt")
rc=$?
set -e
if [ "$rc" -eq 2 ]; then
  echo "before ausente não pode sair 2 quando a ref é conhecida" >&2
  exit 1
fi
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$tip"; then
  echo "before ausente deveria cair fora da ref empurrada e reprovar (saiu $rc)" >&2
  exit 1
fi
if ! grep -q 'before ausente' "$pushd/before-ausente.txt"; then
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
out=$(cd "$pushd" && LC_ALL=C GITHUB_REF_NAME="$refname" sh "$script" --push "$zeros" "$uni_tip")
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$uni_tip"; then
  echo "LC_ALL=C deveria achar o hifen unicode (saiu $rc)" >&2
  exit 1
fi
echo "ok: hifen unicode com LC_ALL=C no script"

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

# Clone como o da CI: fetch traz o tip e origin/<branch> é igual ao after.
git -C "$ci_build" init -q -b main
git -C "$ci_build" config user.name "Teste Local"
git -C "$ci_build" config user.email "teste@example.com"
git -C "$ci_remote" init -q --bare
git -C "$ci_build" remote add origin "$ci_remote"
echo base > "$ci_build/f.txt"
git -C "$ci_build" add f.txt
git -C "$ci_build" commit -q --no-verify -m "base"
git -C "$ci_build" push -q origin main

git -C "$ci_build" checkout -q -b antiga
echo antiga > "$ci_build/f.txt"
git -C "$ci_build" add f.txt
git -C "$ci_build" commit -q --no-verify -m "$(printf '%s\n\n%s\n' 'ja em outra ref' 'Co-authored-by: Ada')"
publicado=$(git -C "$ci_build" rev-parse HEAD)
git -C "$ci_build" push -q origin antiga

git -C "$ci_build" checkout -q -b equipe/nova main
echo novo > "$ci_build/f.txt"
git -C "$ci_build" add f.txt
git -C "$ci_build" commit -q --no-verify -m "$(printf '%s\n\n%s\n' 'so nesta ref' 'Co-authored-by: Bea')"
culpado=$(git -C "$ci_build" rev-parse HEAD)
git -C "$ci_build" push -q origin equipe/nova

git -C "$ci_clone" init -q
git -C "$ci_clone" remote add origin "$ci_remote"
git -C "$ci_clone" fetch -q origin
git -C "$ci_clone" checkout -q -B equipe/nova origin/equipe/nova
if [ "$(git -C "$ci_clone" rev-parse origin/equipe/nova)" != "$culpado" ]; then
  echo "o clone da CI não ficou com origin/equipe/nova igual ao after" >&2
  exit 1
fi

set +e
out=$(cd "$ci_clone" && GITHUB_REF_NAME='equipe/nova' sh "$script" --push "$zeros" "$culpado")
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$culpado"; then
  echo "clone da CI com before zerado deveria reprovar (saiu $rc)" >&2
  exit 1
fi
if printf '%s\n' "$out" | grep -qx "$publicado"; then
  echo "clone da CI listou commit que não é ancestral do after" >&2
  exit 1
fi
echo "ok: before zerado reprova mesmo com origin/<branch> igual ao after"

set +e
out=$(cd "$ci_clone" && GITHUB_REF_NAME='equipe/nova' sh "$script" --push "$missing" "$culpado" 2>"$ci_clone/fetch-falhou.txt")
rc=$?
set -e
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$culpado"; then
  echo "force-push com before ausente e fetch falhando deveria reprovar (saiu $rc)" >&2
  exit 1
fi
if ! grep -q 'before ausente' "$ci_clone/fetch-falhou.txt"; then
  echo "force-push com fetch falhando deveria avisar" >&2
  exit 1
fi
echo "ok: before ausente com fetch falhando reprova no clone da CI"

git -C "$ci_build" checkout -q equipe/nova
git -C "$ci_build" reset -q --hard "$publicado"
git -C "$ci_build" push -q --force origin equipe/nova
git -C "$ci_clone" fetch -q origin
git -C "$ci_clone" checkout -q -B equipe/nova origin/equipe/nova
if [ "$(git -C "$ci_clone" rev-parse origin/equipe/nova)" != "$publicado" ]; then
  echo "origin/equipe/nova não acompanhou o commit já publicado" >&2
  exit 1
fi
if [ "$(git -C "$ci_clone" rev-parse refs/heads/equipe/nova)" != "$publicado" ]; then
  echo "a ref local não ficou igual ao after" >&2
  exit 1
fi
set +e
out=$(cd "$ci_clone" && GITHUB_REF_NAME='equipe/nova' sh "$script" --push "$zeros" "$publicado")
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 1 ] || ! printf '%s\n' "$out" | grep -qx "$publicado"; then
  echo "commit com coautor que também está em outra ref remota deveria reprovar (saiu $rc)" >&2
  printf '%s\n' "$out" >&2
  exit 1
fi
echo "ok: commit com coautor em outra ref remota reprova contra origin/main"

git -C "$ci_build" checkout -q -b limpa main
echo limpo > "$ci_build/f.txt"
git -C "$ci_build" add f.txt
git -C "$ci_build" commit -q --no-verify -m "limpo"
limpo=$(git -C "$ci_build" rev-parse HEAD)
git -C "$ci_build" push -q origin limpa
git -C "$ci_clone" fetch -q origin
git -C "$ci_clone" checkout -q -B limpa origin/limpa
set +e
out=$(cd "$ci_clone" && GITHUB_REF_NAME=limpa sh "$script" --push "$zeros" "$limpo")
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 0 ] || ! printf '%s\n' "$out" | grep -q 'Nenhum commit do intervalo tem Co-authored-by.'; then
  echo "controle limpo deveria sair 0 (saiu $rc)" >&2
  exit 1
fi
echo "ok: controle limpo no clone da CI sai 0"

nl_before="${zeros}
"
set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$refname" sh "$script" --push "$nl_before" "$tip" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'before inválido: quebra de linha'; then
  echo "newline no before deveria sair 2 (saiu $rc)" >&2
  printf '%s\n' "$out" >&2
  exit 1
fi
cr_before=$(printf '%s\r' "$zeros")
set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$refname" sh "$script" --push "$cr_before" "$tip" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'before inválido: quebra de linha'; then
  echo "CR no before deveria sair 2 (saiu $rc)" >&2
  exit 1
fi
nl_after="${tip}
"
set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$refname" sh "$script" --push "$zeros" "$nl_after" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'after inválido: quebra de linha'; then
  echo "newline no after deveria sair 2 (saiu $rc)" >&2
  exit 1
fi
cr_after=$(printf '%s\r' "$tip")
set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$refname" sh "$script" --push "$zeros" "$cr_after" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'after inválido: quebra de linha'; then
  echo "CR no after deveria sair 2 (saiu $rc)" >&2
  exit 1
fi
nl_ref="${refname}
"
set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$nl_ref" sh "$script" --push "$zeros" "$tip" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'GITHUB_REF_NAME inválido: quebra de linha'; then
  echo "newline no GITHUB_REF_NAME deveria sair 2 (saiu $rc)" >&2
  printf '%s\n' "$out" >&2
  exit 1
fi
cr_ref=$(printf '%s\r' "$refname")
set +e
out=$(cd "$pushd" && GITHUB_REF_NAME="$cr_ref" sh "$script" --push "$zeros" "$tip" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'GITHUB_REF_NAME inválido: quebra de linha'; then
  echo "CR no GITHUB_REF_NAME deveria sair 2 (saiu $rc)" >&2
  exit 1
fi
echo "ok: newline e CR em before, after e GITHUB_REF_NAME saem 2"

git -C "$lonely" init -q -b feature
git -C "$lonely" config user.name "Teste Local"
git -C "$lonely" config user.email "teste@example.com"
echo so > "$lonely/f.txt"
git -C "$lonely" add f.txt
git -C "$lonely" commit -q --no-verify -m "sem main"
lonely_tip=$(git -C "$lonely" rev-parse HEAD)
set +e
out=$(cd "$lonely" && GITHUB_REF_NAME=feature sh "$script" --push "$zeros" "$lonely_tip" 2>&1)
rc=$?
set -e
if [ "$rc" -ne 2 ] || ! printf '%s\n' "$out" | grep -q 'origin/main ausente'; then
  echo "sem origin/main deveria sair 2 (saiu $rc)" >&2
  printf '%s\n' "$out" >&2
  exit 1
fi
echo "ok: sem origin/main o push sai 2"
