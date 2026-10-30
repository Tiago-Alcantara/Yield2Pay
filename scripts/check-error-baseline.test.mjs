import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  increases,
  lintSignatures,
  messageText,
  textOf,
} from './check-error-baseline.mjs';

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
  assert.match(localText, /AulaCripto\.tsx:786:3/);
  assert.equal(
    messageText('react-hooks/refs', frame(local), [local]),
    messageText('react-hooks/refs', frame(runner), [runner]),
  );
});

test('linha e coluna do react-hooks não entram na assinatura', () => {
  const body = (line) =>
    `Error: Cannot access refs during render apps/web/src/app/(family)/conta/ContaModal.tsx:${line}:3\n${line - 2} | const x = 1;\n> ${line} | x.current = y;\n  | ^^^^^^^^^^^^^^^ Cannot update ref during render`;
  const shifted = messageText('react-hooks/refs', body(53));
  assert.equal(shifted, messageText('react-hooks/refs', body(54)));
  assert.equal(shifted.includes(':53:3'), false);
  assert.equal(/\d+\s+\|/.test(shifted), false);
  assert.match(shifted, /x\.current = y/);
  assert.match(messageText('prettier/prettier', 'keep line 12 | as text'), /12 \|/);
});

test('dígitos do código continuam na assinatura do react-hooks', () => {
  const frame = (n) =>
    `Error: Calling setState synchronously within an effect apps/web/src/AulaCripto.tsx:173:5\n172 | const requested = Number(aulaQuery);\n> 173 | if (n < ${n} || requested < 1) return;\n    | ^^^^^^^^ Avoid calling setState() directly within an effect`;
  const smaller = messageText('react-hooks/set-state-in-effect', frame(1));
  const larger = messageText('react-hooks/set-state-in-effect', frame(7));
  assert.notEqual(smaller, larger);
  assert.match(smaller, /n < 1 \|\|/);
  assert.match(larger, /n < 7 \|\|/);
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
  const counts = lintSignatures([
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
  ]);

  assert.deepEqual([...counts.keys()], [
    'apps/web/src/app/(family)/aprender/AulaCripto.tsx|react-hooks/refs|Error: Cannot access refs during render apps/web/src/app/(family)/aprender/AulaCripto.tsx',
  ]);
});

test('erro idêntico duplicado no mesmo arquivo fica acima da baseline', () => {
  const file = path.join(
    root,
    'apps/web/src/app/(family)/conta/ContaModal.tsx',
  );
  const message =
    'Error: Cannot access refs during render ContaModal.tsx:53:3\n51 | const x = 1;\n> 53 | x.current = y;\n  | ^^';
  const counts = lintSignatures([
    {
      filePath: file,
      messages: [
        { severity: 2, ruleId: 'react-hooks/refs', message },
        { severity: 2, ruleId: 'react-hooks/refs', message: message.replaceAll('53', '54').replace('51 |', '52 |') },
      ],
    },
  ]);
  assert.equal(counts.size, 1);
  const signature = [...counts.keys()][0];
  assert.equal(counts.get(signature), 2);
  const above = increases(counts, new Map([[signature, 1]]));
  assert.equal(above.length, 1);
  assert.equal(above[0].current, 2);
  assert.equal(above[0].baseline, 1);
  assert.equal(above[0].signature, signature);
});
