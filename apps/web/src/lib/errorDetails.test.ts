import { describe, it, expect } from 'vitest';
import type { ApiErrorPayload } from '@yield2pay/shared';
import { ApiError } from './api';
import { buildErrorDetails } from './errorDetails';

const payload: ApiErrorPayload = {
  statusCode: 500,
  errorId: 'ERR-8F3A-2C91',
  timestamp: '2026-08-17T13:58:41.207Z',
  message: 'Não foi possível concluir a operação.',
  technicalDetails: {
    method: 'POST',
    endpoint: '/deposit/build',
    requestId: 'req_404k4q7pz1m',
    message: 'TypeError: Cannot read properties of undefined',
    stack: 'TypeError: ...\n    at computeYieldSplit',
  },
};

describe('buildErrorDetails', () => {
  it('takes statusCode, errorId and timestamp from the backend payload', () => {
    const details = buildErrorDetails(new ApiError(500, payload));

    expect(details.statusCode).toBe(500);
    expect(details.errorId).toBe('ERR-8F3A-2C91');
    expect(details.timestamp).toBe('2026-08-17T13:58:41.207Z');
  });

  it('drops technicalDetails when the technical panel is off', () => {
    const details = buildErrorDetails(new ApiError(500, payload), {
      showTechnicalDetails: false,
    });

    expect(details.technicalDetails).toBeUndefined();
  });

  it('keeps technicalDetails when the technical panel is on', () => {
    const details = buildErrorDetails(new ApiError(500, payload), {
      showTechnicalDetails: true,
    });

    expect(details.technicalDetails).toEqual(payload.technicalDetails);
  });

  it('falls back to the HTTP status when the body is not the error contract', () => {
    const details = buildErrorDetails(new ApiError(403, null));

    expect(details.statusCode).toBe(403);
    expect(details.errorId).toMatch(/^ERR-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(new Date(details.timestamp).toISOString()).toBe(details.timestamp);
  });

  it('normalizes a status the error screens cannot render', () => {
    expect(buildErrorDetails(new ApiError(422, null)).statusCode).toBe(400);
    expect(buildErrorDetails(new ApiError(504, null)).statusCode).toBe(500);
  });

  it('treats a plain render crash as a 500 with a generated error id', () => {
    const details = buildErrorDetails(new Error('render exploded'));

    expect(details.statusCode).toBe(500);
    expect(details.errorId).toMatch(/^ERR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('describes a render crash in the technical panel when it is on', () => {
    const error = new Error('render exploded');
    const details = buildErrorDetails(error, { showTechnicalDetails: true });

    expect(details.technicalDetails?.message).toBe('Error: render exploded');
    expect(details.technicalDetails?.stack).toContain('render exploded');
  });

  it('carries the Next digest into the requestId so the server log can be found', () => {
    const error = Object.assign(new Error('server component crashed'), { digest: '2748399604' });
    const details = buildErrorDetails(error, { showTechnicalDetails: true });

    expect(details.technicalDetails?.requestId).toBe('digest_2748399604');
  });

  it('accepts an explicit status for the routes that have no error object', () => {
    const details = buildErrorDetails(null, { statusCode: 404 });

    expect(details.statusCode).toBe(404);
  });
});
