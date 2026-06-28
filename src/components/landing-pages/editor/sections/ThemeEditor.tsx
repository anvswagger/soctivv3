/**
 * ThemeEditor — palette + font picker for the landing page.
 *
 * Each palette card shows:
 *   1. A 5-swatch strip — bg / surface / accent / secondary / tertiary,
 *      so the palette's chemistry is readable at a glance.
 *   2. A mini preview using the palette's actual tokens.
 *   3. A mood label pill (دافئ فاخر / فاتح مشرق / مظلم راقٍ / بارد أنيق).
 *
 * Palettes can be filtered by mood group; "الكل" shows every palette.
 */
import { useMemo, useState } from 'react';
import {
    DEFAULT_SOCTIV_THEME_PALETTES,
    DEFAULT_SOCTIV_FONTS,
    SOCTIV_PALETTES,
    SOCTIV_PALETTE_LABELS_AR,
    SOCTIV_PALETTE_MOOD,
    SOCTIV_MOOD_LABELS_AR,
    SOCTIV_PALETTE_IS_DARK,
    SOCTIV_FONT_LABELS_AR,
    type SoctivLandingConfig,
} from '@/types/soctivLandingConfig';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

type MoodKey = 'warm' | 'light' | 'dark' | 'cool';
type MoodFilter = MoodKey | 'all';

/** Stack of the currently-selected theme font + a system fallback. */
function activeFontStack(activeFont: string): string {
    const stacks: Record<string, string> = {
        'Alexandria':
            '"Alexandria", "IBM Plex Sans Arabic", system-ui, sans-serif',
        'IBM Plex Sans Arabic':
            '"IBM Plex Sans Arabic", system-ui, sans-serif',
        'Cairo': '"Cairo", system-ui, sans-serif',
        'Tajawal': '"Tajawal", system-ui, sans-serif',
        'Noto Sans Arabic':
            '"Noto Sans Arabic", system-ui, sans-serif',
        'Readex Pro': '"Readex Pro", system-ui, sans-serif',
        'Almarai': '"Almarai", system-ui, sans-serif',
        'Inter': '"Inter", system-ui, sans-serif',
    };
    return stacks[activeFont] || stacks['Alexandria'];
}

/** The 5 chemistry tokens every card shows — bg / surface / accent /
 *  secondary / tertiary. Plain solid colors drawn directly from the
 *  palette — no gradient or glow, just the palette's identity. */
function PaletteSwatchStrip({
    tokens,
}: {
    tokens: Record<string, string>;
}) {
    const swatches = [
        { var: '--bg', label: 'bg' },
        { var: '--surface', label: 'sf' },
        { var: '--accent', label: 'a' },
        { var: '--secondary', label: '2' },
        { var: '--tertiary', label: '3' },
    ];
    return (
        <div
            className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border bg-card"
            aria-hidden
        >
            {swatches.map((s) => (
                <span
                    key={s.var}
                    className="inline-block h-3.5 w-3.5 rounded-full border border-border/60 shrink-0"
                    style={{ background: tokens[s.var] }}
                    title={s.label}
                />
            ))}
        </div>
    );
}

function PaletteCard({
    palette,
    active,
    activeFont,
    onSelect,
}: {
    palette: (typeof DEFAULT_SOCTIV_THEME_PALETTES)[number];
    active: boolean;
    activeFont: string;
    onSelect: () => void;
}) {
    const tokens = SOCTIV_PALETTES[palette];
    const fontStack = activeFontStack(activeFont);
    const mood = SOCTIV_PALETTE_MOOD[palette];
    const moodLabel = SOCTIV_MOOD_LABELS_AR[mood];
    const isDark = SOCTIV_PALETTE_IS_DARK[palette];
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            className={cn(
                'group relative rounded-lg border text-right overflow-hidden transition-all',
                active
                    ? 'border-primary ring-2 ring-primary/40'
                    : 'border-border hover:border-primary/40'
            )}
        >
            {/* 5-swatch strip — reads the palette's chemistry in 200ms */}
            <PaletteSwatchStrip tokens={tokens} />

            {/* Mini preview — uses the palette's actual tokens, solid colors only */}
            <div className="p-2.5 pb-2 space-y-1.5" style={{ background: tokens['--bg'] }}>
                <div
                    className="h-1 w-8 rounded-full"
                    style={{ background: tokens['--accent'] }}
                />
                <div
                    className="text-[13px] font-bold leading-tight truncate"
                    style={{ color: tokens['--ink'], fontFamily: fontStack }}
                >
                    العنوان
                </div>
                <div
                    className="text-[10px] leading-snug truncate"
                    style={{ color: tokens['--ink-2'], fontFamily: fontStack }}
                >
                    وصف قصير للمنتج
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                    <span
                        className="inline-flex items-center justify-center h-5 px-2 rounded text-[10px] font-semibold"
                        style={{
                            background: tokens['--accent'],
                            color: tokens['--on-primary'],
                        }}
                    >
                        طلب
                    </span>
                    <span
                        className="inline-flex items-center h-5 px-1.5 rounded-full text-[9px] font-medium"
                        style={{
                            background: tokens['--secondary-soft'],
                            color: tokens['--on-secondary'],
                        }}
                    >
                        دفع عند الاستلام
                    </span>
                </div>
            </div>

            {/* Label strip — sits on neutral surface so the label is always legible. */}
            <div className="px-2.5 py-1.5 bg-card border-t border-border flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-foreground truncate">
                    {SOCTIV_PALETTE_LABELS_AR[palette]}
                </span>
                <span
                    className={cn(
                        'inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-bold shrink-0',
                        isDark ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground'
                    )}
                    title={moodLabel}
                >
                    {moodLabel}
                </span>
                {active && (
                    <span
                        className="inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0"
                        style={{
                            background: tokens['--accent'],
                            color: tokens['--on-primary'],
                        }}
                    >
                        <Check className="h-2.5 w-2.5" />
                    </span>
                )}
            </div>
        </button>
    );
}

function FontCard({
    font,
    active,
    onSelect,
}: {
    font: (typeof DEFAULT_SOCTIV_FONTS)[number];
    active: boolean;
    onSelect: () => void;
}) {
    const stack = activeFontStack(font);
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            className={cn(
                'rounded-md border px-2.5 py-2 text-right transition-all',
                active
                    ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                    : 'border-border hover:border-primary/40'
            )}
            style={{ fontFamily: stack }}
        >
            <div
                className={cn(
                    'text-[13px] font-semibold truncate',
                    active ? 'text-foreground' : 'text-foreground/85'
                )}
            >
                {SOCTIV_FONT_LABELS_AR[font]}
            </div>
            <div
                className="text-[10px] text-muted-foreground truncate mt-0.5"
                style={{ direction: 'ltr', fontFamily: stack }}
            >
                Aa أبجد هوز
            </div>
        </button>
    );
}

/** Filter chips at the top of the palette grid — lets the user focus on
 *  a single mood family. Defaults to "الكل". */
function MoodFilter({
    value,
    onChange,
    counts,
}: {
    value: MoodFilter;
    onChange: (next: MoodFilter) => void;
    counts: Record<MoodFilter, number>;
}) {
    const options: { key: MoodFilter; label: string }[] = [
        { key: 'all', label: 'الكل' },
        { key: 'warm', label: SOCTIV_MOOD_LABELS_AR.warm },
        { key: 'light', label: SOCTIV_MOOD_LABELS_AR.light },
        { key: 'dark', label: SOCTIV_MOOD_LABELS_AR.dark },
        { key: 'cool', label: SOCTIV_MOOD_LABELS_AR.cool },
    ];
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
                const active = value === o.key;
                return (
                    <button
                        key={o.key}
                        type="button"
                        onClick={() => onChange(o.key)}
                        className={cn(
                            'inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-semibold transition-colors',
                            active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/70'
                        )}
                    >
                        <span>{o.label}</span>
                        <span
                            className={cn(
                                'inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-bold',
                                active
                                    ? 'bg-primary-foreground/25 text-primary-foreground'
                                    : 'bg-background text-muted-foreground'
                            )}
                        >
                            {counts[o.key]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function ThemeEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const t = config.theme;
    const set = (patch: Partial<SoctivLandingConfig['theme']>) =>
        onChange({ ...config, theme: { ...t, ...patch } });

    const [moodFilter, setMoodFilter] = useState<MoodFilter>('all');

    const { visiblePalettes, moodCounts } = useMemo(() => {
        const all = DEFAULT_SOCTIV_THEME_PALETTES;
        const counts: Record<MoodFilter, number> = {
            all: all.length,
            warm: 0,
            light: 0,
            dark: 0,
            cool: 0,
        };
        all.forEach((p) => {
            const m = SOCTIV_PALETTE_MOOD[p];
            counts[m] += 1;
        });
        const visible =
            moodFilter === 'all'
                ? all
                : all.filter((p) => SOCTIV_PALETTE_MOOD[p] === moodFilter);
        return { visiblePalettes: visible, moodCounts: counts };
    }, [moodFilter]);

    return (
        <div className="space-y-4">
            {/* Palette grid — mood-grouped preview cards */}
            <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <p className="text-xs font-medium">لوحة الألوان</p>
                    <p className="text-[10px] text-muted-foreground">
                        {visiblePalettes.length} من {DEFAULT_SOCTIV_THEME_PALETTES.length}
                    </p>
                </div>
                <MoodFilter
                    value={moodFilter}
                    onChange={setMoodFilter}
                    counts={moodCounts}
                />
                <div className="grid grid-cols-2 gap-2">
                    {visiblePalettes.map((p) => (
                        <PaletteCard
                            key={p}
                            palette={p}
                            active={t.palette === p}
                            activeFont={t.font}
                            onSelect={() => set({ palette: p })}
                        />
                    ))}
                </div>
            </div>

            {/* Font grid — 2 columns, each card shows the name IN that font */}
            <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <p className="text-xs font-medium">الخط</p>
                    <p className="text-[10px] text-muted-foreground">
                        {DEFAULT_SOCTIV_FONTS.length} خطوط
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_SOCTIV_FONTS.map((f) => (
                        <FontCard
                            key={f}
                            font={f}
                            active={t.font === f}
                            onSelect={() => set({ font: f })}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
