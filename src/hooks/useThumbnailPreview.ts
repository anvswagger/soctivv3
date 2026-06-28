/**
 * useThumbnailPreview — render a tiny HTML preview of a landing page config.
 *
 * Reuses `renderSoctivIndexPreview` from the editor's preview service.
 * Returns the rendered HTML string (or empty string while the first frame
 * is being computed). Result is memoized by `cacheKey`.
 *
 * The HTML is fed to a small hidden iframe in `MiniPreview.tsx`.
 */
import { useEffect, useState } from 'react';
import { renderSoctivIndexPreview } from '@/services/soctivLandingPreview';
import { useInlinedGoogleFonts } from '@/hooks/useInlinedGoogleFonts';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

export interface UseThumbnailPreviewOptions {
    /** When true, skip rendering and return empty string immediately. */
    disabled?: boolean;
}

export function useThumbnailPreview(
    config: SoctivLandingConfig | null | undefined,
    options: UseThumbnailPreviewOptions = {}
): string {
    const [html, setHtml] = useState<string>('');
    const inlinedGoogleFontsCss = useInlinedGoogleFonts();

    useEffect(() => {
        if (options.disabled || !config) {
            setHtml('');
            return;
        }
        let cancelled = false;
        // Render in next microtask to keep typing snappy
        Promise.resolve().then(() => {
            if (cancelled) return;
            try {
                const out = renderSoctivIndexPreview(config, {
                    supabaseUrl:
                        (import.meta as any).env?.VITE_SUPABASE_URL || '',
                    year: '2026',
                    inlinedGoogleFontsCss,
                });
                if (!cancelled) setHtml(out);
            } catch (e) {
                // Render failures are non-fatal — the thumbnail just shows the placeholder.
                console.warn('[useThumbnailPreview] render failed', e);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [config, options.disabled, inlinedGoogleFontsCss]);

    return html;
}
