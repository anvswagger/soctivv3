/**
 * Landing Pages list — admin view of all landing pages.
 *
 * Reads the Soctiv `config` JSONB column and the `published_url` /
 * `published_at` columns. Renders a responsive grid of visual cards
 * (each with a live mini-preview thumbnail) instead of a table.
 *
 * Filter bar: status chips (الكل / Live / Drafts / Legacy / Empty)
 *             + search input + "+ New Landing Page" gradient CTA.
 *
 * Empty state: full-bleed glass-card explaining how to start.
 * Delete: confirmed via shadcn AlertDialog.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/sonner';
import { supabase as rawSupabase } from '@/integrations/supabase/client';
const supabase = rawSupabase as any;
import { useAuth } from '@/hooks/useAuth';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';
import { isLegacyZenonConfig } from '@/types/soctivLandingConfig';
import { ListHeader } from '@/components/landing-pages/list/ListHeader';
import { FilterBar, type StatusFilter } from '@/components/landing-pages/list/FilterBar';
import { LandingPageCard, type LandingPageCardData, type LandingPageStatus } from '@/components/landing-pages/list/LandingPageCard';
import { EmptyLandingPages } from '@/components/landing-pages/list/EmptyLandingPages';

interface LandingPageRow {
    id: string;
    title: string | null;
    subdomain: string | null;
    custom_domain: string | null;
    status: string;
    config: SoctivLandingConfig | Record<string, unknown> | null;
    published_url: string | null;
    published_at: string | null;
    updated_at: string;
    products: { name: string } | null;
    /** Joined from `clients` via `client_id`. `clients` is the public table
     *  for the `Client` row (see `src/types/database.ts`). */
    client: { company_name: string } | null;
}

export default function LandingPages() {
    const { client, isAdmin } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [filter, setFilter] = useState<StatusFilter>('all');
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data: landingPages = [], isLoading } = useQuery({
        queryKey: ['landing_pages', isAdmin ? 'all' : client?.id],
        // Defense in depth: don't fire the query until we know the scope.
        // Without this, a non-admin user with `client === undefined` (auth
        // still loading, expired session, or `useAuth` returning a stub)
        // would issue an unscoped SELECT — relying entirely on RLS for
        // privacy. A future RLS regression would then leak every page to
        // every authenticated user.
        enabled: isAdmin || !!client?.id,
        queryFn: async () => {
            let query = supabase
                .from('landing_pages')
                .select(
                    'id, title, subdomain, custom_domain, status, config, published_url, published_at, updated_at, products(name), client:clients(company_name)'
                )
                .order('updated_at', { ascending: false });

            if (!isAdmin && client?.id) {
                query = query.eq('client_id', client.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []) as unknown as LandingPageRow[];
        },
    });

    const deleteMutation = useMutation({
        // Cascade fix: lead/order rows may FK to landing_page_id without
        // ON DELETE CASCADE. We attempt to clear the FK on related rows
        // first (best-effort — if RLS blocks the UPDATE we surface that
        // error), then delete the landing page. This avoids a hard FK
        // violation when there are historical leads/orders attached.
        mutationFn: async (id: string) => {
            // 1. Best-effort: null out landing_page_id on related leads/orders.
            //    Errors are swallowed — if the columns don't exist or RLS
            //    blocks, we still try the DELETE and let it surface the
            //    real failure (FK violation, etc.).
            try {
                await supabase
                    .from('leads')
                    .update({ landing_page_id: null } as any)
                    .eq('landing_page_id', id);
            } catch (_) { /* ignore */ }
            try {
                await supabase
                    .from('orders')
                    .update({ landing_page_id: null } as any)
                    .eq('landing_page_id', id);
            } catch (_) { /* ignore */ }
            // 2. Delete the page row.
            const { error } = await supabase.from('landing_pages').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['landing_pages'] });
            toast.success('تم الحذف', { description: 'تم حذف صفحة الهبوط بنجاح' });
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            toast.error('خطأ', { description: message || 'فشل في حذف صفحة الهبوط' });
        },
    });

    // Map DB rows to card data + apply filters
    const cardData: LandingPageCardData[] = useMemo(() => {
        return landingPages.map((p) => {
            const config = (p.config && !isLegacyZenonConfig(p.config)
                ? (p.config as SoctivLandingConfig)
                : null);
            const title =
                config?.product?.nameArabic ||
                config?.seo?.title ||
                p.title ||
                'صفحة بدون عنوان';

            let status: LandingPageStatus;
            if (p.status === 'published' && p.published_url) {
                status = 'live';
            } else if (isLegacyZenonConfig(p.config)) {
                status = 'legacy';
            } else if (config && Object.keys(config).length > 0) {
                status = 'draft';
            } else {
                status = 'empty';
            }

            return {
                id: p.id,
                title,
                productName: p.products?.name || '',
                storeName: p.client?.company_name || '',
                status,
                publishedUrl: p.published_url,
                subdomain: p.subdomain,
                customDomain: p.custom_domain,
                updatedAt: p.updated_at,
                config,
            };
        });
    }, [landingPages]);

    const filteredCards = useMemo(() => {
        return cardData.filter((c) => {
            // Status filter
            if (filter !== 'all') {
                const map: Record<StatusFilter, LandingPageStatus> = {
                    all: c.status,
                    live: 'live',
                    draft: 'draft',
                    legacy: 'legacy',
                    empty: 'empty',
                };
                if (c.status !== map[filter]) return false;
            }
            // Search filter
            if (search.trim()) {
                const needle = search.trim().toLowerCase();
                const haystack = `${c.title} ${c.productName} ${c.storeName}`.toLowerCase();
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
    }, [cardData, filter, search]);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <ListHeader
                    title="صفحات الهبوط"
                    subtitle="صفحات هبوط بمنصة Soctiv — قالب موحد مع Meta Pixel + CAPI مدمج."
                />

                {!isLoading && landingPages.length > 0 && (
                    <FilterBar
                        active={filter}
                        onActiveChange={setFilter}
                        search={search}
                        onSearchChange={setSearch}
                        onNew={() => navigate('/products')}
                    />
                )}

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : landingPages.length === 0 ? (
                    <EmptyLandingPages />
                ) : filteredCards.length === 0 ? (
                    <FilteredEmpty onClear={() => { setFilter('all'); setSearch(''); }} />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredCards.map((c) => (
                            <LandingPageCard
                                key={c.id}
                                page={c}
                                onDelete={(id) => setDeletingId(id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Delete confirmation dialog */}
            <AlertDialog
                open={!!deletingId}
                onOpenChange={(open) => !open && setDeletingId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف صفحة الهبوط؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف الصفحة نهائيًا. إذا كانت الصفحة منشورة على Netlify،
                            فلن يتأثر ملف HTML المنشور (ستحتاج لإلغاء نشره يدويًا من Netlify).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deletingId) {
                                    deleteMutation.mutate(deletingId);
                                    setDeletingId(null);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            حذف نهائي
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
    return (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-muted/20">
            <p className="text-muted-foreground mb-3">لا توجد صفحات تطابق هذا التصفية</p>
            <button
                type="button"
                onClick={onClear}
                className="text-sm font-medium text-brand-cyan hover:underline"
            >
                مسح التصفية
            </button>
        </div>
    );
}
