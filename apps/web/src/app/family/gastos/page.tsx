'use client';

/**
 * Gastos do mês — /family/gastos
 *
 * Conta recorrente e nota manual. A consulta da NFC-e fica para a parte 2.
 * Nada aqui é gravado até "Salvar conta", "Confirmar gasto" ou "Confirmar nota".
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import type { ExpenseCategory, MonthExpenseView, RecurringAccountView } from '@yield2pay/shared';
import { ApiError, createApi } from '@/lib/api';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { FamilyBrand } from '../_components/FamilyUI';
import { C, cardLabel, cardStyle, chromeButton, fieldStyle } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'mercado', label: 'Mercado' },
  { value: 'conta_da_casa', label: 'Conta da casa' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'outros', label: 'Outros' },
];

const SOURCE_LABEL = { conta: 'Conta', nota: 'Nota' } as const;

function formatCentavos(cents: number): string {
  const reais = Math.floor(Math.abs(cents) / 100).toLocaleString('pt-BR');
  const frac = String(Math.abs(cents) % 100).padStart(2, '0');
  return `R$ ${reais},${frac}`;
}

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function reaisToCentavos(input: string): number | null {
  const match = input.trim().match(/^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/);
  if (!match) return null;
  const reais = Number(match[1].replace(/\./g, ''));
  const frac = (match[2] ?? '').padEnd(2, '0');
  const cents = reais * 100 + Number(frac || '0');
  if (!Number.isInteger(cents) || cents < 1 || cents > 2147483647) return null;
  return cents;
}

function belongsToMonth(row: MonthExpenseView, month: string): boolean {
  return month.length === 7 && row.spentOn.startsWith(month);
}

function categoryLabel(category: ExpenseCategory): string {
  return CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

function Shell({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <div className="fam-center-shell">
        <div style={{ marginBottom: 'clamp(22px,5vw,34px)' }}>
          <FamilyBrand tag={tag} size={20} href="/family/dashboard" />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function GastosPage() {
  const { t } = useFamily();
  if (!isPrivyConfigured) {
    return (
      <Shell tag={t.brandTag}>
        <div style={{ ...cardStyle(20, 28), width: '100%', maxWidth: 420 }}>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text2, margin: 0 }}>
            Entre com sua conta para ver os gastos do mês.
          </p>
          <Link href="/login" style={{ color: C.silver, display: 'inline-block', marginTop: 14 }}>
            Entrar
          </Link>
        </div>
      </Shell>
    );
  }
  return <GastosScreen tag={t.brandTag} />;
}

function GastosScreen({ tag }: { tag: string }) {
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const [month, setMonth] = useState('');
  const [expenses, setExpenses] = useState<MonthExpenseView[]>([]);
  const [contas, setContas] = useState<RecurringAccountView[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [openConta, setOpenConta] = useState<string | null>(null);
  const [contaCategory, setContaCategory] = useState<ExpenseCategory | ''>('');
  const [merchant, setMerchant] = useState('');
  const [notaAmount, setNotaAmount] = useState('');
  const [notaDate, setNotaDate] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [notaCategory, setNotaCategory] = useState<ExpenseCategory | ''>('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [month, saved] = await Promise.all([api.listMonthExpenses(), api.listContas()]);
      if (cancelled) return;
      setMonth(month.month);
      setExpenses(month.expenses);
      setContas(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function saveConta(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = reaisToCentavos(amount);
    if (!name.trim() || amountCents == null) {
      setFormError('Informe o nome e um valor em reais.');
      return;
    }
    setFormError('');
    const saved = await api.createConta({ name: name.trim(), amountCents });
    setContas((prev) => [...prev, saved]);
    setName('');
    setAmount('');
  }

  async function confirmGasto(id: string) {
    if (!contaCategory) return;
    try {
      const row = await api.jaGastei(id, { category: contaCategory });
      setExpenses((prev) => (belongsToMonth(row, month) ? [...prev, row] : prev));
      setContas((prev) => prev.map((conta) => (conta.id === id ? { ...conta, spentThisMonth: true } : conta)));
      setOpenConta(null);
      setContaCategory('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setContas((prev) => prev.map((conta) => (conta.id === id ? { ...conta, spentThisMonth: true } : conta)));
        setFormError('Já lançado neste mês.');
      }
    }
  }

  async function confirmNota(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = reaisToCentavos(notaAmount);
    const key = accessKey.trim();
    if (!merchant.trim() || amountCents == null || !notaDate || !notaCategory) {
      setFormError('Informe estabelecimento, valor, data e categoria.');
      return;
    }
    if (key && !/^\d{44}$/.test(key)) {
      setFormError('A chave de acesso tem 44 dígitos.');
      return;
    }
    setFormError('');
    const row = await api.confirmNota({
      merchant: merchant.trim(),
      amountCents,
      spentOn: notaDate,
      category: notaCategory,
      ...(key ? { accessKey: key } : {}),
    });
    setExpenses((prev) => (belongsToMonth(row, month) ? [...prev, row] : prev));
    setMerchant('');
    setNotaAmount('');
    setNotaDate('');
    setAccessKey('');
    setNotaCategory('');
  }

  return (
    <Shell tag={tag}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section style={cardStyle(20, 24)}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: C.textStrong }}>
            Gastos do mês
          </h1>
          {expenses.length === 0 ? (
            <p style={{ color: C.text2, margin: '14px 0 0' }}>Nenhum gasto neste mês.</p>
          ) : (
            <ul aria-label="Gastos do mês" style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}>
              {expenses.map((row) => (
                <li
                  key={row.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr auto',
                    gap: 8,
                    padding: '12px 0',
                    borderTop: `1px solid ${C.border}`,
                    color: C.text,
                  }}
                >
                  <span>{row.merchant}</span>
                  <span style={{ fontFamily: C.mono, textAlign: 'right' }}>{formatCentavos(row.amountCents)}</span>
                  <span style={{ color: C.text2, fontSize: 13 }}>{formatIsoDate(row.spentOn)}</span>
                  <span style={{ color: C.text2, fontSize: 13, textAlign: 'right' }}>
                    {SOURCE_LABEL[row.source]} · {categoryLabel(row.category)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={(event) => void saveConta(event)} style={cardStyle(20, 24)}>
          <h2 style={{ fontSize: 18, margin: 0, color: C.textStrong }}>Conta recorrente</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: C.text2, margin: '8px 0 0' }}>
            O nome e o valor ficam salvos. O gasto do mês só aparece quando você confirma que já gastou.
          </p>
          <label htmlFor="fam-conta-nome" style={{ ...cardLabel, display: 'block', marginTop: 16 }}>
            Nome da conta
          </label>
          <input id="fam-conta-nome" value={name} onChange={(e) => setName(e.target.value)} style={{ ...fieldStyle(), marginTop: 8 }} />
          <label htmlFor="fam-conta-valor" style={{ ...cardLabel, display: 'block', marginTop: 14 }}>
            Valor da conta
          </label>
          <input
            id="fam-conta-valor"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            style={{ ...fieldStyle(), marginTop: 8 }}
          />
          <button type="submit" className="btn-shine" style={{ ...chromeButton, width: '100%', marginTop: 16 }}>
            Salvar conta
          </button>
          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
            {contas.map((conta) => (
              <li key={conta.id} style={{ padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{conta.name}</span>
                  <span style={{ fontFamily: C.mono }}>{formatCentavos(conta.amountCents)}</span>
                </div>
                {conta.spentThisMonth ? (
                  <button type="button" disabled style={{ ...chromeButton, width: '100%', marginTop: 10, opacity: 0.6 }}>
                    Já lançado neste mês
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`já gastei ${conta.name}`}
                    onClick={() => {
                      setOpenConta(conta.id);
                      setContaCategory('');
                    }}
                    style={{ ...chromeButton, width: '100%', marginTop: 10 }}
                  >
                    já gastei
                  </button>
                )}
                {openConta === conta.id && !conta.spentThisMonth && (
                  <div style={{ marginTop: 10 }}>
                    <label htmlFor="fam-gasto-categoria" style={{ ...cardLabel, display: 'block' }}>
                      Categoria do gasto
                    </label>
                    <select
                      id="fam-gasto-categoria"
                      value={contaCategory}
                      onChange={(e) => setContaCategory(e.target.value as ExpenseCategory)}
                      style={{ ...fieldStyle({ mono: false }), marginTop: 8 }}
                    >
                      <option value="">Escolha</option>
                      {CATEGORIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!contaCategory}
                      onClick={() => void confirmGasto(conta.id)}
                      style={{ ...chromeButton, width: '100%', marginTop: 10 }}
                    >
                      Confirmar gasto
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </form>

        <form onSubmit={(event) => void confirmNota(event)} style={cardStyle(20, 24)}>
          <h2 style={{ fontSize: 18, margin: 0, color: C.textStrong }}>Nota</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: C.text2, margin: '8px 0 0' }}>
            Preencha os campos. A nota só entra no mês quando você confirma.
          </p>
          <label htmlFor="fam-nota-merchant" style={{ ...cardLabel, display: 'block', marginTop: 16 }}>
            Estabelecimento
          </label>
          <input
            id="fam-nota-merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            style={{ ...fieldStyle({ mono: false }), marginTop: 8 }}
          />
          <label htmlFor="fam-nota-valor" style={{ ...cardLabel, display: 'block', marginTop: 14 }}>
            Valor da nota
          </label>
          <input
            id="fam-nota-valor"
            inputMode="decimal"
            value={notaAmount}
            onChange={(e) => setNotaAmount(e.target.value)}
            placeholder="0,00"
            style={{ ...fieldStyle(), marginTop: 8 }}
          />
          <label htmlFor="fam-nota-data" style={{ ...cardLabel, display: 'block', marginTop: 14 }}>
            Data da nota
          </label>
          <input
            id="fam-nota-data"
            type="date"
            value={notaDate}
            onChange={(e) => setNotaDate(e.target.value)}
            style={{ ...fieldStyle(), marginTop: 8 }}
          />
          <label htmlFor="fam-nota-chave" style={{ ...cardLabel, display: 'block', marginTop: 14 }}>
            Chave de acesso
          </label>
          <input
            id="fam-nota-chave"
            inputMode="numeric"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value.replace(/\D/g, '').slice(0, 44))}
            placeholder="44 dígitos, se tiver"
            style={{ ...fieldStyle(), marginTop: 8 }}
          />
          <label htmlFor="fam-nota-categoria" style={{ ...cardLabel, display: 'block', marginTop: 14 }}>
            Categoria da nota
          </label>
          <select
            id="fam-nota-categoria"
            value={notaCategory}
            onChange={(e) => setNotaCategory(e.target.value as ExpenseCategory)}
            style={{ ...fieldStyle({ mono: false }), marginTop: 8 }}
          >
            <option value="">Escolha</option>
            {CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-shine" style={{ ...chromeButton, width: '100%', marginTop: 16 }}>
            Confirmar nota
          </button>
        </form>
        {formError && (
          <p role="alert" style={{ color: C.danger, margin: 0 }}>
            {formError}
          </p>
        )}
      </div>
    </Shell>
  );
}
