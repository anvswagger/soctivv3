/**
 * DnaSummaryCard — Product DNA results display v2.
 *
 * Three clear sections:
 *   1. Product Identity (from user input — "what you told us")
 *   2. Target Customer Analysis (AI's job)
 *   3. Marketing Strategy (AI's main job)
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Zap,
    Download,
    LayoutTemplate,
    Save,
    CheckCircle2,
    AlertTriangle,
    Lightbulb,
    Users,
    Megaphone,
    Tag,
    Copy,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadDnaPdf } from '@/services/pdfExportService';
import { useNavigate } from 'react-router-dom';
import type { ProductDNA, AwarenessLevel } from '@/types/productDNA';

interface DnaSummaryCardProps {
    dna: ProductDNA;
    onRegenerate?: () => void;
    /**
     * Persists the DNA to Supabase. Should return the saved record (with
     * the real DB-assigned id) so the caller can navigate to consumers
     * like the landing-page editor without tripping foreign-key checks.
     */
    onSave?: () => Promise<ProductDNA | null | void> | ProductDNA | null | void;
    isSaved?: boolean;
    className?: string;
}

const LEVEL_LABELS: Record<AwarenessLevel, { ar: string; color: string }> = {
    unaware: { ar: 'غير مدرك', color: 'bg-gray-100 text-gray-700' },
    problem_aware: { ar: 'يعلم بالمشكلة', color: 'bg-orange-100 text-orange-700' },
    solution_aware: { ar: 'يعلم بالحل', color: 'bg-yellow-100 text-yellow-700' },
    product_aware: { ar: 'يعلم بالمنتج', color: 'bg-blue-100 text-blue-700' },
    most_aware: { ar: 'على وشك الشراء', color: 'bg-green-100 text-green-700' },
};

const LEVEL_ORDER: AwarenessLevel[] = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'];

function SectionHeader({ icon: Icon, title, subtitle, color }: {
    icon: typeof Zap;
    title: string;
    subtitle?: string;
    color?: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', color || 'bg-primary/10')}>
                <Icon className={cn('w-4 h-4', color ? 'text-white' : 'text-primary')} />
            </div>
            <div>
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
        </div>
    );
}

export function DnaSummaryCard({ dna, onRegenerate, onSave, isSaved, className }: DnaSummaryCardProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isNavigatingToLanding, setIsNavigatingToLanding] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        identity: true,
        customer: true,
        strategy: true,
    });
    const navigate = useNavigate();

    const pi = dna.productIdentity;
    const tc = dna.targetCustomer;
    const ms = dna.marketingStrategy;

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (!onSave) return;
        setIsSaving(true);
        try {
            await onSave();
        } catch (err) {
            console.error('Failed to save DNA:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await downloadDnaPdf(dna);
        } catch (err) {
            console.error('Failed to download PDF:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch {
            // Clipboard API may fail in some contexts
        }
    };

    // Group angles by awareness level
    const anglesByLevel: Partial<Record<AwarenessLevel, Array<typeof ms.marketingAngles[number]>>> = {};
    for (const angle of ms.marketingAngles) {
        const level = angle.level || 'unaware';
        if (!anglesByLevel[level]) anglesByLevel[level] = [];
        anglesByLevel[level].push(angle);
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('w-full max-w-3xl mx-auto space-y-4', className)}
        >
            {/* ── Header ── */}
            <div className="text-center space-y-2 py-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-primary">Product DNA v2.0</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground">{pi.productName}</h2>
                <p className="text-muted-foreground text-sm">{pi.tagline}</p>
            </div>

            {/* ══ Section 1: Product Identity ══ */}
            <CollapsibleSection
                isExpanded={expandedSections.identity}
                onToggle={() => toggleSection('identity')}
                header={
                    <SectionHeader
                        icon={Zap}
                        title="هوية المنتج"
                        subtitle="بناءً على ما أخبرتنا به"
                        color="bg-blue-500"
                    />
                }
            >
                <div className="space-y-4">
                    {/* Summary */}
                    <p className="text-sm text-foreground/80 leading-relaxed">{pi.summary}</p>

                    {/* Price */}
                    {pi.pricing.price > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">السعر:</span>
                            <span className="font-semibold text-foreground">
                                {pi.pricing.currency} {pi.pricing.price.toLocaleString()}
                            </span>
                        </div>
                    )}

                    {/* Key Features */}
                    {pi.keyFeatures.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">الميزات الرئيسية</h4>
                            <ul className="space-y-1.5">
                                {pi.keyFeatures.map((f, i) => (
                                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                        <span className="text-primary mt-1 text-xs">◆</span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Use Cases */}
                    {pi.useCases.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">حالات الاستخدام</h4>
                            <div className="flex flex-wrap gap-2">
                                {pi.useCases.map((uc, i) => (
                                    <span key={i} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">
                                        {uc}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unique Selling Points */}
                    {pi.uniqueSellingPoints.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">نقاط البيع الفريدة</h4>
                            <ul className="space-y-1.5">
                                {pi.uniqueSellingPoints.map((usp, i) => (
                                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                        <span className="text-green-500 mt-1">✦</span>
                                        {usp}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Tags */}
                    {pi.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {pi.tags.map((tag, i) => (
                                <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            {/* ══ Section 2: Target Customer ══ */}
            <CollapsibleSection
                isExpanded={expandedSections.customer}
                onToggle={() => toggleSection('customer')}
                header={
                    <SectionHeader
                        icon={Users}
                        title="العميل المستهدف"
                        subtitle="تحليل الذكاء الاصطناعي"
                        color="bg-orange-500"
                    />
                }
            >
                <div className="space-y-4">
                    {/* Persona Summary */}
                    {tc.personaSummary && (
                        <p className="text-sm text-foreground/80 leading-relaxed">{tc.personaSummary}</p>
                    )}

                    {/* Demographics */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">الفئة العمرية</p>
                            <p className="text-sm font-medium text-foreground">{tc.demographics.ageRange[0]} - {tc.demographics.ageRange[1]} سنة</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">المواقع</p>
                            <p className="text-sm font-medium text-foreground">{tc.demographics.location.join('، ')}</p>
                        </div>
                    </div>

                    {/* Pain Points */}
                    {tc.painPoints.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">نقاط الألم</h4>
                            <ul className="space-y-1.5">
                                {tc.painPoints.map((pp, i) => (
                                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                                        {pp}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Core Desires */}
                    {tc.coreDesires.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">الرغبات الأساسية</h4>
                            <ul className="space-y-1.5">
                                {tc.coreDesires.map((d, i) => (
                                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                        <Lightbulb className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                        {d}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Buying Behavior */}
                    {tc.behavior.decisionFactors.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">عوامل القرار الشرائي</h4>
                            <div className="flex flex-wrap gap-2">
                                {tc.behavior.decisionFactors.map((f, i) => (
                                    <span key={i} className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full">
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </CollapsibleSection>

            {/* ══ Section 3: Marketing Strategy ══ */}
            <CollapsibleSection
                isExpanded={expandedSections.strategy}
                onToggle={() => toggleSection('strategy')}
                header={
                    <SectionHeader
                        icon={Megaphone}
                        title="الاستراتيجية التسويقية"
                        subtitle="تحليل الذكاء الاصطناعي"
                        color="bg-purple-500"
                    />
                }
            >
                <div className="space-y-5">
                    {/* Marketing Angles by Awareness Level */}
                    <div>
                        <div className="flex items-baseline justify-between mb-3">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                الزوايا التسويقية
                            </h4>
                            <span className="text-xs text-muted-foreground">
                                {ms.marketingAngles.length} زاوية عبر {LEVEL_ORDER.length} مستويات وعي
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                            كل زاوية تستهدف مستوى وعي مختلف (Schwartz 5 Levels) — اختر الزاوية الأنسب لجمهورك المستهدف.
                        </p>
                        <div className="space-y-4">
                            {LEVEL_ORDER.map((level) => {
                                const angles = anglesByLevel[level];
                                if (!angles || angles.length === 0) return null;
                                const info = LEVEL_LABELS[level];
                                // Soft warning if a level is under-represented.
                                const underRepresented = angles.length < 4;

                                return (
                                    <div key={level} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', info.color)}>
                                                {info.ar}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {angles.length} {angles.length === 1 ? 'زاوية' : angles.length === 2 ? 'زوايتان' : angles.length < 11 ? 'زوايا' : 'زاوية'}
                                            </span>
                                            {underRepresented && (
                                                <span
                                                    className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                                                    title="يُنصح بإعادة التوليد لتغطية أوسع"
                                                >
                                                    تغطية منخفضة
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            {angles.map((angle, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-muted/30 border border-border/50 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors group"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <span
                                                            className="text-[10px] font-mono font-medium text-muted-foreground bg-background border border-border/50 rounded px-1.5 py-0.5 mt-0.5 shrink-0"
                                                            aria-label={`الزاوية ${i + 1}`}
                                                        >
                                                            {i + 1}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-medium text-foreground">
                                                                    {angle.angleName}
                                                                </span>
                                                                <button
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            angle.angleName,
                                                                            `angle-${level}-${i}`
                                                                        )
                                                                    }
                                                                    className="text-xs text-muted-foreground hover:text-primary shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                                                                    title="نسخ اسم الزاوية"
                                                                >
                                                                    {copiedField === `angle-${level}-${i}` ? (
                                                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                                    ) : (
                                                                        <Copy className="w-3 h-3" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                            {angle.reasoning && (
                                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                                    {angle.reasoning}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ── Actions ── */}
            <div className="flex items-center justify-center gap-3 pt-4 pb-8 flex-wrap">
                {onSave && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isSaved}
                        className={cn(
                            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-opacity disabled:opacity-50',
                            isSaved
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-primary text-primary-foreground hover:opacity-90'
                        )}
                    >
                        {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className={cn('w-4 h-4', isSaving && 'animate-bounce')} />}
                        {isSaving ? 'جاري الحفظ...' : isSaved ? 'تم الحفظ' : 'حفظ'}
                    </button>
                )}
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity font-medium text-sm disabled:opacity-50"
                >
                    <Download className={cn('w-4 h-4', isDownloading && 'animate-bounce')} />
                    {isDownloading ? 'جاري التحميل...' : 'PDF'}
                </button>
                {onRegenerate && (
                    <button
                        onClick={onRegenerate}
                        className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-xl hover:bg-muted transition-colors font-medium text-sm"
                    >
                        إعادة إنشاء
                    </button>
                )}
                <button
                    onClick={async () => {
                        if (isNavigatingToLanding) return;
                        // If the DNA hasn't been persisted yet, dna.id is
                        // undefined and we have no valid product_dna id to
                        // hand to the landing-page editor. Save first so the
                        // DB row exists (and dna.id gets populated), then
                        // navigate with the real id — never fall back to
                        // dna.productId, which would point to a `products`
                        // row and trip a foreign-key violation.
                        if (!dna.id) {
                            if (!onSave) {
                                navigate('/products');
                                return;
                            }
                            setIsNavigatingToLanding(true);
                            try {
                                const saved = await onSave();
                                const realId = saved?.id;
                                if (!realId) return; // save failed or returned no id; toast already shown
                                navigate(`/landing-pages/new/${realId}`);
                            } finally {
                                setIsNavigatingToLanding(false);
                            }
                            return;
                        }
                        navigate(`/landing-pages/new/${dna.id}`);
                    }}
                    disabled={isNavigatingToLanding}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl hover:opacity-90 transition-opacity font-medium text-sm disabled:opacity-50"
                >
                    <LayoutTemplate className="w-4 h-4" />
                    {isNavigatingToLanding ? 'جاري التحضير...' : 'صفحة هبوط'}
                </button>
            </div>
        </motion.div>
    );
}

// ─── Collapsible Section Wrapper ───────────────────────────────────────────

function CollapsibleSection({
    isExpanded,
    onToggle,
    header,
    children,
}: {
    isExpanded: boolean;
    onToggle: () => void;
    header: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
                {header}
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
            </button>
            <AnimatePresenceWrapper isExpanded={isExpanded}>
                <div className="px-4 pb-4">{children}</div>
            </AnimatePresenceWrapper>
        </div>
    );
}

function AnimatePresenceWrapper({ isExpanded, children }: { isExpanded: boolean; children: React.ReactNode }) {
    if (!isExpanded) return null;
    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            {children}
        </motion.div>
    );
}