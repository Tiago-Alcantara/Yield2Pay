export const SCENE_SECONDS = 8;
export const SPEEDS = [1, 1.25, 1.5, 2] as const;
export const PLAYBACK_KEY = 'y2p-aula-cripto-v2';

export interface PlaybackSave {
  li: number;
  pos: number[];
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function lessonDuration(sceneCount: number): number {
  return Math.max(0, sceneCount) * SCENE_SECONDS;
}

export function sceneIndex(time: number, sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  return Math.min(sceneCount - 1, Math.max(0, Math.floor(time / SCENE_SECONDS)));
}

export function segmentFill(time: number, index: number, sceneCount: number): number {
  if (sceneCount <= 0 || index < 0 || index >= sceneCount) return 0;
  const total = lessonDuration(sceneCount);
  const current = sceneIndex(time, sceneCount);
  if (index < current || (index === current && time >= total)) return 100;
  if (index !== current) return 0;
  return Math.min(1, Math.max(0, (time - index * SCENE_SECONDS) / SCENE_SECONDS)) * 100;
}

export function seekTime(index: number, sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  const clamped = Math.max(0, Math.min(sceneCount - 1, index));
  return clamped * SCENE_SECONDS + 0.001;
}

export function nextSpeed(current: number): number {
  const index = SPEEDS.indexOf(current as (typeof SPEEDS)[number]);
  return SPEEDS[(index + 1) % SPEEDS.length];
}

export function firstOpenIndex(done: boolean[]): number {
  const pending = done.findIndex((item) => !item);
  return pending < 0 ? 0 : pending;
}

export function aprenderPath(lessonNumber: number): string {
  return `/family/aprender?aula=${lessonNumber}`;
}

export function readPlayback(storage: Pick<Storage, 'getItem'>, count: number): PlaybackSave {
  const empty = { li: 0, pos: Array.from({ length: count }, () => 0) };
  try {
    const raw = JSON.parse(storage.getItem(PLAYBACK_KEY) || 'null') as { li?: number; pos?: number[] } | null;
    if (!raw || count <= 0) return empty;
    return {
      li: Math.min(count - 1, Math.max(0, raw.li || 0)),
      pos: Array.from({ length: count }, (_, index) => {
        const value = raw.pos?.[index] ?? 0;
        return Number.isFinite(value) ? Math.max(0, value) : 0;
      }),
    };
  } catch {
    return empty;
  }
}

export function writePlayback(storage: Pick<Storage, 'setItem'>, save: PlaybackSave): void {
  storage.setItem(PLAYBACK_KEY, JSON.stringify({ li: save.li, pos: save.pos }));
}
