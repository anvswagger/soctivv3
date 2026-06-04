import { safeLocalGet, safeLocalSet } from '@/lib/safeStorage';

export type AIProvider = 'openrouter' | 'google_ai';

export interface OpenRouterConfig {
    apiKey: string;
    model: string;
}

export interface GoogleAIConfig {
    apiKey: string;
    model: string;
}

export interface AIConfig {
    provider: AIProvider;
    openrouter: OpenRouterConfig;
    googleAI: GoogleAIConfig;
}

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
export const DEFAULT_GOOGLE_AI_MODEL = 'gemini-2.0-flash';

export const OPENROUTER_MODELS = [
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
    { value: 'openai/gpt-4o', label: 'GPT-4o (OpenAI)' },
    { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo (OpenAI)' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (Anthropic)' },
    { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku (Anthropic)' },
    { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5 (Google)' },
    { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick (Meta)' },
];

export const GOOGLE_AI_MODELS = [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    { value: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image' },
    { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    { value: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { value: 'gemini-2.5-flash-native-audio', label: 'Gemini 2.5 Flash Audio' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' },
    { value: 'gemini-1.0-pro-vision', label: 'Gemini 1.0 Pro Vision' },
];

const STORAGE_KEY = 'app:ai_config';

function createDefaultConfig(): AIConfig {
    return {
        provider: 'openrouter',
        openrouter: {
            apiKey: '',
            model: DEFAULT_OPENROUTER_MODEL,
        },
        googleAI: {
            apiKey: '',
            model: DEFAULT_GOOGLE_AI_MODEL,
        },
    };
}

export function loadAIConfig(): AIConfig {
    try {
        const raw = safeLocalGet(STORAGE_KEY);
        if (!raw) return createDefaultConfig();
        const parsed = JSON.parse(raw) as Partial<AIConfig>;
        const defaults = createDefaultConfig();
        return {
            provider: parsed.provider || defaults.provider,
            openrouter: {
                apiKey: (parsed.openrouter as Partial<OpenRouterConfig> | undefined)?.apiKey || '',
                model: (parsed.openrouter as Partial<OpenRouterConfig> | undefined)?.model || DEFAULT_OPENROUTER_MODEL,
            },
            googleAI: {
                apiKey: (parsed.googleAI as Partial<GoogleAIConfig> | undefined)?.apiKey || '',
                model: (parsed.googleAI as Partial<GoogleAIConfig> | undefined)?.model || DEFAULT_GOOGLE_AI_MODEL,
            },
        };
    } catch {
        return createDefaultConfig();
    }
}

export function saveAIConfig(config: AIConfig): void {
    try {
        safeLocalSet(STORAGE_KEY, JSON.stringify(config));
    } catch {
        // ignore storage failures
    }
}

export function getActiveConfig(): { apiKey: string; model: string } | null {
    const config = loadAIConfig();
    if (config.provider === 'openrouter') {
        if (!config.openrouter.apiKey) return null;
        return { apiKey: config.openrouter.apiKey, model: config.openrouter.model };
    }
    if (config.provider === 'google_ai') {
        if (!config.googleAI.apiKey) return null;
        return { apiKey: config.googleAI.apiKey, model: config.googleAI.model };
    }
    return null;
}
