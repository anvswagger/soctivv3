/**
 * PublishBar — the minimal top bar of the editor.
 *
 * Contains:
 *   - Back chevron (right side in RTL)
 *   - Editable page title
 *   - Status pill (Live / Draft)
 *   - Live URL pill (the EXTERNAL URL the page is / will be served at).
 *     When published this opens the page in a new tab. Before publish it
 *     shows a one-click "accept suggested subdomain" affordance so the
 *     user never has to leave the bar to set up a clean URL.
 *   - Auto-save indicator (idle / saving / saved / error)
 *   - Refresh preview icon button
 *   - ONE primary "Publish" gradient button
 *
 * Visual hierarchy is enforced through size + color, not noise:
 *   - Publish is the only filled colored button
 *   - Everything else is icon-only or subtle text
 */
import { useState } from 'react';
import {
    ArrowRight,
    Check,
    Copy,
    ExternalLink,
    Globe,
    Loader2,
    RefreshCw,
    Rocket,
    Save,
    Sparkles,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PublishBarProps {
    title: string;
    onTitleChange: (next: string) => void;
    isPublished: boolean;
    publishedUrl: string | null;
    /**
     * The canonical external URL of the live page — what the privacy
     * link in the published footer uses as its base, and what "فتح
     * المنشور" opens. Computed by the editor from
     * (custom_domain → subdomain.soctiv.ly → published_url).
     */
    publishedBaseUrl: string | null;
    autoSaveState: AutoSaveState;
    publishing: boolean;
    onPublish: () => void;
    onRefreshPreview: () => void;
    refreshing?: boolean;
    onBack: () => void;
    /**
     * Phase 6: optional subdomain ("my-brand" → "my-brand.soctiv.ly")
     * and customDomain ("shop.example.com"). When `publishedUrl` is null
     * but `subdomain` is set, we show `${subdomain}.soctiv.ly` as the
     * "active URL" so the user knows what they'll get when they publish.
     * `customDomain` takes precedence when set (after DNS is verified).
     */
    subdomain?: string | null;
    customDomain?: string | null;
    /**
     * Auto-derived subdomain proposal — what we'll save if the user
     * hits the inline "استخدم هذا النطاق" button. Shown only when the
     * row has no subdomain AND no custom_domain yet.
     */
    suggestedSubdomain?: string | null;
    /** Persist the accepted suggestion through the same mutation that
     *  the DomainEditor uses, so React Query invalidation fires and the
     *  whole editor re-renders with the new subdomain. */
    onAcceptSuggestion?: (subdomain: string) => Promise<void> | void;
}

export function PublishBar({
    title,
    onTitleChange,
    isPublished,
    publishedUrl,
    publishedBaseUrl,
    autoSaveState,
    publishing,
    onPublish,
    onRefreshPreview,
    refreshing,
    onBack,
    subdomain,
    customDomain,
    suggestedSubdomain,
    onAcceptSuggestion,
}: PublishBarProps) {
    return (
        <div className="sticky top-0 z-30 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-14 sm:h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            {/* Back */}
            <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                aria-label="رجوع"
                className="shrink-0"
            >
                <ArrowRight className="h-4 w-4" />
            </Button>

            {/* Title + status */}
            <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
                <Input
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="عنوان الصفحة"
                    className="h-9 max-w-[180px] sm:max-w-[280px] bg-transparent border-transparent hover:border-border focus-visible:border-input text-base font-semibold"
                    aria-label="عنوان الصفحة"
                />

                {/* Status pill */}
                <span
                    className={cn(
                        'hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border',
                        isPublished
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                    )}
                >
                    <span
                        className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isPublished ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                        )}
                    />
                    {isPublished ? 'منشور' : 'مسودة'}
                </span>

                {/* Phase 6: live URL — the EXTERNAL URL the page is or will
                    be served at. Click-to-copy + click-to-open. When the
                    page is not yet published AND no subdomain is set, we
                    surface the suggested subdomain as a one-click accept
                    so the user never has to dig into Settings to set a
                    clean URL before publishing. */}
                <LiveUrlPill
                    publishedBaseUrl={publishedBaseUrl}
                    publishedUrl={publishedUrl}
                    isPublished={isPublished}
                    subdomain={subdomain ?? null}
                    customDomain={customDomain ?? null}
                    suggestedSubdomain={suggestedSubdomain ?? null}
                    onAcceptSuggestion={onAcceptSuggestion}
                />

                {/* Auto-save indicator — only show when there's something to say */}
                <div className="hidden md:flex shrink-0 items-center">
                    <AutoSaveIndicator state={autoSaveState} />
                </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-1.5 shrink-0">
                <TooltipProvider delayDuration={300}>
                    {/* View live (only when published) — opens the EXTERNAL
                        URL the privacy link in the page footer uses, not
                        the bare Netlify deploy URL. */}
                    {isPublished && publishedBaseUrl && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                        window.open(publishedBaseUrl, '_blank', 'noopener,noreferrer')
                                    }
                                    aria-label="فتح المنشور"
                                    className="h-9 w-9"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>فتح المنشور</TooltipContent>
                        </Tooltip>
                    )}

                    {/* Refresh preview */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={onRefreshPreview}
                                disabled={refreshing}
                                aria-label="تحديث المعاينة"
                                className="h-9 w-9"
                            >
                                <RefreshCw
                                    className={cn('h-4 w-4', refreshing && 'animate-spin')}
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>تحديث المعاينة</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Primary: Publish */}
                <Button
                    onClick={onPublish}
                    disabled={publishing}
                    className="gap-2 h-9 px-4 bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-extrabold shadow-glow-cyan transform transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {publishing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Rocket className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                        {isPublished ? 'إعادة النشر' : 'نشر'}
                    </span>
                </Button>
            </div>
        </div>
    );
}

/**
 * LiveUrlPill — the visible "where will my page live" element.
 *
 * Three modes:
 *   - published: shows the external URL + copy + open buttons.
 *   - has-subdomain (not yet published): shows the proposed URL + a
 *     "ready to publish" hint.
 *   - no-subdomain yet: shows the auto-derived suggestion as a chip the
 *     user can accept with one click. Once accepted, the chip collapses
 *     into the regular pill.
 *
 * The pill's primary job is to make "this is where my page will be"
 * obvious BEFORE the user clicks Publish — so they never accidentally
 * publish a page to an internal-looking Netlify URL.
 */
function LiveUrlPill({
    publishedBaseUrl,
    publishedUrl,
    isPublished,
    subdomain,
    customDomain,
    suggestedSubdomain,
    onAcceptSuggestion,
}: {
    publishedBaseUrl: string | null;
    publishedUrl: string | null;
    isPublished: boolean;
    subdomain: string | null;
    customDomain: string | null;
    suggestedSubdomain: string | null;
    onAcceptSuggestion?: (subdomain: string) => Promise<void> | void;
}) {
    const [copied, setCopied] = useState<'open' | null>(null);
    const [suggestionState, setSuggestionState] = useState<
        'idle' | 'saving' | 'saved' | 'error'
    >('idle');
    const [dismissed, setDismissed] = useState(false);

    const showSuggestion =
        !subdomain &&
        !customDomain &&
        !isPublished &&
        !!suggestedSubdomain &&
        !dismissed &&
        suggestionState !== 'saved';

    const displayUrl =
        publishedBaseUrl ||
        (customDomain && `https://${customDomain}`) ||
        (subdomain && `https://${subdomain}.soctiv.ly`) ||
        (isPublished && publishedUrl) ||
        null;

    if (!displayUrl && !showSuggestion) return null;

    const copy = (text: string) => {
        try {
            navigator.clipboard.writeText(text).then(() => {
                setCopied('open');
                setTimeout(() => setCopied((c) => (c === 'open' ? null : c)), 1500);
            });
        } catch {
            // clipboard API can be blocked in some browsers; ignore silently
        }
    };

    const acceptSuggestion = async () => {
        if (!suggestedSubdomain || !onAcceptSuggestion) return;
        setSuggestionState('saving');
        try {
            await onAcceptSuggestion(suggestedSubdomain);
            setSuggestionState('saved');
        } catch (e) {
            console.warn('Failed to accept suggested subdomain:', e);
            setSuggestionState('error');
        }
    };

    const cleanUrl = (s: string) => s.replace(/^https?:\/\//, '');

    if (showSuggestion) {
        return (
            <span
                dir="ltr"
                role="group"
                aria-label="اقتراح النطاق الفرعي"
                className="hidden md:inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-brand-cyan/40 bg-brand-cyan/5 px-1.5 py-1 text-[11px]"
            >
                <Sparkles className="h-3 w-3 text-brand-cyan shrink-0" aria-hidden="true" />
                <span className="font-mono text-foreground/90 truncate max-w-[180px]">
                    {suggestedSubdomain}.soctiv.ly
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={acceptSuggestion}
                    disabled={suggestionState === 'saving'}
                    className="h-6 px-2 text-[11px] font-bold text-brand-cyan hover:text-brand-cyan-light"
                    aria-label={`استخدم النطاق ${suggestedSubdomain}.soctiv.ly`}
                >
                    {suggestionState === 'saving' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        'استخدم'
                    )}
                </Button>
                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    aria-label="إخفاء الاقتراح"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/60"
                >
                    <X className="h-3 w-3" />
                </button>
            </span>
        );
    }

    return (
        <span
            dir="ltr"
            role="group"
            aria-label="الرابط النشط"
            className="hidden lg:inline-flex shrink-0 items-center gap-1 rounded-md bg-muted/40 px-1.5 py-1 text-[11px] font-mono text-foreground/90"
        >
            <Globe className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <a
                href={isPublished ? displayUrl : undefined}
                target={isPublished ? '_blank' : undefined}
                rel={isPublished ? 'noopener noreferrer' : undefined}
                title={displayUrl}
                className={cn(
                    'max-w-[180px] truncate',
                    isPublished && 'hover:text-brand-cyan transition-colors'
                )}
            >
                {cleanUrl(displayUrl!)}
            </a>
            <button
                type="button"
                onClick={() => copy(displayUrl!)}
                aria-label="نسخ الرابط"
                className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted"
            >
                {copied === 'open' ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                    <Copy className="h-3 w-3" />
                )}
            </button>
        </span>
    );
}

function AutoSaveIndicator({ state }: { state: AutoSaveState }) {
    if (state === 'idle')
        return (
            <span className="text-[11px] text-muted-foreground/70 inline-flex items-center gap-1.5">
                <Save className="h-3 w-3" />
                لم يُحفظ بعد
            </span>
        );
    if (state === 'saving')
        return (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                جاري الحفظ…
            </span>
        );
    if (state === 'saved')
        return (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                <Check className="h-3 w-3" />
                محفوظ
            </span>
        );
    return (
        <span className="text-[11px] text-destructive inline-flex items-center gap-1.5">
            فشل الحفظ
        </span>
    );
}
