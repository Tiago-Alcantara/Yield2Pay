/**
 * Módulo: privy-token-cache.http
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A chave gira mesmo com o cliente real do Privy, que guarda a primeira para sempre.
 * Sequência: o HTTP é o único mock; o SDK envenenado não impede o refetch.
 */
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import {
  createPrivyTokenCache,
  fetchPrivyVerificationKey,
} from './privy-token-cache';

const require = createRequire(__filename);
const { generateKeyPair, exportSPKI, SignJWT } = require(
  require.resolve('jose', {
    paths: [require.resolve('@privy-io/server-auth')],
  }),
) as {
  generateKeyPair: (
    alg: string,
  ) => Promise<{ publicKey: unknown; privateKey: unknown }>;
  exportSPKI: (key: unknown) => Promise<string>;
  SignJWT: new (payload: Record<string, unknown>) => {
    setProtectedHeader(header: Record<string, unknown>): ReturnType;
    setIssuer(issuer: string): ReturnType;
    setAudience(audience: string): ReturnType;
    setSubject(subject: string): ReturnType;
    setIssuedAt(): ReturnType;
    setExpirationTime(time: string): ReturnType;
    sign(key: unknown): Promise<string>;
  };
};

type ReturnType = InstanceType<typeof SignJWT>;

const APP_ID = 'cl_test_app';
const APP_SECRET = 'test-secret';

async function signedToken(privateKey: unknown, subject = 'did:privy:ana') {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuer('privy.io')
    .setAudience(APP_ID)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(privateKey);
}

function appBody(verificationKey: string) {
  return {
    id: APP_ID,
    name: 'test',
    verification_key: verificationKey,
    allowlist_config: {
      error_title: '',
      error_detail: '',
      cta_text: '',
      cta_link: '',
    },
    created_at: 0,
    updated_at: 0,
  };
}

type PrivySdk = {
  getVerificationKey: () => Promise<string>;
  verifyAuthToken: (
    token: string,
    verificationKeyOverride?: string,
  ) => Promise<{ userId: string }>;
  getUser: (id: string) => Promise<{
    google?: { email?: string | null } | null;
    email?: { address?: string | null } | null;
  }>;
};

describe('cliente real do Privy', () => {
  let server: Server;
  let calls: string[] = [];
  let current = '';
  let hang = false;
  let Client: new (appId: string, appSecret: string) => PrivySdk;

  beforeAll(async () => {
    server = createServer((req, res) => {
      calls.push(req.url ?? '');
      if (hang) return;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(appBody(current)));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('servidor de teste sem porta');
    }
    process.env.PRIVY_API_URL = `http://127.0.0.1:${address.port}`;
    const loaded = (await import('@privy-io/server-auth')) as {
      PrivyClient: new (appId: string, appSecret: string) => PrivySdk;
    };
    Client = loaded.PrivyClient;
  });

  afterAll(async () => {
    delete process.env.PRIVY_API_URL;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    calls = [];
    hang = false;
  });

  it('busca a chave fora do cache do SDK e aceita a chave nova depois da rotação', async () => {
    const first = await generateKeyPair('ES256');
    const second = await generateKeyPair('ES256');
    const firstPem = await exportSPKI(first.publicKey);
    const secondPem = await exportSPKI(second.publicKey);
    current = firstPem;

    const sdk = new Client(APP_ID, APP_SECRET);
    await sdk.getVerificationKey();
    expect(calls).toHaveLength(1);

    current = secondPem;
    let clock = 0;
    const cache = createPrivyTokenCache(sdk, {
      fetchVerificationKey: () => fetchPrivyVerificationKey(APP_ID, APP_SECRET),
      now: () => clock,
    });
    const rotated = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        signedToken(second.privateKey, `did:privy:user-${index}`),
      ),
    );
    const results = await Promise.all(
      rotated.map((token) => cache.verify(token)),
    );
    expect(results.map((row) => row.privyUserId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `did:privy:user-${index}`),
    );
    expect(calls).toHaveLength(2);

    const oldToken = await signedToken(first.privateKey, 'did:privy:ana');
    current = firstPem;
    clock = 45_000;
    await expect(cache.verify(oldToken)).resolves.toEqual({
      privyUserId: 'did:privy:ana',
    });
    expect(calls).toHaveLength(3);
    expect(calls.every((url) => url.includes(`/api/v1/apps/${APP_ID}`))).toBe(
      true,
    );
  });

  it('cem tokens forjados não disparam uma busca por token', async () => {
    const pair = await generateKeyPair('ES256');
    current = await exportSPKI(pair.publicKey);
    const sdk = new Client(APP_ID, APP_SECRET);
    const cache = createPrivyTokenCache(sdk, {
      fetchVerificationKey: () => fetchPrivyVerificationKey(APP_ID, APP_SECRET),
    });
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: 'privy.io',
        aud: APP_ID,
        sub: 'did:privy:x',
        iat: 1,
        exp: 4_000_000_000,
      }),
    ).toString('base64url');
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        cache
          .verify(`${header}.${payload}.bad-${index}`)
          .catch(() => undefined),
      ),
    );
    expect(calls).toHaveLength(2);
  });

  it('recusa chave lixo e RSA', async () => {
    current = 'nao-e-uma-chave';
    await expect(fetchPrivyVerificationKey(APP_ID, APP_SECRET)).rejects.toThrow(
      'chave do Privy inválida',
    );
    const rsa = await generateKeyPair('RS256');
    current = await exportSPKI(rsa.publicKey);
    await expect(fetchPrivyVerificationKey(APP_ID, APP_SECRET)).rejects.toThrow(
      'chave do Privy inválida',
    );
  });

  it('desiste quando o Privy não responde', async () => {
    hang = true;
    const started = Date.now();
    await expect(
      fetchPrivyVerificationKey(APP_ID, APP_SECRET),
    ).rejects.toThrow();
    const elapsed = Date.now() - started;
    hang = false;
    server.closeAllConnections();
    expect(elapsed).toBeGreaterThanOrEqual(5_000);
    expect(elapsed).toBeLessThan(12_000);
  }, 15_000);
});
