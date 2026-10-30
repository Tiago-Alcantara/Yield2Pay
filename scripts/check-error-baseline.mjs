import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keys = ['api-lint', 'web-lint', 'api-tsc', 'web-tsc'];
const labels = {
  'api-lint': 'lint da API',
  'web-lint': 'lint da web',
  'api-tsc': 'tsc da API',
  'web-tsc': 'tsc da web',
};

const dump = process.argv[2] === '--dump';
const key = dump ? null : process.argv[2];

function run(args) {
  return spawnSync('pnpm', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function pathForms(dirPath) {
  const posix = dirPath.split(path.sep).join('/');
  return [posix, posix.replaceAll('/', '\\')];
}

export function rootsOf(dir) {
  const resolved = path.resolve(dir);
  const forms = new Set(pathForms(resolved));
  try {
    for (const form of pathForms(realpathSync(resolved))) forms.add(form);
  } catch {
    // Sem o diretório, o caminho resolvido ainda identifica a raiz.
  }
  return [...forms].filter((item) => item && item !== '/' && item !== '\\');
}

const repoRoots = rootsOf(root);

export function stripRoots(text, roots = repoRoots) {
  let out = String(text ?? '');
  const ordered = [...roots].sort((a, b) => b.length - a.length);
  for (const variant of ordered) {
    if (!variant || variant === '/' || variant === '\\') continue;
    const usesWin = variant.includes('\\') && !variant.includes('/');
    const sep = usesWin ? '\\' : '/';
    const prefix = variant.endsWith(sep) ? variant : `${variant}${sep}`;
    out = out.split(prefix).join('');
  }
  return out;
}

export function textOf(message, roots = repoRoots) {
  return stripRoots(message, roots).replace(/\s+/g, ' ').trim();
}

export function messageText(ruleId, message, roots = repoRoots) {
  let text = textOf(message, roots);
  if (!String(ruleId ?? '').startsWith('react-hooks/')) return text;
  text = text.replace(/:\d+:\d+\b/g, '');
  text = text.replace(/\s>\s*\d+\s+\||\s\d+\s+\|/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function addCount(found, signature) {
  found.set(signature, (found.get(signature) ?? 0) + 1);
}

function relPath(filePath) {
  const stripped = stripRoots(String(filePath ?? '').replaceAll('\\', '/'));
  if (!stripped) return '';
  const absolute =
    path.posix.isAbsolute(stripped) || /^[A-Za-z]:\//.test(stripped);
  if (!absolute) return stripped.replace(/^\.\//, '');
  return path.relative(root, path.resolve(stripped)).split(path.sep).join('/');
}

export function lintSignatures(report) {
  const found = new Map();
  for (const file of report) {
    const arquivo = relPath(file.filePath || '');
    for (const message of file.messages || []) {
      if (message.severity !== 2) continue;
      addCount(
        found,
        `${arquivo}|${message.ruleId ?? ''}|${messageText(message.ruleId, message.message)}`,
      );
    }
  }
  return found;
}

function tscSignatures(text) {
  const found = new Map();
  for (const line of text.split(/\r?\n/)) {
    const withFile = line.match(/^(.*)\(\d+,\d+\): error (TS\d+): (.*)$/);
    if (withFile) {
      const arquivo = relPath(withFile[1]);
      addCount(found, `${arquivo}|${withFile[2]}|${textOf(withFile[3])}`);
      continue;
    }
    const bare = line.match(/(?:^|\s)error (TS\d+): (.*)$/);
    if (bare) addCount(found, `|${bare[1]}|${textOf(bare[2])}`);
  }
  return found;
}

export function countList(items) {
  const counts = new Map();
  for (const item of items) addCount(counts, item);
  return counts;
}

export function increases(current, baseline) {
  const rows = [];
  for (const [signature, count] of current) {
    const known = baseline.get(signature) ?? 0;
    if (count > known) {
      rows.push({ signature, current: count, baseline: known });
    }
  }
  rows.sort((a, b) =>
    a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0,
  );
  return rows;
}

function total(counts) {
  let n = 0;
  for (const count of counts.values()) n += count;
  return n;
}

function expand(counts) {
  const rows = [];
  for (const signature of [...counts.keys()].sort()) {
    const n = counts.get(signature);
    for (let i = 0; i < n; i += 1) rows.push(signature);
  }
  return rows;
}

function collectLint(which) {
  const dir = mkdtempSync(path.join(tmpdir(), 'y2p-baseline-'));
  const out = path.join(dir, 'eslint.json');
  const args =
    which === 'api-lint'
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
  const label = labels[which];
  const result = run(args);
  try {
    if (result.error) {
      console.error(
        `${label}: não foi possível executar o comando: ${result.error.message}`,
      );
      process.exit(1);
    }
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
    return lintSignatures(report);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function collectTsc(which) {
  const label = labels[which];
  const filter = which === 'api-tsc' ? '@yield2pay/api' : '@yield2pay/web';
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
  if (result.error) {
    console.error(
      `${label}: não foi possível executar o comando: ${result.error.message}`,
    );
    process.exit(1);
  }
  if (result.status === null || result.status > 1) {
    const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
    console.error(`${label}: tsc encerrou com código ${result.status}`);
    if (text) console.error(text);
    process.exit(result.status || 1);
  }
  return tscSignatures(`${result.stdout || ''}\n${result.stderr || ''}`);
}

function collect(which) {
  return which.endsWith('-lint') ? collectLint(which) : collectTsc(which);
}

function main() {
  if (!dump && !Object.hasOwn(labels, key)) {
    console.error(
      'uso: node scripts/check-error-baseline.mjs <api-lint|web-lint|api-tsc|web-tsc>',
    );
    process.exit(2);
  }

  if (dump) {
    const payload = {};
    for (const which of keys) payload[which] = expand(collect(which));
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(0);
  }

  const baseline = JSON.parse(
    readFileSync(path.join(root, 'scripts/error-baseline.json'), 'utf8'),
  );
  const known = baseline[key];
  if (!Array.isArray(known) || known.some((item) => typeof item !== 'string')) {
    console.error(`baseline inválido para ${key}`);
    process.exit(2);
  }

  const label = labels[key];
  const current = collect(key);
  const base = countList(known);
  const fresh = increases(current, base);

  if (fresh.length > 0) {
    console.error(
      `${label}: ${fresh.length} assinatura(s) acima da baseline.`,
    );
    for (const row of fresh) {
      console.error(row.signature);
      console.error(`atual=${row.current} baseline=${row.baseline}`);
    }
    process.exit(1);
  }

  console.log(
    `${label}: ${total(current)} ocorrência(s) no código, ${total(base)} na baseline.`,
  );
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (entry === self) main();
