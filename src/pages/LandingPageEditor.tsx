/**
 * Landing Page Editor — the one editor, for the one template.
 *
 * Slimmed-down state machine. The visual layout (top bar, settings panel,
 * preview pane) lives in `src/components/landing-pages/editor/`:
 *
 *   - `EditorShell`  full-screen takeover layout
 *   - `EmptyEditor`  first-run experience (Generate with AI)
 *   - `LegacyBanner` legacy Zenon config migration banner
 *
 * All data-fetching, mutation, auto-save, and publish logic is kept here
 * (this is the brain of the editor). UI rendering is delegated to the
 * editor components.
 *
 * Lifecycle:
 *   - Loading → centered spinner
 *   - Legacy Zenon config → `<LegacyBanner />` (one CTA: regenerate)
 *   - Empty (new page) → `<EmptyEditor />` (one CTA: generate)
 *   - Editing → `<EditorShell />` (full-screen takeover)
 *
 * Edits autosave (debounced 800 ms). Publish calls the
 * `publish-landing-page` edge function directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { supabase as rawSupabase } from '@/integrations/supabase/client';
const supabase = rawSupabase as any;
import { useAuth } from '@/hooks/useAuth';
import {
    generateAndSaveSoctivLandingPage,
    saveSoctivLandingConfig,
    regenerateSoctivSection,
} from '@/services/soctivLandingConfigService';
import { renderSoctivIndexPreview } from '@/services/soctivLandingPreview';
import {
    isLegacyZenonConfig,
    type SoctivLandingConfig,
    type SoctivSectionKey,
} from '@/types/soctivLandingConfig';
import { useDebounce } from '@/hooks/useDebounce';
import { useInlinedGoogleFonts } from '@/hooks/useInlinedGoogleFonts';

import { EditorShell } from '@/components/landing-pages/editor/EditorShell';
import { EmptyEditor } from '@/components/landing-pages/editor/EmptyEditor';
import { LegacyBanner } from '@/components/landing-pages/editor/LegacyBanner';

interface LandingPageRow {
    id: string;
    client_id: string;
    product_id: string | null;
    product_dna_id: string | null;
    subdomain: string | null;
    custom_domain?: string | null; // Phase 6 — column already exists, kept optional for legacy rows
    status: string;
    config: SoctivLandingConfig | null;
    published_at: string | null;
    published_url: string | null;
    created_at: string;
    updated_at: string;
}

interface ProductDnaRow {
    id: string;
    product_id: string | null;
    [k: string]: unknown;
}

/**
 * Coerce any error from `supabase.functions.invoke` into a human-readable
 * string. Supabase's FunctionsHttpError / FunctionsRelayError instances
 * are objects whose `.message` is empty — the real message lives on
 * `.context.{message,error}`. Without this helper, the failure toast
 * surfaces with an empty description and the user thinks nothing
 * happened.
 */
function extractReadableError(err: unknown): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    const anyErr = err as Record<string, any>;
    if (typeof anyErr.message === 'string' && anyErr.message.trim()) return anyErr.message;
    const ctx = anyErr.context;
    if (ctx) {
        if (typeof ctx.message === 'string' && ctx.message.trim()) return ctx.message;
        if (typeof ctx.error === 'string' && ctx.error.trim()) return ctx.error;
        if (typeof ctx.status === 'number') return `Edge function returned HTTP ${ctx.status}`;
    }
    try {
        return JSON.stringify(err);
    } catch {
        return 'Unknown error';
    }
}

/**
 * Slugify a brand or product name into a valid subdomain.
 *
 * Rules (mirrors `DomainEditor` SUBDOMAIN_RE):
 *   - lowercase latin letters, digits, dashes
 *   - 2-32 chars, can't start or end with a dash
 *
 * Arabic brand names collapse to the empty string — callers should
 * fall back to a numeric suffix (see `suggestSubdomain`).
 */
function slugifyForSubdomain(input: string | undefined | null): string {
    const s = (input || '').toLowerCase();
    // Transliterate a few common Arabic-Indic digits that sneak in
    // when the user pastes a brand name with embedded numerals.
    const map: Record<string, string> = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    };
    const normalized = s
        .split('')
        .map((c) => map[c] ?? c)
        .join('');
    // Strip diacritics / non-latin letters (Arabic, etc.) — leave only
    // a-z, 0-9, and dashes.
    const stripped = normalized
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    // Clamp to 32 chars and re-strip leading/trailing dashes.
    return stripped.slice(0, 32).replace(/^-+|-+$/g, '');
}

const SUBDOMAIN_BASE = 'soctiv.ly';

/**
 * Pick a suggested subdomain from the row + config. Falls back through:
 *   1. Brand name in config
 *   2. Product name in config
 *   3. Page title in config (hero headline)
 *   4. Existing subdomain (don't change what the user already picked)
 *   5. Random alphanumeric tail (when nothing slugifiable is available,
 *      e.g. the brand is fully Arabic — we still want a usable value).
 *
 * The "existing subdomain wins" rule is important: we never overwrite
 * what the user has already typed in the DomainEditor.
 *
 * Race-safety: callers MUST verify uniqueness against the DB before
 * persisting (see `findAvailableSubdomain`). With only 4 hex chars the
 * random tail has a 1.67M space — birthday paradox makes ~37+ pages
 * guaranteed collision. We always retry with a fresh random until the
 * DB update succeeds.
 */
function suggestSubdomain(
    page: LandingPageRow | null | undefined,
    config: SoctivLandingConfig | null
): string {
    if (page?.subdomain) return page.subdomain;
    const candidates = [
        config?.business?.brand,
        config?.product?.nameArabic,
        config?.product?.name,
        config?.hero?.headline,
        config?.seo?.title,
    ];
    for (const c of candidates) {
        const slug = slugifyForSubdomain(c);
        if (slug.length >= 2) return slug;
    }
    // Brand is fully non-latin — fall back to a stable random tail.
    // Use 8 hex chars (~4.3B space) so birthday-paradox collisions only
    // become likely at ~65k published pages.
    return (
        'store-' +
        Math.random().toString(36).slice(2, 10).toLowerCase()
    );
}

/**
 * Probe `landing_pages.subdomain` for an available slug. Tries up to
 * `maxAttempts` candidates — first the deterministic slug from
 * `suggestSubdomain`, then randomized variants if the deterministic one
 * is already taken. Returns the first available slug, or null if every
 * attempt collided (extremely unlikely with 4.3B random space).
 */
async function findAvailableSubdomain(
    pageId: string,
    baseSlug: string,
    supabase: any,
    maxAttempts: number = 6
): Promise<string | null> {
    // Try the deterministic slug first (preserves brand name when possible).
    const candidates: string[] = [baseSlug];
    // Then randomized variants (keeps any prefix from the deterministic slug
    // — e.g. "acme" + "8a3f" → "acme-8a3f" — but only if it's >= 2 chars).
    const base = baseSlug.replace(/^store-/, '');
    const basePrefix = base.length >= 2 ? base.slice(0, 16) + '-' : '';
    for (let i = 1; i < maxAttempts; i++) {
        candidates.push(basePrefix + Math.random().toString(36).slice(2, 10).toLowerCase());
    }
    for (const candidate of candidates) {
        const { data, error } = await supabase
            .from('landing_pages')
            .select('id')
            .eq('subdomain', candidate)
            .neq('id', pageId)
            .maybeSingle();
        if (error) {
            // Network/RLS error — fall through and let the UPDATE surface it.
            return null;
        }
        if (!data) return candidate; // not taken
    }
    return null;
}

function buildPublishedBaseUrl(
    page: LandingPageRow | null | undefined,
    publishedUrl: string | null
): string | null {
    // Prefer what we already wrote to the DB after a successful publish.
    // Strip the trailing slash so it concatenates cleanly with "/privacy-policy.html".
    if (publishedUrl) return publishedUrl.replace(/\/+$/, '');
    // Otherwise derive from the row (covers pre-publish preview).
    if (page?.custom_domain) return `https://${page.custom_domain}`;
    if (page?.subdomain) return `https://${page.subdomain}.${SUBDOMAIN_BASE}`;
    return null;
}

export default function LandingPageEditor() {
    const { id: rawId, dnaId: rawDnaId } = useParams<{ id?: string; dnaId?: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { client } = useAuth();

    const isNew = !!rawDnaId && !rawId;
    const pageId = rawId;

    // ─── Editor state
    const [config, setConfig] = useState<SoctivLandingConfig | null>(null);
    const [configIsLegacy, setConfigIsLegacy] = useState(false);
    const [regeneratingSection, setRegeneratingSection] =
        useState<SoctivSectionKey | null>(null);
    const [autoSaveState, setAutoSaveState] = useState<
        'idle' | 'saving' | 'saved' | 'error'
    >('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState(false);

    // Force-reload counter — bumped on `onRefreshPreview` to give the iframe a
    // fresh `key` even if the rendered HTML is byte-identical.
    //
    // CRITICAL: we deliberately do NOT include `previewHtml.length` (or the
    // HTML itself) in the key. If we did, every config change (and the
    // associated 350ms-debounced re-render) would force a fresh iframe mount,
    // destroying any in-progress form input focus and recreating the order
    // form from scratch. That was the source of the "Order Now loop" symptom:
    // click "اطلب الآن" → re-render → focus lost → re-enter form → repeat.
    //
    // Now the iframe mounts once on first non-empty HTML arrival and stays
    // mounted across edits. The `<iframe srcDoc={html}>` swap is handled by
    // the browser, which is naturally diff-friendly for HTML content. To
    // force a full reload (e.g. after publish), the user clicks the
    // explicit "Refresh Preview" button.
    const [previewReloadNonce, setPreviewReloadNonce] = useState<number>(0);
    const iframeMountKey = `preview-${previewReloadNonce}`;

    // Bump nonce exactly once on first non-empty HTML arrival so the iframe
    // mounts the moment we have something to show, but never again on edits.
    const firstMountBumpedRef = useRef(false);
    useEffect(() => {
        if (previewHtml && !firstMountBumpedRef.current) {
            firstMountBumpedRef.current = true;
            setPreviewReloadNonce((n) => n + 1);
        }
    }, [previewHtml]);

    const onRefreshPreview = () => {
        // Reset and bump — the useEffect above will re-mount on the next
        // non-empty HTML arrival, ensuring we re-mount exactly once.
        firstMountBumpedRef.current = false;
        setPreviewReloadNonce((n) => n + 1);
    };

    // ─── Fetch landing page
    const { data: pageData, isLoading: pageLoading } = useQuery<LandingPageRow | null>({
        queryKey: ['landing_page', pageId],
        queryFn: async () => {
            if (!pageId) return null;
            const { data, error } = await supabase
                .from('landing_pages')
                .select('*')
                .eq('id', pageId as any)
                .single();
            if (error) throw error;
            return data as LandingPageRow;
        },
        enabled: !!pageId,
    });

    // ─── Fetch Product DNA
    const dnaId = rawDnaId || pageData?.product_dna_id;
    const {
        data: dnaData,
        isLoading: dnaLoading,
        isError: dnaError,
    } = useQuery<ProductDnaRow | null>({
        queryKey: ['product_dna', dnaId],
        queryFn: async () => {
            if (!dnaId) return null;
            const { data, error } = await supabase
                .from('product_dna')
                .select('id, product_id, *')
                .eq('id', dnaId as any)
                .single();
            if (error) {
                console.error('[LandingPageEditor] product_dna fetch failed', {
                    dnaId,
                    code: error.code,
                    message: error.message,
                });
                throw error;
            }
            return data as ProductDnaRow;
        },
        enabled: !!dnaId,
    });

    // ─── Fetch product
    const productId = dnaData?.product_id;
    const {
        data: product,
        isLoading: productLoading,
        isError: productError,
    } = useQuery({
        queryKey: ['product', productId],
        queryFn: async () => {
            if (!productId) return null;
            const { data, error } = await supabase
                .from('products')
                .select('id, name, image_url, price, code, category')
                .eq('id', productId as any)
                .single();
            if (error) {
                console.error('[LandingPageEditor] product fetch failed', {
                    productId,
                    code: error.code,
                    message: error.message,
                });
                throw error;
            }
            return data as {
                id: string;
                name: string;
                image_url: string | null;
                price: number;
                code: string | null;
                category: string | null;
            };
        },
        enabled: !!productId,
    });

    // ─── Fetch client webhook_code (for preview form submit)
    // The preview iframe posts the form to `webhook.url` with `client_code`
    // and `product_code` fields. The webhook resolves these to client_id /
    // product_id via DB lookup. If either is empty in the editor's
    // config (which is the case for newly-generated pages — only the
    // publish edge function stamps them today), the webhook returns 4xx
    // and the form shows "فشل في إنشاء الطلب" in the preview.
    //
    // Mirrors the auto-stamping in supabase/functions/publish-landing-page/
    // index.ts:443-458 so the preview behaves exactly like the published
    // site without forcing the user to publish first.
    const clientId = pageData?.client_id;
    const { data: clientWebhookCode } = useQuery<string | null>({
        queryKey: ['client_webhook_code', clientId],
        queryFn: async () => {
            if (!clientId) return null;
            const { data, error } = await supabase
                .from('clients')
                .select('webhook_code')
                .eq('id', clientId as any)
                .single();
            if (error || !data) return null;
            return (data as any).webhook_code || null;
        },
        enabled: !!clientId,
        // Cheap query, but don't refetch on every keystroke — 5 min
        // is plenty for a value that only changes when the client is
        // reconfigured.
        staleTime: 5 * 60 * 1000,
    });

    // ─── Sync config from page data on load
    useEffect(() => {
        if (pageData?.config && Object.keys(pageData.config).length > 0) {
            if (isLegacyZenonConfig(pageData.config)) {
                setConfigIsLegacy(true);
                setConfig(null);
            } else {
                setConfigIsLegacy(false);
                setConfig(pageData.config as SoctivLandingConfig);
            }
        }
    }, [pageData]);

    // ─── Update config (just sets state + flags unsaved)
    const updateConfig = (next: SoctivLandingConfig) => {
        setConfig(next);
        setHasUnsavedChanges(true);
        setAutoSaveState('idle');
    };

    // ─── Regenerate full config (or per-section)
    const regenerateMutation = useMutation({
        mutationFn: async ({
            sectionKey,
            guidance,
        }: {
            sectionKey?: SoctivSectionKey;
            guidance?: string;
        }) => {
            if (!pageId) throw new Error('No page ID');
            if (!sectionKey) {
                if (!dnaId) throw new Error('Missing DNA id');
                if (!product) throw new Error('Missing product');
                const generated = await generateAndSaveSoctivLandingPage(
                    pageId,
                    dnaId,
                    product.id
                );
                setConfigIsLegacy(false);
                return generated;
            }
            if (!config) throw new Error('No config');
            const updated = await regenerateSoctivSection(config, sectionKey, guidance);
            await saveSoctivLandingConfig(pageId, updated);
            return updated;
        },
        onSuccess: (updated) => {
            setConfig(updated);
            queryClient.invalidateQueries({ queryKey: ['landing_page', pageId] });
            setAutoSaveState('saved');
            setHasUnsavedChanges(false);
            toast.success('تم التحديث', { description: 'تم تحديث المحتوى' });
        },
        onError: (e: Error) => {
            toast.error('فشل التوليد', { description: e.message });
        },
    });

    // ─── Auto-save (debounced 800ms)
    // Race fix: each save gets a token; if a newer save starts, we mark the
    // previous as superseded and only commit the latest. Without this, fast
    // typing fires concurrent UPDATEs that race in PG (last-writer-wins),
    // and `lastSavedRef` records whichever response resolves LAST instead
    // of the actual latest user state — so the idempotency check would
    // silently drop a real unsaved edit.
    const debouncedConfig = useDebounce(config, 800);
    const lastSavedRef = useRef<string>('');
    const saveSeqRef = useRef<number>(0);
    const inFlightRef = useRef<boolean>(false);
    useEffect(() => {
        if (!pageId || !debouncedConfig) return;
        if (!hasUnsavedChanges) return;
        const serialized = JSON.stringify(debouncedConfig);
        if (serialized === lastSavedRef.current) return;
        // Mark this attempt as the latest. Any in-flight save with a
        // smaller seq is discarded on resolve.
        const mySeq = ++saveSeqRef.current;
        inFlightRef.current = true;
        setAutoSaveState('saving');
        saveSoctivLandingConfig(pageId, debouncedConfig)
            .then(() => {
                // Only commit the saved state if we're still the latest save.
                // If the user kept typing, a newer seq started; let it win.
                if (mySeq !== saveSeqRef.current) return;
                lastSavedRef.current = serialized;
                inFlightRef.current = false;
                setAutoSaveState('saved');
                setHasUnsavedChanges(false);
            })
            .catch((e: Error) => {
                if (mySeq !== saveSeqRef.current) return;
                inFlightRef.current = false;
                setAutoSaveState('error');
                toast.error('فشل الحفظ', { description: e.message });
            });
    }, [debouncedConfig, pageId, hasUnsavedChanges]);

    // ─── Local dry-run preview (instant — no network round-trip)
    const debouncedForPreview = useDebounce(config, 350);
    const supabaseUrl =
        (import.meta as any).env?.VITE_SUPABASE_URL ||
        (typeof window !== 'undefined' && (window as any).__SUPABASE_URL__) ||
        '';
    // Pre-warm the Google Fonts inliner on mount so the iframe preview
    // shows the user-picked font on first paint. While the inliner resolves,
    // we render with the external <link> (which loads fine for fresh tabs)
    // and re-render once the inlined CSS arrives.
    const inlinedGoogleFontsCss = useInlinedGoogleFonts();
    // Stamp webhook.url/clientCode/productCode at render time so the
    // preview form submit actually reaches a working webhook endpoint
    // (the publish edge function does this stamping at deploy time, but
    // the editor's preview pipeline doesn't go through publish — see
    // the `client_webhook_code` query above for the why).
    //
    // We only mutate the COPY of config passed to the renderer — the
    // user-visible config in the editor isn't touched, so the webhook
    // fields shown in the SettingsTabs reflect whatever the user typed
    // (or the empty placeholder).
    const previewConfig = useMemo(() => {
        if (!config) return null;
        const stamped: SoctivLandingConfig = {
            ...config,
            webhook: {
                ...config.webhook,
                url: config.webhook.url || `${supabaseUrl}/functions/v1/facebook-leads-webhook`,
                clientCode: config.webhook.clientCode || clientWebhookCode || '',
                productCode: config.webhook.productCode || product?.code || '',
            },
        };
        return stamped;
    }, [config, supabaseUrl, clientWebhookCode, product?.code]);
    const localPreviewHtml = useMemo(() => {
        if (!previewConfig) return '';
        try {
            return renderSoctivIndexPreview(previewConfig, {
                supabaseUrl,
                year: '2026',
                inlinedGoogleFontsCss,
            });
        } catch (e) {
            console.error('[LandingPageEditor] local preview render failed', e);
            return '';
        }
    }, [previewConfig, supabaseUrl, inlinedGoogleFontsCss]);

    useEffect(() => {
        if (localPreviewHtml) setPreviewHtml(localPreviewHtml);
    }, [localPreviewHtml]);

    // One-shot edge-function dry-run check (after the first config load).
    const edgeCheckedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!pageId || !config) return;
        if (edgeCheckedRef.current === pageId) return;
        edgeCheckedRef.current = pageId;
        supabase.functions
            .invoke('publish-landing-page', {
                body: { landing_page_id: pageId, dry_run: true },
            })
            .then(({ data, error }) => {
                if (error) {
                    console.warn('[LandingPageEditor] edge dry-run error:', error);
                    return;
                }
                const payload = (data as any)?.data ?? data;
                if (payload?.error) {
                    console.warn('[LandingPageEditor] edge dry-run payload error:', payload.error);
                }
            })
            .catch((e) => {
                console.warn('[LandingPageEditor] edge dry-run failed (local preview still works):', e);
            });
    }, [pageId, config]);

    // ─── Create + generate (from empty state)
    const generateMutation = useMutation({
        mutationFn: async () => {
            if (!dnaId) throw new Error('Missing DNA id');
            if (!product) throw new Error('Missing product');
            if (!client?.id) throw new Error('Missing client');
            if (dnaId && !dnaData) {
                throw new Error(
                    'Product DNA not found. Open the product and run DNA review first.'
                );
            }
            const { data: created, error } = await supabase
                .from('landing_pages')
                .insert({
                    client_id: client.id,
                    product_id: dnaData?.product_id || null,
                    product_dna_id: dnaData?.id ?? null,
                    subdomain: null,
                    status: 'draft',
                    config: {} as any,
                } as any)
                .select()
                .single();
            if (error) throw error;
            const generated = await generateAndSaveSoctivLandingPage(
                created.id,
                dnaId,
                product.id
            );
            return { created, generated };
        },
        onSuccess: ({ created, generated }) => {
            setConfig(generated);
            setConfigIsLegacy(false);
            queryClient.invalidateQueries({ queryKey: ['landing_page'] });
            toast.success('تم التوليد', { description: 'تم إنشاء صفحة الهبوط بنجاح' });
            navigate(`/landing-pages/${created.id}/edit`, { replace: true });
        },
        onError: (e: Error) => {
            toast.error('فشل', { description: e.message });
        },
    });

    // ─── Publish
    // Before publish, ensure the row has a subdomain. We auto-derive a
    // slug from the brand name (or product name) and persist it. This
    // makes the published page land at `https://my-brand.soctiv.ly/`
    // — an external-looking URL — instead of the bare Netlify deploy
    // URL with the internal page-id subfolder visible in the bar.
    //
    // The user can change the subdomain any time in the Setup tab
    // DomainEditor before they hit Publish.
    const ensureSubdomainBeforePublish = async (): Promise<void> => {
        if (!pageId) return;
        const currentSub = (pageData?.subdomain ?? '').trim();
        const currentCustom = (pageData?.custom_domain ?? '').trim();
        if (currentSub || currentCustom) return;
        const baseSlug = suggestSubdomain(pageData ?? null, config);
        if (!baseSlug) return;
        // Race fix: probe for a non-colliding slug before UPDATE. With the
        // previous design, a unique-constraint failure persisted the
        // colliding slug as page.subdomain, blocked subsequent retries,
        // and locked the user out of publishing.
        const available = await findAvailableSubdomain(pageId, baseSlug, supabase);
        if (!available) {
            throw new Error(
                'تعذّر إيجاد نطاق فرعي متاح. اختر نطاقًا يدويًا من تبويب الإعدادات → النطاق.'
            );
        }
        const { error } = await supabase
            .from('landing_pages')
            .update({ subdomain: available } as any)
            .eq('id', pageId as any);
        if (error) {
            console.warn('Failed to set suggested subdomain:', error);
            throw new Error(
                `تعذّر حفظ النطاق الفرعي المقترح (${available}). اختر نطاقًا يدويًا من تبويب الإعدادات → النطاق.`
            );
        }
    };

    const publishMutation = useMutation({
        mutationFn: async () => {
            if (!pageId) throw new Error('No page id');
            // Drain any in-flight auto-save so we don't publish against a
            // stale config. Race fix: if `inFlightRef` is true, wait for the
            // latest debounced save to resolve before publishing. The auto-
            // save effect bumps `saveSeqRef` on every new edit; we wait for
            // it to settle, then re-check whether there's still unsaved
            // state and save once more for good measure.
            if (inFlightRef.current || hasUnsavedChanges) {
                await new Promise<void>((resolve) => {
                    // Poll briefly until in-flight drains, or timeout 2s.
                    const start = Date.now();
                    const tick = () => {
                        if (!inFlightRef.current || Date.now() - start > 2000) {
                            resolve();
                            return;
                        }
                        setTimeout(tick, 50);
                    };
                    tick();
                });
                if (hasUnsavedChanges && config) {
                    await saveSoctivLandingConfig(pageId, config);
                }
            }
            await ensureSubdomainBeforePublish();
            const { data, error } = await supabase.functions.invoke('publish-landing-page', {
                body: { landing_page_id: pageId },
            });
            if (error) throw new Error(extractReadableError(error));
            const payload = (data as any)?.data ?? data;
            if (payload?.error) throw new Error(payload.error);
            if (!payload?.published_url) {
                throw new Error('لم يصلنا رابط المنشور');
            }
            return payload;
        },
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['landing_page', pageId] });
            toast.success('تم النشر!', {
                description: res?.published_url,
                duration: 4000,
            });
        },
        onError: (e: Error) => {
            // `e` is whatever the mutation threw — a real Error, a
            // FunctionsHttpError, or any other object. Toast descriptions
            // need a string, so coerce safely and fall back to a useful
            // Arabic message instead of an empty string (which used to make
            // the failure look "silent" — the red toast popped with no
            // visible body and the user thought nothing happened).
            const message =
                (e && typeof e.message === 'string' && e.message.trim()) ||
                (e && typeof (e as any).context?.message === 'string' && (e as any).context.message) ||
                (e && (e as any).context?.error) ||
                'حدث خطأ غير متوقع أثناء النشر. تحقق من الكونسول.';
            toast.error('فشل النشر', { description: message, duration: 6000 });
        },
    });

    // ─── Domain save (Phase 6)
    // Narrow PATCH to landing_pages.subdomain + landing_pages.custom_domain.
    // Deliberately a separate mutation from `saveSoctivLandingConfig`:
    // domain changes should NOT trigger AI regen or rewrite the config.
    // Empty string is normalized to NULL so the user can "clear" the value.
    const saveDomainMutation = useMutation({
        mutationFn: async (next: { subdomain: string; customDomain: string }) => {
            if (!pageId) throw new Error('No page id');
            const { error } = await supabase
                .from('landing_pages')
                .update({
                    subdomain: next.subdomain.trim() ? next.subdomain.trim() : null,
                    custom_domain: next.customDomain.trim()
                        ? next.customDomain.trim().toLowerCase()
                        : null,
                } as any)
                .eq('id', pageId as any);
            if (error) throw error;
            return next;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['landing_page', pageId] });
        },
    });

    const handleSaveDomain = async (next: { subdomain: string; customDomain: string }) => {
        await saveDomainMutation.mutateAsync(next);
    };

    // ─── Lead-creation handlers (forwarded to PreviewPane → in-iframe runtime)
    // The runtime posts `soctiv:lead-created` after a successful webhook
    // insert, or `soctiv:lead-failed` on error/timeout. We translate those
    // into toasts + query invalidation so the leads pipeline reflects the
    // new row immediately and the editor user gets clear feedback.
    //
    // Declared BEFORE any early returns so the Rules of Hooks aren't
    // violated — hooks must run in the same order every render regardless
    // of which branch is taken below.
    const handleLeadCreated = useCallback(
        ({ leadId, orderId }: { leadId: string | null; orderId: string }) => {
            // Belt-and-suspenders alongside useRealtimeSync: explicit
            // invalidation makes sure the leads list / kanban refreshes
            // even if the realtime subscription is still warming up.
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            const description = leadId
                ? `رقم الطلب: ${orderId} · معرّف العميل المحتمل: ${leadId.slice(0, 8)}…`
                : `رقم الطلب: ${orderId}`;
            toast.success('تم إنشاء الطلب بنجاح', {
                description,
                action: {
                    label: 'عرض في لوحة الطلبات',
                    onClick: () => navigate('/orders'),
                },
            });
        },
        [navigate, queryClient]
    );

    const handleLeadFailed = useCallback(
        (failure: { reason: string; status?: number; orderId: string; body?: string }) => {
            const message =
                failure.reason === 'timeout'
                    ? 'انتهت مهلة إرسال الطلب'
                    : failure.reason === 'rate_limited'
                      ? 'تم تجاوز الحد المسموح'
                      : failure.reason === 'network'
                        ? 'تعذّر الاتصال بالخادم'
                        : 'تعذّر إرسال الطلب';
            // Surface the actual server response so the user can debug —
            // truncated to keep the toast tidy.
            let description = `رقم الطلب: ${failure.orderId || '—'}`;
            if (failure.body && failure.reason === 'http_error') {
                const body = String(failure.body).trim();
                if (body) {
                    description += failure.status
                        ? ` · HTTP ${failure.status}: ${body.length > 100 ? body.slice(0, 97) + '…' : body}`
                        : ` · ${body.length > 100 ? body.slice(0, 97) + '…' : body}`;
                }
            } else if (failure.status) {
                description += ` · HTTP ${failure.status}`;
            }
            toast.error(message, { description });
        },
        []
    );

    // ─── Loading
    if (pageLoading && !isNew) {
        return (
            <div className="fixed inset-0 z-40 bg-background flex items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    // ─── Legacy Zenon config banner
    if (configIsLegacy && pageData) {
        return (
            <LegacyBanner
                regenerating={regenerateMutation.isPending}
                disabled={!dnaId || !product}
                onRegenerate={() => regenerateMutation.mutate({})}
            />
        );
    }

    // ─── Empty state (new landing page, nothing generated)
    if (!config) {
        const isFetchingContext = dnaLoading || productLoading;
        const noDnaId = !dnaId;
        const dnaMissing = !dnaLoading && !dnaData && !dnaError;
        const dnaFailed = !!dnaError;
        const productMissing =
            !dnaLoading && !!dnaData && !productLoading && !product && !productError;
        const productFailed = !!productError;
        const isBlocked = !isFetchingContext && (!dnaData || !product);

        const blockedReason = dnaFailed
            ? 'تعذّر تحميل Product DNA. تحقق من الاتصال وأعد المحاولة.'
            : dnaMissing
              ? 'لم يتم العثور على Product DNA. أنشئ أو أعد توليد DNA لهذا المنتج أولاً.'
              : productFailed
                ? 'تعذّر تحميل بيانات المنتج. تحقق من الاتصال وأعد المحاولة.'
                : productMissing
                  ? 'Product DNA يشير إلى منتج غير موجود. أعد حفظ DNA أو اربطه بمنتج صالح.'
                  : undefined;

        return (
            <EmptyEditor
                product={
                    product
                        ? {
                              id: product.id,
                              name: product.name,
                              nameArabic: product.name,
                              imageUrl: product.image_url,
                          }
                        : null
                }
                hasDna={!!dnaData}
                dnaError={dnaFailed}
                productError={productFailed}
                loadingContext={isFetchingContext}
                blocked={isBlocked}
                blockedReason={blockedReason}
                generating={generateMutation.isPending}
                onGenerate={() => generateMutation.mutate()}
                onRetry={() => window.location.reload()}
            />
        );
    }

    // ─── Editing state (full-screen takeover)
    return (
        <EditorShell
            config={config}
            onChange={updateConfig}
            pageData={pageData}
            autoSaveState={autoSaveState}
            onPublish={() => publishMutation.mutate()}
            publishing={publishMutation.isPending}
            onBack={() => navigate('/landing-pages')}
            onRefreshPreview={onRefreshPreview}
            previewHtml={previewHtml}
            iframeMountKey={iframeMountKey}
            onLeadCreated={handleLeadCreated}
            onLeadFailed={handleLeadFailed}
            previewLoading={previewLoading || debouncedForPreview !== config}
            onRegenerateSection={async (sectionKey, guidance) => {
                setRegeneratingSection(sectionKey);
                try {
                    await regenerateMutation.mutateAsync({ sectionKey, guidance });
                } finally {
                    setRegeneratingSection(null);
                }
            }}
            regeneratingSection={regeneratingSection}
            // Phase 6: pass through subdomain + customDomain so PublishBar
            // can show the active URL, and so the SettingsTabs Setup tab
            // can mount the DomainEditor.
            subdomain={pageData?.subdomain ?? null}
            customDomain={pageData?.custom_domain ?? null}
            // Computed external URL (subdomain / custom_domain / Netlify
            // fallback). Used by PublishBar to show a "will publish to …"
            // preview AND by the published page's privacy link template.
            // The publish flow auto-derives a subdomain if none is set,
            // so this URL is always defined once the user has clicked
            // Publish at least once — and shows the suggested URL
            // before that.
            publishedBaseUrl={buildPublishedBaseUrl(pageData, pageData?.published_url ?? null)}
            suggestedSubdomain={suggestSubdomain(pageData ?? null, config)}
            // Accept a subdomain from the PublishBar's inline "استخدم"
            // button — uses the same saveDomainMutation the DomainEditor
            // uses, so React Query invalidation fires and the whole
            // editor re-renders with the new subdomain.
            onAcceptSuggestion={(sub) => {
                void saveDomainMutation.mutateAsync({
                    subdomain: sub,
                    customDomain: pageData?.custom_domain ?? '',
                });
            }}
            domain={{
                subdomain: pageData?.subdomain ?? null,
                customDomain: pageData?.custom_domain ?? null,
                isPublished:
                    pageData?.status === 'live' || !!pageData?.published_url,
                saving: saveDomainMutation.isPending,
                onSaveDomain: handleSaveDomain,
            }}
        />
    );
}