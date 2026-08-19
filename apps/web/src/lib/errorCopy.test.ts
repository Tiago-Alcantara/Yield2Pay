import { describe, it, expect } from 'vitest';
import { PAGE_COPY, DIALOG_COPY, DIALOG_STATUS_CODES } from './errorCopy';

describe('PAGE_COPY', () => {
  it('covers every status the error page can receive', () => {
    expect(Object.keys(PAGE_COPY).map(Number).sort((a, b) => a - b)).toEqual([
      400, 401, 403, 404, 408, 500, 502, 503,
    ]);
  });

  it('offers no retry on a 404 because retrying cannot fix it', () => {
    expect(PAGE_COPY[404].primary).toBe('home');
    expect(PAGE_COPY[404].secondary).toBeNull();
  });

  it('sends a 401 to login and a 500 to retry', () => {
    expect(PAGE_COPY[401].primary).toBe('login');
    expect(PAGE_COPY[500].primary).toBe('retry');
  });

  it('names the status inside the kicker', () => {
    expect(PAGE_COPY[503].kicker).toContain('503');
  });
});

describe('DIALOG_COPY', () => {
  it('covers only the statuses that leave a usable screen behind the dialog', () => {
    expect(DIALOG_STATUS_CODES).toEqual([400, 401, 403, 408, 500]);
  });

  it('keeps the same kicker as the full page', () => {
    for (const code of DIALOG_STATUS_CODES) {
      expect(DIALOG_COPY[code].kicker).toBe(PAGE_COPY[code].kicker);
    }
  });

  it('shortens the titles that mention the page, since the page is still there', () => {
    expect(DIALOG_COPY[403].title).toBe('Você não tem acesso a isso');
    expect(DIALOG_COPY[500].title).toBe('Não conseguimos concluir agora');
    expect(DIALOG_COPY[401].title).toBe(PAGE_COPY[401].title);
  });

  it('never sends the user home — the secondary action is always closing', () => {
    for (const code of DIALOG_STATUS_CODES) {
      expect(DIALOG_COPY[code].primary).not.toBe('home');
    }
  });

  it('retries the action on a 408 and reviews the data on a 400', () => {
    expect(DIALOG_COPY[408].primary).toBe('retry');
    expect(DIALOG_COPY[400].primary).toBe('review');
  });
});
