/**
 * OpenRouter API client for multi-step AI chaining.
 * Handles requests, retries, JSON enforcement, and rate limiting.
 */
import type {
    OpenRouterRequest,
    OpenRouterResponse,
    OpenRouterError,
} from '@/types/productDNA';
import { loadAIConfig } from './aiConfigService';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

/** Get the OpenRouter API key from localStorage or environment */
function getApiKey(): string {
    const config = loadAIConfig();
    const key = config.openrouter.apiKey;
    if (!key || key.startsWith('%')) {
        const runtimeEnv = (window as any).__env__ || {};
        const envKey =
            runtimeEnv.VITE_OPENROUTER_API_KEY ||
            (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_OPENROUTER_API_KEY : null);
        if (!envKey || (envKey as string).startsWith('%')) {
            throw new Error(
                'OpenRouter API key not configured. Set it in Settings > AI Configuration, or set VITE_OPENROUTER_API_KEY in your environment.'
            );
        }
        return envKey as string;
    }
    return key;
}

/** Delay helper for retry backoff */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if an error is retryable */
function isRetryableError(status: number): boolean {
    return status === 429 || status >= 500;
}

/**
 * Send a request to OpenRouter and return the parsed JSON response.
 * Automatically enforces JSON output format and retries on failure.
 */
export async function callOpenRouter(
    request: OpenRouterRequest,
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        /** AbortSignal to cancel the request */
        signal?: AbortSignal;
    }
): Promise<Record<string, unknown>> {
    const apiKey = getApiKey();

    const body: OpenRouterRequest = {
        model: options?.model ?? DEFAULT_MODEL,
        messages: request.messages,
        response_format: { type: 'json_object' },
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 4096,
    };

    let lastError: Error | null = null;
    const signal = options?.signal;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (signal?.aborted) {
            throw new Error('OpenRouter request aborted');
        }

        if (attempt > 0) {
            const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(
                `[OpenRouter] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`
            );
            await delay(backoff);
        }

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Soctiv CRM',
                },
                body: JSON.stringify(body),
                signal: signal ?? undefined,
            });

            if (!response.ok) {
                const errorBody = (await response.json().catch(() => ({}))) as OpenRouterError;
                const errorMsg =
                    errorBody?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`;

                if (isRetryableError(response.status)) {
                    lastError = new Error(errorMsg);
                    continue;
                }

                throw new Error(errorMsg);
            }

            const data = (await response.json()) as OpenRouterResponse;

            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('OpenRouter returned empty response content');
            }

            // Parse the JSON response
            try {
                const parsed = JSON.parse(content) as Record<string, unknown>;
                return parsed;
            } catch (parseError) {
                throw new Error(
                    `Failed to parse OpenRouter JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
                );
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Never retry aborted requests
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
            }

            const status = (error as any)?.status;
            const isRetryable =
                isRetryableError(Number(status)) ||
                (error instanceof TypeError && error.message === 'Failed to fetch');

            if (!isRetryable) {
                throw lastError;
            }
            // otherwise loop continues to next attempt
        }
    }

    throw lastError ?? new Error('OpenRouter request failed after all retries');
}

/**
 * Convenience wrapper to call OpenRouter and validate against a Zod schema.
 * Returns the validated typed output.
 */
export async function callOpenRouterTyped<T>(
    schema: { parse: (data: unknown) => T },
    request: OpenRouterRequest,
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        /** AbortSignal to cancel the request */
        signal?: AbortSignal;
    }
): Promise<T> {
    const raw = await callOpenRouter(request, options);
    return schema.parse(raw);
}