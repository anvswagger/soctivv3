/**
 * PreviewPane — full-height live iframe preview of the landing page.
 *
 * Sandboxed iframe with a viewport switcher (desktop / tablet / mobile).
 * Updates as the user edits (parent passes the rendered HTML + mount key).
 *
 * The viewport switcher just changes the iframe CSS width; the rendered
 * HTML is responsive, so the same `srcDoc` is used at all sizes.
 *
 * Lead-creation channel: the in-iframe runtime (client_runtime.js) posts
 * messages back to the parent whenever a form submit succeeds or fails.
 * We listen on `window.message` and forward the events via the
 * `onLeadCreated` / `onLeadFailed` props so the editor can show a toast
 * and navigate to the leads pipeline.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
    desktop: '100%',
    tablet: '768px',
    mobile: '390px',
};

export interface PreviewLeadCreatedPayload {
    leadId: string | null;
    orderId: string;
}

export interface PreviewLeadFailedPayload {
    reason: 'network' | 'timeout' | 'http_error' | 'rate_limited' | string;
    status?: number;
    orderId: string;
    body?: string;
}

interface PreviewPaneProps {
    html: string;
    iframeMountKey: string;
    loading?: boolean;
    title?: string;
    onLeadCreated?: (payload: PreviewLeadCreatedPayload) => void;
    onLeadFailed?: (payload: PreviewLeadFailedPayload) => void;
}

export function PreviewPane({
    html,
    iframeMountKey,
    loading,
    title = 'معاينة صفحة الهبوط',
    onLeadCreated,
    onLeadFailed,
}: PreviewPaneProps) {
    const [viewport, setViewport] = useState<ViewportSize>('desktop');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Listen for postMessage events from the in-iframe runtime. We
    // validate that the event source is OUR iframe (not a random cross-
    // origin message from elsewhere on the page), and then dispatch to the
    // matching callback. The `type` discriminator is namespaced under
    // `soctiv:*` so it can't collide with other extensions or libraries
    // posting messages on the same window.
    useEffect(() => {
        function onMessage(e: MessageEvent) {
            // `about:srcdoc` iframes report `null` as `e.origin` but the
            // `source` reference is still reliable. Comparing `source` to
            // our iframe's contentWindow is stricter than origin alone.
            if (!iframeRef.current) return;
            if (e.source !== iframeRef.current.contentWindow) return;
            const data = e.data as { type?: string; [k: string]: unknown } | null;
            if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
            if (data.type === 'soctiv:lead-created') {
                onLeadCreated?.({
                    leadId: (data.leadId as string | null) ?? null,
                    orderId: String(data.orderId || ''),
                });
            } else if (data.type === 'soctiv:lead-failed') {
                onLeadFailed?.({
                    reason: String(data.reason || 'unknown'),
                    status: typeof data.status === 'number' ? data.status : undefined,
                    orderId: String(data.orderId || ''),
                    body: typeof data.body === 'string' ? data.body : undefined,
                });
            }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [onLeadCreated, onLeadFailed]);

    return (
        <div className="relative h-full w-full flex flex-col bg-muted/30 overflow-hidden">
            {/* Viewport switcher — top-right floating control */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 rounded-full border border-border bg-background/90 backdrop-blur px-1.5 py-1 shadow-sm">
                <ViewportButton
                    active={viewport === 'desktop'}
                    onClick={() => setViewport('desktop')}
                    label="Desktop"
                    icon={<Monitor className="h-3.5 w-3.5" />}
                />
                <ViewportButton
                    active={viewport === 'tablet'}
                    onClick={() => setViewport('tablet')}
                    label="Tablet"
                    icon={<Tablet className="h-3.5 w-3.5" />}
                />
                <ViewportButton
                    active={viewport === 'mobile'}
                    onClick={() => setViewport('mobile')}
                    label="Mobile"
                    icon={<Smartphone className="h-3.5 w-3.5" />}
                />
            </div>

            {/* Iframe area */}
            <div className="flex-1 overflow-auto p-3 sm:p-6 flex items-start justify-center">
                {html ? (
                    <div
                        className={cn(
                            'relative bg-white rounded-lg shadow-2xl mx-auto transition-all duration-300',
                            viewport === 'desktop' && 'w-full',
                            viewport !== 'desktop' && 'border border-border/60'
                        )}
                        style={{
                            width: VIEWPORT_WIDTHS[viewport],
                            maxWidth: '100%',
                            minHeight: viewport === 'mobile' ? 700 : viewport === 'tablet' ? 900 : 1100,
                        }}
                    >
                        <iframe
                            ref={iframeRef}
                            key={iframeMountKey}
                            srcDoc={html}
                            title={title}
                            sandbox="allow-scripts allow-forms allow-same-origin"
                            className="w-full bg-white rounded-lg border-0 block"
                            style={{
                                height:
                                    viewport === 'mobile'
                                        ? '700px'
                                        : viewport === 'tablet'
                                          ? '900px'
                                          : '1100px',
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
                        {loading !== false && (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                جاري بناء المعاينة…
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ViewportButton({
    active,
    onClick,
    label,
    icon,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
            className={cn(
                'inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
        >
            {icon}
        </button>
    );
}