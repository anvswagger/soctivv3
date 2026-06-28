/**
 * Product DNA PDF Export v4 — Editorial / magazine spread.
 *
 * Design intent
 * ─────────────
 * A high-end Arabic report that reads like the front-of-book spread of a
 * business magazine. The Soctiv cyan "S" mark (#39c8ff) is the only saturated
 * color; everything else is ink, paper, and hairline rules.
 *
 *  • Full-bleed ink-black cover with a giant Arabic title, a bold cyan
 *    geometric anchor, and a product "nameplate" card.
 *  • Content spreads use an editorial two-column grid: a giant section
 *    numeral on the right (RTL "start"), a hairline rule, then content
 *    that breaks across stat tiles, pull-quote cards, and indexed lists.
 *  • Every page wears a fixed top brand strip and a fixed bottom rule that
 *    carries the page number, product name, and report date.
 *  • Type: Alexandria (300/400/500/600/700/800) — same family as the web app.
 *  • Direction: RTL — text-align right, flex flows right-to-left.
 */
import { pdf, Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import type { ProductDNA, AwarenessLevel } from '@/types/productDNA';
import * as React from 'react';

// ─── Brand assets ───────────────────────────────────────────────────────────
// Soctiv "S" mark — used as the cover anchor and on every page strip.
// We load the .webp at runtime, paint it onto a canvas, and export a PNG
// data URL. PNG is universally decoded by @react-pdf/renderer (WebP is not
// always supported and was the reason the logo was silently dropped).
const SOCTIV_ICON_PATH = '/Soctiv-Logo-80.webp';
const SOCTIV_MARK_PATH = '/Soctiv-Logo.webp';

let _iconDataUrl: string | null = null;
let _markDataUrl: string | null = null;
let _loadPromise: Promise<void> | null = null;

async function loadAsPngDataUrl(path: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
        const url = new URL(path, window.location.origin).toString();
        return await new Promise<string | null>((resolve) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const w = img.naturalWidth || 200;
                    const h = img.naturalHeight || 200;
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(null); return; }
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/png'));
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    } catch {
        return null;
    }
}

/**
 * Pre-load the brand assets as PNG data URLs. Call this before generating
 * a PDF. If the load fails, the strings stay null and the page renders
 * without the image (the wordmark is still drawn in the page strip).
 */
export async function preloadDnaPdfAssets(): Promise<void> {
    if (_loadPromise) return _loadPromise;
    _loadPromise = (async () => {
        const [icon, mark] = await Promise.all([
            loadAsPngDataUrl(SOCTIV_ICON_PATH),
            loadAsPngDataUrl(SOCTIV_MARK_PATH),
        ]);
        _iconDataUrl = icon;
        _markDataUrl = mark;
    })();
    return _loadPromise;
}

const SOCTIV_ICON: string = ''; // resolved at runtime via preloadDnaPdfAssets()
const SOCTIV_MARK: string = '';

/** Returns the data-URL for the icon, or '' if not yet loaded. */
function iconSrc(): string { return _iconDataUrl ?? ''; }
function markSrc(): string { return _markDataUrl ?? ''; }

// ─── Font registration (Alexandria — same family as the web app) ────────────

Font.register({
    family: 'Alexandria',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9qlTqbH.ttf', fontWeight: 300 },
        { src: 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9r7TqbH.ttf', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9rJTqbH.ttf', fontWeight: 500 },
        { src: 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9olSabH.ttf', fontWeight: 600 },
        { src: 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9ocSabH.ttf', fontWeight: 700 },
        { src: 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9p7SabH.ttf', fontWeight: 800 },
    ],
});

// ─── Palette (anchored on actual Soctiv brand tokens) ──────────────────────

const C = {
    // Brand
    ink:         '#040b14',  // Soctiv brand-dark — primary ink
    inkSoft:     '#0b1220',  // slightly lifted ink
    inkRaised:   '#111c30',  // card-on-ink
    paper:       '#ffffff',
    paperAlt:    '#f6f8fb',  // off-white card
    paperMuted:  '#eef2f7',  // hairline-row alt
    // Accent (only one saturated color)
    cyan:        '#39c8ff',  // Soctiv brand-cyan
    cyanSoft:    '#80dfff',  // Soctiv brand-cyan-light
    cyanGlow:    'rgba(57, 200, 255, 0.12)',
    cyanInk:     '#0a3a52',  // dark cyan for tinted text backgrounds
    // Text
    text:        '#0b1220',
    textSoft:    '#475569',
    textMuted:   '#94a3b8',
    textFaint:   '#cbd5e1',
    // Lines
    rule:        '#e6eaf0',
    ruleStrong:  '#cbd5e1',
    // Status accents (used sparingly, paired with ink)
    red:         '#dc2626',
    redSoft:     '#fef2f2',
    green:       '#16a34a',
    greenSoft:   '#f0fdf4',
    orange:      '#ea580c',
    orangeSoft:  '#fff7ed',
    purple:      '#9333ea',
    purpleSoft:  '#faf5ff',
    yellow:      '#ca8a04',
    yellowSoft:  '#fefce8',
};

// ─── Awareness-level metadata ───────────────────────────────────────────────

const LEVEL_META: Record<AwarenessLevel, { ar: string; en: string; color: string; bg: string }> = {
    unaware:        { ar: 'غير مدرك',         en: 'Unaware',        color: '#64748b', bg: '#f1f5f9' },
    problem_aware:  { ar: 'مدرك للمشكلة',     en: 'Problem Aware',  color: C.orange,  bg: C.orangeSoft },
    solution_aware: { ar: 'مدرك للحل',        en: 'Solution Aware', color: C.yellow,  bg: C.yellowSoft },
    product_aware:  { ar: 'يعرف المنتج',      en: 'Product Aware',  color: C.cyan,    bg: '#e0f4ff' },
    most_aware:     { ar: 'جاهز للشراء',      en: 'Most Aware',     color: C.green,   bg: C.greenSoft },
};
const LEVEL_ORDER: AwarenessLevel[] = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'];

// ─── Stylesheet ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    // ─── Page chrome ────────────────────────────────────────────────────────
    cover: {
        padding: 0,
        fontFamily: 'Alexandria',
        backgroundColor: C.ink,
        color: C.paper,
        direction: 'rtl',
    },
    page: {
        paddingTop: 64,
        paddingBottom: 56,
        paddingHorizontal: 44,
        fontFamily: 'Alexandria',
        backgroundColor: C.paper,
        color: C.text,
        direction: 'rtl',
    },

    // ─── Cover ─────────────────────────────────────────────────────────────
    coverBase:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.ink },
    coverGlow:   { position: 'absolute', top: -120, left: -120, width: 460, height: 460, borderRadius: 230, backgroundColor: C.cyan, opacity: 0.10 },
    coverGlow2:  { position: 'absolute', bottom: -160, right: -160, width: 520, height: 520, borderRadius: 260, backgroundColor: C.cyanSoft, opacity: 0.06 },
    coverGridV:  { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: C.cyan, opacity: 0.05 },
    coverGridH:  { position: 'absolute', top: '38%', left: 0, right: 0, height: 1, backgroundColor: C.cyan, opacity: 0.06 },
    coverCornerTL: { position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTopWidth: 1, borderLeftWidth: 1, borderColor: C.cyan, opacity: 0.5 },
    coverCornerTR: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTopWidth: 1, borderRightWidth: 1, borderColor: C.cyan, opacity: 0.5 },
    coverCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: C.cyan, opacity: 0.5 },
    coverCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottomWidth: 1, borderRightWidth: 1, borderColor: C.cyan, opacity: 0.5 },

    // Top strip
    coverTop: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 36, paddingTop: 28, paddingBottom: 18,
    },
    coverTopLabel: {
        fontSize: 9, color: C.textMuted,
        fontWeight: 500, fontFamily: 'Alexandria',
    },
    coverTopBrand: {
        fontSize: 11, color: C.paper,
        fontWeight: 700, fontFamily: 'Alexandria',
    },
    coverTopLine: {
        position: 'absolute', top: 64, left: 36, right: 36, height: 1,
        backgroundColor: C.cyan, opacity: 0.25,
    },

    // Vertical brand strip on right (RTL anchor)
    coverVStrip: {
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 56,
        flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 36,
    },
    coverVStripLabel: {
        fontSize: 8, color: C.cyan,
        fontWeight: 600, fontFamily: 'Alexandria',
    },
    coverVStripLine: { width: 1, flex: 1, backgroundColor: C.cyan, opacity: 0.25, marginVertical: 16 },
    coverVStripDate: { fontSize: 8, color: C.textMuted, fontWeight: 500, fontFamily: 'Alexandria' },

    // Hero block (RTL: children align to the right)
    coverHero: {
        flex: 1,
        paddingHorizontal: 36,
        paddingTop: 80,
        paddingBottom: 40,
        flexDirection: 'column', justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    coverLogoFrame: {
        width: 96, height: 96, borderRadius: 22,
        backgroundColor: C.cyan,
        justifyContent: 'center', alignItems: 'center',
    },
    coverLogoImg: { width: 64, height: 64 },
    coverKicker: {
        fontSize: 10, color: C.cyan,
        fontWeight: 600, fontFamily: 'Alexandria', marginBottom: 16,
    },
    coverTitle: {
        fontSize: 56, fontWeight: 800, color: C.paper,
        textAlign: 'right', fontFamily: 'Alexandria', lineHeight: 1.1,
        marginBottom: 18,
    },
    coverSub: {
        fontSize: 12, color: C.textFaint, textAlign: 'right',
        lineHeight: 1.85, fontFamily: 'Alexandria', fontWeight: 300, maxWidth: 460,
        marginBottom: 24,
    },
    coverRule: {
        width: 72, height: 3, backgroundColor: C.cyan,
        marginBottom: 24, borderRadius: 1.5, alignSelf: 'flex-end',
    },

    // Product nameplate
    coverNameplate: {
        flexDirection: 'column', alignItems: 'flex-end',
        paddingTop: 16, paddingBottom: 16, paddingRight: 18, paddingLeft: 18,
        borderTopWidth: 1, borderTopColor: C.cyan, borderBottomWidth: 1, borderBottomColor: C.cyan,
    },
    coverNameplateLabel: {
        fontSize: 9, color: C.cyan, fontWeight: 600,
        fontFamily: 'Alexandria', marginBottom: 8,
    },
    coverNameplateName: {
        fontSize: 26, fontWeight: 700, color: C.paper,
        textAlign: 'right', fontFamily: 'Alexandria', marginBottom: 4,
    },
    coverNameplateTag: {
        fontSize: 11, color: C.textMuted, textAlign: 'right',
        fontFamily: 'Alexandria', fontWeight: 300,
    },

    // Cover footer
    coverFooter: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 36, paddingVertical: 20,
    },
    coverFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coverFooterDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.cyan },
    coverFooterText: { fontSize: 8, color: C.textMuted, fontFamily: 'Alexandria', fontWeight: 500 },
    coverFooterStrong: { fontSize: 8, color: C.cyan, fontFamily: 'Alexandria', fontWeight: 700 },

    // ─── Top brand strip on content pages ──────────────────────────────────
    topStrip: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 44,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 44, paddingTop: 16, paddingBottom: 14,
    },
    topStripLine: {
        position: 'absolute', top: 44, left: 44, right: 44, height: 1,
        backgroundColor: C.rule,
    },
    topStripLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    topStripCenter: { fontSize: 9, color: C.textMuted, fontWeight: 600, fontFamily: 'Alexandria' },
    topStripRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topStripLogo: { width: 18, height: 18 },
    topStripBrand: { fontSize: 11, color: C.ink, fontWeight: 700, fontFamily: 'Alexandria' },
    topStripPage: {
        fontSize: 9, color: C.cyan, fontWeight: 700, fontFamily: 'Alexandria',
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
        backgroundColor: C.cyanGlow,
    },

    // ─── Footer rule on content pages ──────────────────────────────────────
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 44,
    },
    footerLine: { position: 'absolute', bottom: 36, left: 44, right: 44, height: 1, backgroundColor: C.rule },
    footerText: { fontSize: 8, color: C.textMuted, fontFamily: 'Alexandria' },
    footerBrand: { fontSize: 8, color: C.ink, fontWeight: 700, fontFamily: 'Alexandria' },

    // ─── Section header (vertical stack — kicker → title → subtitle) ───────
    sectionHead: {
        marginBottom: 6, marginTop: 6,
    },
    sectionKickerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        marginBottom: 6,
    },
    sectionKicker: {
        fontSize: 9, color: C.cyan, fontWeight: 700,
        fontFamily: 'Alexandria',
    },
    sectionKickerNum: {
        fontSize: 11, color: C.cyan, fontWeight: 800,
        fontFamily: 'Alexandria',
        paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3,
        backgroundColor: C.cyanGlow,
    },
    sectionTitle: {
        fontSize: 22, fontWeight: 800, color: C.ink, textAlign: 'right',
        fontFamily: 'Alexandria', lineHeight: 1.2, marginBottom: 6,
    },
    sectionSub: {
        fontSize: 10, color: C.textSoft, textAlign: 'right',
        fontFamily: 'Alexandria', fontWeight: 300, lineHeight: 1.6,
        marginBottom: 12,
    },
    sectionRule: { height: 1, backgroundColor: C.ink, marginBottom: 16, opacity: 0.85 },
    sectionRuleAccent: { height: 2, backgroundColor: C.cyan, width: 64, marginBottom: 16, marginTop: -1, alignSelf: 'flex-end' },

    // ─── Cards ─────────────────────────────────────────────────────────────
    card: {
        padding: 18, backgroundColor: C.paperAlt,
        borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: C.rule,
    },
    cardDark: {
        padding: 18, backgroundColor: C.ink, color: C.paper,
        borderRadius: 10, marginBottom: 12,
    },
    cardEdge: {
        position: 'absolute', top: 0, bottom: 0, right: 0, width: 3,
        backgroundColor: C.cyan, borderTopRightRadius: 10, borderBottomRightRadius: 10,
    },
    cardLabel: {
        fontSize: 9, color: C.textMuted, fontWeight: 600,
        fontFamily: 'Alexandria', marginBottom: 8, textAlign: 'right',
    },
    cardLabelAccent: { color: C.cyan },
    cardTitle: {
        fontSize: 14, fontWeight: 700, color: C.ink, textAlign: 'right',
        fontFamily: 'Alexandria', marginBottom: 6,
    },
    cardSub: { fontSize: 10, fontWeight: 600, color: C.cyan, marginBottom: 6, marginTop: 8, textAlign: 'right', fontFamily: 'Alexandria' },
    body: { fontSize: 10.5, lineHeight: 1.85, color: C.text, marginBottom: 4, textAlign: 'right', fontFamily: 'Alexandria', fontWeight: 400 },
    bodyMuted: { fontSize: 9.5, lineHeight: 1.7, color: C.textSoft, textAlign: 'right', fontFamily: 'Alexandria', fontWeight: 300 },
    bodyLead: { fontSize: 13, lineHeight: 1.75, color: C.paper, textAlign: 'right', fontFamily: 'Alexandria', fontWeight: 300 },

    // ─── Stat tiles (3-up) ─────────────────────────────────────────────────
    // `row-reverse` so the first stat in source is the rightmost (RTL start)
    statRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
    stat: {
        flex: 1, padding: 14, backgroundColor: C.paper,
        borderRadius: 8, borderWidth: 1, borderColor: C.rule,
        alignItems: 'flex-end',
    },
    statIconBox: {
        width: 28, height: 28, borderRadius: 6,
        backgroundColor: C.cyanGlow, justifyContent: 'center', alignItems: 'center',
        marginBottom: 10,
    },
    statIcon: { fontSize: 12, color: C.cyan, fontFamily: 'Alexandria', fontWeight: 700 },
    statValue: { fontSize: 14, fontWeight: 800, color: C.ink, textAlign: 'right', fontFamily: 'Alexandria', marginBottom: 4, lineHeight: 1.15 },
    statLabel: { fontSize: 9, color: C.textMuted, textAlign: 'right', fontFamily: 'Alexandria', fontWeight: 600 },

    // ─── Numbered list rows (key features) ────────────────────────────────
    listRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.rule,
    },
    listRowLast: { borderBottomWidth: 0 },
    listNum: {
        fontSize: 10, color: C.cyan, fontFamily: 'Alexandria', fontWeight: 700,
        minWidth: 22, textAlign: 'right',
    },
    listText: {
        flex: 1, fontSize: 10.5, color: C.text, textAlign: 'right',
        fontFamily: 'Alexandria', lineHeight: 1.7, fontWeight: 400,
    },
    listTextAccent: { color: C.ink, fontWeight: 600 },

    // ─── Pain / desire / factor rows (status-coded) ────────────────────────
    statusRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        paddingVertical: 8,
    },
    statusIcon: {
        width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    },
    statusIconText: { fontSize: 10, fontFamily: 'Alexandria', fontWeight: 800 },
    statusText: { flex: 1, fontSize: 10.5, textAlign: 'right', fontFamily: 'Alexandria', lineHeight: 1.7 },

    // ─── Value-prop hero card ──────────────────────────────────────────────
    valueCard: {
        padding: 22, backgroundColor: C.ink, borderRadius: 12,
        marginBottom: 14,
    },
    valueLabel: {
        fontSize: 9, color: C.cyan, fontWeight: 700,
        fontFamily: 'Alexandria', marginBottom: 10, textAlign: 'right',
    },
    valueText: {
        fontSize: 16, fontWeight: 700, color: C.paper, textAlign: 'right',
        fontFamily: 'Alexandria', lineHeight: 1.6,
    },
    valueMark: {
        fontSize: 56, color: C.cyan, opacity: 0.18,
        position: 'absolute', top: 8, right: 16, fontFamily: 'Alexandria', fontWeight: 800,
    },

    // ─── Marketing angle card ──────────────────────────────────────────────
    angleBlock: { marginBottom: 8 },
    angleHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6,
        marginBottom: 6,
    },
    angleHeaderLabel: { fontSize: 10, fontWeight: 700, fontFamily: 'Alexandria' },
    angleHeaderCount: { fontSize: 9, color: C.textMuted, fontFamily: 'Alexandria', marginRight: 'auto', fontWeight: 600 },
    angleCard: {
        padding: 10, backgroundColor: C.paperAlt, borderRadius: 8,
        marginBottom: 6, borderRightWidth: 3,
    },
    angleName: { fontSize: 11, fontWeight: 700, color: C.ink, textAlign: 'right', fontFamily: 'Alexandria', marginBottom: 3 },
    angleReason: { fontSize: 9, color: C.textSoft, textAlign: 'right', fontFamily: 'Alexandria', lineHeight: 1.5, fontWeight: 300 },

    // ─── Pill / tag ────────────────────────────────────────────────────────
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
    pill: {
        fontSize: 9, color: C.ink, backgroundColor: C.paperAlt,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
        fontFamily: 'Alexandria', fontWeight: 500, borderWidth: 1, borderColor: C.rule,
    },
    pillAccent:  { color: C.cyan,    backgroundColor: '#e0f4ff', borderColor: '#bce3ff' },
    pillGreen:   { color: C.green,   backgroundColor: C.greenSoft,   borderColor: '#bbf7d0' },
    pillOrange:  { color: C.orange,  backgroundColor: C.orangeSoft,  borderColor: '#fed7aa' },
    pillPurple:  { color: C.purple,  backgroundColor: C.purpleSoft,  borderColor: '#e9d5ff' },
    pillRed:     { color: C.red,     backgroundColor: C.redSoft,     borderColor: '#fecaca' },

    // ─── Persona hero block ───────────────────────────────────────────────
    personaBlock: {
        padding: 22, backgroundColor: C.ink, borderRadius: 12, marginBottom: 14,
    },
    personaKicker: {
        fontSize: 9, color: C.cyan, fontWeight: 700,
        fontFamily: 'Alexandria', marginBottom: 10, textAlign: 'right',
    },
    personaQuote: {
        fontSize: 14, color: C.paper, textAlign: 'right',
        fontFamily: 'Alexandria', lineHeight: 1.8, fontWeight: 300,
    },
    personaMark: {
        fontSize: 80, color: C.cyan, opacity: 0.15, position: 'absolute',
        top: 4, right: 14, fontFamily: 'Alexandria', fontWeight: 800,
    },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Blocked product tags — mirrors BLOCKED_PRODUCT_TAGS in productDnaService.ts.
 * Kept inline here so the PDF export never renders a tag that the rest of the
 * app has agreed to suppress, even if a stale DNA slips through.
 */
const BLOCKED_DNA_TAGS = new Set(
    ['شريط لاصق', 'مانع تسريب', 'صيانة منزلية'].map((t) => t.trim().toLowerCase())
);

/**
 * `E` is our `React.createElement` wrapper. We filter out `undefined` and
 * `false` children (which @react-pdf/renderer doesn't tolerate) and keep
 * `null` (which React knows how to skip).
 */
function E(type: any, props?: Record<string, any> | null, ...children: any[]): React.ReactElement {
    const safe = children.filter((c) => c !== undefined && c !== false);
    return React.createElement(type, props ?? {}, ...safe);
}

/**
 * Render an Image only when we have a valid data URL. An empty src crashes
 * @react-pdf/renderer with "Cannot read properties of undefined (reading 'id')"
 * — so prefer a missing element over a broken one.
 */
function safeImage(src: string, style: any): React.ReactElement | null {
    return src ? E(Image, { src, style }) : null;
}

function arabicNum(n: number): string {
    const map: Record<string, string> = { '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤', '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩' };
    return String(n).split('').map((c) => map[c] ?? c).join('');
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return '';
    }
}

/**
 * Defensively normalize a ProductDNA so every field has a safe default.
 * The PDF renderer crashes hard on `undefined` (it surfaces as
 * "Cannot read properties of undefined (reading 'id')"), so we coerce
 * arrays to [] and strings to '' before they reach the JSX tree.
 *
 * Returns a fully-populated empty DNA if `input` is null/undefined/empty —
 * the caller gets a placeholder PDF instead of a hard crash.
 */
const EMPTY_DNA: ProductDNA = {
    id: '',
    clientId: '',
    productId: '',
    version: '1.0',
    generatedAt: new Date(0).toISOString(),
    onboarding: {} as ProductDNA['onboarding'],
    productIdentity: {
        productName: '—',
        tagline: '',
        summary: '',
        keyFeatures: [],
        useCases: [],
        pricing: { price: 0, currency: '', pricingModel: 'one-time' },
        category: [],
        tags: [],
        uniqueSellingPoints: [],
    },
    targetCustomer: {
        personaSummary: '',
        demographics: { ageRange: [0, 0] as readonly [number, number], gender: null, location: [], occupation: [] },
        painPoints: [],
        coreDesires: [],
        behavior: { buyingHabits: [], preferredChannels: [], decisionFactors: [] },
    },
    marketingStrategy: {
        primaryValueProposition: '',
        elevatorPitch: '',
        marketingAngles: [],
        callToActions: [],
        seoKeywords: [],
        recommendedChannels: [],
        proofSuggestions: { testimonialPrompts: [], statSuggestions: [], guaranteeIdeas: [] },
    },
};

function isUsableDna(input: unknown): input is ProductDNA {
    return !!input && typeof input === 'object' && 'productIdentity' in (input as object);
}

function safe(input: ProductDNA | null | undefined): ProductDNA {
    if (!isUsableDna(input)) return EMPTY_DNA;
    const pi = input.productIdentity ?? ({} as ProductDNA['productIdentity']);
    const tc = input.targetCustomer ?? ({} as ProductDNA['targetCustomer']);
    const ms = input.marketingStrategy ?? ({} as ProductDNA['marketingStrategy']);
    return {
        id: input.id ?? '',
        clientId: input.clientId ?? '',
        productId: input.productId ?? '',
        version: input.version ?? '1.0',
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        onboarding: input.onboarding ?? ({} as ProductDNA['onboarding']),
        productIdentity: {
            productName: pi.productName ?? '—',
            tagline: pi.tagline ?? '',
            summary: pi.summary ?? '',
            keyFeatures: Array.isArray(pi.keyFeatures) ? pi.keyFeatures : [],
            useCases: Array.isArray(pi.useCases) ? pi.useCases : [],
            pricing: {
                price: pi.pricing?.price ?? 0,
                currency: pi.pricing?.currency ?? '',
                pricingModel: pi.pricing?.pricingModel ?? 'one-time',
            },
            category: Array.isArray(pi.category) ? pi.category : [],
            tags: (Array.isArray(pi.tags) ? pi.tags : []).filter(
                (t) => typeof t !== 'string' || !BLOCKED_DNA_TAGS.has(t.trim().toLowerCase())
            ),
            uniqueSellingPoints: Array.isArray(pi.uniqueSellingPoints) ? pi.uniqueSellingPoints : [],
        },
        targetCustomer: {
            personaSummary: tc.personaSummary ?? '',
            demographics: {
                ageRange: (tc.demographics?.ageRange ?? [0, 0]) as readonly [number, number],
                gender: tc.demographics?.gender ?? null,
                location: Array.isArray(tc.demographics?.location) ? tc.demographics!.location : [],
                occupation: Array.isArray(tc.demographics?.occupation) ? tc.demographics!.occupation : [],
            },
            painPoints: Array.isArray(tc.painPoints) ? tc.painPoints : [],
            coreDesires: Array.isArray(tc.coreDesires) ? tc.coreDesires : [],
            behavior: {
                buyingHabits: Array.isArray(tc.behavior?.buyingHabits) ? tc.behavior!.buyingHabits : [],
                preferredChannels: Array.isArray(tc.behavior?.preferredChannels) ? tc.behavior!.preferredChannels : [],
                decisionFactors: Array.isArray(tc.behavior?.decisionFactors) ? tc.behavior!.decisionFactors : [],
            },
        },
        marketingStrategy: {
            primaryValueProposition: ms.primaryValueProposition ?? '',
            elevatorPitch: ms.elevatorPitch ?? '',
            marketingAngles: Array.isArray(ms.marketingAngles) ? ms.marketingAngles : [],
            callToActions: Array.isArray(ms.callToActions) ? ms.callToActions : [],
            seoKeywords: Array.isArray(ms.seoKeywords) ? ms.seoKeywords : [],
            recommendedChannels: Array.isArray(ms.recommendedChannels) ? ms.recommendedChannels : [],
            proofSuggestions: {
                testimonialPrompts: Array.isArray(ms.proofSuggestions?.testimonialPrompts) ? ms.proofSuggestions!.testimonialPrompts : [],
                statSuggestions: Array.isArray(ms.proofSuggestions?.statSuggestions) ? ms.proofSuggestions!.statSuggestions : [],
                guaranteeIdeas: Array.isArray(ms.proofSuggestions?.guaranteeIdeas) ? ms.proofSuggestions!.guaranteeIdeas : [],
            },
        },
    };
}

// ─── Reusable page chrome ───────────────────────────────────────────────────

function TopStrip({ sectionLabel, pageNum }: { sectionLabel: string; pageNum: number }) {
    return E(React.Fragment, null,
        E(View, { style: s.topStrip, fixed: true },
            // left in RTL = end of reading flow (small label)
            E(View, { style: s.topStripLeft },
                E(Text, { style: s.topStripPage }, arabicNum(pageNum)),
            ),
            // center: section label
            E(Text, { style: s.topStripCenter }, sectionLabel),
            // right (RTL start): brand
            E(View, { style: s.topStripRight },
                E(Text, { style: s.topStripBrand }, 'سوكتيف'),
                safeImage(iconSrc(), s.topStripLogo),
            ),
        ),
        E(View, { style: s.topStripLine, fixed: true }),
    );
}

function BottomStrip({ productName, date, pageNum }: { productName: string; date: string; pageNum: number }) {
    return E(React.Fragment, null,
        E(View, { style: s.footerLine, fixed: true }),
        E(View, { style: s.footer, fixed: true },
            E(Text, { style: s.footerText }, 'صفحة ' + arabicNum(pageNum)),
            E(Text, { style: s.footerText }, date + '   •   ' + productName),
            E(Text, { style: s.footerBrand }, 'سوكتيڤ • تحليل المنتج'),
        ),
    );
}

function SectionHead({ number, title, subtitle, kicker }: { number: string; title: string; subtitle: string; kicker: string }) {
    return E(View, { style: s.sectionHead },
        // Kicker row — RTL: kicker text on the right, number chip to its left
        E(View, { style: s.sectionKickerRow },
            E(Text, { style: s.sectionKickerNum }, number),
            E(Text, { style: s.sectionKicker }, kicker),
        ),
        // Title — single line at 22pt fits comfortably
        E(Text, { style: s.sectionTitle }, title),
        // Subtitle
        E(Text, { style: s.sectionSub }, subtitle),
        // Black rule + cyan accent
        E(View, { style: s.sectionRule }),
        E(View, { style: s.sectionRuleAccent }),
    );
}

// ─── Page 1: Cover ──────────────────────────────────────────────────────────

function CoverPage(dna: ProductDNA) {
    const pi = dna.productIdentity;
    const date = formatDate(dna.generatedAt);

    return E(Page, { size: 'A4', style: s.cover },
        // Decorative background
        E(View, { style: s.coverBase }),
        E(View, { style: s.coverGlow }),
        E(View, { style: s.coverGlow2 }),
        E(View, { style: s.coverGridV }),
        E(View, { style: s.coverGridH }),
        E(View, { style: s.coverCornerTL }),
        E(View, { style: s.coverCornerTR }),
        E(View, { style: s.coverCornerBL }),
        E(View, { style: s.coverCornerBR }),

        // Top strip
        E(View, { style: s.coverTop },
            E(Text, { style: s.coverTopLabel }, 'تقرير تحليل المنتج'),
            E(Text, { style: s.coverTopBrand }, 'سوكتيڤ'),
        ),
        E(View, { style: s.coverTopLine }),

        // Vertical strip on right (RTL anchor)
        E(View, { style: s.coverVStrip },
            E(Text, { style: s.coverVStripLabel }, 'تحليل المنتج'),
            E(View, { style: s.coverVStripLine }),
            E(Text, { style: s.coverVStripDate }, arabicNum(new Date(dna.generatedAt).getFullYear())),
        ),

        // Hero
        E(View, { style: s.coverHero },
            E(View, null,
                E(View, { style: s.coverLogoFrame },
                    safeImage(iconSrc(), s.coverLogoImg),
                ),
            ),
            E(View, null,
                E(Text, { style: s.coverKicker }, 'تحليل معمّق · مدعوم بالذكاء الاصطناعي'),
                E(Text, { style: s.coverTitle }, 'تحليل\nDNA\nالمنتج'),
                E(Text, { style: s.coverSub },
                    'تقرير شامل عن هوية المنتج، الجمهور المستهدف، والاستراتيجية التسويقية — مُولَّد بالذكاء الاصطناعي ومصمَّم ليقود قرارات النمو.'
                ),
                E(View, { style: s.coverRule }),

                // Product nameplate
                E(View, { style: s.coverNameplate },
                    E(Text, { style: s.coverNameplateLabel }, 'المنتج المُحلَّل'),
                    E(Text, { style: s.coverNameplateName }, pi.productName),
                    pi.tagline ? E(Text, { style: s.coverNameplateTag }, pi.tagline) : null,
                ),
            ),
        ),

        // Footer — RTL: date (end) left, version middle, soctiv.com (start) right
        E(View, { style: s.coverFooter },
            E(View, { style: s.coverFooterItem },
                E(Text, { style: s.coverFooterText }, date),
                E(View, { style: s.coverFooterDot }),
            ),
            E(View, { style: s.coverFooterItem },
                E(View, { style: s.coverFooterDot }),
                E(Text, { style: s.coverFooterText }, 'الإصدار ' + dna.version),
            ),
            E(Text, { style: s.coverFooterStrong }, 'soctiv.com'),
        ),
    );
}

// ─── Page 2: Product Identity ───────────────────────────────────────────────

function ProductIdentityPage(dna: ProductDNA, pageNum: number) {
    const pi = dna.productIdentity;
    const date = formatDate(dna.generatedAt);

    const priceLabel = pi.pricing.price > 0
        ? pi.pricing.currency + ' ' + pi.pricing.price.toLocaleString('ar-EG')
        : 'غير محدد';
    const modelLabel =
        pi.pricing.pricingModel === 'one-time'     ? 'دفعة واحدة' :
        pi.pricing.pricingModel === 'subscription' ? 'اشتراك' :
        pi.pricing.pricingModel === 'tiered'       ? 'متدرّج' :
        pi.pricing.pricingModel === 'freemium'     ? 'مجاني + مدفوع' :
        pi.pricing.pricingModel === 'negotiable'   ? 'قابل للتفاوض' :
        pi.pricing.pricingModel;
    const featuresCount = arabicNum(pi.keyFeatures.length);

    return E(Page, { size: 'A4', style: s.page },
        E(TopStrip, { sectionLabel: 'هوية المنتج', pageNum }),
        E(BottomStrip, { productName: pi.productName, date, pageNum }),

        E(SectionHead, {
            number: '٠١',
            kicker: 'الفصل الأول',
            title: 'هوية المنتج',
            subtitle: 'نظرة شاملة ومعمّقة على المنتج، خصائصه، وما يجعله مختلفًا في السوق.',
        }),

        // Quick stats — three editorial tiles
        E(View, { style: s.statRow },
            E(View, { style: s.stat },
                E(View, { style: s.statIconBox }, E(Text, { style: s.statIcon }, '﷼')),
                E(Text, { style: s.statValue }, priceLabel),
                E(Text, { style: s.statLabel }, 'السعر'),
            ),
            E(View, { style: s.stat },
                E(View, { style: s.statIconBox }, E(Text, { style: s.statIcon }, '⇄')),
                E(Text, { style: s.statValue }, modelLabel),
                E(Text, { style: s.statLabel }, 'طريقة البيع'),
            ),
            E(View, { style: s.stat },
                E(View, { style: s.statIconBox }, E(Text, { style: s.statIcon }, '◆')),
                E(Text, { style: s.statValue }, featuresCount + ' ميزة'),
                E(Text, { style: s.statLabel }, 'الميزات الرئيسية'),
            ),
        ),

        // Summary card with cyan edge
        E(View, { style: s.card },
            E(View, { style: s.cardEdge }),
            E(Text, { style: { ...s.cardLabel, ...s.cardLabelAccent } }, 'الملخّص'),
            E(Text, { style: s.body }, pi.summary),
        ),

        // Key features — numbered list
        pi.keyFeatures.length > 0
            ? E(View, { style: s.card },
                E(Text, { style: s.cardLabel }, 'الميزات الرئيسية'),
                ...pi.keyFeatures.map((f, i) =>
                    E(View, { style: { ...s.listRow, ...(i === pi.keyFeatures.length - 1 ? s.listRowLast : {}) }, key: i },
                        E(Text, { style: s.listText, key: 't' }, f),
                        E(Text, { style: s.listNum, key: 'n' }, arabicNum(i + 1).padStart(2, '٠')),
                    )
                ),
            )
            : null,

        // USPs — emphasis list
        pi.uniqueSellingPoints.length > 0
            ? E(View, { style: s.card },
                E(Text, { style: { ...s.cardLabel, color: C.orange } }, 'نقاط البيع الفريدة'),
                ...pi.uniqueSellingPoints.map((usp, i) =>
                    E(View, { style: { ...s.listRow, ...(i === pi.uniqueSellingPoints.length - 1 ? s.listRowLast : {}) }, key: i },
                        E(Text, { style: { ...s.listText, ...s.listTextAccent, color: C.orange } }, usp),
                        E(Text, { style: { ...s.listNum, color: C.orange } }, '★'),
                    )
                ),
            )
            : null,

        // Use cases + tags (RTL: useCases on right, tags on left)
        pi.useCases.length > 0 || pi.tags.length > 0
            ? E(View, { style: { flexDirection: 'row-reverse', gap: 8 } },
                pi.useCases.length > 0
                    ? E(View, { style: { ...s.card, flex: 1, marginBottom: 0 } },
                        E(Text, { style: { ...s.cardLabel, color: C.purple } }, 'حالات الاستخدام'),
                        E(View, { style: s.pillRow },
                            ...pi.useCases.map((uc, i) =>
                                E(Text, { style: { ...s.pill, ...s.pillPurple }, key: i }, uc)
                            )
                        ),
                    )
                    : null,
                (pi.tags.length > 0 || pi.category.length > 0)
                    ? E(View, { style: { ...s.card, flex: 1, marginBottom: 0 } },
                        E(Text, { style: { ...s.cardLabel, color: C.cyan } }, 'التصنيفات والوسوم'),
                        pi.category.length > 0
                            ? E(Text, { style: { ...s.bodyMuted, marginBottom: 8 } }, pi.category.join('  •  '))
                            : null,
                        pi.tags.length > 0
                            ? E(View, { style: s.pillRow },
                                ...pi.tags.map((t, i) =>
                                    E(Text, { style: { ...s.pill, ...s.pillAccent }, key: i }, '#' + t)
                                )
                            )
                            : null,
                    )
                    : null,
            )
            : null,
    );
}

// ─── Page 3: Target Customer ────────────────────────────────────────────────

function TargetCustomerPage(dna: ProductDNA, pageNum: number) {
    const tc = dna.targetCustomer;
    const pi = dna.productIdentity;
    const date = formatDate(dna.generatedAt);

    const ageLabel = arabicNum(tc.demographics.ageRange[0]) + '  —  ' + arabicNum(tc.demographics.ageRange[1]) + '  سنة';

    return E(Page, { size: 'A4', style: s.page },
        E(TopStrip, { sectionLabel: 'العميل المستهدف', pageNum }),
        E(BottomStrip, { productName: pi.productName, date, pageNum }),

        E(SectionHead, {
            number: '٠٢',
            kicker: 'الفصل الثاني',
            title: 'العميل المستهدف',
            subtitle: 'تحليل معمّق للشخصية المثالية، احتياجاتها، وما يحرّك قراراتها الشرائية.',
        }),

        // Persona hero — full-bleed dark card
        tc.personaSummary
            ? E(View, { style: s.personaBlock },
                E(Text, { style: s.personaMark }, '”'),
                E(Text, { style: s.personaKicker }, 'شخصية العميل'),
                E(Text, { style: s.personaQuote }, tc.personaSummary),
            )
            : null,

        // Demographics — 3 editorial tiles
        E(View, { style: s.statRow },
            E(View, { style: s.stat },
                E(View, { style: s.statIconBox }, E(Text, { style: s.statIcon }, '◷')),
                E(Text, { style: s.statValue }, ageLabel),
                E(Text, { style: s.statLabel }, 'الفئة العمرية'),
            ),
            E(View, { style: s.stat },
                E(View, { style: s.statIconBox }, E(Text, { style: s.statIcon }, '◉')),
                E(Text, { style: { ...s.statValue, fontSize: 10 } }, tc.demographics.location.join('  ·  ') || '—'),
                E(Text, { style: s.statLabel }, 'المواقع'),
            ),
            E(View, { style: s.stat },
                E(View, { style: s.statIconBox }, E(Text, { style: s.statIcon }, '◧')),
                E(Text, { style: { ...s.statValue, fontSize: 10 } }, tc.demographics.occupation.join('  ·  ') || '—'),
                E(Text, { style: s.statLabel }, 'المهن'),
            ),
        ),

        // Pain points (red) + desires (green) side by side (RTL: pain on right, desires on left)
        E(View, { style: { flexDirection: 'row-reverse', gap: 8 } },
            tc.painPoints.length > 0
                ? E(View, { style: { ...s.card, flex: 1, marginBottom: 0 } },
                    E(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'flex-end' } },
                        E(Text, { style: { ...s.cardLabel, color: C.red, marginBottom: 0 } }, 'نـقـاط  الألـم'),
                        E(View, { style: { ...s.statusIcon, backgroundColor: C.redSoft } },
                            E(Text, { style: { ...s.statusIconText, color: C.red } }, '!'),
                        ),
                    ),
                    ...tc.painPoints.map((pp, i) =>
                        E(View, { style: { ...s.statusRow, borderBottomWidth: i === tc.painPoints.length - 1 ? 0 : 1, borderBottomColor: C.rule }, key: i },
                            E(Text, { style: { ...s.statusText, color: C.text } }, pp),
                            E(View, { style: { ...s.statusIcon, backgroundColor: C.redSoft, minWidth: 22, height: 22 } },
                                E(Text, { style: { ...s.statusIconText, color: C.red, fontSize: 9 } }, arabicNum(i + 1)),
                            ),
                        )
                    ),
                )
                : null,

            tc.coreDesires.length > 0
                ? E(View, { style: { ...s.card, flex: 1, marginBottom: 0 } },
                    E(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'flex-end' } },
                        E(Text, { style: { ...s.cardLabel, color: C.green, marginBottom: 0 } }, 'الرغبات'),
                        E(View, { style: { ...s.statusIcon, backgroundColor: C.greenSoft } },
                            E(Text, { style: { ...s.statusIconText, color: C.green } }, '✓'),
                        ),
                    ),
                    ...tc.coreDesires.map((d, i) =>
                        E(View, { style: { ...s.statusRow, borderBottomWidth: i === tc.coreDesires.length - 1 ? 0 : 1, borderBottomColor: C.rule }, key: i },
                            E(Text, { style: { ...s.statusText, color: C.text } }, d),
                            E(View, { style: { ...s.statusIcon, backgroundColor: C.greenSoft, minWidth: 22, height: 22 } },
                                E(Text, { style: { ...s.statusIconText, color: C.green, fontSize: 9 } }, arabicNum(i + 1)),
                            ),
                        )
                    ),
                )
                : null,
        ),

        // Decision factors (orange)
        tc.behavior.decisionFactors.length > 0
            ? E(View, { style: { ...s.card, marginTop: 12 } },
                E(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'flex-end' } },
                    E(Text, { style: { ...s.cardLabel, color: C.orange, marginBottom: 0 } }, 'عوامل القرار الشرائي'),
                    E(View, { style: { ...s.statusIcon, backgroundColor: C.orangeSoft } },
                        E(Text, { style: { ...s.statusIconText, color: C.orange } }, '▸'),
                    ),
                ),
                ...tc.behavior.decisionFactors.map((f, i) =>
                    E(View, { style: { ...s.listRow, ...(i === tc.behavior.decisionFactors.length - 1 ? s.listRowLast : {}) }, key: i },
                        E(Text, { style: s.listText }, f),
                        E(Text, { style: { ...s.listNum, color: C.orange } }, arabicNum(i + 1).padStart(2, '٠')),
                    )
                ),
            )
            : null,

        // Buying habits (RTL: only habits card now — preferred channels removed)
        tc.behavior.buyingHabits.length > 0
            ? E(View, { style: { ...s.card, marginTop: 12 } },
                E(Text, { style: s.cardLabel }, 'عادات الشراء'),
                E(View, { style: s.pillRow },
                    ...tc.behavior.buyingHabits.map((h, i) =>
                        E(Text, { style: { ...s.pill, ...s.pillOrange }, key: i }, h)
                    )
                ),
            )
            : null,
    );
}

// ─── Page 4: Marketing Strategy ─────────────────────────────────────────────

function MarketingStrategyPage(dna: ProductDNA, pageNum: number) {
    const ms = dna.marketingStrategy;
    const pi = dna.productIdentity;
    const date = formatDate(dna.generatedAt);

    const anglesByLevel = LEVEL_ORDER.map((lvl) => ({
        level: lvl,
        angles: ms.marketingAngles.filter((a) => a.level === lvl),
    })).filter((g) => g.angles.length > 0);

    return E(Page, { size: 'A4', style: s.page },
        E(TopStrip, { sectionLabel: 'الاستراتيجية التسويقية', pageNum }),
        E(BottomStrip, { productName: pi.productName, date, pageNum }),

        E(SectionHead, {
            number: '٠٣',
            kicker: 'الفصل الثالث',
            title: 'الاستراتيجية التسويقية',
            subtitle: 'الزوايا التسويقية مرتّبة حسب مستوى وعي الجمهور.',
        }),

        // Marketing angles funnel
        anglesByLevel.length > 0
            ? E(View, { style: s.card },
                E(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
                    E(Text, { style: { ...s.bodyMuted, fontSize: 9 } },
                        'مرتّبة حسب مستوى وعي الجمهور — من غير المدرك إلى الجاهز للشراء.'
                    ),
                    E(Text, { style: s.cardLabel }, 'الزوايا التسويقية (' + arabicNum(ms.marketingAngles.length) + ')'),
                ),
                ...anglesByLevel.flatMap(({ level, angles }) => {
                    const meta = LEVEL_META[level];
                    return [
                        E(View, { style: { ...s.angleHeader, backgroundColor: meta.bg }, key: 'h-' + level },
                            E(Text, { style: { ...s.angleHeaderLabel, color: meta.color } }, meta.ar),
                            E(Text, { style: { ...s.angleHeaderCount } }, arabicNum(angles.length) + '  زاوية'),
                        ),
                        ...angles.map((angle, i) =>
                            E(View, { style: { ...s.angleCard, borderRightColor: meta.color }, key: level + '-' + i },
                                E(Text, { style: s.angleName }, angle.angleName),
                                angle.reasoning
                                    ? E(Text, { style: s.angleReason }, angle.reasoning)
                                    : null,
                            )
                        ),
                    ];
                }),
            )
            : null,
    );
}

// ─── Document assembly ──────────────────────────────────────────────────────

function buildDocument(dna: ProductDNA | null | undefined): React.ReactElement {
    const s_dna = safe(dna);
    return E(Document,
        {
            title: 'Product DNA — ' + s_dna.productIdentity.productName,
            author: 'Soctiv',
            subject: 'تحليل DNA المنتج',
            creator: 'Soctiv Product DNA',
            producer: 'Soctiv Product DNA',
        },
        CoverPage(s_dna),
        ProductIdentityPage(s_dna, 2),
        TargetCustomerPage(s_dna, 3),
        MarketingStrategyPage(s_dna, 4),
    );
}

// ─── URL cleanup tracking ───────────────────────────────────────────────────

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

// ─── Public API ─────────────────────────────────────────────────────────────

export async function generateDnaPdf(dna: ProductDNA | null | undefined): Promise<Blob> {
    try {
        // Guard against null/undefined input — the renderer crashes hard
        // with "Cannot read properties of undefined (reading 'id')" otherwise.
        if (!isUsableDna(dna)) {
            console.warn('[pdfExportService] generateDnaPdf called with invalid dna; rendering placeholder.');
        }

        // Make sure the brand mark is loaded as a data URL before we build the
        // document — @react-pdf/renderer is most reliable with base64.
        await preloadDnaPdfAssets();
        const doc = buildDocument(dna as ProductDNA);
        return await pdf(doc).toBlob();
    } catch (err) {
        // Surface a clearer message so the preview UI can show what failed.
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : '';
        console.error('[pdfExportService] generateDnaPdf failed:', msg, stack);
        throw new Error('PDF generation failed: ' + msg);
    }
}

export async function downloadDnaPdf(dna: ProductDNA | null | undefined): Promise<void> {
    const safeDna = safe(dna);
    const blob = await generateDnaPdf(dna);
    const url = URL.createObjectURL(blob);
    trackedUrls.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Product-DNA-' + safeDna.productIdentity.productName.replace(/[^a-zA-Z0-9؀-ۿ-]/g, '_') + '.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    cleanupDnaPdfUrl(url);
}

export async function getDnaPdfDataUrl(dna: ProductDNA | null | undefined): Promise<string> {
    const blob = await generateDnaPdf(dna);
    const url = URL.createObjectURL(blob);
    trackedUrls.add(url);
    return url;
}
