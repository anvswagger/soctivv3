import { loadAIConfig } from '@/services/aiConfigService';
import type { OpenRouterMessage } from '@/types/productDNA';

export const GOOGLE_AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_GOOGLE_AI_MODEL = 'gemini-2.0-flash';
export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 1000;

function getApiKey(): string {
    const config = loadAIConfig();
    const key = config.googleAI.apiKey;
    if (!key) {
        throw new Error(
            'Google AI API key not configured. Add it in Settings > AI Configuration.'
        );
    }
    return key;
}

function getModel(): string {
    const config = loadAIConfig();
    return config.googleAI.model || DEFAULT_GOOGLE_AI_MODEL;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

export interface GoogleAIOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
}

export async function callGoogleAI(
    messages: OpenRouterMessage[],
    options?: GoogleAIOptions,
): Promise<string> {
    const apiKey = getApiKey();
    const model = options?.model || getModel();
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 4096;
    const signal = options?.signal;

    const systemMessage = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');

    const parts: { text: string }[] = [];
    if (systemMessage) {
        parts.push({ text: `[System Instruction]\n${systemMessage.content}` });
    }
    for (const m of userMessages) {
        const roleLabel = m.role === 'assistant' ? 'Assistant' : 'User';
        parts.push({ text: `[${roleLabel}]\n${m.content}` });
    }

    const url = `${GOOGLE_AI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
        contents: [{ parts }],
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
        },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (signal?.aborted) {
            throw new Error('Google AI request aborted');
        }

        if (attempt > 0) {
            const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(`[GoogleAI] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`);
            await delay(backoff);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: signal ?? undefined,
            });

            if (!response.ok) {
                const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
                const message =
                    (errorBody.error && typeof errorBody.error === 'object' && 'message' in errorBody.error)
                        ? (errorBody.error as Record<string, string>).message
                        : `HTTP ${response.status}: ${response.statusText}`;

                if (isRetryableStatus(response.status)) {
                    lastError = new Error(message);
                    continue;
                }
                throw new Error(message);
            }

            const data = (await response.json()) as Record<string, unknown>;
            const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
            const candidate = candidates?.[0];
            const content = candidate?.content as Record<string, unknown> | undefined;
            const partsResp = content?.parts as Array<Record<string, unknown>> | undefined;
            const text = partsResp?.[0]?.text as string | undefined;

            if (!text) {
                throw new Error('Google AI returned empty response content');
            }

            return text;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
            }

            const status = (error as Record<string, unknown>)?.status as number | undefined;
            const isRetryable =
                (typeof status === 'number' && isRetryableStatus(status)) ||
                (error instanceof TypeError && error.message === 'Failed to fetch');

            if (!isRetryable) {
                throw lastError;
            }
        }
    }

    throw lastError ?? new Error('Google AI request failed after all retries');
}
