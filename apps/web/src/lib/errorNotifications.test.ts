import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ErrorStatusCode } from '@yield2pay/shared';
import {
  publishErrorNotification,
  dismissErrorNotification,
  subscribeToErrorNotifications,
  getErrorNotification,
} from './errorNotifications';

function detailsFor(statusCode: ErrorStatusCode, errorId = 'ERR-0000-0001') {
  return { statusCode, errorId, timestamp: '2026-08-17T13:58:41.207Z' };
}

beforeEach(() => {
  dismissErrorNotification();
});

describe('errorNotifications', () => {
  it('exposes the published notification', () => {
    publishErrorNotification(detailsFor(408));

    expect(getErrorNotification()).toMatchObject({ statusCode: 408 });
  });

  it('starts with nothing to show', () => {
    expect(getErrorNotification()).toBeNull();
  });

  it('notifies subscribers when a notification is published and dismissed', () => {
    const listener = vi.fn();
    subscribeToErrorNotifications(listener);

    publishErrorNotification(detailsFor(500));
    dismissErrorNotification();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToErrorNotifications(listener);
    unsubscribe();

    publishErrorNotification(detailsFor(500));

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores a repeat of the status already on screen so a retry loop cannot flicker it', () => {
    publishErrorNotification(detailsFor(408, 'ERR-AAAA-0001'));
    publishErrorNotification(detailsFor(408, 'ERR-BBBB-0002'));

    expect(getErrorNotification()?.errorId).toBe('ERR-AAAA-0001');
  });

  it('replaces the notification when a different failure arrives', () => {
    publishErrorNotification(detailsFor(408, 'ERR-AAAA-0001'));
    publishErrorNotification(detailsFor(401, 'ERR-BBBB-0002'));

    expect(getErrorNotification()).toMatchObject({ statusCode: 401, errorId: 'ERR-BBBB-0002' });
  });

  it('shows the same status again once the user dismissed the first one', () => {
    publishErrorNotification(detailsFor(408, 'ERR-AAAA-0001'));
    dismissErrorNotification();
    publishErrorNotification(detailsFor(408, 'ERR-BBBB-0002'));

    expect(getErrorNotification()?.errorId).toBe('ERR-BBBB-0002');
  });

  it('maps a status the dialog has no copy for onto one it does', () => {
    publishErrorNotification(detailsFor(502));
    expect(getErrorNotification()?.statusCode).toBe(500);

    dismissErrorNotification();
    publishErrorNotification(detailsFor(404));
    expect(getErrorNotification()?.statusCode).toBe(400);
  });

  it('keeps the original error id when the status is mapped', () => {
    publishErrorNotification(detailsFor(503, 'ERR-CCCC-0003'));

    expect(getErrorNotification()?.errorId).toBe('ERR-CCCC-0003');
  });
});
