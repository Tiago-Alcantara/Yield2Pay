let pending: string | null = null;

export function setPendingRoute(path: string | null): void {
  pending = path;
}

export function consumePendingRoute(): string | null {
  const path = pending;
  pending = null;
  return path;
}
