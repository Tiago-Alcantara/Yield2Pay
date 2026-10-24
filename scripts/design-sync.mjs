#!/usr/bin/env node
// Sincroniza o design system (design/) com o app (apps/web).
//   pnpm design:sync   -> regenera design/docs/INVENTARIO.md
//   pnpm design:check  -> falha (exit 1) se houver desvio de tokens
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const designDir = join(root, 'design');
const webSrc = join(root, 'apps/web/src');
const appTokensDir = join(webSrc, 'app/tokens');
const check = process.argv.includes('--check');

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => relative(root, p).replaceAll('\\', '/');

// ── Tokens ──────────────────────────────────────────────────────────────────
const defRe = /(--(?:fx|fam)-[a-z0-9-]+)\s*:/g;
const useRe = /var\(\s*(--(?:fx|fam)-[a-z0-9-]+)/g;
const collect = (files, re) => {
  const set = new Set();
  for (const f of files) for (const m of read(f).matchAll(re)) set.add(m[1]);
  return set;
};

const designTokenFiles = walk(join(designDir, 'tokens')).filter((f) => f.endsWith('.css'));
const appCss = walk(webSrc).filter((f) => f.endsWith('.css'));
const appSrc = walk(webSrc).filter((f) => /\.(css|tsx?|jsx?)$/.test(f));

const designDefined = collect(designTokenFiles, defRe);
const appDefined = collect(appCss, defRe);
const appUsed = collect(appSrc, useRe);

const undefinedInApp = [...appUsed].filter((t) => !appDefined.has(t)).sort();
const onlyInApp = [...appDefined].filter((t) => !designDefined.has(t)).sort();
const onlyInDesign = [...designDefined].filter((t) => !appDefined.has(t)).sort();

// Arquivos de tokens do app devem espelhar design/tokens. Ignora comentários,
// @import e o valor das famílias de fonte (app usa next/font, design usa Google Fonts).
const normalize = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import\s+url\([^)]*\)\s*;/g, "")
    .replace(/(--fx-font-[a-z-]+)\s*:[^;]*;/g, '$1:*;')
    .replace(/\s+/g, ' ')
    .trim();
const fileDrift = designTokenFiles
  .map((f) => ({ name: basename(f), appFile: join(appTokensDir, basename(f)), designFile: f }))
  .filter(({ appFile, designFile }) => !existsSync(appFile) || normalize(read(appFile)) !== normalize(read(designFile)))
  .map(({ name }) => name);

// ── Componentes ─────────────────────────────────────────────────────────────
const appComponents = walk(join(webSrc, 'components'))
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
  .map((f) => basename(f, '.tsx'))
  .sort();
const designComponents = new Set(
  walk(join(designDir, 'components')).filter((f) => f.endsWith('.jsx')).map((f) => basename(f, '.jsx')),
);
const componentsMissing = appComponents.filter((c) => !designComponents.has(c));

// ── Telas ───────────────────────────────────────────────────────────────────
const pages = walk(join(webSrc, 'app'))
  .filter((f) => /(^|\/)page\.tsx$/.test(rel(f)))
  .map((f) => '/' + rel(f).replace(/^apps\/web\/src\/app\//, '').replace(/\/?page\.tsx$/, '').replace(/\([^)]*\)\/?/g, ''))
  .map((p) => (p === '/' ? '/' : p.replace(/\/$/, '')))
  .sort();
const uiKits = readdirSync(join(designDir, 'ui_kits'));

// ── Relatório ───────────────────────────────────────────────────────────────
const list = (items, empty = '_nenhum_') => (items.length ? items.map((i) => `- \`${i}\``).join('\n') : empty);
const md = `# Inventário do design system × app

> Gerado por \`pnpm design:sync\` (scripts/design-sync.mjs). **Não edite à mão.**
> Use como fonte de verdade ao criar telas/campos novos: reaproveite os tokens e componentes abaixo.

## Tokens
- Definidos em \`design/tokens\`: **${designDefined.size}**
- Definidos no CSS do app: **${appDefined.size}** (inclui \`--fam-*\`, locais do app)
- Arquivos de \`apps/web/src/app/tokens\` diferentes de \`design/tokens\`: ${fileDrift.length ? fileDrift.map((f) => `\`${f}\``).join(', ') : '_nenhum_'}

### Usados no app mas sem definição (bug)
${list(undefinedInApp)}

### Só no app (candidatos a subir para design/tokens)
${list(onlyInApp)}

### Só no design (não usados/definidos no app)
${list(onlyInDesign)}

## Componentes do app
Presentes em \`apps/web/src/components\`. Marcados com ⚠ quando não há espelho em \`design/components\`.

${appComponents.map((c) => `- \`${c}\`${designComponents.has(c) ? '' : ' ⚠ sem espelho no design'}`).join('\n')}

## Telas do app
${list(pages)}

UI kits em \`design/ui_kits\`: ${uiKits.map((k) => `\`${k}\``).join(', ')}.
Telas sem kit correspondente devem ser documentadas em \`design/ui_kits/\` ao serem estabilizadas.
`;

writeFileSync(join(designDir, 'docs/INVENTARIO.md'), md);

console.log(`Inventário atualizado: ${rel(join(designDir, 'docs/INVENTARIO.md'))}`);
console.log(`  tokens sem definição: ${undefinedInApp.length} | só no app: ${onlyInApp.length} | arquivos de tokens divergentes: ${fileDrift.length}`);
console.log(`  componentes sem espelho: ${componentsMissing.length} | telas: ${pages.length}`);

if (check && (undefinedInApp.length || fileDrift.length)) {
  console.error('\ndesign:check falhou — corrija tokens indefinidos ou sincronize apps/web/src/app/tokens com design/tokens.');
  process.exit(1);
}
