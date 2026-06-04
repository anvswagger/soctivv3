/**
 * Product DNA PDF Export — Arabic RTL, branded, amazing design.
 */
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { ProductDNA, AwarenessLevel } from '@/types/productDNA';
import * as React from 'react';

// ─── Font Registration ──────────────────────────────────────────────────────

Font.register({
    family: 'Cairo',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hNI-W1Q.ttf', fontWeight: 500 },
        { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf', fontWeight: 700 },
        { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hGA5W1Q.ttf', fontWeight: 800 },
    ],
});

// ─── Palette ────────────────────────────────────────────────────────────────

const C = {
    primary: '#0f172a',
    accent: '#2563eb',
    accentLight: '#3b82f6',
    accentPale: '#dbeafe',
    text: '#1e293b',
    textLight: '#64748b',
    textMuted: '#94a3b8',
    bg: '#ffffff',
    sectionBg: '#f8fafc',
    border: '#e2e8f0',
    highlight: '#eff6ff',
    white: '#ffffff',
    orange: '#f97316',
    orangeLight: '#fff7ed',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    gray: '#6b7280',
    grayLight: '#f9fafb',
    yellow: '#ca8a04',
    yellowLight: '#fefce8',
    red: '#dc2626',
    redLight: '#fef2f2',
    gradient1: '#1e40af',
    gradient2: '#3b82f6',
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    // Cover
    cover: { padding: 0, fontFamily: 'Cairo', backgroundColor: C.primary },
    coverTop: { padding: 50, paddingBottom: 30 },
    coverBottom: { padding: 40, paddingTop: 30 },
    coverBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 60 },
    coverLogo: { width: 40, height: 40, backgroundColor: C.accent, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    coverLogoText: { fontSize: 22, fontWeight: 800, color: C.white, fontFamily: 'Cairo' },
    coverBrandName: { fontSize: 18, fontWeight: 700, color: C.white, fontFamily: 'Cairo' },
    coverTitle: { fontSize: 38, fontWeight: 800, color: C.white, textAlign: 'right', marginBottom: 12, fontFamily: 'Cairo', lineHeight: 1.3 },
    coverSub: { fontSize: 15, color: C.textMuted, textAlign: 'right', marginBottom: 40, lineHeight: 1.8, fontFamily: 'Cairo' },
    coverProductName: { fontSize: 22, fontWeight: 700, color: C.accentLight, textAlign: 'right', marginBottom: 8, fontFamily: 'Cairo' },
    coverTagline: { fontSize: 14, color: C.textMuted, textAlign: 'right', fontFamily: 'Cairo' },
    coverAccentLine: { height: 3, backgroundColor: C.accent, width: 80, marginTop: 40 },
    coverFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 20 },
    coverFooterText: { fontSize: 9, color: C.textMuted, fontFamily: 'Cairo' },

    // Content pages
    page: { padding: 36, paddingBottom: 56, fontFamily: 'Cairo', backgroundColor: C.bg, direction: 'rtl' },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: C.border },
    pageHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageHeaderLogo: { width: 24, height: 24, backgroundColor: C.accent, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    pageHeaderLogoText: { fontSize: 12, fontWeight: 800, color: C.white, fontFamily: 'Cairo' },
    pageHeaderBrand: { fontSize: 12, fontWeight: 700, color: C.primary, fontFamily: 'Cairo' },
    pageHeaderLeft: { fontSize: 8, color: C.textMuted, fontFamily: 'Cairo' },

    // Section card
    card: { padding: 20, backgroundColor: C.sectionBg, borderRadius: 10, marginBottom: 16, borderRightWidth: 4, borderRightColor: C.accent },
    cardTitle: { fontSize: 18, fontWeight: 800, color: C.primary, marginBottom: 14, textAlign: 'right', fontFamily: 'Cairo' },
    cardSub: { fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8, marginTop: 14, textAlign: 'right', fontFamily: 'Cairo' },

    // Text
    body: { fontSize: 11, lineHeight: 1.7, color: C.text, marginBottom: 6, textAlign: 'right', fontFamily: 'Cairo', direction: 'rtl' },
    bodySmall: { fontSize: 10, lineHeight: 1.6, color: C.textLight, marginBottom: 4, textAlign: 'right', fontFamily: 'Cairo' },

    // Key-value
    kvRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, gap: 8 },
    kvKey: { fontSize: 10, fontWeight: 700, color: C.textMuted, textAlign: 'right', fontFamily: 'Cairo' },
    kvVal: { fontSize: 11, color: C.text, textAlign: 'right', fontFamily: 'Cairo', flex: 1 },

    // Tags
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, marginBottom: 8 },
    tag: { fontSize: 9, color: C.accent, backgroundColor: C.accentPale, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontFamily: 'Cairo' },

    // Awareness level badge
    levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, justifyContent: 'flex-end' },
    levelDot: { width: 8, height: 8, borderRadius: 4 },
    levelText: { fontSize: 12, fontWeight: 700, fontFamily: 'Cairo' },
    levelCount: { fontSize: 10, color: C.textMuted, fontFamily: 'Cairo' },

    // Angle card
    angleCard: { padding: 14, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
    angleHeadline: { fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 4, textAlign: 'right', fontFamily: 'Cairo' },
    angleName: { fontSize: 9, color: C.textMuted, marginBottom: 6, textAlign: 'right', fontFamily: 'Cairo' },
    angleBody: { fontSize: 10, lineHeight: 1.6, color: C.text, marginBottom: 8, textAlign: 'right', fontFamily: 'Cairo', direction: 'rtl' },
    angleMeta: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    angleMetaItem: { fontSize: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontFamily: 'Cairo' },

    // Divider
    divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function E(type: any, props?: Record<string, any> | null, ...children: any[]): React.ReactElement {
    return React.createElement(type, props ?? {}, ...children);
}

function LogoSmall() {
    return E(View, { style: s.pageHeaderLogo },
        E(Text, { style: s.pageHeaderLogoText }, 'S')
    );
}

function LogoBrand() {
    return E(View, { style: s.pageHeaderRight },
        E(LogoSmall),
        E(Text, { style: s.pageHeaderBrand }, 'Soctiv')
    );
}

// ─── Level Colors ───────────────────────────────────────────────────────────

const LEVEL_META: Record<AwarenessLevel, { ar: string; color: string; bg: string }> = {
    unaware: { ar: 'غير مدرك للمشكلة', color: C.gray, bg: C.grayLight },
    problem_aware: { ar: 'يعلم بالمشكلة', color: C.orange, bg: C.orangeLight },
    solution_aware: { ar: 'يعلم بالحل', color: C.yellow, bg: C.yellowLight },
    product_aware: { ar: 'يعرف المنتج', color: C.blue, bg: C.blueLight },
    most_aware: { ar: 'جاهز للشراء', color: C.green, bg: C.greenLight },
};

const LEVEL_ORDER: AwarenessLevel[] = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'];

// ─── Page: Cover ────────────────────────────────────────────────────────────

function CoverPage(dna: ProductDNA) {
    const date = new Date(dna.generatedAt).toLocaleDateString('ar-LY', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
    return E(Page, { size: 'A4', style: s.cover },
        // Top section with brand
        E(View, { style: { ...s.coverTop, flex: 1 } },
            E(View, { style: s.coverBrand },
                E(View, { style: s.coverLogo }, E(Text, { style: s.coverLogoText }, 'S')),
                E(Text, { style: s.coverBrandName }, 'Soctiv')
            ),
            // Title
            E(Text, { style: s.coverTitle }, 'تحليل DNA المنتج'),
            E(Text, { style: s.coverSub }, 'تحليل شامل لبيانات المنتج والاستراتيجية التسويقية بالذكاء الاصطناعي'),
            // Product info
            E(View, { style: s.coverAccentLine }),
            E(Text, { style: { ...s.coverProductName, marginTop: 20 } }, dna.coreFacts.productName),
            dna.coreFacts.tagline ? E(Text, { style: s.coverTagline }, dna.coreFacts.tagline) : null,
        ),
        // Bottom
        E(View, { style: s.coverFooter },
            E(Text, { style: s.coverFooterText }, date),
            E(Text, { style: s.coverFooterText }, 'v' + dna.version),
        )
    );
}

// ─── Page: Product Facts ────────────────────────────────────────────────────

function ProductFactsPage(dna: ProductDNA) {
    const cf = dna.coreFacts;
    return E(Page, { size: 'A4', style: s.page },
        E(View, { style: s.pageHeader },
            E(LogoBrand),
            E(Text, { style: s.pageHeaderLeft }, dna.coreFacts.productName),
        ),
        E(View, { style: s.card },
            E(Text, { style: s.cardTitle }, 'حقائق المنتج'),
            // Summary
            E(Text, { style: s.body }, cf.description.summary),
            E(View, { style: s.divider }),
            // Key info
            cf.pricing.price > 0
                ? E(View, { style: s.kvRow },
                    E(Text, { style: s.kvVal }, cf.pricing.currency + ' ' + cf.pricing.price.toLocaleString()),
                    E(Text, { style: s.kvKey }, 'السعر'),
                )
                : null,
            E(View, { style: s.kvRow },
                E(Text, { style: s.kvVal }, cf.pricing.pricingModel === 'one-time' ? 'دفعة واحدة' : cf.pricing.pricingModel),
                E(Text, { style: s.kvKey }, 'طريقة البيع'),
            ),
            cf.category.length > 0
                ? E(View, { style: s.kvRow },
                    E(Text, { style: s.kvVal }, cf.category.join(' • ')),
                    E(Text, { style: s.kvKey }, 'التصنيف'),
                )
                : null,
        ),
        // Specifications
        Object.keys(cf.description.specifications).length > 0
            ? E(View, { style: s.card },
                E(Text, { style: s.cardTitle }, 'المكونات والخصائص'),
                ...Object.entries(cf.description.specifications).map(([k, v]) =>
                    E(View, { style: s.kvRow, key: k },
                        E(Text, { style: s.kvVal }, v),
                        E(Text, { style: s.kvKey }, k),
                    )
                )
            )
            : null,
        // Key Features
        cf.description.keyFeatures.length > 0
            ? E(View, { style: s.card },
                E(Text, { style: s.cardTitle }, 'الميزات الرئيسية'),
                ...cf.description.keyFeatures.map((f, i) =>
                    E(Text, { style: { ...s.body, paddingLeft: 10 }, key: i }, '\u2022 ' + f)
                )
            )
            : null,
        // Use Cases
        cf.description.useCases.length > 0
            ? E(View, { style: s.card },
                E(Text, { style: s.cardTitle }, 'حالات الاستخدام'),
                E(View, { style: s.tagWrap },
                    ...cf.description.useCases.map((uc, i) =>
                        E(Text, { style: s.tag, key: i }, uc)
                    )
                )
            )
            : null,
    );
}

// ─── Page: Target Customer ──────────────────────────────────────────────────

function TargetCustomerPage(dna: ProductDNA) {
    const icp = dna.icpProfile;
    return E(Page, { size: 'A4', style: s.page },
        E(View, { style: s.pageHeader },
            E(LogoBrand),
            E(Text, { style: s.pageHeaderLeft }, 'العميل المستهدف'),
        ),
        E(View, { style: s.card },
            E(Text, { style: s.cardTitle }, 'العميل المستهدف'),
            icp.personaSummary ? E(Text, { style: s.body }, icp.personaSummary) : null,
            E(View, { style: s.divider }),
            // Pain Points
            icp.primaryPainPoints.length > 0
                ? E(View, null,
                    E(Text, { style: { ...s.cardSub, color: C.red } }, 'نقاط الألم'),
                    ...icp.primaryPainPoints.map((pp, i) =>
                        E(Text, { style: { ...s.body, color: C.red }, key: i }, '\u26a0 ' + pp)
                    )
                )
                : null,
            // Desires
            icp.coreDesires.length > 0
                ? E(View, null,
                    E(Text, { style: { ...s.cardSub, color: C.green } }, 'الرغبات والطموحات'),
                    ...icp.coreDesires.map((d, i) =>
                        E(Text, { style: { ...s.body, color: C.green }, key: i }, '\u2728 ' + d)
                    )
                )
                : null,
        ),
    );
}

// ─── Page: Marketing Angles ─────────────────────────────────────────────────

function MarketingAnglesPage(dna: ProductDNA, pageNum: number) {
    const ms = dna.marketingSynthesis;
    return E(Page, { size: 'A4', style: s.page },
        E(View, { style: s.pageHeader },
            E(LogoBrand),
            E(Text, { style: s.pageHeaderLeft }, 'الزوايا التسويقية'),
        ),
        E(View, { style: s.card },
            E(Text, { style: s.cardTitle }, 'الزوايا التسويقية (' + ms.marketingAngles.length + ' زاوية)'),
            E(Text, { style: { ...s.body, fontWeight: 700, color: C.accent } }, ms.primaryValueProposition),
        ),
        // Angles by level
        ...LEVEL_ORDER.flatMap((level) => {
            const angles = ms.marketingAngles.filter((a) => (a.level || 'unaware') === level);
            if (angles.length === 0) return [];
            const meta = LEVEL_META[level];
            return [
                E(View, { style: s.levelBadge, key: 'badge-' + level },
                    E(Text, { style: s.levelCount }, angles.length + ' زوايا'),
                    E(Text, { style: { ...s.levelText, color: meta.color } }, meta.ar),
                    E(View, { style: { ...s.levelDot, backgroundColor: meta.color } }),
                ),
                ...angles.map((angle, i) =>
                    E(View, { style: { ...s.angleCard, borderRightColor: meta.color }, key: level + '-' + i },
                        E(Text, { style: s.angleHeadline }, angle.headline),
                        E(Text, { style: s.angleName }, angle.angleName),
                        angle.subheadline ? E(Text, { style: { ...s.bodySmall, fontStyle: 'italic' } }, angle.subheadline) : null,
                        E(Text, { style: s.angleBody }, angle.bodyCopy),
                        E(View, { style: s.angleMeta },
                            E(Text, { style: { ...s.angleMetaItem, backgroundColor: C.orangeLight, color: C.orange } }, '🎯 ' + angle.targetPainPoint),
                            E(Text, { style: { ...s.angleMetaItem, backgroundColor: C.blueLight, color: C.blue } }, '💬 ' + angle.emotionalAppeal),
                        ),
                    )
                ),
            ];
        }),
    );
}

// ─── Document Assembly ─────────────────────────────────────────────────────

function buildDocument(dna: ProductDNA): React.ReactElement {
    return E(Document,
        { title: 'Product DNA - ' + dna.coreFacts.productName, author: 'Soctiv CRM', subject: 'تحليل المنتج' },
        CoverPage(dna),
        ProductFactsPage(dna),
        TargetCustomerPage(dna),
        MarketingAnglesPage(dna, 3),
    );
}

// ─── URL Cleanup Tracking ──────────────────────────────────────────────────

const trackedUrls = new Set<string>();

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupAllDnaPdfUrls);
}

export function cleanupDnaPdfUrl(url: string | null) {
    if (!url) return;
    if (trackedUrls.has(url)) {
        URL.revokeObjectURL(url);
        trackedUrls.delete(url);
    }
}

export function cleanupAllDnaPdfUrls() {
    for (const url of trackedUrls) {
        URL.revokeObjectURL(url);
    }
    trackedUrls.clear();
}

// ─── Exports ───────────────────────────────────────────────────────────────

export async function generateDnaPdf(dna: ProductDNA): Promise<Blob> {
    const doc = buildDocument(dna);
    return pdf(doc).toBlob();
}

export async function downloadDnaPdf(dna: ProductDNA): Promise<void> {
    const blob = await generateDnaPdf(dna);
    const url = URL.createObjectURL(blob);
    trackedUrls.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Product-DNA-' + dna.coreFacts.productName.replace(/[^a-zA-Z0-9\u0600-\u06FF-]/g, '_') + '.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    cleanupDnaPdfUrl(url);
}

export async function getDnaPdfDataUrl(dna: ProductDNA): Promise<string> {
    const blob = await generateDnaPdf(dna);
    const url = URL.createObjectURL(blob);
    trackedUrls.add(url);
    return url;
}