'use client';

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import type { ExpenseCategory, ExpenseKind, StatementImportResult, StatementPreview, StatementView } from '@yield2pay/shared';
import type { NewExpense } from '../_lib/householdApi';
import { brl, reais, saoPauloToday, signedBrl } from './painel-format';

type Mode = 'ofx' | 'nfe' | 'manual';

const EXAMPLE_KEY = '35261012202612345678901234567890123456789012';
const EXAMPLE_NOTE = {
  merchant: 'Supermercado Bom Preço',
  spentOn: '2026-10-12',
  amountCents: 18740,
};

const CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'groceries', label: 'Mercado' },
  { id: 'restaurant', label: 'Restaurante' },
  { id: 'transport', label: 'Transporte' },
  { id: 'housing', label: 'Casa' },
  { id: 'health', label: 'Saúde' },
  { id: 'subscriptions', label: 'Assinaturas' },
  { id: 'shopping', label: 'Outros' },
];

const EXAMPLE_OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20261002</DTPOSTED><TRNAMT>-86.40</TRNAMT><NAME>Supermercado Extra</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261005</DTPOSTED><TRNAMT>-42.00</TRNAMT><NAME>Restaurante da Praça</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261008</DTPOSTED><TRNAMT>-28.90</TRNAMT><NAME>Uber</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261011</DTPOSTED><TRNAMT>-1200.00</TRNAMT><NAME>Aluguel</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261014</DTPOSTED><TRNAMT>-55.90</TRNAMT><NAME>Netflix</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261016</DTPOSTED><TRNAMT>-37.20</TRNAMT><NAME>Farmacia</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

function groupsOfFour(digits: string) {
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function centsFromInput(raw: string): number | null {
  const cleaned = raw.replace(/R\$/g, '').replace(/\s/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function chipStyle(on: boolean): CSSProperties {
  return on
    ? { height: 38, padding: '0 15px', borderRadius: 999, border: '1px solid #D4D6D9', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
    : { height: 38, padding: '0 15px', borderRadius: 999, border: '1px solid #3a3d42', background: '#16181b', color: '#EDEFF1', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer' };
}

function CategoryChips({ value, onChange }: { value: ExpenseCategory; onChange: (category: ExpenseCategory) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {CATEGORIES.map((item) => (
        <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => onChange(item.id)} style={chipStyle(value === item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Gasto ou entrada, no lançamento manual e na nota. A entrada não tem categoria. */
function KindChips({ value, onChange }: { value: ExpenseKind; onChange: (kind: ExpenseKind) => void }) {
  return (
    <div role="group" aria-label="Tipo do lançamento" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {([['expense', 'Gasto'], ['income', 'Entrada']] as const).map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} style={chipStyle(value === id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function dayMonth(iso: string) {
  return iso.slice(8, 10) + '/' + iso.slice(5, 7);
}

export function ImportModal({
  onClose,
  onPreviewFile,
  onImportFile,
  onUndoImport,
  onListStatements,
  onCreateExpense,
  onDone,
  initialMode = 'ofx',
}: {
  onClose: () => void;
  onPreviewFile: (file: File) => Promise<StatementPreview>;
  onImportFile: (file: File, kinds: ExpenseKind[]) => Promise<StatementImportResult>;
  onUndoImport: (statementId: string) => Promise<void>;
  onListStatements?: () => Promise<StatementView[]>;
  onCreateExpense: (body: NewExpense) => Promise<void>;
  onDone: () => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loaded, setLoaded] = useState(0);
  const [lastStatementId, setLastStatementId] = useState<string | null>(null);
  const [lastImported, setLastImported] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const [keyDigits, setKeyDigits] = useState('');
  const [note, setNote] = useState<typeof EXAMPLE_NOTE | null>(null);
  const [noteKind, setNoteKind] = useState<ExpenseKind>('expense');
  const [noteCategory, setNoteCategory] = useState<ExpenseCategory>('groceries');
  const [noteError, setNoteError] = useState('');
  const [where, setWhere] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => saoPauloToday());
  const [manualKind, setManualKind] = useState<ExpenseKind>('expense');
  const [manualCategory, setManualCategory] = useState<ExpenseCategory>('groceries');
  const [manualError, setManualError] = useState('');
  const [confirmHuge, setConfirmHuge] = useState(false);
  // O arquivo fica aqui até a confirmação: a API não guarda nada na prévia.
  const [preview, setPreview] = useState<{ file: File; data: StatementPreview; kinds: ExpenseKind[] } | null>(null);
  const [statements, setStatements] = useState<StatementView[]>([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const listStatementsRef = useRef(onListStatements);
  listStatementsRef.current = onListStatements;

  useEffect(() => {
    let cancelled = false;
    listStatementsRef.current?.().then((rows) => {
      if (!cancelled && Array.isArray(rows)) setStatements(rows);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function showFileError(error: unknown) {
    const status = (error as { status?: number }).status;
    setFileError(status === 409
      ? 'Esse extrato já foi importado.'
      : 'Não conseguimos ler esse arquivo. Use OFX, CSV ou PDF exportado pelo banco.');
  }

  async function importFile(file: File) {
    setBusy(true);
    setFileError('');
    try {
      const data = await onPreviewFile(file);
      setPreview({ file, data, kinds: data.rows.map((row) => row.kind) });
    } catch (error) {
      showFileError(error);
    } finally {
      setBusy(false);
    }
  }

  function changeRowKind(index: number, kind: ExpenseKind) {
    setPreview((current) => (current
      ? { ...current, kinds: current.kinds.map((item, position) => (position === index ? kind : item)) }
      : current));
  }

  async function confirmPreview() {
    if (!preview || busy) return;
    const { file, kinds } = preview;
    setBusy(true);
    setFileError('');
    try {
      const result = await onImportFile(file, kinds);
      setPreview(null);
      if (result.imported === 0) {
        setFileError('Nada novo nesse arquivo.');
        return;
      }
      setLoaded((current) => current + result.imported);
      setLastImported(result.imported);
      setLastStatementId(result.statementId);
      setStatements((current) => [{ id: result.statementId, filename: file.name, importedAt: new Date().toISOString(), expenseCount: result.imported }, ...current.filter((item) => item.id !== result.statementId)]);
    } catch (error) {
      showFileError(error);
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void importFile(file);
  }

  function useExampleStatement() {
    const file = new File([EXAMPLE_OFX], 'extrato-exemplo.ofx', { type: 'text/plain' });
    void importFile(file);
  }

  function searchNote() {
    setNoteError('');
    setNote(null);
    if (keyDigits === EXAMPLE_KEY) {
      setNote(EXAMPLE_NOTE);
      setNoteKind('expense');
      setNoteCategory('groceries');
      return;
    }
    setNoteError('Não encontramos essa nota. Confira a chave ou use o exemplo.');
  }

  async function addNote() {
    if (!note || busy) return;
    setBusy(true);
    setNoteError('');
    try {
      const row = { merchant: note.merchant, amountCents: note.amountCents, spentOn: note.spentOn };
      await onCreateExpense(noteKind === 'income'
        ? { ...row, kind: 'income' }
        : { ...row, kind: 'expense', category: noteCategory });
      setLoaded((current) => current + 1);
      setNote(null);
      setKeyDigits('');
    } catch {
      setNoteError('Não conseguimos adicionar essa nota agora.');
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    const amountCents = centsFromInput(amount);
    const spentOn = date || saoPauloToday();
    if (!where.trim() || amountCents == null) {
      setManualError('Preencha onde e o valor.');
      return;
    }
    if (spentOn > saoPauloToday()) {
      setManualError('Essa data ainda não chegou. Use hoje ou um dia que já passou.');
      return;
    }
    if (amountCents >= 10_000_000 && !confirmHuge) {
      setConfirmHuge(true);
      setManualError('Esse valor passa de R$ 100.000. Confira e toque de novo para lançar.');
      return;
    }
    setManualError('');
    setConfirmHuge(false);
    setBusy(true);
    try {
      const row = { merchant: where.trim(), amountCents, spentOn };
      await onCreateExpense(manualKind === 'income'
        ? { ...row, kind: 'income' }
        : { ...row, kind: 'expense', category: manualCategory });
      setLoaded((current) => current + 1);
      setWhere('');
      setAmount('');
    } catch {
      setManualError(manualKind === 'income' ? 'Não conseguimos adicionar essa entrada agora.' : 'Não conseguimos adicionar esse gasto agora.');
    } finally {
      setBusy(false);
    }
  }

  const options: { id: Mode; kicker: string; title: string; detail: string }[] = [
    { id: 'ofx', kicker: 'Mais completo', title: 'Extrato do banco', detail: 'Arquivo OFX, CSV ou PDF' },
    { id: 'nfe', kicker: 'Uma compra', title: 'Nota fiscal', detail: 'Pela chave de acesso' },
    { id: 'manual', kicker: 'Do seu jeito', title: 'Manual', detail: 'Digite um gasto ou uma entrada' },
  ];

  const newRows = preview ? preview.data.rows.filter((row) => !row.alreadyImported) : [];
  const newIncomes = preview ? newRows.filter((row) => preview.kinds[row.index] === 'income').length : 0;

  return (
    <div
      role="presentation"
      className="y2p-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        id="s-importar"
        style={{ background: '#0E0F11', color: '#EDEFF1', border: '1px solid #2A2D31', borderRadius: 20, padding: '32px 28px', width: 'min(920px, 100%)', margin: '4vh auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, letterSpacing: 0, color: '#8a8d91' }}>Passo 1 de 2</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', color: '#9A9DA1', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>Fechar</button>
        </div>
        <h2 id="import-title" style={{ fontSize: 'clamp(28px, 3.6vw, 42px)', fontWeight: 600, lineHeight: 1.1, letterSpacing: '-.022em', margin: '12px 0 0' }}>Traga seus gastos</h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: '#9A9DA1', margin: '10px 0 0', maxWidth: 600 }}>Escolha um jeito. Nada fica salvo até você criar a conta.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14, marginTop: 28 }}>
          {options.map((option) => {
            const on = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => setMode(option.id)}
                style={on
                  ? { textAlign: 'left', padding: '20px 22px', borderRadius: 16, border: '1px solid #C0C2C5', background: 'linear-gradient(135deg,#34373c,#1b1d21)', color: '#F2F3F4', fontFamily: 'inherit', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.1)' }
                  : { textAlign: 'left', padding: '20px 22px', borderRadius: 16, border: '1px solid #2A2D31', background: '#131417', color: '#EDEFF1', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, letterSpacing: 0, color: on ? '#C0C2C5' : '#8a8d91' }}>{option.kicker}</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>{option.title}</div>
                <div style={{ fontSize: 14, color: '#9A9DA1', marginTop: 4 }}>{option.detail}</div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, borderRadius: 18, border: '1px solid #3a3d42', background: 'linear-gradient(160deg,#1e2024,#131417)', padding: 26 }}>
          {mode === 'ofx' && preview && (
            <div role="region" aria-label="Prévia do extrato" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{preview.data.filename}</div>
                <div style={{ fontSize: 14, color: '#9A9DA1', marginTop: 4, lineHeight: 1.5 }}>
                  Confira o tipo de cada linha. Nada foi gravado ainda.
                  {preview.data.skipped > 0 && (preview.data.skipped === 1 ? ' 1 linha não pôde ser lida.' : ` ${preview.data.skipped} linhas não puderam ser lidas.`)}
                </div>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 12, border: '1px solid #2A2D31' }}>
                {preview.data.rows.map((row) => {
                  const kind = preview.kinds[row.index] ?? row.kind;
                  return (
                    <div key={row.index} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderTop: row.index === 0 ? 'none' : '1px solid #2A2D31', opacity: row.alreadyImported ? 0.55 : 1 }}>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: '#8a8d91' }}>{dayMonth(row.date)}</span>
                      <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.merchant}</span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, textAlign: 'right' }}>{kind === 'income' ? signedBrl(row.amountCents) : brl(reais(row.amountCents))}</span>
                      {row.alreadyImported ? (
                        <span style={{ fontSize: 13, color: '#8a8d91' }}>Já importada</span>
                      ) : (
                        <select
                          aria-label={`Tipo de ${row.merchant} em ${dayMonth(row.date)}`}
                          value={kind}
                          disabled={busy}
                          onChange={(event) => changeRowKind(row.index, event.target.value as ExpenseKind)}
                          style={{ height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid #3a3d42', background: '#16181b', color: '#EDEFF1', fontFamily: 'inherit', fontSize: 13 }}
                        >
                          <option value="expense">Gasto</option>
                          <option value="income">Entrada</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy || newRows.length === 0} onClick={() => void confirmPreview()} style={{ height: 46, padding: '0 22px', borderRadius: 999, border: 'none', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  Confirmar importação
                </button>
                <button type="button" disabled={busy} onClick={() => { setPreview(null); setFileError(''); }} style={{ height: 46, padding: '0 18px', borderRadius: 999, border: '1px solid #3a3d42', background: '#16181b', color: '#EDEFF1', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  Escolher outro arquivo
                </button>
                <span style={{ fontSize: 14, color: '#9A9DA1' }}>
                  {newRows.length === 0
                    ? 'Todas as linhas já foram importadas.'
                    : `${newRows.length - newIncomes} ${newRows.length - newIncomes === 1 ? 'gasto' : 'gastos'} · ${newIncomes} ${newIncomes === 1 ? 'entrada' : 'entradas'}`}
                </span>
              </div>
              {fileError && <div style={{ fontSize: 14, color: '#EDEFF1' }}>{fileError}</div>}
            </div>
          )}

          {mode === 'ofx' && !preview && (
            <div
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 24, borderRadius: 14, border: `1.5px dashed ${dragOver ? '#C0C2C5' : '#3a3d42'}`, background: 'rgba(12,13,15,.5)' }}
            >
              <div style={{ fontSize: 18, fontWeight: 600 }}>Arraste o extrato aqui</div>
              <div style={{ fontSize: 14, color: '#9A9DA1', maxWidth: 420, lineHeight: 1.5 }}>No app do banco: Extrato → Exportar → OFX, CSV ou PDF. Até 5 MB.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px', borderRadius: 999, background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".ofx,.qfx,.csv,.pdf,text/plain,text/csv,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void importFile(file);
                    }}
                  />
                  Escolher arquivo
                </label>
                <button type="button" disabled={busy} onClick={useExampleStatement} style={{ height: 44, padding: '0 18px', borderRadius: 999, border: '1px solid #3a3d42', background: '#16181b', color: '#EDEFF1', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  Usar extrato de exemplo
                </button>
              </div>
              {fileError && <div style={{ fontSize: 14, color: '#EDEFF1' }}>{fileError}</div>}
            </div>
          )}

          {mode === 'nfe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label htmlFor="nfe-key" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, letterSpacing: 0, color: '#8a8d91' }}>
                Chave de acesso da nota · {keyDigits.length} / 44
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  id="nfe-key"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                  value={groupsOfFour(keyDigits)}
                  onChange={(event) => {
                    setKeyDigits(event.target.value.replace(/\D/g, '').slice(0, 44));
                    setNote(null);
                    setNoteError('');
                  }}
                  style={{ flex: '1 1 420px', minWidth: 0, height: 50, padding: '0 16px', borderRadius: 12, border: '1px solid #2A2D31', background: '#0c0d0f', color: '#F2F3F4', fontFamily: "'Geist Mono', monospace", fontSize: 14, outline: 'none' }}
                />
                <button
                  type="button"
                  disabled={keyDigits.length !== 44 || busy}
                  onClick={searchNote}
                  style={keyDigits.length === 44
                    ? { height: 50, padding: '0 24px', borderRadius: 999, border: 'none', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
                    : { height: 50, padding: '0 24px', borderRadius: 999, border: '1px solid #2A2D31', background: '#16181b', color: '#5F6266', fontFamily: 'inherit', fontSize: 15, fontWeight: 600 }}
                >
                  Buscar nota
                </button>
              </div>
              <button type="button" onClick={() => { setKeyDigits(EXAMPLE_KEY); setNote(null); setNoteError(''); }} style={{ fontSize: 13, color: '#C0C2C5', alignSelf: 'flex-start', textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                Usar uma chave de exemplo
              </button>
              {noteError && <div style={{ fontSize: 14, color: '#EDEFF1' }}>{noteError}</div>}
              {note && (
                <div style={{ marginTop: 6, padding: 18, borderRadius: 14, border: '1px solid #3a3d42', background: '#131417', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{note.merchant}</div>
                      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#8a8d91', marginTop: 4 }}>{note.spentOn.slice(8, 10) + '/' + note.spentOn.slice(5, 7) + '/' + note.spentOn.slice(0, 4)}</div>
                    </div>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 24, fontWeight: 600, color: '#F2F3F4' }}>{brl(reais(note.amountCents))}</div>
                  </div>
                  <KindChips value={noteKind} onChange={setNoteKind} />
                  {noteKind === 'expense' && <CategoryChips value={noteCategory} onChange={setNoteCategory} />}
                  <button type="button" disabled={busy} onClick={() => void addNote()} style={{ alignSelf: 'flex-start', height: 46, padding: '0 22px', borderRadius: 999, border: 'none', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                    {noteKind === 'income' ? 'Adicionar às entradas' : 'Adicionar aos gastos'}
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="gasto-onde" style={{ display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: 13, letterSpacing: 0, color: '#8a8d91', marginBottom: 8 }}>Onde</label>
                <input id="gasto-onde" placeholder="Ex.: Padaria da esquina" value={where} onChange={(event) => { setWhere(event.target.value); setManualError(''); }} style={{ width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 12, border: '1px solid #2A2D31', background: '#0c0d0f', color: '#EDEFF1', fontFamily: 'inherit', fontSize: 15, outline: 'none' }} />
              </div>
              <div>
                <label htmlFor="gasto-valor" style={{ display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: 13, letterSpacing: 0, color: '#8a8d91', marginBottom: 8 }}>Valor</label>
                <input id="gasto-valor" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(event) => { setAmount(event.target.value); setManualError(''); setConfirmHuge(false); }} style={{ width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 12, border: '1px solid #2A2D31', background: '#0c0d0f', color: '#F2F3F4', fontFamily: "'Geist Mono', monospace", fontSize: 15, outline: 'none' }} />
              </div>
              <div>
                <label htmlFor="gasto-data" style={{ display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: 13, letterSpacing: 0, color: '#8a8d91', marginBottom: 8 }}>Data</label>
                <input id="gasto-data" type="date" max={saoPauloToday()} value={date} onChange={(event) => setDate(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 12, border: '1px solid #2A2D31', background: '#0c0d0f', color: '#EDEFF1', fontFamily: "'Geist Mono', monospace", fontSize: 14, outline: 'none' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <KindChips value={manualKind} onChange={setManualKind} />
                {manualKind === 'expense' && <CategoryChips value={manualCategory} onChange={setManualCategory} />}
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => void addManual()} style={{ height: 46, padding: '0 22px', borderRadius: 999, border: 'none', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  {confirmHuge ? 'Confirmar valor' : manualKind === 'income' ? 'Adicionar entrada' : 'Adicionar gasto'}
                </button>
                {manualError && <span style={{ fontSize: 14, color: '#EDEFF1' }}>{manualError}</span>}
              </div>
            </div>
          )}
        </div>

        {statements.some((item) => item.expenseCount > 0) && (
          <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {statements.filter((item) => item.expenseCount > 0).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void onUndoImport(item.id).then(() => {
                    setStatements((current) => current.filter((row) => row.id !== item.id));
                    if (item.id === lastStatementId) {
                      setLoaded((current) => Math.max(0, current - item.expenseCount));
                      setLastImported(0);
                      setLastStatementId(null);
                    }
                  }).catch(() => {
                    setFileError('Não conseguimos desfazer essa importação. Os gastos continuam no painel.');
                  });
                }}
                style={{ height: 40, padding: '0 14px', borderRadius: 999, border: '1px solid #3a3d42', background: '#16181b', color: '#EDEFF1', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                {'Desfazer ' + item.filename}
              </button>
            ))}
          </div>
        )}

        {loaded > 0 && (
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '16px 20px', borderRadius: 16, border: '1px solid #2A2D31', background: '#131417' }}>
            <span style={{ fontSize: 15 }}>
              <b style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>{loaded}</b>
              {loaded === 1 ? ' lançamento carregado. Pode juntar outros jeitos.' : ' lançamentos carregados. Pode juntar outros jeitos.'}
            </span>
            <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={onDone} style={{ height: 44, padding: '0 20px', borderRadius: 999, border: 'none', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                Ver minhas contas
              </button>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
