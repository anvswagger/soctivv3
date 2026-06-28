/**
 * PreviewPage — full-page read-only preview of a landing page.
 *
 * Route: `/preview/:id`
 *
 * Why this exists:
 *   Before this page existed, the only way to "see what your draft looks
 *   like" was to either publish it (heavy) or use the in-editor iframe
 *   (small, full of editor chrome). With this route, the user can click a
 *   single "مراجعة" button on any card and get a clean, full-screen, no-
 *   chrome preview in a new tab — regardless of publish status.
 *
 * Behavior:
 *   - Loads the `landing_pages` row by id (Supabase RLS enforces ownership).
 *   - Renders the same HTML the editor's iframe renders, via
 *     `renderSoctivIndexPreview` — so the preview is byte-identical to
 *     what the user sees in the builder.
 *   - Pixel/CAPI scripts are NOT noop'd — clients see the real Pixel fire
 *     when they visit, so what-you-see-is-what-they-get.
 *   - Super admins see a small "تعديل في المحرر" jump-back button so they
 *     can pivot from preview into editing without losing context.
 *
 * Empty / RLS-denied rows:
 *   `.single()` throws `PGRST116` when no row is returned. We catch that
 *   specifically and render a 404-style empty card instead of an error.
 *
 * Legacy Zenon configs:
 *   These configs were authored against the deleted Zenon template system.
 *   They have shape mismatches with the current renderer, so we render a
 *   dedicated empty card with a link to the editor (where the user can
 *   regenerate via the LegacyBanner flow).
 */
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, ExternalLink, Loader2, Pencil } from 'lucide-react';
import { supabase as rawSupabase } from '@/integrations/supabase/client';
const supabase = rawSupabase as any;
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { renderSoctivIndexPreview } from '@/services/soctivLandingPreview';
import { useInlinedGoogleFonts } from '@/hooks/useInlinedGoogleFonts';
import {
    isLegacyZenonConfig,
    type SoctivLandingConfig,
} from '@/types/soctivLandingConfig';
import { cn } from '@/lib/utils';

interface PreviewPageRow {
    id: string;
    title: string | null;
    subdomain: string | null;
    status: string;
    config: SoctivLandingConfig | Record<string, unknown> | null;
    published_url: string | null;
    published_at: string | null;
    client_id: string | null;
    product_id: string | null;
    products: { name: string } | null;
    client: { company_name: string } | null;
}

type PreviewState =
    | { kind: 'not_found' }
    | { kind: 'legacy'; row: PreviewPageRow }
    | { kind: 'empty'; row: PreviewPageRow }
    | { kind: 'ready'; row: PreviewPageRow; html: string; statusLabel: string; statusClass: string };

const STATUS_META: Record<
    string,
    { label: string; className: string }
> = {
    live: {
        label: 'منشور',
        className:
            'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    },
    draft: {
        label: 'مسودة',
        className:
            'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
    },
    legacy: {
        label: 'قالب قديم',
        className:
            'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    empty: {
        label: 'لم يبدأ بعد',
        className:
            'bg-muted text-muted-foreground border-border',
    },
};

function resolveStatus(row: PreviewPageRow): 'live' | 'draft' | 'legacy' | 'empty' {
    if (row.status === 'published' && row.published_url) return 'live';
    if (isLegacyZenonConfig(row.config)) return 'legacy';
    const cfg = row.config as SoctivLandingConfig | null | Record<string, unknown>;
    if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) return 'draft';
    return 'empty';
}

export default function PreviewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isSuperAdmin } = useAuth();

    // Pre-warm the Google Fonts inliner so the preview iframe shows the
    // user-picked font on first paint (same fix as the editor — see
    // useInlinedGoogleFonts.ts for the full rationale).
    const inlinedGoogleFontsCss = useInlinedGoogleFonts();

    const state: UseQueryResult<PreviewState, Error> = useQuery({
        // Re-run when the font inliner resolves so the preview re-renders
        // with the inlined CSS (instead of the external <link>).
        queryKey: ['landing_pages', 'preview', id, inlinedGoogleFontsCss ? 'inlined' : 'link'],
        queryFn: async (): Promise<PreviewState> => {
            if (!id) return { kind: 'not_found' };

            const { data, error } = await supabase
                .from('landing_pages')
                .select(
                    'id, title, subdomain, status, config, published_url, published_at, client_id, product_id, products(name), client:clients(company_name)'
                )
                .eq('id', id)
                .maybeSingle();

            // RLS denial, deleted row, or invalid id — all look the same to us.
            if (error) {
                // PGRST116 = .single() found no rows. maybeSingle returns null,
                // but other failures (network / RLS) can throw too.
                if ((error as { code?: string }).code === 'PGRST116') {
                    return { kind: 'not_found' };
                }
                throw error;
            }
            if (!data) return { kind: 'not_found' };

            const row = data as unknown as PreviewPageRow;

            if (isLegacyZenonConfig(row.config)) {
                return { kind: 'legacy', row };
            }

            // Empty rows (no config yet) — render a friendly empty card with
            // a jump to the editor instead of fabricating a fake config.
            if (!row.config || Object.keys(row.config as object).length === 0) {
                return { kind: 'empty', row };
            }

            const cfg = row.config as SoctivLandingConfig;
            const html = renderSoctivIndexPreview(cfg, {
                supabaseUrl:
                    (import.meta as any).env?.VITE_SUPABASE_URL || '',
                year: String(new Date().getFullYear()),
                noopPixel: false,
                inlinedGoogleFontsCss,
            });

            const status = resolveStatus(row);
            const meta = STATUS_META[status];

            return {
                kind: 'ready',
                row,
                html,
                statusLabel: meta.label,
                statusClass: meta.className,
            };
        },
        enabled: !!id,
        retry: false,
        // Render-preview is sensitive to stale data; do not serve from cache
        // across page navigations.
        staleTime: 0,
        gcTime: 0,
    });

    // Loading — centered spinner.
    if (state.isLoading) {
        return <CenteredState icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />} title="جاري تحميل المعاينة…" />;
    }

    // Error — friendly retry.
    if (state.error) {
        return (
            <CenteredState
                title="تعذّر تحميل الصفحة"
                body={(state.error as Error).message || 'حدث خطأ غير متوقع'}
                action={
                    <Button onClick={() => state.refetch()} variant="default" size="sm">
                        إعادة المحاولة
                    </Button>
                }
            />
        );
    }

    const data = state.data;
    if (!data) return <CenteredState title="جاري التحميل…" />;

    // 404 / RLS-denied.
    if (data.kind === 'not_found') {
        return (
            <CenteredState
                title="هذه الصفحة غير متاحة"
                body="الصفحة غير موجودة أو ليس لديك صلاحية لعرضها."
                action={
                    <Button
                        onClick={() => navigate('/landing-pages')}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                    >
                        <ArrowRight className="h-4 w-4" />
                        العودة إلى صفحات الهبوط
                    </Button>
                }
            />
        );
    }

    // Legacy config — show dedicated empty card with editor jump.
    if (data.kind === 'legacy') {
        return (
            <CenteredState
                title="هذا التكوين قديم"
                body="هذا التكوين بُني بقالب قديم ولا يمكن معاينته هنا. افتح المحرر لإعادة التوليد بالنسخة الحالية."
                action={
                    <Button
                        onClick={() => navigate(`/landing-pages/${data.row.id}/edit`)}
                        variant="default"
                        size="sm"
                        className="gap-2"
                    >
                        <Pencil className="h-4 w-4" />
                        افتح في المحرر
                    </Button>
                }
            />
        );
    }

    // Empty config — page exists but has nothing to preview yet.
    if (data.kind === 'empty') {
        return (
            <CenteredState
                title="لم تبدأ هذه الصفحة بعد"
                body="لم يتم توليد محتوى لهذه الصفحة. افتح المحرر لتوليد المحتوى بالذكاء الاصطناعي أو كتابته يدويًا."
                action={
                    <Button
                        onClick={() => navigate(`/landing-pages/${data.row.id}/edit`)}
                        variant="default"
                        size="sm"
                        className="gap-2"
                    >
                        <Pencil className="h-4 w-4" />
                        افتح في المحرر
                    </Button>
                }
            />
        );
    }

    // Ready — full preview.
    return <ReadyPreview state={data} canEdit={isSuperAdmin} />;
}

function ReadyPreview({
    state,
    canEdit,
}: {
    state: Extract<PreviewState, { kind: 'ready' }>;
    canEdit: boolean;
}) {
    const productName =
        state.row.products?.name ||
        (state.row.config as SoctivLandingConfig | null)?.product?.nameArabic ||
        state.row.title ||
        'صفحة هبوط';
    const storeName =
        state.row.client?.company_name ||
        (state.row.config as SoctivLandingConfig | null)?.business?.brand ||
        '';
    // External URL: custom_domain → subdomain.soctiv.ly → published_url.
    // Same priority as publish-landing-page/index.ts. We use this for the
    // "فتح المنشور الفعلي" button so it opens the clean external URL
    // (e.g. https://my-brand.soctiv.ly/), not the bare Netlify deploy URL.
    const externalUrl =
        (state.row.custom_domain && `https://${state.row.custom_domain}`) ||
        (state.row.subdomain && `https://${state.row.subdomain}.soctiv.ly`) ||
        state.row.published_url ||
        null;

    return (
        <div dir="rtl" className="min-h-screen bg-background flex flex-col">
            {/* Top bar — sticky, minimal, no admin chrome. */}
            <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-3 bg-background/85 backdrop-blur border-b border-border">
                {/* RTL start: product name + status pill. */}
                <div className="flex items-center gap-3 min-w-0">
                    <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">
                        {productName}
                    </h1>
                    {storeName && (
                        <span className="hidden sm:inline-block text-xs text-muted-foreground truncate max-w-[200px]">
                            · {storeName}
                        </span>
                    )}
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0',
                            state.statusClass
                        )}
                    >
                        {state.statusLabel}
                    </span>
                </div>

                {/* RTL center: caption. */}
                <div className="hidden md:block text-xs text-muted-foreground shrink-0">
                    معاينة فقط
                </div>

                {/* RTL end: actions. */}
                <div className="flex items-center gap-2 shrink-0">
                    {externalUrl && (
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            title="فتح المنشور الفعلي"
                        >
                            <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">المنشور</span>
                            </a>
                        </Button>
                    )}
                    {canEdit && (
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                        >
                            <Link to={`/landing-pages/${state.row.id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span>تعديل في المحرر</span>
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            {/* Full-bleed iframe. */}
            <main className="flex-1 bg-muted/20">
                <iframe
                    srcDoc={state.html}
                    title={`معاينة: ${productName}`}
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    className="w-full h-full min-h-[calc(100vh-3.5rem)] border-0 bg-white block"
                />
            </main>
        </div>
    );
}

function CenteredState({
    icon,
    title,
    body,
    action,
}: {
    icon?: React.ReactNode;
    title: string;
    body?: string;
    action?: React.ReactNode;
}) {
    return (
        <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 backdrop-blur p-8 text-center space-y-4">
                {icon && <div className="flex justify-center">{icon}</div>}
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                {body && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                )}
                {action && <div className="flex justify-center pt-2">{action}</div>}
            </div>
        </div>
    );
}