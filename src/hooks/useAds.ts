/**
 * Ad Builder — React Query hooks.
 *
 * - useAdsQuery / useExistingTopics — reads
 * - useCreateAd / useUpdateAd / useDeleteAd — mutations
 * - useGenerateAd — local state machine wrapping `generateAd` with cancel
 *
 * All mutations invalidate `queryKeys.ads.root` on success so any active
 * list/topics query refreshes automatically.
 */
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_POLICY } from '@/lib/queryPolicy';
import {
    createAd,
    deleteAd,
    generateAd,
    listAds,
    listExistingTopics,
    updateAd,
} from '@/services/adService';
import type {
    Ad,
    AdInsert,
    AdUpdate,
    GenerateAdOptions,
    GeneratedAdDraft,
} from '@/types/ads';

// ─── Reads ────────────────────────────────────────────────────────────────

export interface AdsListFilters {
    productId?: string;
    angleName?: string;
}

export function useAdsQuery(filters: AdsListFilters = {}) {
    return useQuery<Ad[]>({
        queryKey: queryKeys.ads.list(filters),
        queryFn: ({ signal }) => listAds({ ...filters, signal }),
        staleTime: QUERY_POLICY.appDefaults.staleTime,
        gcTime: QUERY_POLICY.appDefaults.gcTime,
    });
}

/**
 * Topics already used for a (product, angle) — passed to the AI as the
 * variation input. Disabled when either id is missing.
 */
export function useExistingTopics(
    productId: string | null | undefined,
    angleName: string | null | undefined,
) {
    return useQuery<string[]>({
        queryKey: queryKeys.ads.topics(productId ?? '__none__', angleName ?? '__none__'),
        queryFn: ({ signal }) =>
            listExistingTopics({
                productId: productId as string,
                angleName: angleName as string,
                signal,
            }),
        enabled: !!productId && !!angleName,
        staleTime: 30_000,
    });
}

// ─── Mutations ────────────────────────────────────────────────────────────

export function useCreateAd() {
    const qc = useQueryClient();
    return useMutation<Ad, Error, AdInsert>({
        mutationFn: createAd,
        onSuccess: (ad) => {
            void qc.invalidateQueries({ queryKey: queryKeys.ads.root });
            toast.success('تم الحفظ', { description: 'تم حفظ الإعلان في المكتبة' });
            // Pre-populate the cache so the Library tab shows it immediately.
            qc.setQueryData<Ad[]>(
                queryKeys.ads.list({ productId: ad.productId }),
                (prev) => (prev ? [ad, ...prev] : [ad]),
            );
        },
        onError: (err) => {
            toast.error('فشل الحفظ', { description: err.message });
        },
    });
}

export function useUpdateAd() {
    const qc = useQueryClient();
    return useMutation<Ad, Error, { id: string; changes: AdUpdate }>({
        mutationFn: ({ id, changes }) => updateAd(id, changes),
        onSuccess: (ad) => {
            void qc.invalidateQueries({ queryKey: queryKeys.ads.root });
            // Update the cached list row.
            qc.setQueriesData<Ad[]>(
                { queryKey: [...queryKeys.ads.root, 'list'] },
                (prev) => (prev ? prev.map((x) => (x.id === ad.id ? ad : x)) : prev),
            );
            toast.success('تم تحديث الإعلان');
        },
        onError: (err) => {
            toast.error('فشل التحديث', { description: err.message });
        },
    });
}

export function useDeleteAd() {
    const qc = useQueryClient();
    return useMutation<void, Error, { id: string; productId: string }>({
        mutationFn: ({ id }) => deleteAd(id),
        onSuccess: (_void, vars) => {
            void qc.invalidateQueries({ queryKey: queryKeys.ads.root });
            // Remove the row from every cached list so the UI updates instantly.
            qc.setQueriesData<Ad[]>(
                { queryKey: [...queryKeys.ads.root, 'list'] },
                (prev) => (prev ? prev.filter((x) => x.id !== vars.id) : prev),
            );
            toast.success('تم حذف الإعلان');
        },
        onError: (err) => {
            toast.error('فشل الحذف', { description: err.message });
        },
    });
}

// ─── Generation (local state machine + cancel) ───────────────────────────

export interface UseGenerateAdReturn {
    /** Trigger a generation. Throws on abort so the caller can catch if needed. */
    generate: (input: GenerateAdOptions) => Promise<GeneratedAdDraft>;
    /** Abort the in-flight request, if any. */
    cancel: () => void;
    isGenerating: boolean;
    data: GeneratedAdDraft | null;
    error: Error | null;
}

export function useGenerateAd(): UseGenerateAdReturn {
    const [isGenerating, setIsGenerating] = useState(false);
    const [data, setData] = useState<GeneratedAdDraft | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
    }, []);

    const generate = useCallback(
        async (input: GenerateAdOptions): Promise<GeneratedAdDraft> => {
            // Cancel any in-flight request first.
            controllerRef.current?.abort();
            const controller = new AbortController();
            controllerRef.current = controller;

            setIsGenerating(true);
            setError(null);
            setData(null);

            try {
                const result = await generateAd({
                    ...input,
                    signal: controller.signal,
                });
                setData(result);
                if (result.partial) {
                    toast.warning(
                        'تم استلام الإخراج بتنسيق غير مكتمل',
                        {
                            description:
                                'بعض حقول الإعلان قد تكون فارغة — راجع السكربت قبل الحفظ.',
                        },
                    );
                }
                return result;
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    toast.info('تم الإلغاء');
                    const abortErr = new Error('cancelled');
                    setError(abortErr);
                    throw abortErr;
                }
                const e = err instanceof Error ? err : new Error(String(err));
                setError(e);
                toast.error('فشل توليد الإعلان', { description: e.message });
                throw e;
            } finally {
                if (controllerRef.current === controller) {
                    controllerRef.current = null;
                }
                setIsGenerating(false);
            }
        },
        [],
    );

    return { generate, cancel, isGenerating, data, error };
}