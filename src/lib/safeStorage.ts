type StorageKind = 'local' | 'session';

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGet(kind: StorageKind, key: string): string | null {
  try {
    return getStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(kind: StorageKind, key: string, value: string): void {
  try {
    getStorage(kind)?.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

function safeRemove(kind: StorageKind, key: string): void {
  try {
    getStorage(kind)?.removeItem(key);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

export function safeLocalGet(key: string): string | null {
  return safeGet('local', key);
}

export function safeLocalSet(key: string, value: string): void {
  safeSet('local', key, value);
}

export function safeLocalRemove(key: string): void {
  safeRemove('local', key);
}

export function safeSessionGet(key: string): string | null {
  return safeGet('session', key);
}

export function safeSessionSet(key: string, value: string): void {
  safeSet('session', key, value);
}

export function safeReadJson<T>(
  kind: StorageKind,
  key: string,
  fallback: T,
): T {
  const raw = safeGet(kind, key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    safeRemove(kind, key);
    return fallback;
  }
}
