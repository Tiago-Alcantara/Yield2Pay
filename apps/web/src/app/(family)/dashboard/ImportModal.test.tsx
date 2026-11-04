/**
 * Módulo: ImportModal
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: A prévia do extrato deixa trocar o tipo de cada linha antes de gravar, e o manual e a nota escolhem entre gasto e entrada.
 * Sequência: o arquivo vira prévia e nada é gravado antes de confirmar; a troca de tipo em uma linha vai na confirmação; a linha já importada não tem seletor; sem linha nova não dá para confirmar; o erro da confirmação fica na prévia; escolher outro arquivo volta ao início; a entrada manual sai sem categoria; o gasto manual continua com categoria; a nota vira entrada sem categoria.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { StatementPreview } from '@yield2pay/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';

const PREVIEW: StatementPreview = {
  filename: 'extrato.ofx',
  skipped: 1,
  rows: [
    { index: 0, date: '2026-10-01', merchant: 'Salário', amountCents: 500000, kind: 'income', alreadyImported: false },
    { index: 1, date: '2026-10-02', merchant: 'Mercado', amountCents: 8640, kind: 'expense', alreadyImported: false },
    { index: 2, date: '2026-10-03', merchant: 'Reembolso', amountCents: 2000, kind: 'expense', alreadyImported: false },
    { index: 3, date: '2026-10-04', merchant: 'Uber', amountCents: 1000, kind: 'expense', alreadyImported: true },
  ],
};

function setup(preview: StatementPreview = PREVIEW, initialMode: 'ofx' | 'nfe' | 'manual' = 'ofx') {
  const onPreviewFile = vi.fn().mockResolvedValue(preview);
  const onImportFile = vi.fn().mockResolvedValue({ statementId: 's1', imported: 3, skipped: 1 });
  const onCreateExpense = vi.fn().mockResolvedValue(undefined);
  render(
    <ImportModal
      initialMode={initialMode}
      onClose={() => undefined}
      onPreviewFile={onPreviewFile}
      onImportFile={onImportFile}
      onUndoImport={async () => undefined}
      onCreateExpense={onCreateExpense}
      onDone={() => undefined}
    />,
  );
  return { onPreviewFile, onImportFile, onCreateExpense };
}

async function openPreview() {
  fireEvent.click(screen.getByRole('button', { name: 'Usar extrato de exemplo' }));
  return screen.findByRole('region', { name: 'Prévia do extrato' });
}

describe('prévia do extrato', () => {
  it('o arquivo vira prévia e nada é gravado antes de confirmar', async () => {
    const { onPreviewFile, onImportFile } = setup();

    const region = await openPreview();

    expect(onPreviewFile).toHaveBeenCalledTimes(1);
    expect(onImportFile).not.toHaveBeenCalled();
    expect(within(region).getByRole('combobox', { name: 'Tipo de Salário em 01/10' })).toHaveValue('income');
    expect(within(region).getByRole('combobox', { name: 'Tipo de Mercado em 02/10' })).toHaveValue('expense');
    expect(within(region).getByText('+ R$ 5.000,00')).toBeInTheDocument();
    expect(within(region).getByText('R$ 86,40')).toBeInTheDocument();
    expect(within(region).getByText(/1 linha não pôde ser lida/)).toBeInTheDocument();
    expect(within(region).getByText('2 gastos · 1 entrada')).toBeInTheDocument();
  });

  it('a troca de tipo em uma linha vai na confirmação', async () => {
    const { onImportFile } = setup();
    const region = await openPreview();

    fireEvent.change(within(region).getByRole('combobox', { name: 'Tipo de Reembolso em 03/10' }), { target: { value: 'income' } });
    fireEvent.change(within(region).getByRole('combobox', { name: 'Tipo de Salário em 01/10' }), { target: { value: 'expense' } });

    expect(within(region).getByText('+ R$ 20,00')).toBeInTheDocument();
    expect(within(region).getByText('R$ 5.000,00')).toBeInTheDocument();
    expect(within(region).getByText('2 gastos · 1 entrada')).toBeInTheDocument();

    fireEvent.click(within(region).getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(onImportFile).toHaveBeenCalledTimes(1));
    const [file, kinds] = onImportFile.mock.calls[0] ?? [];
    expect((file as File).name).toBe('extrato-exemplo.ofx');
    // Um tipo por linha da prévia, na mesma ordem, inclusive a já importada.
    expect(kinds).toEqual(['expense', 'expense', 'income', 'expense']);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Prévia do extrato' })).not.toBeInTheDocument());
    expect(screen.getByText(/lançamentos carregados/)).toBeInTheDocument();
  });

  it('a linha já importada não tem seletor', async () => {
    setup();
    const region = await openPreview();

    expect(within(region).queryByRole('combobox', { name: /Tipo de Uber/ })).not.toBeInTheDocument();
    expect(within(region).getByText('Já importada')).toBeInTheDocument();
  });

  it('sem linha nova não dá para confirmar', async () => {
    setup({ ...PREVIEW, rows: PREVIEW.rows.map((row) => ({ ...row, alreadyImported: true })) });
    const region = await openPreview();

    expect(within(region).getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();
    expect(within(region).getByText('Todas as linhas já foram importadas.')).toBeInTheDocument();
  });

  it('o erro da confirmação fica na prévia, com as escolhas', async () => {
    const { onImportFile } = setup();
    onImportFile.mockRejectedValueOnce(Object.assign(new Error('falhou'), { status: 409 }));
    const region = await openPreview();
    fireEvent.change(within(region).getByRole('combobox', { name: 'Tipo de Reembolso em 03/10' }), { target: { value: 'income' } });

    fireEvent.click(within(region).getByRole('button', { name: 'Confirmar importação' }));

    expect(await within(region).findByText('Esse extrato já foi importado.')).toBeInTheDocument();
    expect(within(region).getByRole('combobox', { name: 'Tipo de Reembolso em 03/10' })).toHaveValue('income');
  });

  it('a prévia que falha mostra o erro e continua no início', async () => {
    const { onPreviewFile } = setup();
    onPreviewFile.mockRejectedValueOnce(Object.assign(new Error('falhou'), { status: 400 }));

    fireEvent.click(screen.getByRole('button', { name: 'Usar extrato de exemplo' }));

    expect(await screen.findByText(/Não conseguimos ler esse arquivo/)).toBeInTheDocument();
    expect(screen.getByText('Arraste o extrato aqui')).toBeInTheDocument();
  });

  it('escolher outro arquivo volta ao início sem gravar', async () => {
    const { onImportFile } = setup();
    const region = await openPreview();

    fireEvent.click(within(region).getByRole('button', { name: 'Escolher outro arquivo' }));

    expect(screen.getByText('Arraste o extrato aqui')).toBeInTheDocument();
    expect(onImportFile).not.toHaveBeenCalled();
  });
});

describe('gasto ou entrada no lançamento', () => {
  // Um dia que já passou: a validação recusa data futura.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fillManual() {
    fireEvent.change(screen.getByLabelText('Onde'), { target: { value: 'Freela' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '1.250,50' } });
  }

  it('a entrada manual sai sem categoria', async () => {
    const { onCreateExpense } = setup(PREVIEW, 'manual');
    const kinds = within(screen.getByRole('group', { name: 'Tipo do lançamento' }));
    expect(kinds.getByRole('button', { name: 'Gasto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mercado' })).toBeInTheDocument();

    fireEvent.click(kinds.getByRole('button', { name: 'Entrada' }));

    expect(screen.queryByRole('button', { name: 'Mercado' })).not.toBeInTheDocument();
    fillManual();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar entrada' }));

    await waitFor(() => expect(onCreateExpense).toHaveBeenCalledTimes(1));
    expect(onCreateExpense).toHaveBeenCalledWith({
      merchant: 'Freela',
      amountCents: 125050,
      spentOn: '2026-10-15',
      kind: 'income',
    });
  });

  it('o gasto manual continua com categoria', async () => {
    const { onCreateExpense } = setup(PREVIEW, 'manual');

    fireEvent.click(screen.getByRole('button', { name: 'Saúde' }));
    fillManual();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar gasto' }));

    await waitFor(() => expect(onCreateExpense).toHaveBeenCalledTimes(1));
    expect(onCreateExpense).toHaveBeenCalledWith({
      merchant: 'Freela',
      amountCents: 125050,
      spentOn: '2026-10-15',
      kind: 'expense',
      category: 'health',
    });
  });

  it('a nota vira entrada sem categoria', async () => {
    const { onCreateExpense } = setup(PREVIEW, 'nfe');
    fireEvent.click(screen.getByRole('button', { name: 'Usar uma chave de exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar nota' }));
    expect(screen.getByRole('button', { name: 'Adicionar aos gastos' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'Tipo do lançamento' })).getByRole('button', { name: 'Entrada' }));

    expect(screen.queryByRole('button', { name: 'Mercado' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar às entradas' }));

    await waitFor(() => expect(onCreateExpense).toHaveBeenCalledTimes(1));
    expect(onCreateExpense).toHaveBeenCalledWith({
      merchant: 'Supermercado Bom Preço',
      amountCents: 18740,
      spentOn: '2026-10-12',
      kind: 'income',
    });
  });
});
