/**
 * Soctiv landing-page config — single source of truth.
 *
 * Replaces the deleted ZenonLandingConfig. The shape mirrors the placeholders
 * used by the templated `LANIDNG PAGE SOCTIV/` static HTML, which is rendered
 * by `supabase/functions/publish-landing-page/index.ts` and shipped to Netlify
 * per landing page.
 *
 * One data shape, one visual output. The editor UI in
 * `src/components/landing-pages/editor/sections/` edits this config; the AI
 * service in `src/services/soctivLandingConfigService.ts` fills it from Product
 * DNA + product metadata; the publish edge function renders it into HTML.
 */

// ─── Constants (market defaults) ────────────────────────────────────────────

/** 10 curated palettes. Each ships the full color-token set (28 tokens) so
 *  every section of the page (hero, form, trust row, reviews, footer)
 *  reads as a coherent design system with proper color chemistry — not
 *  a 3-token guess. Token groups:
 *    Surface:  bg, surface, surface-2, surface-3, ink, ink-2, muted, line, line-2
 *    Primary:  accent, accent-soft, accent-deep
 *    Secondary (the chemistry-maker): secondary, secondary-soft, secondary-deep
 *    Tertiary (pop): tertiary, tertiary-soft
 *    Trust (kept for back-compat with qty stepper / input focus):
 *              sage, sage-soft, sage-deep
 *    States:   success, success-bright, danger, highlight
 *    On-color text: on-primary, on-cta, on-secondary, on-highlight
 *
 *  The 4 dark palettes (charcoal-mint, navy-coral, espresso-emerald,
 *  ink-rose) have a warm `--secondary` so the page harmonizes with warm
 *  product photos (saffron, honey, amber). The previous mint/blue secondaries
 *  fought the product's color temperature and read as clinical.
 *
 *  Gradient/glow/halo CSS values are NOT tokens — they live in styles.css
 *  and compose the color tokens directly. This keeps the data file focused
 *  on colors and lets the stylesheet evolve its visual treatment without
 *  bumping the data shape. */
export const DEFAULT_SOCTIV_THEME_PALETTES = [
    'cream-sage',
    'ivory-teal',
    'sand-amber',
    'charcoal-mint',
    'navy-coral',
    'blush-bronze',
    'slate-violet',
    'espresso-emerald',
    'cloud-lavender',
    'ink-rose',
] as const;
export type SoctivThemePalette = (typeof DEFAULT_SOCTIV_THEME_PALETTES)[number];

/** Mood-group classification for the editor's palette picker. Lets the
 *  ThemeEditor group cards under Arabic mood headings (دافئ، فاتح، مظلم، بارد). */
export const SOCTIV_PALETTE_MOOD: Record<SoctivThemePalette, 'warm' | 'light' | 'dark' | 'cool'> = {
    'cream-sage': 'warm',
    'sand-amber': 'warm',
    'blush-bronze': 'warm',
    'ivory-teal': 'light',
    'cloud-lavender': 'light',
    'slate-violet': 'cool',
    'charcoal-mint': 'dark',
    'navy-coral': 'dark',
    'espresso-emerald': 'dark',
    'ink-rose': 'dark',
};

/** 8 curated fonts covering MENA ecommerce. Mix of Arabic-native + Inter
 *  (Latin fallback). All loaded from Google Fonts in template_index.html,
 *  template_thank_you.html, and template_privacy.html. */
export const DEFAULT_SOCTIV_FONTS = [
    'Alexandria',
    'IBM Plex Sans Arabic',
    'Cairo',
    'Tajawal',
    'Noto Sans Arabic',
    'Readex Pro',
    'Almarai',
    'Inter',
] as const;
export type SoctivThemeFont = (typeof DEFAULT_SOCTIV_FONTS)[number];

/** Curated palette resolver. Each preset is a complete color system so
 *  the page reads as a single design with primary / secondary / tertiary
 *  chemistry. The 4 dark palettes use warm secondaries (saffron, gold,
 *  amber) so the page reads as a premium product page, not a clinical
 *  B2B SaaS landing. */
export const SOCTIV_PALETTES: Record<SoctivThemePalette, Record<string, string>> = {
    'cream-sage': {
        // Warm light — the default trust look. Bronze primary, sage secondary.
        '--bg': '#f6f3ec', '--surface': '#ffffff', '--surface-2': '#efeae0',
        '--surface-3': '#f9f6ef', '--ink': '#1f1f1c', '--ink-2': '#3a3a35',
        '--muted': '#5a584f', '--line': '#e9e4d8', '--line-2': '#ddd6c5',
        '--accent': '#9a7e57', '--accent-soft': '#ece2cd', '--accent-deep': '#6b553a',
        '--secondary': '#6e8a7c', '--secondary-soft': '#e3ebe5', '--secondary-deep': '#3f564a',
        '--tertiary': '#c08a4a', '--tertiary-soft': '#f0dfc0',
        '--sage': '#6e8a7c', '--sage-soft': '#e3ebe5', '--sage-deep': '#3f564a',
        '--success': '#4f7a64', '--success-bright': '#5e8c75', '--danger': '#a35a4a',
        '--highlight': '#f5e8d0',
        // CTA on bronze accent (mid-warm, L≈0.21) needs near-black text for
        // WCAG AA. Earlier `#3d2a10` and cream `#fbf8f0` both fell below 4.5.
        '--on-primary': '#0a0500', '--on-cta': '#0a0500',
        '--on-secondary': '#2a3a30', '--on-highlight': '#3d2a10',
    },
    'ivory-teal': {
        // Cool light. Teal primary, deep sage secondary, warm gold pop.
        '--bg': '#fafaf7', '--surface': '#ffffff', '--surface-2': '#f1efe8',
        '--surface-3': '#f5f3ec', '--ink': '#0f1f1f', '--ink-2': '#2a3a3a',
        '--muted': '#4a5252', '--line': '#e3e6e0', '--line-2': '#d0d5cd',
        '--accent': '#3f7a7b', '--accent-soft': '#d8e7e6', '--accent-deep': '#1f4f50',
        '--secondary': '#5a8a7a', '--secondary-soft': '#dceae6', '--secondary-deep': '#2a5a4a',
        '--tertiary': '#d8a04a', '--tertiary-soft': '#f5e6c8',
        '--sage': '#3f7a7b', '--sage-soft': '#d8e7e6', '--sage-deep': '#1f4f50',
        '--success': '#2f6a5a', '--success-bright': '#3f8a72', '--danger': '#a35a4a',
        '--highlight': '#e8e6d8',
        // On-color text: dark teal accent (L≈0.21) → light text on the chip/CTA.
        '--on-primary': '#f5f8f6', '--on-cta': '#fbf8f0',
        '--on-secondary': '#1a3a30', '--on-highlight': '#1a2020',
    },
    'sand-amber': {
        // Warm light. Amber primary, olive secondary, terracotta pop.
        '--bg': '#f5efe6', '--surface': '#ffffff', '--surface-2': '#ebe4d6',
        '--surface-3': '#efe9da', '--ink': '#2a1f12', '--ink-2': '#4a3a25',
        '--muted': '#5a4a35', '--line': '#e0d6c0', '--line-2': '#cdc1a5',
        '--accent': '#c08a4a', '--accent-soft': '#f0dfc0', '--accent-deep': '#8a5a2a',
        '--secondary': '#7a8a4a', '--secondary-soft': '#e8e0c5', '--secondary-deep': '#4a5a25',
        '--tertiary': '#a85a3a', '--tertiary-soft': '#f0d4c0',
        '--sage': '#8a7a4a', '--sage-soft': '#e8e0c5', '--sage-deep': '#5a4a25',
        '--success': '#7a8a4a', '--success-bright': '#9aaa5a', '--danger': '#a35a3a',
        '--highlight': '#f5e2c5',
        // CTA on amber accent (mid-warm gold, L≈0.32) needs dark text — cream
        // `#fbf8f0` was at 2.84:1 (FAIL). Switched to warm near-black.
        '--on-primary': '#3a2010', '--on-cta': '#1a1008',
        '--on-secondary': '#2a3010', '--on-highlight': '#3a2010',
    },
    'charcoal-mint': {
        // Dark luxe — the screenshot palette. RE-TINTED: warm saffron secondary
        // (was mint) so the page harmonizes with warm product photos.
        // The mint now only appears as a micro-accent (eyebrow dot, section
        // accents); the saffron secondary tints the CTA gradient, total
        // row, image halo, and hero glow.
        '--bg': '#0f1417', '--surface': '#161c20', '--surface-2': '#1c2429',
        '--surface-3': '#222b30', '--ink': '#f0f3f5', '--ink-2': '#c0c8cc',
        '--muted': '#a0aab0', '--line': '#2a3338', '--line-2': '#36403f',
        '--accent': '#7ce0c2', '--accent-soft': '#1c3a35', '--accent-deep': '#3fa890',
        '--secondary': '#e8b85a', '--secondary-soft': '#3a3020', '--secondary-deep': '#a87a2a',
        '--tertiary': '#5ae0c8', '--tertiary-soft': '#1a3a32',
        '--sage': '#7ce0c2', '--sage-soft': '#1c3a35', '--sage-deep': '#a8f0d8',
        '--success': '#7ce0c2', '--success-bright': '#a8f0d8', '--danger': '#ff7a6a',
        '--highlight': '#2a2a30',
        // On-color text: secondary-soft is a dark brown chip (L≈0.18) →
        // light cream text. accent is light mint (L≈0.75) → dark text.
        '--on-primary': '#0a2a22', '--on-cta': '#1a1208',
        '--on-secondary': '#f5e8c8', '--on-highlight': '#e8b85a',
    },
    'navy-coral': {
        // Dark luxe. RE-TINTED: warm gold secondary (was cool blue) to
        // harmonize with the coral accent. Navy + coral + gold = premium.
        '--bg': '#0d1825', '--surface': '#142133', '--surface-2': '#1a2a3f',
        '--surface-3': '#22344c', '--ink': '#f5f7fa', '--ink-2': '#c5cfd9',
        '--muted': '#a0b0c0', '--line': '#2a3a52', '--line-2': '#36456a',
        '--accent': '#ff6a5a', '--accent-soft': '#3a1f1c', '--accent-deep': '#c44030',
        '--secondary': '#e8b85a', '--secondary-soft': '#3a3020', '--secondary-deep': '#a87a2a',
        '--tertiary': '#7aa8ff', '--tertiary-soft': '#1a2a4a',
        '--sage': '#5a8aff', '--sage-soft': '#1c2a4a', '--sage-deep': '#a8bfff',
        '--success': '#5ae0a8', '--success-bright': '#7ce8c0', '--danger': '#ff6a5a',
        '--highlight': '#2a2a3a',
        // On-color text: secondary-soft is dark brown chip (L≈0.18) →
        // light cream text. accent is light coral (L≈0.62) → dark text.
        '--on-primary': '#3a0a08', '--on-cta': '#1a0808',
        '--on-secondary': '#f5e8c8', '--on-highlight': '#e8b85a',
    },
    'blush-bronze': {
        // Warm light — feminine luxury. Bronze primary, mauve secondary,
        // warm gold pop.
        '--bg': '#faf3ee', '--surface': '#ffffff', '--surface-2': '#f5e8de',
        '--surface-3': '#f9ede2', '--ink': '#2a1a14', '--ink-2': '#4a3530',
        '--muted': '#5a4030', '--line': '#ead9c8', '--line-2': '#d9c0a8',
        '--accent': '#b8723a', '--accent-soft': '#f0dcc4', '--accent-deep': '#7a4a20',
        '--secondary': '#a86a5a', '--secondary-soft': '#f0d8d0', '--secondary-deep': '#6a3a2a',
        '--tertiary': '#d8a85a', '--tertiary-soft': '#f5e8c8',
        '--sage': '#a86a5a', '--sage-soft': '#f0d8d0', '--sage-deep': '#7a4a3a',
        '--success': '#7a9a6a', '--success-bright': '#9ab07a', '--danger': '#a85a4a',
        '--highlight': '#f5e0d0',
        // CTA on bronze accent (mid-warm, L≈0.21) needs near-black text —
        // cream `#fbf8f0` was at 3.59:1 (BAD) and `#3a1a08` was at 4.14:1
        // (AA-large only). Switched both to warm near-black `#0a0500`.
        '--on-primary': '#0a0500', '--on-cta': '#0a0500',
        '--on-secondary': '#2a1008', '--on-highlight': '#3a1a08',
    },
    'slate-violet': {
        // Cool light. Violet primary, blue secondary, mint pop.
        '--bg': '#f4f4f8', '--surface': '#ffffff', '--surface-2': '#e8e8f0',
        '--surface-3': '#eeeef4', '--ink': '#1a1a2a', '--ink-2': '#3a3a4a',
        '--muted': '#6a6a7a', '--line': '#d8d8e0', '--line-2': '#c5c5d0',
        '--accent': '#6a4ae8', '--accent-soft': '#e0d8f5', '--accent-deep': '#3a1aa0',
        '--secondary': '#4a6ae8', '--secondary-soft': '#d8e0f5', '--secondary-deep': '#1a3aa0',
        '--tertiary': '#4ae8c8', '--tertiary-soft': '#d8f5ec',
        '--sage': '#4a6ae8', '--sage-soft': '#d8e0f5', '--sage-deep': '#2a3aa0',
        '--success': '#4a8a6a', '--success-bright': '#6aaa8a', '--danger': '#a84a4a',
        '--highlight': '#e8e6f0',
        // On-color text: dark violet accent (L≈0.33) → light cream text on
        // the chip/CTA so contrast reads correctly (was dark violet on
        // dark violet, unreadable).
        '--on-primary': '#f5f0fa', '--on-cta': '#fbf8f0',
        '--on-secondary': '#0a1a4a', '--on-highlight': '#1a1a3a',
    },
    'espresso-emerald': {
        // Dark warm. RE-TINTED: warm amber secondary (was mint) — espresso
        // + emerald + amber = coffee-shop warmth.
        '--bg': '#1a120c', '--surface': '#221812', '--surface-2': '#2a1f18',
        '--surface-3': '#322520', '--ink': '#f5ebe0', '--ink-2': '#c5b5a0',
        '--muted': '#a89880', '--line': '#3a2a1f', '--line-2': '#4a3a2a',
        '--accent': '#5ae0a0', '--accent-soft': '#1c3a2a', '--accent-deep': '#3aa070',
        '--secondary': '#e8a85a', '--secondary-soft': '#3a2a1a', '--secondary-deep': '#a8702a',
        '--tertiary': '#a8e0c8', '--tertiary-soft': '#1c3a2a',
        '--sage': '#5ae0a0', '--sage-soft': '#1c3a2a', '--sage-deep': '#a8f0c5',
        '--success': '#5ae0a0', '--success-bright': '#a8f0c5', '--danger': '#ff7a5a',
        '--highlight': '#2a201a',
        // On-color text: secondary-soft is dark brown chip (L≈0.15) →
        // light warm cream text. accent is light emerald (L≈0.69) → dark text.
        '--on-primary': '#0a2010', '--on-cta': '#1a1008',
        '--on-secondary': '#f5e8c8', '--on-highlight': '#e8a85a',
    },
    'cloud-lavender': {
        // Cool light. Lavender primary, dusty rose secondary, periwinkle pop.
        '--bg': '#faf8fc', '--surface': '#ffffff', '--surface-2': '#f0eaf5',
        '--surface-3': '#f5f0fa', '--ink': '#1f1a2a', '--ink-2': '#3a3540',
        '--muted': '#524858', '--line': '#e5dceb', '--line-2': '#d0c5d8',
        '--accent': '#9a7ad8', '--accent-soft': '#ebdff5', '--accent-deep': '#5a3aa0',
        '--secondary': '#d8a8c0', '--secondary-soft': '#f5e0ea', '--secondary-deep': '#8a5a7a',
        '--tertiary': '#7a9ad8', '--tertiary-soft': '#dfe5f5',
        '--sage': '#7a9ad8', '--sage-soft': '#dfe5f5', '--sage-deep': '#5a4a8a',
        '--success': '#6a9a7a', '--success-bright': '#8aaa8a', '--danger': '#a85a7a',
        '--highlight': '#f0e8f5',
        // CTA on lavender accent (mid purple, L≈0.30) needs dark text — cream
        // `#fbf8f0` was at 3.22:1 (BAD). Switched to dark indigo `#1a1230`.
        '--on-primary': '#2a1a4a', '--on-cta': '#1a1230',
        '--on-secondary': '#3a1a2a', '--on-highlight': '#2a1a3a',
    },
    'ink-rose': {
        // Dark romantic. RE-TINTED: warm gold secondary (was near-accent rose)
        // so the secondary reads as a true chemistry-mate, not a near-duplicate
        // of the rose accent. Ink + rose + gold = jewelry/gifts vibe.
        '--bg': '#0f0d12', '--surface': '#171420', '--surface-2': '#1f1a2a',
        '--surface-3': '#272234', '--ink': '#f5f0f5', '--ink-2': '#c5bcc5',
        '--muted': '#a0929a', '--line': '#2a2530', '--line-2': '#3a3540',
        '--accent': '#f0a8b8', '--accent-soft': '#3a2a30', '--accent-deep': '#a86878',
        '--secondary': '#e8c878', '--secondary-soft': '#3a3020', '--secondary-deep': '#a8883a',
        '--tertiary': '#a8c8f0', '--tertiary-soft': '#1a2a3a',
        '--sage': '#e0a8b8', '--sage-soft': '#3a2a30', '--sage-deep': '#f5c5d0',
        '--success': '#a8e0b8', '--success-bright': '#c5f0d0', '--danger': '#ff7a8a',
        '--highlight': '#2a2530',
        // On-color text: secondary-soft is dark brown chip (L≈0.18) →
        // light warm cream text. accent is light rose (L≈0.74) → dark text.
        '--on-primary': '#3a1a22', '--on-cta': '#1a1008',
        '--on-secondary': '#f5e8c8', '--on-highlight': '#e8c878',
    },
};

/** Mood heading (Arabic) used by the ThemeEditor to group palettes into
 *  visual sections. The key matches SOCTIV_PALETTE_MOOD. */
export const SOCTIV_MOOD_LABELS_AR: Record<'warm' | 'light' | 'dark' | 'cool', string> = {
    'warm': 'دافئ وفاخر',
    'light': 'فاتح ومشرق',
    'dark': 'مظلم وراقٍ',
    'cool': 'بارد وأنيق',
};

/** A small structural diff: which palettes are "dark" (bg luminance < 0.5).
 *  Used by the runtime CSS to decide whether to apply dark-mode styling
 *  for derived values (halo alpha, grain strength, etc.) without the
 *  data file having to declare isDark. Computed once at module init. */
function isDarkPalette(p: SoctivThemePalette): boolean {
    const hex = SOCTIV_PALETTES[p]['--bg'];
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    // Rec. 709 luminance
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

/** Rec. 709 luminance of a #rrggbb hex string, range 0..1. The threshold
 *  for "this background needs dark text" is L < 0.55 (so mid-tone colors
 *  like teal #3f7a7b still pick a dark-on-light readable text, while
 *  really bright colors like saffron pick dark text). */
export function hexLuminance(hex: string): number {
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Auto-pick a readable on-color text for any background hex. Uses the
 *  palette's own --ink (deep dark) and the warm cream as the two
 *  candidates, then chooses by luminance.
 *
 *  Rule: if the bg's luminance is < 0.55, return the light cream candidate
 *  (text on dark surfaces reads as light). Otherwise return the dark ink
 *  candidate. The result is palette-aware — a charcoal-mint page with a
 *  saffron chip will get dark ink on saffron (light bg), while the same
 *  page's mint chip will get the same dark ink (light bg too). A dark
 *  slate-violet chip on a light page gets light cream text.
 *
 *  Use this whenever you add a new palette: instead of hand-picking
 *  `--on-primary` etc., call pickOnColor(tokens['--accent'], tokens['--ink'])
 *  and trust the result. */
export function pickOnColor(
    bgHex: string,
    inkHex: string,
    creamHex = '#f5efe0',
): string {
    return hexLuminance(bgHex) < 0.55 ? creamHex : inkHex;
}

/** Convenience: pick the right on-color for each named chip in a palette
 *  in one call. Returns the six most-used on-* tokens. Use this when
 *  authoring a new palette so you don't have to hand-pick contrast.
 *
 *  - onPrimary:       text on `--accent` (CTA, footer mark, total row)
 *  - onPrimarySoft:   text on `--accent-soft` (eyebrow chip, hero highlight)
 *  - onCta:           text on the CTA / total row (== onPrimary by default,
 *                      but exposed separately in case a palette wants a
 *                      CTA chip color different from its accent)
 *  - onSecondary:     text on `--secondary-soft` (discount row, review chip)
 *  - onHighlight:     text on `--highlight` (callout boxes, error states)
 *
 *  All six are computed from the underlying bg's luminance — no warm
 *  accent text on neutral chips, no dark text on dark chips. Just black
 *  or white depending on what's underneath. */
export function pickOnColorsForPalette(
    tokens: Record<string, string>,
): {
    onPrimary: string;
    onPrimarySoft: string;
    onCta: string;
    onSecondary: string;
    onHighlight: string;
} {
    const ink = tokens['--ink'];
    return {
        onPrimary: pickOnColor(tokens['--accent'], ink),
        onPrimarySoft: pickOnColor(tokens['--accent-soft'], ink),
        onCta: pickOnColor(tokens['--accent'], ink),
        onSecondary: pickOnColor(tokens['--secondary-soft'], ink),
        onHighlight: pickOnColor(tokens['--highlight'], ink),
    };
}

export const SOCTIV_PALETTE_IS_DARK: Record<SoctivThemePalette, boolean> = {
    'cream-sage': isDarkPalette('cream-sage'),
    'ivory-teal': isDarkPalette('ivory-teal'),
    'sand-amber': isDarkPalette('sand-amber'),
    'blush-bronze': isDarkPalette('blush-bronze'),
    'slate-violet': isDarkPalette('slate-violet'),
    'cloud-lavender': isDarkPalette('cloud-lavender'),
    'charcoal-mint': isDarkPalette('charcoal-mint'),
    'navy-coral': isDarkPalette('navy-coral'),
    'espresso-emerald': isDarkPalette('espresso-emerald'),
    'ink-rose': isDarkPalette('ink-rose'),
};

/** Human-readable Arabic name per palette. Used in the ThemeEditor for
 *  the option label, and as the `<title>` for screen readers. */
export const SOCTIV_PALETTE_LABELS_AR: Record<SoctivThemePalette, string> = {
    'cream-sage': 'كريم وأعشاب',
    'ivory-teal': 'فيروزي',
    'sand-amber': 'عنبري',
    'charcoal-mint': 'فحمي ونعناع',
    'navy-coral': 'كحلي ومرجاني',
    'blush-bronze': 'وردي وبرونزي',
    'slate-violet': 'رمادي وبنفسجي',
    'espresso-emerald': 'إسبريسو وزمردي',
    'cloud-lavender': 'غيوم وخزامى',
    'ink-rose': 'حبري ووردي',
};

/** Human-readable Arabic name per font. */
export const SOCTIV_FONT_LABELS_AR: Record<SoctivThemeFont, string> = {
    'Alexandria': 'الإسكندرية',
    'IBM Plex Sans Arabic': 'IBM بلكس',
    'Cairo': 'القاهرة',
    'Tajawal': 'تجوال',
    'Noto Sans Arabic': 'نوتو',
    'Readex Pro': 'ريدكس',
    'Almarai': 'المراعي',
    'Inter': 'إنتر',
};

// ─── Per-section types ──────────────────────────────────────────────────────

export interface SoctivProduct {
    id: string;
    code: string;
    name: string;            // English / canonical
    nameArabic: string;
    category: string;        // English, for Meta content_category
    image: string;           // hero + order-line image (URL)
    currency: 'LYD';
    currencySymbol: 'د.ل';
    currencyName: 'دينار ليبي';
    value: number;           // unit price at qty=1
    unitPrice: number;       // alias of value (kept for clarity in editor)
    metaLine: string;        // one-liner under product name on order form (Arabic)
}

export interface SoctivPricingTier {
    quantity: number;
    price: number;           // total price for this quantity
    label: string;           // Arabic label (e.g. "قطعة واحدة", "3 قطع + خصم 15%")
}

export interface SoctivPricing {
    tiers: SoctivPricingTier[];
    maxQty: number;
    discountLabel: string;   // Arabic label for discount row
}

export interface SoctivTracking {
    pixelId: string;
    capiUrl: string;
    testEventCode: string;
    debug: boolean;
}

export interface SoctivHero {
    headline: string;
    subline: string;
    ctaText: string;
    imageUrl: string;
    imageAlt: string;
}

export interface SoctivForm {
    submitText: string;
    nameField: string;        // Arabic label
    phoneField: string;
    locationField: string;
    phoneRegex: string;
    phonePlaceholder: string;
    nameMinLength: number;
    locationMinLength: number;
    submittingText: string;   // "جاري الإرسال..."
}

export interface SoctivObjectionItem {
    q: string;
    a: string;
}

export interface SoctivObjections {
    heading: string;
    subheading: string;
    items: SoctivObjectionItem[];
}

export interface SoctivReviewItem {
    name: string;       // Arabic
    location: string;   // Libyan city
    text: string;       // Arabic 1-2 sentences
    initial: string;    // single Arabic letter for avatar
}

export interface SoctivReviews {
    /** Phase 5: hide the whole social-proof section without deleting copy.
     *  Defaults to `true` for backward compat — legacy configs without the
     *  flag are treated as enabled. */
    enabled?: boolean;
    heading: string;
    subheading: string;
    items: SoctivReviewItem[];
}

/** A trust strip has two parts: 3 short badges above the form, and 2
 *  short row chips under the submit button. Both have a Phase 5 toggle. */
export interface SoctivTrustStrip {
    /** Phase 5: hide this strip without deleting copy. Defaults `true`. */
    enabled?: boolean;
    items: string[];
}

export interface SoctivTrust {
    /** 3 short chips rendered above the order form */
    badges: string[] | SoctivTrustStrip;
    /** 2 short chips under submit button */
    row: string[] | SoctivTrustStrip;
}

export interface SoctivBusiness {
    brand: string;
    brandInitial?: string;  // auto-stamped at preview/publish from brand[0]
    supportEmail: string;
    privacyEmail: string;
    country: string;
    phonePrefix: string;
    copyright: string;
}

export interface SoctivWebhook {
    url: string;
    clientCode: string;     // auto-stamped at publish from clients.webhook_code
    productCode: string;    // auto-stamped at publish from products.code
    thankYouUrl: string;
    source: string;
}

export interface SoctivSeo {
    title: string;
    description: string;
    ogImage: string;
    ogImageAlt: string;
    year?: string;          // auto-stamped at preview/publish from new Date()
}

export interface SoctivTheme {
    palette: SoctivThemePalette;
    font: SoctivThemeFont;
}

// ─── Top-level shape ────────────────────────────────────────────────────────

export interface SoctivLandingConfig {
    product: SoctivProduct;
    pricing: SoctivPricing;
    tracking: SoctivTracking;
    hero: SoctivHero;
    form: SoctivForm;
    objections: SoctivObjections;
    reviews: SoctivReviews;
    trust: SoctivTrust;
    business: SoctivBusiness;
    webhook: SoctivWebhook;
    seo: SoctivSeo;
    theme: SoctivTheme;
}

export type SoctivSectionKey =
    | 'hero'
    | 'pricing'
    | 'form'
    | 'objections'
    | 'reviews'
    | 'trust'
    | 'seo'
    | 'business'
    | 'theme';

// ─── Builders ───────────────────────────────────────────────────────────────

export interface BuildDefaultInput {
    product: {
        id: string;
        code?: string;
        name: string;
        nameArabic?: string;
        imageUrl: string | null;
        price: number;
        category?: string;
    };
    market?: {
        country?: string;
        currency?: 'LYD';
        phoneRegex?: string;
    };
}

const MARKET_DEFAULTS = {
    currency: 'LYD' as const,
    currencySymbol: 'د.ل' as const,
    currencyName: 'دينار ليبي' as const,
    country: 'Libya',
    phonePrefix: '+218',
    phoneRegex: '^09[0-9]{8}$',
    phonePlaceholder: '091 234 5678',
    nameMinLength: 3,
    locationMinLength: 5,
    brand: 'soctiv',
    supportEmail: 'support@soctiv.ly',
    privacyEmail: 'privacy@soctiv.ly',
};

/** Discount schedule per tier (qty → percent). Monotonic non-decreasing. */
const TIER_DISCOUNT_PERCENT: Record<number, number> = {
    1: 0,
    2: 8,
    3: 15,
    4: 22,
    5: 28,
    6: 33,
};

function deriveTiers(unitPrice: number, maxQty: number): SoctivPricingTier[] {
    if (unitPrice <= 0 || maxQty <= 0) return [];
    const tiers: SoctivPricingTier[] = [];
    for (let q = 1; q <= maxQty; q++) {
        const discount = TIER_DISCOUNT_PERCENT[q] ?? Math.min(40, 5 * (q - 1) + 8);
        const total = Math.round(q * unitPrice * (1 - discount / 100) * 100) / 100;
        const unit = Math.round((total / q) * 100) / 100;
        const labelParts: string[] = [];
        labelParts.push(qtyTextAr(q));
        if (discount > 0) labelParts.push(`خصم ${discount}٪`);
        tiers.push({
            quantity: q,
            price: total,
            label: labelParts.join(' — '),
        });
        // unit is implicit in label; expose for advanced users
        void unit;
    }
    return tiers;
}

function qtyTextAr(qty: number): string {
    if (qty === 1) return 'قطعة واحدة';
    if (qty === 2) return 'قطعتان';
    if (qty >= 3 && qty <= 10) return `${qty} قطع`;
    return `${qty} قطعة`;
}

/** Build a blank-but-valid `SoctivLandingConfig` populated with market defaults
 *  and product metadata. AI-generated copy is left empty so the editor can
 *  show a clear empty-state and the user can regenerate. */
export function buildDefaultSoctivConfig(input: BuildDefaultInput): SoctivLandingConfig {
    const m = { ...MARKET_DEFAULTS, ...(input.market || {}) };
    const unitPrice = Number(input.product.price) || 0;
    const maxQty = 5;
    const tiers = deriveTiers(unitPrice, maxQty);
    const nameArabic = input.product.nameArabic || input.product.name;
    const code = input.product.code || input.product.id;

    return {
        product: {
            id: input.product.id,
            code,
            name: input.product.name,
            nameArabic,
            category: input.product.category || 'General',
            image: input.product.imageUrl || '',
            currency: 'LYD',
            currencySymbol: m.currencySymbol,
            currencyName: m.currencyName,
            value: unitPrice,
            unitPrice,
            metaLine: '',
        },
        pricing: {
            tiers,
            maxQty,
            discountLabel: 'التخفيض',
        },
        tracking: {
            pixelId: '',
            capiUrl: '',
            testEventCode: '',
            debug: false,
        },
        hero: {
            headline: '',
            subline: '',
            ctaText: 'اطلب الآن — الدفع عند الاستلام',
            imageUrl: input.product.imageUrl || '',
            imageAlt: `صورة ${nameArabic}`,
        },
        form: {
            submitText: 'تأكيد الطلب',
            nameField: 'الاسم الكامل',
            phoneField: 'رقم الهاتف',
            locationField: 'المدينة والعنوان',
            phoneRegex: m.phoneRegex,
            phonePlaceholder: m.phonePlaceholder,
            nameMinLength: m.nameMinLength,
            locationMinLength: m.locationMinLength,
            submittingText: 'جاري الإرسال…',
        },
        objections: {
            heading: 'ثلاثة أسئلة تشغلك — وإجاباتها',
            subheading:
                'الأسباب التي تجعل عملاءنا يطلبون بثقة، مرتبة حسب الأسئلة الأكثر تكراراً.',
            items: [
                { q: '', a: '' },
                { q: '', a: '' },
                { q: '', a: '' },
            ],
        },
        reviews: {
            enabled: true,
            heading: 'ماذا يقول عملاؤنا',
            subheading: 'تجارب حقيقية من عملاء طلبوا من soctiv.',
            items: [
                { name: '', location: '', text: '', initial: '' },
                { name: '', location: '', text: '', initial: '' },
                { name: '', location: '', text: '', initial: '' },
            ],
        },
        trust: {
            badges: {
                enabled: true,
                items: ['الدفع عند الاستلام', 'توصيل مجاني', 'ضمان سنة'],
            },
            row: {
                enabled: true,
                items: ['دفع عند الاستلام', 'توصيل مجاني'],
            },
        },
        business: {
            brand: m.brand,
            supportEmail: m.supportEmail,
            privacyEmail: m.privacyEmail,
            country: m.country,
            phonePrefix: m.phonePrefix,
            copyright: `© ${new Date().getFullYear()} ${m.brand} — جميع الحقوق محفوظة`,
        },
        webhook: {
            url: '',
            clientCode: '',
            productCode: '',
            thankYouUrl: 'thank-you.html',
            source: 'Landing Page',
        },
        seo: {
            title: '',
            description: '',
            ogImage: input.product.imageUrl || '',
            ogImageAlt: `صورة ${nameArabic}`,
        },
        theme: {
            palette: 'cream-sage',
            font: 'Alexandria',
        },
    };
}

/** True if the loaded JSON has any legacy Zenon top-level key. The editor
 *  uses this to show a "regenerate to migrate" banner. */
export function isLegacyZenonConfig(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    const form = obj.form && typeof obj.form === 'object'
        ? (obj.form as Record<string, unknown>)
        : undefined;
    return Boolean(
        obj.meta || obj.offers || obj.proofStrip || (form && form.heading !== undefined)
    );
}
