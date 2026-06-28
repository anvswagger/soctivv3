/**
 * SectionPanel — a single editable section in the editor's settings panel.
 *
 * Replaces the old `SectionCard`:
 *   - No more `window.prompt` for regenerate guidance.
 *   - Clicking the sparkle button reveals an inline `<Textarea>` for
 *     guidance + Regenerate / Cancel buttons inside the panel header.
 *   - Cleaner visual hierarchy: title is bold, the regenerate icon is
 *     subtle (only highlights on hover), and the chevron indicator is
 *     minimal.
 *   - Body is the existing editable fields — unchanged.
 *
 * Optional `sectionKey` lets the parent `SettingsTabs` track which
 * sections are open across tab switches (kept in parent state).
 */
import { ReactNode, useState } from 'react';
import { ChevronDown, Loader2, Sparkles, X, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface SectionPanelProps {
    title: string;
    description?: string;
    /** Whether this section can be regenerated with AI. */
    regenerable?: boolean;
    regenerating?: boolean;
    /** Triggered when the user submits the guidance form. */
    onRegenerate?: (guidance: string) => void | Promise<void>;
    children: ReactNode;
    defaultOpen?: boolean;
    /** When true, render a more compact header (for secondary panels). */
    compact?: boolean;
    className?: string;
}

export function SectionPanel({
    title,
    description,
    regenerable = false,
    regenerating = false,
    onRegenerate,
    children,
    defaultOpen = true,
    compact = false,
    className,
}: SectionPanelProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [guidanceOpen, setGuidanceOpen] = useState(false);
    const [guidance, setGuidance] = useState('');

    const handleRegenerateClick = () => {
        if (guidanceOpen) {
            // Already open — second click regenerates with current text.
            if (onRegenerate) onRegenerate(guidance.trim());
        } else {
            setGuidance('');
            setGuidanceOpen(true);
        }
    };

    const handleCancel = () => {
        setGuidanceOpen(false);
        setGuidance('');
    };

    const handleSubmit = () => {
        if (onRegenerate) onRegenerate(guidance.trim());
    };

    return (
        <section
            className={cn(
                'rounded-xl border border-border bg-card text-card-foreground overflow-hidden',
                'transition-shadow',
                open && 'shadow-sm',
                className
            )}
        >
            {/* Header */}
            <header
                className={cn(
                    'flex items-start gap-2 px-4 py-3',
                    compact ? 'bg-muted/20' : 'bg-muted/30'
                )}
            >
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="flex-1 flex items-center gap-2 text-start hover:opacity-80 transition-opacity min-w-0"
                    aria-expanded={open}
                >
                    <ChevronDown
                        className={cn(
                            'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                            !open && '-rotate-90'
                        )}
                    />
                    <div className="flex-1 min-w-0">
                        <h3
                            className={cn(
                                'font-semibold leading-tight truncate',
                                compact ? 'text-sm' : 'text-[15px]'
                            )}
                        >
                            {title}
                        </h3>
                        {description && open && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {description}
                            </p>
                        )}
                    </div>
                </button>

                {regenerable && onRegenerate && (
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={handleRegenerateClick}
                                    disabled={regenerating}
                                    aria-label={`إعادة توليد ${title}`}
                                    className={cn(
                                        'shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md',
                                        'text-muted-foreground hover:text-brand-cyan hover:bg-brand-cyan/10',
                                        'transition-colors',
                                        guidanceOpen &&
                                            'text-brand-cyan bg-brand-cyan/10',
                                        regenerating && 'opacity-50'
                                    )}
                                >
                                    {regenerating ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                <p>إعادة توليد بالذكاء الاصطناعي</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </header>

            {/* Inline guidance input — slides down below the header. */}
            {guidanceOpen && (
                <div className="px-4 py-3 border-t border-border bg-brand-cyan/5 animate-in slide-in-from-top-1 fade-in duration-200">
                    <div className="flex items-start gap-2">
                        <Wand2 className="h-4 w-4 text-brand-cyan shrink-0 mt-2.5" />
                        <div className="flex-1 space-y-2">
                            <Textarea
                                value={guidance}
                                onChange={(e) => setGuidance(e.target.value)}
                                placeholder="إرشادات اختيارية (مثال: اجعلها أكثر عاطفية، ركّز على النساء فوق 30)"
                                rows={2}
                                className="text-sm bg-background/80 border-brand-cyan/30 focus-visible:ring-brand-cyan/40"
                                autoFocus
                                dir="auto"
                            />
                            <div className="flex items-center gap-2 justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancel}
                                    className="h-7 px-2.5 text-xs"
                                >
                                    <X className="h-3 w-3 ml-1" />
                                    إلغاء
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSubmit}
                                    disabled={regenerating}
                                    className="h-7 px-3 text-xs gap-1 bg-brand-cyan text-brand-darker hover:bg-brand-cyan-light font-bold"
                                >
                                    {regenerating ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-3 w-3" />
                                    )}
                                    إعادة توليد
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Body */}
            {open && (
                <div
                    className={cn(
                        'px-4 py-4 space-y-3 border-t border-border',
                        compact && 'py-3 space-y-2'
                    )}
                >
                    {children}
                </div>
            )}
        </section>
    );
}
