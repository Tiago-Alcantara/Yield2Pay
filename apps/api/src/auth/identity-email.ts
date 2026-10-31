/**
 * Módulo: identity-email
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: O e-mail de posse sai do identity token assinado, não da tabela.
 * Sequência: lê linked_accounts; Google vem antes do e-mail solto.
 */

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) throw new Error('invalid token');
  const payload: unknown = JSON.parse(
    Buffer.from(part, 'base64url').toString('utf8'),
  );
  if (!payload || typeof payload !== 'object') throw new Error('invalid token');
  return payload as Record<string, unknown>;
}

export function emailFromLinkedAccounts(raw: unknown): string | null {
  const accounts = linkedAccounts(raw);
  const google = accounts.find(
    (item) => item.type === 'google_oauth' && typeof item.email === 'string',
  );
  if (google && typeof google.email === 'string' && google.email.trim()) {
    return google.email.trim().toLowerCase();
  }
  const email = accounts.find(
    (item) => item.type === 'email' && typeof item.address === 'string',
  );
  if (email && typeof email.address === 'string' && email.address.trim()) {
    return email.address.trim().toLowerCase();
  }
  return null;
}

function linkedAccounts(raw: unknown): Record<string, unknown>[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const accounts: Record<string, unknown>[] = [];
  for (const item of parsed as unknown[]) {
    if (isRecord(item)) accounts.push(item);
  }
  return accounts;
}

export function isSignatureFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code =
    'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return true;
  const message = error instanceof Error ? error.message : '';
  return /signature/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}
