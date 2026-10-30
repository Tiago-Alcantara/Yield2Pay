'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const pkgDir = path.resolve(__dirname, '..');

function git(args) {
  return spawnSync('git', args, {
    cwd: pkgDir,
    encoding: 'utf8',
  });
}

function fail(message, status) {
  console.error(message);
  process.exit(status || 1);
}

const top = git(['rev-parse', '--show-toplevel']);
if (top.error) {
  fail(`prepare: não foi possível executar o git: ${top.error.message}`);
}
if (top.status !== 0) {
  const msg = (top.stderr || top.stdout || '').trim();
  fail(`prepare: git rev-parse falhou: ${msg || 'sem mensagem'}`, top.status);
}

let same = false;
try {
  same = fs.realpathSync(top.stdout.trim()) === fs.realpathSync(pkgDir);
} catch (err) {
  fail(`prepare: não foi possível comparar o diretório do git: ${err.message}`);
}

if (!same) {
  console.log(
    'prepare: este pacote não é a raiz do repositório git. core.hooksPath permanece como está.',
  );
  process.exit(0);
}

const current = git(['config', '--get', 'core.hooksPath']);
if (current.error) {
  fail(`prepare: não foi possível ler core.hooksPath: ${current.error.message}`);
}
if (current.status > 1) {
  const msg = (current.stderr || current.stdout || '').trim();
  fail(
    `prepare: git config --get core.hooksPath falhou: ${msg || 'sem mensagem'}`,
    current.status,
  );
}

const value = current.status === 0 ? current.stdout.trim() : '';
if (value && value !== '.githooks') {
  console.warn(
    `prepare: core.hooksPath já é "${value}". Não vou sobrescrever.`,
  );
  process.exit(0);
}

const set = git(['config', 'core.hooksPath', '.githooks']);
if (set.error || set.status !== 0) {
  const msg = set.error
    ? set.error.message
    : (set.stderr || set.stdout || '').trim();
  fail(
    `prepare: não foi possível definir core.hooksPath: ${msg || 'sem mensagem'}`,
    set.status,
  );
}

console.log('prepare: core.hooksPath definido como .githooks');
