/**
 * Módulo: index-exports
 * Criado em: 2026-11-01
 * Última atualização: 2026-11-01
 * Intuito: O index.mjs, que é o que a API carrega em produção, exporta em runtime o mesmo que o index.ts.
 * Sequência: as exportações de runtime dos dois arquivos são iguais; as constantes de grupo existem no index.mjs com o valor certo.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Import dinâmico do arquivo real: o alias do vitest aponta o pacote para o index.ts. */
async function loadExports(fileName: string): Promise<Record<string, unknown>> {
  const url = pathToFileURL(resolve(__dirname, fileName)).href;
  return (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
}

describe('exportações de runtime do pacote compartilhado', () => {
  it('index.mjs e index.ts exportam os mesmos nomes', async () => {
    const mjs = await loadExports('index.mjs');
    const ts = await loadExports('index.ts');
    expect(Object.keys(mjs).sort()).toEqual(Object.keys(ts).sort());
  });

  it('as constantes de grupo existem no index.mjs', async () => {
    const mjs = await loadExports('index.mjs');
    expect(mjs.HOUSEHOLD_ID_HEADER).toBe('X-Household-Id');
    expect(mjs.MAX_GROUPS).toBe(5);
    expect(mjs.DEFAULT_GUEST_LIMIT).toBe(1);
  });
});
