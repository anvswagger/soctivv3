export const CORRELATION_ID_HEADER = 'x-correlation-id';

const LAST_CORRELATION_ID_STORAGE_KEY = 'soctiv_last_correlation_id';

function randomSegment(): string {
    return Math.random().toString(36).slice(2, 10);
}

export function createCorrelationId(prefix = 'web'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    const ts = Date.now().toString(36);
    return `${prefix}-${ts}-${randomSegment()}`;
}

export function rememberCorrelationId(correlationId: string | null | undefined): void {
    if (!correlationId || typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.setItem(LAST_CORRELATION_ID_STORAGE_KEY, correlationId);
    } catch {
        // Ignore storage failures in private mode / restricted browsers.
    }
}

export function getLastCorrelationId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return window.sessionStorage.getItem(LAST_CORRELATION_ID_STORAGE_KEY);
    } catch {
        return null;
    }
}

