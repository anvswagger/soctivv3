export type RetryDomain = 'bookingSubmit' | 'bookingSlots' | 'analytics';

export type RetryPolicy = {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
};

const NETWORK_ERROR_RE = /failed to fetch|network|timeout|temporarily|connection|offline|fetch failed/i;

export const RETRY_POLICY: Record<RetryDomain, RetryPolicy> = {
    // Booking submission is non-idempotent. Avoid automatic retries to prevent duplicates.
    bookingSubmit: {
        maxAttempts: 1,
        baseDelayMs: 0,
        maxDelayMs: 0,
    },
    // Slot discovery is read-only and safe to retry briefly.
    bookingSlots: {
        maxAttempts: 3,
        baseDelayMs: 250,
        maxDelayMs: 1400,
    },
    // Analytics is best-effort; retry lightly without impacting UX.
    analytics: {
        maxAttempts: 2,
        baseDelayMs: 200,
        maxDelayMs: 600,
    },
};

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function backoffDelay(attempt: number, policy: RetryPolicy): number {
    if (attempt <= 1) return 0;
    const expDelay = policy.baseDelayMs * 2 ** (attempt - 2);
    const bounded = Math.min(policy.maxDelayMs, expDelay);
    const jitter = Math.floor(Math.random() * Math.max(10, policy.baseDelayMs / 2));
    return bounded + jitter;
}

export function shouldRetryInvokeError(error: unknown): boolean {
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    if (typeof status === 'number') {
        if (status === 429) return true;
        if (status >= 500) return true;
        return false;
    }

    const message =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : String(error ?? '');

    return NETWORK_ERROR_RE.test(message);
}

export async function withRetry<T>(
    execute: (attempt: number) => Promise<T>,
    policy: RetryPolicy,
    shouldRetry: (error: unknown) => boolean
): Promise<T> {
    const attempts = Math.max(1, policy.maxAttempts);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('OFFLINE');
        }

        try {
            return await execute(attempt);
        } catch (error) {
            lastError = error;
            if (attempt >= attempts || !shouldRetry(error)) {
                throw error;
            }

            const delay = backoffDelay(attempt, policy);
            if (delay > 0) {
                await wait(delay);
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Retry attempts exhausted');
}

