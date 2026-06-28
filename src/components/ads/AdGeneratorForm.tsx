/**
 * AdGeneratorForm — the "Generate" tab content.
 *
 * Flow:
 *  1. User picks product (or it comes pre-selected from URL :productId).
 *  2. Form fetches the product's DNA, hydrates it, and renders its
 *     marketingAngles as angle options.
 *  3. Duration slider 10–120s (with quick presets), default 30.
 *  4. Click Generate → useGenerateAd fires with the avoid-topics list.
 *  5. On success, the resulting draft renders inside an AdCard (mode="preview").
 *     Save persists it; Discard clears the draft.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, X, Info, Clock, Package, Lightbulb, Check, ChevronsUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { AdCard } from './AdCard';
import { EmptyAdsNoProductSelected, EmptyAdsNoDna } from './EmptyAdsState';
import {
    useCreateAd,
    useExistingTopics,
    useGenerateAd,
} from '@/hooks/useAds';
import { useAuth } from '@/hooks/useAuth';
import { listProductsWithDna } from '@/services/adService';
import { loadProductDna, type ProductDnaRow } from '@/services/productDnaService';
import type { ProductDNA, MarketingAngle, AwarenessLevel } from '@/types/productDNA';
import { toast } from '@/components/ui/sonner';

const DEFAULT_DURATION = 30;
const MIN_DURATION = 10;
const MAX_DURATION = 120;
const DURATION_STEP = 5;
const DURATION_PRESETS = [15, 30, 45, 60, 90];

/**
 * Awareness levels are the strategic spine of the angle picker: a marketer
 * decides "which awareness stage am I targeting" before "which angle". So we
 * surface the level everywhere an angle appears — grouped headers in the
 * picker, a colored dot on the trigger, a soft badge in the context panel.
 *
 * Colors follow the awareness journey: cold (slate) → warming (amber/sky) →
 * convinced (violet) → ready to buy (emerald). Schwartz order is preserved.
 */
const AWARENESS_ORDER: readonly AwarenessLevel[] = [
    'unaware',
    'problem_aware',
    'solution_aware',
    'product_aware',
    'most_aware',
];

const AWARENESS_META: Record<AwarenessLevel, { label: string; dot: string; soft: string }> = {
    unaware: {
        label: 'غير واعٍ',
        dot: 'bg-slate-400',
        soft: 'bg-slate-400/10 text-slate-600 dark:text-slate-300',
    },
    problem_aware: {
        label: 'واعٍ بالمشكلة',
        dot: 'bg-amber-500',
        soft: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    solution_aware: {
        label: 'واعٍ بالحل',
        dot: 'bg-sky-500',
        soft: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    },
    product_aware: {
        label: 'واعٍ بالمنتج',
        dot: 'bg-violet-500',
        soft: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    },
    most_aware: {
        label: 'الأكثر وعياً',
        dot: 'bg-emerald-500',
        soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
};

/** Spoken Misrati ≈ 2.2 words/sec — keep this in sync with adPrompt.ts. */
function estimatedWords(seconds: number): string {
    const min = Math.max(20, Math.round(seconds * 1.8));
    const max = Math.round(seconds * 2.6);
    return `${min}–${max}`;
}

interface AdGeneratorFormProps {
    /** Pre-select this product (from /ads/:productId URL). */
    productId?: string;
    /** Called after a draft is successfully saved. */
    onCreated?: () => void;
}

export function AdGeneratorForm({ productId: initialProductId, onCreated }: AdGeneratorFormProps) {
    const [selectedProductId, setSelectedProductId] = useState<string | null>(
        initialProductId ?? null,
    );
    const [selectedAngleName, setSelectedAngleName] = useState<string | null>(null);
    const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
    const [draft, setDraft] = useState<ReturnType<typeof useGenerateAd>['data']>(null);

    // Reset angle selection when product changes.
    useEffect(() => {
        setSelectedAngleName(null);
        setDraft(null);
    }, [selectedProductId]);

    // Reset everything when initialProductId prop changes (e.g. route change).
    useEffect(() => {
        setSelectedProductId(initialProductId ?? null);
        setDraft(null);
    }, [initialProductId]);

    return (
        <div className="space-y-6">
            <ProductAngleDuration
                selectedProductId={selectedProductId}
                onProductChange={setSelectedProductId}
                fixedProductId={initialProductId}
                selectedAngleName={selectedAngleName}
                onAngleChange={setSelectedAngleName}
                duration={duration}
                onDurationChange={setDuration}
            />

            {selectedProductId && selectedAngleName && (
                <GenerateControls
                    productId={selectedProductId}
                    angleName={selectedAngleName}
                    duration={duration}
                    onDraft={(d) => setDraft(d)}
                    onDiscard={() => setDraft(null)}
                    onSaved={() => {
                        setDraft(null);
                        onCreated?.();
                    }}
                />
            )}

            <AnimatePresence>
                {draft && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <AdCardWrapper
                            draft={draft}
                            productId={selectedProductId!}
                            angleName={selectedAngleName!}
                            durationSeconds={duration}
                            onDiscard={() => setDraft(null)}
                            onSaved={() => {
                                setDraft(null);
                                onCreated?.();
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

interface SectionHeaderProps {
    step: number;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
}

function SectionHeader({ step, title, icon: Icon }: SectionHeaderProps) {
    return (
        <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {step}
            </span>
            <h3 className="flex items-center gap-2 text-base font-semibold">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {title}
            </h3>
        </div>
    );
}

// ─── Product combobox (searchable, scales past a flat dropdown) ─────────

interface ProductComboboxProps {
    products: { id: string; name: string }[];
    value: string | null;
    onChange: (id: string) => void;
    loading: boolean;
}

function ProductCombobox({ products, value, onChange, loading }: ProductComboboxProps) {
    const [open, setOpen] = useState(false);
    const selected = products.find((p) => p.id === value) ?? null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        !selected && 'text-muted-foreground',
                    )}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                            {selected ? (
                                <span className="font-medium text-foreground">{selected.name}</span>
                            ) : loading ? (
                                'جاري تحميل المنتجات...'
                            ) : (
                                'اختر منتجاً'
                            )}
                        </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="ابحث عن منتج..." />
                    <CommandList>
                        <CommandEmpty>
                            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                                لا توجد منتجات بـ DNA بعد.{' '}
                                <Link to="/products" className="text-primary hover:underline">
                                    أنشئ واحداً
                                </Link>
                            </div>
                        </CommandEmpty>
                        <CommandGroup>
                            {products.map((p) => (
                                <CommandItem
                                    key={p.id}
                                    value={p.name}
                                    onSelect={() => {
                                        onChange(p.id);
                                        setOpen(false);
                                    }}
                                    className="gap-2"
                                >
                                    <Check
                                        className={cn(
                                            'h-4 w-4 shrink-0',
                                            value === p.id ? 'opacity-100' : 'opacity-0',
                                        )}
                                    />
                                    <span className="truncate">{p.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Angle combobox (searchable, grouped by awareness level) ────────────

interface AngleComboboxProps {
    angles: MarketingAngle[];
    anglesByLevel: Map<AwarenessLevel, MarketingAngle[]>;
    value: string | null;
    onChange: (name: string) => void;
    disabled: boolean;
    placeholder: string;
}

function AngleCombobox({
    angles,
    anglesByLevel,
    value,
    onChange,
    disabled,
    placeholder,
}: AngleComboboxProps) {
    const [open, setOpen] = useState(false);
    const selected = angles.find((a) => a.angleName === value) ?? null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        !selected && 'text-muted-foreground',
                    )}
                >
                    {selected ? (
                        <span className="flex min-w-0 items-center gap-2">
                            <span
                                className={cn(
                                    'h-2 w-2 shrink-0 rounded-full',
                                    AWARENESS_META[selected.level].dot,
                                )}
                            />
                            <span className="truncate font-medium text-foreground">
                                {selected.angleName}
                            </span>
                        </span>
                    ) : (
                        <span className="truncate">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="ابحث عن زاوية أو مستوى وعي..." />
                    <CommandList>
                        <CommandEmpty>لا توجد زاوية مطابقة.</CommandEmpty>
                        {AWARENESS_ORDER.map((level) => {
                            const list = anglesByLevel.get(level);
                            if (!list || list.length === 0) return null;
                            const meta = AWARENESS_META[level];
                            return (
                                <CommandGroup
                                    key={level}
                                    heading={
                                        <span className="flex items-center gap-2">
                                            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                                            {meta.label}
                                            <span className="text-muted-foreground/60">
                                                ({list.length})
                                            </span>
                                        </span>
                                    }
                                >
                                    {list.map((a) => (
                                        <CommandItem
                                            key={a.angleName}
                                            value={`${a.angleName} — ${meta.label}`}
                                            onSelect={() => {
                                                onChange(a.angleName);
                                                setOpen(false);
                                            }}
                                            className="gap-2"
                                        >
                                            <Check
                                                className={cn(
                                                    'h-4 w-4 shrink-0',
                                                    value === a.angleName ? 'opacity-100' : 'opacity-0',
                                                )}
                                            />
                                            <span className="truncate">{a.angleName}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            );
                        })}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

interface ProductAngleDurationProps {
    selectedProductId: string | null;
    onProductChange: (id: string | null) => void;
    fixedProductId?: string;
    selectedAngleName: string | null;
    onAngleChange: (name: string | null) => void;
    duration: number;
    onDurationChange: (d: number) => void;
}

function ProductAngleDuration(props: ProductAngleDurationProps) {
    const {
        selectedProductId,
        onProductChange,
        fixedProductId,
        selectedAngleName,
        onAngleChange,
        duration,
        onDurationChange,
    } = props;

    // Products-with-DNA list (for the dropdown). Skipped when fixed by URL.
    const { data: products = [], isLoading: loadingProducts } = useQuery({
        queryKey: ['products-with-dna'],
        queryFn: () => listProductsWithDna(),
        enabled: !fixedProductId,
    });

    // DNA for the selected product.
    const {
        data: dnaRecord,
        isLoading: loadingDna,
        isError: dnaError,
    } = useQuery<{ row: ProductDnaRow; dna: ProductDNA } | null>({
        queryKey: ['product-dna', selectedProductId],
        queryFn: ({ signal }) =>
            selectedProductId ? loadProductDna(selectedProductId, { signal }) : Promise.resolve(null),
        enabled: !!selectedProductId,
    });

    const angles: MarketingAngle[] = useMemo(() => {
        return dnaRecord ? Array.from(dnaRecord.dna.marketingStrategy.marketingAngles) : [];
    }, [dnaRecord]);

    // Group angles by awareness level (in Schwartz order) for the picker.
    const anglesByLevel = useMemo(() => {
        const groups = new Map<AwarenessLevel, MarketingAngle[]>();
        for (const a of angles) {
            const list = groups.get(a.level);
            if (list) list.push(a);
            else groups.set(a.level, [a]);
        }
        return groups;
    }, [angles]);

    const selectedAngle = useMemo(
        () => angles.find((a) => a.angleName === selectedAngleName) ?? null,
        [angles, selectedAngleName],
    );

    const productName = useMemo(() => {
        if (!selectedProductId) return null;
        return products.find((p) => p.id === selectedProductId)?.name ?? null;
    }, [products, selectedProductId]);

    // True once we know the chosen product has no DNA yet (and isn't still loading).
    const noDnaYet = !!selectedProductId && (dnaError || (dnaRecord === null && !loadingDna));

    return (
        <Card className="border-border/60 shadow-sm">
            <CardHeader>
                <SectionHeader step={1} title="اختر المنتج والزاوية" icon={Package} />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                    {/* Product — searchable combobox (scales past a flat dropdown). */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">المنتج</Label>
                        {fixedProductId ? (
                            <div className="flex h-11 items-center justify-between rounded-lg border border-input bg-muted/40 px-3">
                                <span className="flex items-center gap-2 text-sm font-medium">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    {productName ?? '— جاري التحميل —'}
                                    {loadingDna && <Loader2 className="h-3 w-3 animate-spin" />}
                                </span>
                            </div>
                        ) : (
                            <ProductCombobox
                                products={products}
                                value={selectedProductId}
                                onChange={(id) => onProductChange(id)}
                                loading={loadingProducts}
                            />
                        )}
                    </div>

                    {/* Angle — searchable combobox grouped by awareness level. */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">زاوية الإعلان</Label>
                        <AngleCombobox
                            angles={angles}
                            anglesByLevel={anglesByLevel}
                            value={selectedAngleName}
                            onChange={(name) => onAngleChange(name)}
                            disabled={!dnaRecord || loadingDna || noDnaYet}
                            placeholder={
                                !selectedProductId
                                    ? 'اختر منتجاً أولاً'
                                    : loadingDna
                                        ? 'جاري تحميل الزوايا...'
                                        : noDnaYet
                                            ? 'لا يوجد DNA لهذا المنتج'
                                            : angles.length === 0
                                                ? 'لا توجد زوايا في هذا الـ DNA'
                                                : 'اختر زاوية'
                            }
                        />
                    </div>
                </div>

                {/* No product selected yet. */}
                {!selectedProductId && <EmptyAdsNoProductSelected />}

                {/* Product selected but it has no DNA yet. */}
                {noDnaYet && selectedProductId && <EmptyAdsNoDna productId={selectedProductId} />}

                {/* Selected angle context — reasoning + awareness level */}
                <AnimatePresence mode="wait">
                    {selectedAngle && (
                        <motion.div
                            key={selectedAngle.angleName}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
                                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold">{selectedAngle.angleName}</span>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                                AWARENESS_META[selectedAngle.level].soft,
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'h-1.5 w-1.5 rounded-full',
                                                    AWARENESS_META[selectedAngle.level].dot,
                                                )}
                                            />
                                            {AWARENESS_META[selectedAngle.level].label ?? selectedAngle.level}
                                        </span>
                                    </div>
                                    {selectedAngle.reasoning && (
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {selectedAngle.reasoning}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Duration — only meaningful once a product with DNA is selected. */}
                {dnaRecord && (
                    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                مدة الإعلان
                            </Label>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="tabular-nums font-semibold">
                                    {duration} ثانية
                                </Badge>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    ≈ {estimatedWords(duration)} كلمة
                                </span>
                            </div>
                        </div>

                        <Slider
                            min={MIN_DURATION}
                            max={MAX_DURATION}
                            step={DURATION_STEP}
                            value={[duration]}
                            onValueChange={(v) => onDurationChange(v[0] ?? DEFAULT_DURATION)}
                        />

                        <div className="flex flex-wrap gap-2 pt-1">
                            {DURATION_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => onDurationChange(preset)}
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                        duration === preset
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                    )}
                                >
                                    {preset}ث
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Generate button + draft handoff ────────────────────────────────────

interface GenerateControlsProps {
    productId: string;
    angleName: string;
    duration: number;
    onDraft: (d: NonNullable<ReturnType<typeof useGenerateAd>['data']>) => void;
    onDiscard: () => void;
    onSaved: () => void;
}

function GenerateControls({
    productId,
    angleName,
    duration,
    onDraft,
}: GenerateControlsProps) {
    const { data: dnaRecord } = useQuery({
        queryKey: ['product-dna', productId],
        queryFn: ({ signal }) => loadProductDna(productId, { signal }),
        enabled: !!productId,
    });

    const { data: existingTopics = [] } = useExistingTopics(productId, angleName);

    const angle: MarketingAngle | undefined = useMemo(() => {
        if (!dnaRecord) return undefined;
        return dnaRecord.dna.marketingStrategy.marketingAngles.find(
            (a) => a.angleName === angleName,
        );
    }, [dnaRecord, angleName]);

    const { generate, cancel, isGenerating } = useGenerateAd();

    const handleGenerate = async () => {
        if (!dnaRecord || !angle) {
            toast.error('لا يمكن توليد الإعلان', {
                description: 'بيانات الـ DNA أو الزاوية غير مكتملة.',
            });
            return;
        }
        try {
            const draft = await generate({
                dna: dnaRecord.dna,
                angle,
                durationSeconds: duration,
                existingTopics,
            });
            onDraft(draft);
        } catch {
            // useGenerateAd already surfaces a toast on error.
        }
    };

    return (
        <Card className="border-border/60 shadow-sm">
            <CardHeader>
                <SectionHeader step={2} title="ولّد الإعلان" icon={Sparkles} />
            </CardHeader>
            <CardContent className="space-y-4">
                {existingTopics.length > 0 && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="leading-relaxed">
                            تم توليد <strong>{existingTopics.length}</strong> موضوع سابق في هذه الزاوية.
                            سيتجنّب الذكاء الاصطناعي تكرارها ويختار موضوعاً جديداً.
                        </span>
                    </div>
                )}

                {isGenerating ? (
                    <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <div className="space-y-0.5">
                                <p className="text-sm font-semibold">جاري كتابة السكربت…</p>
                                <p className="text-xs text-muted-foreground">قد يستغرق 5–15 ثانية</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={cancel}
                            aria-label="إلغاء التوليد"
                        >
                            <X className="ml-2 h-4 w-4" />
                            إلغاء
                        </Button>
                    </div>
                ) : (
                    <Button
                        onClick={handleGenerate}
                        disabled={!dnaRecord || !angle}
                        size="lg"
                        className="group w-full gap-2 text-base shadow-md shadow-primary/20 sm:w-auto"
                    >
                        <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
                        ولّد إعلاناً جديداً
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Wrapper that wires the preview card to save / discard ──────────────

interface AdCardWrapperProps {
    draft: NonNullable<ReturnType<typeof useGenerateAd>['data']>;
    productId: string;
    angleName: string;
    durationSeconds: number;
    onDiscard: () => void;
    onSaved: () => void;
}

function AdCardWrapper({
    draft,
    productId,
    angleName,
    durationSeconds,
    onDiscard,
    onSaved,
}: AdCardWrapperProps) {
    const { user } = useAuth();
    // Need the DNA row to get client_id (the ads.client_id column is NOT NULL).
    const { data: dnaRecord } = useQuery({
        queryKey: ['product-dna', productId],
        queryFn: ({ signal }) => loadProductDna(productId, { signal }),
        enabled: !!productId,
    });
    const create = useCreateAd();

    const handleSave = async (changes: { hooks: string[]; copy: string; headline: string }) => {
        if (!dnaRecord) {
            toast.error('تعذّر الحفظ', {
                description: 'لم يتم العثور على بيانات المنتج.',
            });
            return;
        }
        try {
            await create.mutateAsync({
                product_id: productId,
                client_id: dnaRecord.row.client_id,
                angle_name: angleName,
                topic: draft.topic,
                duration_seconds: durationSeconds,
                hooks: changes.hooks,
                copy: changes.copy,
                headline: changes.headline,
                created_by: user?.id ?? null,
            });
            onSaved();
        } catch {
            // useCreateAd toasts on error.
        }
    };

    return (
        <AdCard
            mode="preview"
            draft={draft}
            angleName={angleName}
            durationSeconds={durationSeconds}
            isSaving={create.isPending}
            onSave={handleSave}
            onDiscard={onDiscard}
        />
    );
}
