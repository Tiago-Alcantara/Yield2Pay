import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = process.argv[2];
const labels = {
  'api-lint': 'lint da API',
  'web-lint': 'lint da web',
  'api-tsc': 'tsc da API',
  'web-tsc': 'tsc da web',
};

if (!Object.hasOwn(labels, key)) {
  console.error(
    'uso: node scripts/check-error-baseline.mjs <api-lint|web-lint|api-tsc|web-tsc>',
  );
  process.exit(2);
}

const baseline = JSON.parse(
  readFileSync(path.join(root, 'scripts/error-baseline.json'), 'utf8'),
);
const limit = baseline[key];
if (!Number.isInteger(limit) || limit < 0) {
  console.error(`baseline inválido para ${key}`);
  process.exit(2);
}

const label = labels[key];

function run(args) {
  return spawnSync('pnpm', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function failSpawn(result) {
  if (result.error) {
    console.error(
      `${label}: não foi possível executar o comando: ${result.error.message}`,
    );
    process.exit(1);
  }
}

let count = 0;

if (key.endsWith('-lint')) {
  const dir = mkdtempSync(path.join(tmpdir(), 'y2p-baseline-'));
  const out = path.join(dir, 'eslint.json');
  const args =
    key === 'api-lint'
      ? [
          '--filter',
          '@yield2pay/api',
          'exec',
          'eslint',
          '{src,apps,libs,test}/**/*.ts',
          '-f',
          'json',
          '-o',
          out,
        ]
      : [
          '--filter',
          '@yield2pay/web',
          'exec',
          'eslint',
          '.',
          '-f',
          'json',
          '-o',
          out,
        ];
  const result = run(args);
  try {
    failSpawn(result);
    if (result.status !== 0 && result.status !== 1) {
      const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
      console.error(`${label}: eslint encerrou com código ${result.status}`);
      if (text) console.error(text);
      process.exit(result.status || 1);
    }
    let report;
    try {
      report = JSON.parse(readFileSync(out, 'utf8'));
    } catch (err) {
      console.error(`${label}: relatório do eslint ilegível: ${err.message}`);
      process.exit(1);
    }
    if (!Array.isArray(report)) {
      console.error(`${label}: relatório do eslint inesperado`);
      process.exit(1);
    }
    for (const file of report) {
      for (const message of file.messages || []) {
        if (message.severity === 2) count += 1;
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
} else {
  const filter = key === 'api-tsc' ? '@yield2pay/api' : '@yield2pay/web';
  const result = run([
    '--filter',
    filter,
    'exec',
    'tsc',
    '--noEmit',
    '--pretty',
    'false',
    '--project',
    'tsconfig.json',
  ]);
  failSpawn(result);
  if (result.status === null || result.status > 1) {
    const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
    console.error(`${label}: tsc encerrou com código ${result.status}`);
    if (text) console.error(text);
    process.exit(result.status || 1);
  }
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  count = (text.match(/error TS\d+/g) || []).length;
}

if (count > limit) {
  console.error(`${label} subiu de ${limit} para ${count} (+${count - limit})`);
  process.exit(1);
}

console.log(`${label}: ${count} erro(s), baseline ${limit}.`);
