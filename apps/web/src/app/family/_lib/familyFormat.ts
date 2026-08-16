/**
 * Formatação monetária das telas de família.
 *
 * O saldo é exibido sempre em reais, nas duas línguas — o design em inglês
 * também usa "R$", porque a família deposita e saca por PIX.
 */

/** "R$ 1.234,56" */
export function fmtBRL(value: number): string {
  return (
    'R$ ' +
    Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** "R$ 1.235" — usado onde o centavo só polui (slider, metas de depósito). */
export function fmtBRLShort(value: number): string {
  return 'R$ ' + Math.round(value).toLocaleString('pt-BR');
}

/** Lê um valor digitado em pt-BR ("1.234,56") como number. Inválido vira 0. */
export function parseBRL(input: string): number {
  return parseFloat(String(input).replace(/\./g, '').replace(',', '.')) || 0;
}

/** Filtro de digitação para campos de valor: só dígitos, ponto e vírgula. */
export function numericOnly(input: string): string {
  return input.replace(/[^0-9.,]/g, '');
}

/** Validação de e-mail usada no formulário de lista de espera. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Chave PIX aceita: e-mail ou telefone com 10–14 dígitos. */
export function isValidPixKey(value: string): boolean {
  const v = value.trim();
  if (isValidEmail(v)) return true;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 14;
}
