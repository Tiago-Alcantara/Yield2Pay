import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { lintSignatures, textOf } from './check-error-baseline.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('o mesmo quadro vira a mesma assinatura na máquina local e no runner', () => {
  const frame = (dir) =>
    `Error: Cannot access refs during render ${dir}/apps/web/src/app/(family)/aprender/AulaCripto.tsx:786:3 784 | const openRef = useRef(onOpenRead);`;
  const local = '/workspace';
  const runner = '/home/runner/work/Yield2Pay/Yield2Pay';
  const localText = textOf(frame(local), [local]);
  const runnerText = textOf(frame(runner), [runner]);

  assert.equal(localText, runnerText);
  assert.equal(localText.includes('/workspace'), false);
  assert.equal(runnerText.includes('/home/runner'), false);
  assert.match(
    localText,
    /apps\/web\/src\/app\/\(family\)\/aprender\/AulaCripto\.tsx:786:3/,
  );
});

test('uma mensagem diferente continua sendo outra assinatura', () => {
  const runner = '/home/runner/work/Yield2Pay/Yield2Pay';
  const original = textOf(
    `Error: Cannot update ref ${runner}/apps/web/src/Aula.tsx:1:1`,
    [runner],
  );
  const swapped = textOf(
    `Error: Calling setState synchronously ${runner}/apps/web/src/Aula.tsx:1:1`,
    [runner],
  );
  assert.notEqual(original, swapped);
});

test('o relatório do eslint perde a raiz absoluta desta árvore', () => {
  const file = path.join(
    root,
    'apps/web/src/app/(family)/aprender/AulaCripto.tsx',
  );
  const signatures = [
    ...lintSignatures([
      {
        filePath: file,
        messages: [
          {
            severity: 2,
            ruleId: 'react-hooks/refs',
            message: `Error: Cannot access refs during render ${file}:786:3`,
          },
        ],
      },
    ]),
  ];

  assert.deepEqual(signatures, [
    'apps/web/src/app/(family)/aprender/AulaCripto.tsx|react-hooks/refs|Error: Cannot access refs during render apps/web/src/app/(family)/aprender/AulaCripto.tsx:786:3',
  ]);
});
