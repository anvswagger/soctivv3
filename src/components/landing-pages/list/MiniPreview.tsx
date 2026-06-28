/**
 * MiniPreview — tiny scaled-down iframe preview of a landing page.
 *
 * Used in the landing page card grid. Renders the actual page HTML in a
 * sandboxed iframe at 320×540 logical pixels scaled down to fit a 160 px
 * tall thumbnail — gives the cards a "screenshot of your page" feel without
 * requiring a server-side screenshot pipeline.
 *
 * Falls back to a palette-tinted placeholder while the render is pending
 * (and when the config is empty / legacy). The placeholder uses the
 * palette's solid `--bg` with the palette's accent for the initial tile —
 * a flat natural look that matches the published page's design language.
 */
import { cn } from '@/lib/utils';
import { useThumbnailPreview } from '@/hooks/useThumbnailPreview';
import {
    DEFAULT_SOCTIV_THEME_PALETTES,
    SOCTIV_PALETTES,
    type SoctivLandingConfig,
} from '@/types/soctivLandingConfig';

interface MiniPreviewProps {
    config: SoctivLandingConfig | null;
    className?: string;
}

/** Returns a flat solid-color background drawn directly from the palette
 *  identity. No gradient — the published page itself uses solid colors,
 *  so the placeholder should preview that same flat natural look. */
function fallbackBgFor(paletteKey: string): string {
    const tokens = SOCTIV_PALETTES[paletteKey] || SOCTIV_PALETTES['cream-sage'];
    return tokens['--bg'];
}

export function MiniPreview({ config, className }: MiniPreviewProps) {
    const html = useThumbnailPreview(config);

    // Placeholder bg is the palette's own --bg — a single neutral color
    // drawn straight from the palette, no gradient blending.
    const palette: string =
        (config?.theme?.palette as (typeof DEFAULT_SOCTIV_THEME_PALETTES)[number]) ||
        'cream-sage';
    const paletteTokens = SOCTIV_PALETTES[palette] || SOCTIV_PALETTES['cream-sage'];
    const accent = paletteTokens['--accent'] || '#9a7e57';
    const bg = paletteTokens['--bg'] || '#f6f3ec';
    const placeholderBg = fallbackBgFor(palette);

    return (
        <div
            className={cn(
                'relative w-full h-full overflow-hidden rounded-t-xl',
                className
            )}
            style={{ background: html ? '#ffffff' : placeholderBg }}
        >
            {html ? (
                <iframe
                    srcDoc={html}
                    title="معاينة صفحة الهبوط"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    className="absolute inset-0 w-[320px] h-[540px] border-0 origin-top-left pointer-events-none"
                    style={{
                        // Scale the 320-wide logical canvas down to fill the
                        // 100% wide container. Keeps aspect ratio for all
                        // card sizes without per-card width math.
                        transform: 'scale(var(--lp-mini-scale, 0.5))',
                        transformOrigin: 'top left',
                    }}
                />
            ) : (
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: placeholderBg }}
                >
                    <div
                        className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-heading font-bold text-2xl"
                        style={{
                            borderColor: accent,
                            color: accent,
                            background: bg,
                        }}
                    >
                        {(config?.product?.nameArabic?.[0] || 'S').toUpperCase()}
                    </div>
                </div>
            )}
        </div>
    );
}
