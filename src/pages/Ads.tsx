/**
 * Ad Builder — page entry point.
 *
 * Routes:
 *   /ads           → pick a product from the dropdown
 *   /ads/:productId → product pre-selected from the URL
 *
 * Super-admin only (enforced by `<ProtectedRoute requireSuperAdmin>` in App.tsx).
 *
 * Two tabs: Generate (create a new ad) and Library (browse saved ads).
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Megaphone, Sparkles, Library as LibraryIcon, Wand2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdGeneratorForm } from '@/components/ads/AdGeneratorForm';
import { AdLibraryList } from '@/components/ads/AdLibraryList';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Tab = 'generate' | 'library';

export default function Ads() {
    const { productId } = useParams<{ productId?: string }>();
    const [tab, setTab] = useState<Tab>('generate');

    // When the URL pins a product, fetch its name for the page header.
    const { data: product } = useQuery({
        queryKey: ['product-name', productId],
        queryFn: async () => {
            if (!productId) return null;
            const { data, error } = await db
                .from('products')
                .select('id, name')
                .eq('id', productId)
                .maybeSingle();
            if (error) throw error;
            return data as { id: string; name: string } | null;
        },
        enabled: !!productId,
    });

    return (
        <DashboardLayout>
            <div className="mx-auto w-full max-w-5xl space-y-8 pb-12">
                <PageHeader
                    title={product ? `إعلانات: ${product.name}` : 'مولّد الإعلانات'}
                    subtitle="سكربتات إعلانات فيسبوك مباشرة للكاميرا — لهجة مصراتية، جاهزة للتصوير، مولّدة من Product DNA."
                />

                <Tabs
                    value={tab}
                    onValueChange={(v) => setTab(v as Tab)}
                    className="space-y-6"
                >
                    <TabsList className="h-11 w-full justify-start gap-1 rounded-xl bg-muted/60 p-1 sm:w-auto">
                        <TabsTrigger
                            value="generate"
                            className="gap-2 rounded-lg px-4 data-[state=active]:shadow-sm"
                        >
                            <Wand2 className="h-4 w-4" />
                            إنشاء إعلان
                        </TabsTrigger>
                        <TabsTrigger
                            value="library"
                            className="gap-2 rounded-lg px-4 data-[state=active]:shadow-sm"
                        >
                            <LibraryIcon className="h-4 w-4" />
                            المكتبة
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="generate" className="space-y-4 focus-visible:outline-none">
                        <AdGeneratorForm
                            productId={productId}
                            onCreated={() => setTab('library')}
                        />
                    </TabsContent>

                    <TabsContent value="library" className="space-y-4 focus-visible:outline-none">
                        <AdLibraryList
                            productId={productId}
                            onSwitchToGenerate={() => setTab('generate')}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}

interface PageHeaderProps {
    title: string;
    subtitle: string;
}

function PageHeader({ title, subtitle }: PageHeaderProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/[0.06] via-card to-card p-6 shadow-sm sm:p-8"
        >
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                        <Megaphone className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="hidden shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary sm:flex">
                    <Sparkles className="h-3.5 w-3.5" />
                    مدعوم بالذكاء الاصطناعي
                </div>
            </div>
        </motion.div>
    );
}
