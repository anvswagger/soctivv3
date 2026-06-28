/**
 * useInlinedGoogleFonts — pre-warm the inlined Google Fonts CSS on mount.
 *
 * The Soctiv landing page links to Google Fonts for 8 curated families
 * (Alexandria, Cairo, Tajawal, …). Inside the editor's `<iframe srcDoc>`
 * preview, the second-hop download to `fonts.gstatic.com` often fails —
 * leaving the page stuck on the system font fallback.
 *
 * This hook fetches the Google Fonts CSS + every woff2 file it references,
 * inlines the binary fonts as base64 data URIs, and caches the result for
 * the rest of the session. After the first call, subsequent calls are
 * instant (module-level cache in `soctivFontInliner`).
 *
 * Usage in a component:
 *   const inlinedFontsCss = useInlinedGoogleFonts();
 *   …
 *   const html = renderSoctivIndexPreview(config, { inlinedGoogleFontsCss: inlinedFontsCss });
 *
 * `inlinedFontsCss` is `null` until the inliner resolves; the renderer
 * gracefully falls back to the external `<link>` in that case.
 */
import { useEffect, useState } from 'react';
import {
    fetchInlinedGoogleFontsCss,
    getCachedInlinedGoogleFontsCss,
} from '@/services/soctivFontInliner';

export function useInlinedGoogleFonts(): string | null {
    const [css, setCss] = useState<string | null>(() =>
        getCachedInlinedGoogleFontsCss()
    );

    useEffect(() => {
        // If we already have the cached version, do nothing.
        if (getCachedInlinedGoogleFontsCss()) {
            setCss(getCachedInlinedGoogleFontsCss());
            return;
        }

        let cancelled = false;
        fetchInlinedGoogleFontsCss()
            .then((inlined) => {
                if (!cancelled) setCss(inlined);
            })
            .catch((e) => {
                // Fall back to the external <link> if the inliner fails
                // (e.g. CORS-blocked CDN, no network, ad-blocker). The
                // preview still works — just with system-font fallback.
                console.warn(
                    '[useInlinedGoogleFonts] inliner failed, falling back to external <link>:',
                    e
                );
                if (!cancelled) setCss(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return css;
}
