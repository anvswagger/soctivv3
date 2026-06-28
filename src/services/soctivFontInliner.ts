/**
 * soctivFontInliner — fetch Google Fonts CSS + font files, convert to base64
 * data URIs, and return a self-contained `<style>` block.
 *
 * Why this exists:
 *   The editor preview uses `<iframe srcDoc>` to render the landing page.
 *   srcDoc iframes have a unique origin (`about:srcdoc`) and some browsers
 *   / network layers block the second-hop download to `fonts.gstatic.com`
 *   even when the CSS file from `fonts.googleapis.com` returns 200. The
 *   visible result: the body falls back to "Times New Roman" / system
 *   fonts instead of the user-picked font (Alexandria, Cairo, …).
 *
 *   The robust fix: when we render the preview in the editor, we fetch the
 *   Google Fonts CSS + every woff2 file it references, base64-encode them,
 *   and inline the result as a `<style>` block. The preview iframe is then
 *   fully self-contained — no external font download needed.
 *
 *   On the PUBLISHED page (edge function), the same `<link>` to Google
 *   Fonts stays in place — published pages aren't sandboxed in iframes and
 *   download fonts normally.
 *
 * Caching: the response is cached in module scope. Re-renders during a
 * single editor session reuse the same inlined CSS — no extra network.
 */

const GOOGLE_FONTS_URL =
    'https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&family=Noto+Sans+Arabic:wght@300;400;500;600;700;800&family=Readex+Pro:wght@300;400;500;600;700&family=Almarai:wght@300;400;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap';

let cachedCss: string | null = null;
let inflight: Promise<string | null> | null = null;

/** Convert a woff/woff2 binary to a base64 data URI string. */
async function toDataUri(url: string, formatHint: string): Promise<string> {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`font fetch failed: ${url} → ${res.status}`);
    const buf = await res.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    // Google Fonts CSS declares the format already (e.g. "woff2"); we still
    // pass through whatever the upstream said so a future format change
    // (woff3, …) keeps working.
    return `data:font/${formatHint};base64,${b64}`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
    // Chunked to avoid call-stack overflow on large woff2 files (~50-150 KB each).
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + CHUNK))
        );
    }
    return btoa(binary);
}

/** Fetch the Google Fonts CSS, rewrite all `url(https://fonts.gstatic.com/…)`
 *  references to data: URIs, return the inlined CSS string. */
export async function fetchInlinedGoogleFontsCss(
    googleFontsUrl: string = GOOGLE_FONTS_URL
): Promise<string> {
    if (cachedCss) return cachedCss;
    if (inflight) return inflight;

    inflight = (async () => {
        // Google Fonts serves different CSS depending on the user-agent (e.g.
        // older browsers get woff, modern browsers get woff2). We must send
        // a browser-like UA so the response contains woff2 URLs we can
        // download and inline.
        const cssRes = await fetch(googleFontsUrl, {
            headers: {
                // Pretend to be a real browser so Google serves the woff2 list
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
        if (!cssRes.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
        const cssText = await cssRes.text();

        // Extract all `url(https://fonts.gstatic.com/...woff2)` references
        // and the format hint that immediately precedes each one.
        const urlRe = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s+format\('([^']+)'\)/g;
        const urls: { url: string; format: string }[] = [];
        let m: RegExpExecArray | null;
        while ((m = urlRe.exec(cssText)) !== null) {
            urls.push({ url: m[1], format: m[2] });
        }

        // Dedupe (the same font file can appear in multiple @font-face rules)
        const unique = new Map<string, string>(); // url → dataUri
        await Promise.all(
            urls.map(async ({ url, format }) => {
                try {
                    const dataUri = await toDataUri(url, format);
                    unique.set(url, dataUri);
                } catch (e) {
                    // Swallow single-file failures — the CSS will still load
                    // for the families that did succeed. Surfacing in console
                    // helps debug persistent CORS / CSP issues.
                    console.warn('[soctivFontInliner] failed to inline', url, e);
                }
            })
        );

        // Rewrite the CSS: replace each gstatic URL with its data URI.
        let inlined = cssText;
        unique.forEach((dataUri, url) => {
            inlined = inlined.split(url).join(dataUri);
        });

        cachedCss = inlined;
        return inlined;
    })().finally(() => {
        inflight = null;
    });

    return inflight;
}

/** Returns the cached inlined CSS, or null if not yet fetched. Use this
 *  in render code paths that should NOT block the first paint. */
export function getCachedInlinedGoogleFontsCss(): string | null {
    return cachedCss;
}
