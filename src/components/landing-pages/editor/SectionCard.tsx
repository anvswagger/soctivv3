/**
 * SectionCard — a single editable section in the right pane of the editor.
 *
 * Header: title + AI regenerate button. Children are the editable fields.
 */
import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SectionCardProps {
    title: string;
    description?: string;
    regenerating?: boolean;
    onRegenerate?: () => void;
    /** When true, a "Regenerate" button is rendered that prompts for guidance
     *  before invoking onRegenerate(guidance). */
    onRegenerateWithGuidance?: (guidance: string) => void;
    children: ReactNode;
    defaultOpen?: boolean;
    /** Compact header for less prominent sections. */
    compact?: boolean;
}

export function SectionCard({
    title,
    description,
    regenerating,
    onRegenerate,
    onRegenerateWithGuidance,
    children,
    defaultOpen = true,
    compact = false,
}: SectionCardProps) {
    const [open, setOpen] = useState(defaultOpen);

    const handleRegenerate = () => {
        if (!onRegenerateWithGuidance) {
            onRegenerate?.();
            return;
        }
        const guidance = window.prompt(
            `إرشادات اختيارية لإعادة توليد "${title}":\n\n(مثال: اجعلها أكثر عاطفية، ركز على النساء فوق 30...)`,
            ''
        );
        if (guidance === null) return; // user cancelled
        onRegenerateWithGuidance(guidance);
    };

    return (
        <div
            className={cn(
                'rounded-lg border bg-card text-card-foreground shadow-sm',
                compact ? 'p-0' : 'p-0'
            )}
        >
            <div
                className={cn(
                    'flex items-center gap-2 px-4 py-3 border-b',
                    compact ? 'bg-muted/30' : 'bg-muted/20'
                )}
            >
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="flex-1 flex items-center gap-2 text-start hover:opacity-80 transition-opacity"
                    aria-expanded={open}
                >
                    <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
                        {title}
                    </h3>
                    {open ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                </button>
                {(onRegenerate || onRegenerateWithGuidance) && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                    >
                        {regenerating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>إعادة توليد</span>
                    </Button>
                )}
            </div>
            {description && open && (
                <p className="px-4 pt-3 text-xs text-muted-foreground">{description}</p>
            )}
            {open && <div className={cn('p-4 space-y-3', compact && 'space-y-2')}>{children}</div>}
        </div>
    );
}
