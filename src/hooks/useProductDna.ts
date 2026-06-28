/**
 * useProductDna — React hook for the Product DNA generation pipeline v2.
 *
 * Multi-phase flow:
 *   Phase 0: Onboarding (question generation + user answers) — handled by ProductOnboarding component
 *   Phase 1-3: DNA generation pipeline — handled here
 *
 * This hook manages the generation phase. Onboarding is handled separately.
 *
 * Persistence:
 *   The generated DNA is cached in localStorage, keyed by productId, so the
 *   user doesn't lose the result when navigating away and back. The cache is
 *   cleared by `reset()` (which the page calls when the user explicitly
 *   regenerates or navigates to a different product).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { generateProductDna } from '@/services/productDnaService';
import { callGoogleAI } from '@/services/googleAiService';
import { loadAIConfig } from '@/services/aiConfigService';
import { supabase } from '@/integrations/supabase/client';
import { safeLocalGet, safeLocalRemove, safeLocalSet } from '@/lib/safeStorage';
import type { ProductDNA, OnboardingData } from '@/types/productDNA';

/**
 * Strip any blocked product tag (case-insensitive) from a DNA's `tags` array.
 * Defensive layer for cached/stale DNA written before the blocklist existed —
 * keeps the UI consistent with the AI prompt rule.
 */
function sanitizeDnaTags(dna: ProductDNA | null): ProductDNA | null {
    if (!dna) return dna;
    const tags = Array.isArray(dna.productIdentity?.tags) ? dna.productIdentity!.tags : [];
    const filtered = tags.filter(
        (t) => typeof t === 'string' && !BLOCKED_DNA_TAG_NORMALIZED.has(t.trim().toLowerCase())
    );
    if (filtered.length === tags.length) return dna;
    return {
        ...dna,
        productIdentity: { ...dna.productIdentity, tags: filtered },
    };
}

// Mirror of the BLOCKED_PRODUCT_TAGS list in productDnaService.ts — kept
// inline so the hook doesn't import a frozen constant just to compare strings.
const BLOCKED_DNA_TAG_NORMALIZED = new Set(
    ['شريط لاصق', 'مانع تسريب', 'صيانة منزلية'].map((t) => t.trim().toLowerCase())
);

export interface DnaProgress {
    step: number;
    label: string;
    /** 0-100 percentage estimate */
    percentage: number;
}

export interface UseProductDnaOptions {
    /** Automatically save to Supabase after generation */
    autoSave?: boolean;
    /**
     * When provided, the hook will try to restore a previously-cached DNA
     * for this productId on mount. If found, the returned `dna` is set
     * immediately so the caller can show the result without re-generating.
     */
    productId?: string;
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
    /** Trigger DNA generation from onboarding data */
    generate: (onboarding: OnboardingData, productId?: string) => Promise<ProductDNA | null>;
    /** Cancel an in-flight generation */
    cancel: () => void;
    /** Reset all state (also clears the localStorage cache for `productId`) */
    reset: () => void;
    /** Clear only the error */
    clearError: () => void;
    /**
     * Replace the current DNA in state. Use this after the caller saves to
     * Supabase and learns the real DB-assigned `id` so downstream consumers
     * (e.g. the "open landing page" button) get a valid id instead of a
     * stale or undefined one. Also rewrites the localStorage cache.
     */
    setDna: (next: ProductDNA | null) => void;
}

const STORAGE_PREFIX = 'soctiv_product_dna_cache:';

function cacheKeyFor(productId: string | undefined): string | null {
    if (!productId) return null;
    return `${STORAGE_PREFIX}${productId}`;
}

function readCache(productId: string | undefined): ProductDNA | null {
    const key = cacheKeyFor(productId);
    if (!key) return null;
    const raw = safeLocalGet(key);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as ProductDNA;
        // Sanity check: the cached entry must have an id and the expected
        // productId. Drop anything that doesn't match.
        if (!parsed?.id) return null;
        if (productId && parsed.productId && parsed.productId !== productId) {
            return null;
        }
        return sanitizeDnaTags(parsed);
    } catch {
        safeLocalRemove(key);
        return null;
    }
}

function writeCache(dna: ProductDNA): void {
    const key = cacheKeyFor(dna.productId);
    if (!key) return;
    try {
        safeLocalSet(key, JSON.stringify(dna));
    } catch {
        // Storage may be full or unavailable — silently ignore.
    }
}

function clearCache(productId: string | undefined): void {
    const key = cacheKeyFor(productId);
    if (key) safeLocalRemove(key);
}

export function useProductDna(options?: UseProductDnaOptions): UseProductDnaReturn {
    const { client, user } = useAuth();
    const autoSave = options?.autoSave ?? true;
    const restoreProductId = options?.productId;

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<DnaProgress | null>(null);
    const [dna, setDnaState] = useState<ProductDNA | null>(null);
    const [error, setError] = useState<string | null>(null);

    /** AbortController for the current generation flight */
    const abortControllerRef = useRef<AbortController | null>(null);
    /** Track the productId we're currently working with for cache cleanup on reset. */
    const activeProductIdRef = useRef<string | undefined>(restoreProductId);

    // ─── Restore cached DNA on mount / when productId changes ──────────
    useEffect(() => {
        if (!restoreProductId) return;
        const cached = readCache(restoreProductId);
        if (cached) {
            setDnaState(cached);
        }
    }, [restoreProductId]);

    /**
     * Same defensive filter, applied to DNA coming from any source (cache,
     * DB load, manual setDna). Keeps the in-memory state and the localStorage
     * cache consistent with the AI blocklist.
     */
    const setDnaSafely = useCallback((next: ProductDNA | null) => {
        setDnaState(sanitizeDnaTags(next));
    }, []);

    const cancel = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);

    const reset = useCallback(() => {
        cancel();
        clearCache(activeProductIdRef.current);
        setIsGenerating(false);
        setProgress(null);
        setDnaState(null);
        setError(null);
    }, [cancel]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const setDna = useCallback((next: ProductDNA | null) => {
        const safe = sanitizeDnaTags(next);
        setDnaState(safe);
        if (safe) writeCache(safe);
        else if (activeProductIdRef.current) clearCache(activeProductIdRef.current);
    }, []);

    const generate = useCallback(
        async (
            onboarding: OnboardingData,
            productId?: string
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

            const resolvedProductId = productId || 'unknown';
            activeProductIdRef.current = resolvedProductId;

            // Clear any previous cached DNA for this product — the user is
            // explicitly regenerating, so the old result is no longer valid.
            if (resolvedProductId !== 'unknown') {
                clearCache(resolvedProductId);
            }

            setIsGenerating(true);
            setError(null);
            setDnaState(null);
            setProgress({ step: 0, label: 'Starting...', percentage: 0 });

            try {
                const config = loadAIConfig();
                let aiCaller: any = undefined;
                if (config.provider === 'google_ai' && config.googleAI.apiKey) {
                    aiCaller = async (messages: any, opts: any) =>
                        callGoogleAI(messages, {
                            model: opts?.model || config.googleAI.model,
                            temperature: opts?.temperature,
                            maxTokens: opts?.maxTokens,
                            signal: opts?.signal,
                        });
                }

                const result = await generateProductDna({
                    productId: resolvedProductId,
                    clientId,
                    onboarding,
                    onStepComplete: (step, label) => {
                        if (controller.signal.aborted) return;
                        const percentage = Math.round((step / 3) * 100);
                        setProgress({ step, label, percentage });
                    },
                    onError: (step, err) => {
                        console.error(`[useProductDna] Step ${step} error:`, err);
                    },
                    signal: controller.signal,
                });

                setDnaState(result);
                setProgress({ step: 3, label: 'Complete', percentage: 100 });

                // Cache the result so navigation away and back doesn't lose it.
                writeCache(result);
                // Also rewrite cache with sanitized tags — defense in depth in
                // case BLOCKED_PRODUCT_TAGS grows and older cached entries
                // start to look stale.
                writeCache(sanitizeDnaTags(result) ?? result);

                // Auto-save to Supabase
                if (autoSave) {
                    try {
                        const isValidUuid = (v: string) =>
                            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
                        const validProductId =
                            resolvedProductId && isValidUuid(resolvedProductId)
                                ? resolvedProductId
                                : null;

                        // The live DB has a unique constraint on
                        // product_dna.product_id (one DNA row per product).
                        // Each regeneration produces a NEW result.id, so
                        // upsert(onConflict:'id') would try to insert a
                        // second row and fail. Reuse the existing row's id
                        // if one is already linked to this product, so the
                        // upsert updates the same row in place.
                        let existingId: string | null = null;
                        if (validProductId) {
                            const { data: existing, error: lookupErr } = await supabase
                                .from('product_dna')
                                .select('id')
                                .eq('product_id', validProductId as any)
                                .maybeSingle();
                            if (lookupErr) {
                                console.warn(
                                    '[useProductDna] Could not look up existing DNA row:',
                                    lookupErr.message
                                );
                            } else {
                                existingId = (existing as { id: string } | null)?.id ?? null;
                            }
                        }

                        const record: any = {
                            id: existingId ?? result.id,
                            client_id: clientId,
                            product_id: validProductId,
                            // Store under the old column names for backward compatibility
                            core_facts: result.productIdentity,
                            icp_profile: result.targetCustomer,
                            marketing_synthesis: result.marketingStrategy,
                            raw_input: result.onboarding,
                            generated_at: result.generatedAt,
                            version: result.version,
                        };

                        // Prefer onConflict: 'product_id' (the actual unique
                        // constraint on the live DB). If the project doesn't
                        // have a unique index on product_id, the PostgREST
                        // client rejects the option — fall back to 'id' (we've
                        // already resolved the existing id above, so this
                        // update path is safe either way).
                        let savePromise = supabase
                            .from('product_dna')
                            .upsert(record, { onConflict: 'product_id' });
                        // Chain a fallback if the first call rejects the
                        // onConflict target. We can't await here, so we
                        // attach a `.then` that retries on the documented
                        // "no unique or exclusion constraint" error.
                        savePromise = savePromise.then((res) => {
                            if (
                                res.error &&
                                /no unique or exclusion constraint|onconflict|conflict target/i.test(
                                    res.error.message
                                )
                            ) {
                                console.warn(
                                    '[useProductDna] onConflict: product_id not accepted, falling back to id:',
                                    res.error.message
                                );
                                return supabase
                                    .from('product_dna')
                                    .upsert(record, { onConflict: 'id' });
                            }
                            return res;
                        });

                        const timeoutPromise = new Promise<never>((_, reject) => {
                            const id = setTimeout(() => {
                                clearTimeout(id);
                                reject(
                                    new Error(
                                        'Save timed out — please check your connection and try again.'
                                    )
                                );
                            }, 12_000);
                        });

                        const { error: saveError } = await Promise.race([
                            savePromise,
                            timeoutPromise,
                        ]);

                        if (saveError) {
                            console.warn(
                                '[useProductDna] Failed to save DNA to Supabase:',
                                saveError
                            );
                        } else {
                            console.log('[useProductDna] DNA saved to Supabase:', result.id);
                        }
                    } catch (saveErr) {
                        const msg =
                            saveErr instanceof Error ? saveErr.message : String(saveErr);
                        console.warn('[useProductDna] Error saving to Supabase:', msg);
                    }
                }

                return result;
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    // Silently handle cancellation — no error state set
                    return null;
                }
                const message =
                    err instanceof Error
                        ? err.message
                        : 'An unexpected error occurred during DNA generation.';
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
        setDna,
    };
}
