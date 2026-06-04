/**
 * useProductDna — React hook for the Product DNA generation pipeline.
 * Manages state across the 3-step AI chain and provides control methods.
 */
import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { generateProductDna } from '@/services/productDnaService';
import { callGoogleAI } from '@/services/googleAiService';
import { loadAIConfig } from '@/services/aiConfigService';
import { supabase } from '@/integrations/supabase/client';
import type { ProductDNA } from '@/types/productDNA';
import type { ProductDNARecord } from '@/types/database';

export interface DnaProgress {
    step: number;
    label: string;
    /** 0-100 percentage estimate */
    percentage: number;
}

export interface UseProductDnaOptions {
    /** Automatically save to Supabase after generation */
    autoSave?: boolean;
}

export interface UseProductDnaReturn {
    /** Whether the pipeline is currently running */
    isGenerating: boolean;
    /** Current step progress */
    progress: DnaProgress | null;
    /** The generated DNA, null until generation completes */
    dna: ProductDNA | null;
    /** Error message if generation failed */
    error: string | null;
    /** Trigger the full 3-step pipeline */
    generate: (productData: Record<string, unknown>, clientData?: Record<string, unknown>) => Promise<ProductDNA | null>;
    /** Cancel an in-flight generation */
    cancel: () => void;
    /** Reset all state */
    reset: () => void;
    /** Clear only the error */
    clearError: () => void;
}

const STEP_LABELS: Record<number, string> = {
    1: 'Core Fact Extraction',
    2: 'ICP Profiling',
    3: 'Marketing Synthesis',
};

export function useProductDna(options?: UseProductDnaOptions): UseProductDnaReturn {
    const { client, user } = useAuth();
    const autoSave = options?.autoSave ?? true;

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<DnaProgress | null>(null);
    const [dna, setDna] = useState<ProductDNA | null>(null);
    const [error, setError] = useState<string | null>(null);

    /** AbortController for the current generation flight */
    const abortControllerRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);

    const reset = useCallback(() => {
        cancel();
        setIsGenerating(false);
        setProgress(null);
        setDna(null);
        setError(null);
    }, [cancel]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const generate = useCallback(
        async (
            productData: Record<string, unknown>,
            clientData?: Record<string, unknown>
        ): Promise<ProductDNA | null> => {
            const clientId = client?.id || user?.id;
            if (!clientId) {
                const errMsg = 'No authenticated client found. Please log in.';
                setError(errMsg);
                return null;
            }

            // Cancel any in-flight generation before starting a new one
            cancel();
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const productId = (productData.id as string) || 'unknown';
            setIsGenerating(true);
            setError(null);
            setDna(null);
            setProgress(null);

            try {
                const resolvedClientData = clientData || {
                    company_name: client?.company_name,
                    specialty: client?.specialty,
                    work_area: client?.work_area,
                    strength: client?.strength,
                    achievements: client?.achievements,
                    headquarters: client?.headquarters,
                    promotional_offer: client?.promotional_offer,
                };

                const config = loadAIConfig();
                let aiCaller: any = undefined;
                if (config.provider === 'google_ai' && config.googleAI.apiKey) {
                    aiCaller = async (messages, opts) => callGoogleAI(messages, {
                        model: opts?.model || config.googleAI.model,
                        temperature: opts?.temperature,
                        maxTokens: opts?.maxTokens,
                        signal: opts?.signal,
                    });
                }

                const result = await generateProductDna({
                    productId,
                    clientId,
                    productData,
                    clientData: resolvedClientData as Record<string, unknown>,
                    model: config.provider === 'openrouter' ? config.openrouter.model : undefined,
                    onStepComplete: (step, label) => {
                        if (controller.signal.aborted) return;
                        const percentage = Math.round((step / 3) * 100);
                        setProgress({ step, label, percentage });
                    },
                    onError: (step, err) => {
                        console.error(`[useProductDna] Step ${step} error:`, err);
                    },
                    signal: controller.signal,
                    aiCaller,
                });

                setDna(result);
                setProgress({ step: 3, label: 'Complete', percentage: 100 });

                // Auto-save to Supabase
                if (autoSave) {
                    try {
                        const isValidUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
                        const validProductId = productId && isValidUuid(productId) ? productId : null;

                        const record: any = {
                            id: result.id,
                            client_id: clientId,
                            product_id: validProductId,
                            core_facts: result.coreFacts,
                            icp_profile: result.icpProfile,
                            marketing_synthesis: result.marketingSynthesis,
                            raw_input: result.rawInput,
                            generated_at: result.generatedAt,
                            version: result.version,
                        };

                        const savePromise = supabase
                            .from('product_dna')
                            .upsert(record, { onConflict: 'id' });

                        const timeoutPromise = new Promise<never>((_, reject) => {
                            const id = setTimeout(() => {
                                clearTimeout(id);
                                reject(new Error('Save timed out — please check your connection and try again.'));
                            }, 12_000);
                        });

                        const { error: saveError } = await Promise.race([savePromise, timeoutPromise]);

                        if (saveError) {
                            console.warn('[useProductDna] Failed to save DNA to Supabase:', saveError);
                        } else {
                            console.log('[useProductDna] DNA saved to Supabase:', result.id);
                        }
                    } catch (saveErr) {
                        const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
                        console.warn('[useProductDna] Error saving to Supabase:', msg);
                    }
                }

                return result;
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    // Silently handle cancellation — no error state set
                    return null;
                }
                const message = err instanceof Error ? err.message : 'An unexpected error occurred during DNA generation.';
                setError(message);
                return null;
            } finally {
                setIsGenerating(false);
                abortControllerRef.current = null;
            }
        },
        [client, user, autoSave, cancel]
    );

    return {
        isGenerating,
        progress,
        dna,
        error,
        generate,
        cancel,
        reset,
        clearError,
    };
}
