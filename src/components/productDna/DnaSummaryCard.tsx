/**
 * DnaSummaryCard — Simplified Product DNA display with awareness-level marketing angles.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Target, Zap, Download, LayoutTemplate, Save, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadDnaPdf } from '@/services/pdfExportService';
import { useNavigate } from 'react-router-dom';
import type { ProductDNA, AwarenessLevel } from '@/types/productDNA';

interface DnaSummaryCardProps {
    dna: ProductDNA;
    onRegenerate?: () => void;
    onSave?: () => Promise<void> | void;
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

export function DnaSummaryCard({ dna, onRegenerate, onSave, isSaved, className }: DnaSummaryCardProps) {
    const [expandedAngle, setExpandedAngle] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const navigate = useNavigate();
    const cf = dna.coreFacts;
    const icp = dna.icpProfile;
    const ms = dna.marketingSynthesis;

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
            className={cn('w-full max-w-3xl mx-auto space-y-6', className)}
        >
            {/* Header */}
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">{cf.productName}</h2>
                <p className="text-muted-foreground text-sm">{cf.tagline}</p>
            </div>

            {/* ── Product Facts ── */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">حقائق المنتج</h3>
                </div>

                <p className="text-sm text-foreground/80 leading-relaxed">{cf.description.summary}</p>

                {/* Price */}
                {cf.pricing.price > 0 && (
                    <div className="text-sm">
                        <span className="text-muted-foreground">السعر: </span>
                        <span className="font-medium text-foreground">{cf.pricing.currency} {cf.pricing.price.toLocaleString()}</span>
                    </div>
                )}

                {/* Specifications */}
                {Object.keys(cf.description.specifications).length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">المكونات والخصائص</h4>
                        <div className="space-y-1">
                            {Object.entries(cf.description.specifications).map(([key, value], i) => (
                                <div key={i} className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span className="text-foreground">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Key Features */}
                {cf.description.keyFeatures.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">الميزات الرئيسية</h4>
                        <ul className="space-y-1">
                            {cf.description.keyFeatures.map((f, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Use Cases */}
                {cf.description.useCases.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">حالات الاستخدام</h4>
                        <div className="flex flex-wrap gap-2">
                            {cf.description.useCases.map((uc, i) => (
                                <span key={i} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">{uc}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Target Customer ── */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">العميل المستهدف</h3>
                </div>

                {icp.personaSummary && (
                    <p className="text-sm text-foreground/80 leading-relaxed">{icp.personaSummary}</p>
                )}

                {icp.primaryPainPoints.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">نقاط الألم</h4>
                        <ul className="space-y-1">
                            {icp.primaryPainPoints.map((pp, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                                    {pp}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {icp.coreDesires.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">الرغبات</h4>
                        <ul className="space-y-1">
                            {icp.coreDesires.map((d, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <Lightbulb className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                    {d}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* ── Marketing Angles by Awareness Level ── */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">الزوايا التسويقية ({ms.marketingAngles.length} زاوية)</h3>
                </div>

                {LEVEL_ORDER.map((level) => {
                    const angles = anglesByLevel[level];
                    if (!angles || angles.length === 0) return null;
                    const info = LEVEL_LABELS[level];

                    return (
                        <div key={level} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', info.color)}>
                                    {info.ar}
                                </span>
                                <span className="text-xs text-muted-foreground">{angles.length} زوايا</span>
                            </div>

                            <div className="space-y-2">
                                {angles.map((angle, i) => {
                                    const key = `${level}-${i}`;
                                    const isExpanded = expandedAngle === key;

                                    return (
                                        <div key={i} className="border border-border rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setExpandedAngle(isExpanded ? null : key)}
                                                className="w-full flex items-center justify-between p-3 text-right hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="font-medium text-foreground text-sm">{angle.headline}</span>
                                                    <span className="text-xs text-muted-foreground">{angle.angleName}</span>
                                                </div>
                                                <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', isExpanded && 'rotate-180')} />
                                            </button>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-3 pt-0 border-t border-border space-y-2">
                                                            {angle.subheadline && (
                                                                <p className="text-sm text-muted-foreground">{angle.subheadline}</p>
                                                            )}
                                                            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{angle.bodyCopy}</p>
                                                            <div className="flex flex-wrap gap-2 text-xs">
                                                                <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded">🎯 {angle.targetPainPoint}</span>
                                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">💬 {angle.emotionalAppeal}</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Actions ── */}
            <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
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
                    onClick={() => navigate(`/landing-pages/new/${dna.id || dna.productId}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl hover:opacity-90 transition-opacity font-medium text-sm"
                >
                    <LayoutTemplate className="w-4 h-4" />
                    صفحة هبوط
                </button>
            </div>
        </motion.div>
    );
}