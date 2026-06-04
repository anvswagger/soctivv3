import { Loader2 } from 'lucide-react';

/**
 * Subtle inline loader used as a Suspense fallback for lazy-loaded pages.
 *
 * The previous version painted a full-viewport black overlay with the message
 * "جاري التحميل..." which caused two user-visible problems:
 *   1. Sudden full-screen blackout on every navigation (perceived flicker).
 *   2. Forced a re-layout + blocked paint, especially noticeable on low-end
 *      mobile browsers / Capacitor WebView.
 *
 * This new version renders a small floating indicator in the top-right so the
 * background content stays visible and the transition is smooth.
 */
export function PageLoader() {
    return (
        <div
            role="status"
            aria-label="جاري التحميل"
            className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground shadow-sm border border-border/60 motion-reduce:transition-none"
        >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="hidden sm:inline">جاري التحميل...</span>
        </div>
    );
}
