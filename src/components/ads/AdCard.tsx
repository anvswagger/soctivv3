/**
 * AdCard — display, edit, save, copy, and delete a single ad.
 *
 * Two modes:
 *  - `preview`: just-generated draft, not yet persisted. Save persists.
 *  - `saved`: persisted ad. Save updates existing row.
 *
 * Editing is fully inline. The Save button enables only when there are
 * local edits (or in preview mode, where saving is the primary action).
 * Each section (hook, body, headline) and the whole script can be copied.
 */
import { useEffect, useMemo, useState } from 'react';
import {
    Check,
    Copy,
    Loader2,
    Save,
    Sparkles,
    Trash2,
    Clock,
    Target,
    Megaphone,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { Ad, GeneratedAdDraft } from '@/types/ads';

type Mode = 'preview' | 'saved';

interface BaseProps {
    mode: Mode;
    /** Angle display name (used as a fallback title when topic is empty). */
    angleName: string;
    /** Duration in seconds — shown in the header. */
    durationSeconds: number;
    /** Called when the user clicks Save. */
    onSave: (changes: { hooks: string[]; copy: string; headline: string }) => Promise<void> | void;
    /** Called when the user wants to discard the unsaved draft. Preview only. */
    onDiscard?: () => void;
    /** Called when the user confirms deletion. Saved only. */
    onDelete?: () => Promise<void> | void;
    /** Mutation pending flag — disables Save/Delete while in flight. */
    isSaving?: boolean;
    isDeleting?: boolean;
}

type PreviewProps = BaseProps & {
    mode: 'preview';
    draft: GeneratedAdDraft;
    /** Not used in preview mode. */
    ad?: never;
};

type SavedProps = BaseProps & {
    mode: 'saved';
    ad: Ad;
    /** Not used in saved mode. */
    draft?: never;
};

export type AdCardProps = PreviewProps | SavedProps;

function countWords(text: string): number {
    const t = text.trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
}

export function AdCard(props: AdCardProps) {
    const { mode, angleName, durationSeconds, onSave, onDiscard, onDelete, isSaving, isDeleting } = props;

    // Source of truth for the editable fields.
    const initial = useMemo(() => {
        if (mode === 'preview') {
            return {
                topic: props.draft.topic,
                hooks: props.draft.hooks,
                copy: props.draft.copy,
                headline: props.draft.headline,
            };
        }
        return {
            topic: props.ad.topic,
            hooks: props.ad.hooks,
            copy: props.ad.copy,
            headline: props.ad.headline,
        };
    }, [mode, props]);

    const isPartial = mode === 'preview' && props.draft.partial;

    const [topic, setTopic] = useState(initial.topic);
    const [hooks, setHooks] = useState<string[]>(initial.hooks);
    const [copy, setCopy] = useState(initial.copy);
    const [headline, setHeadline] = useState(initial.headline);
    const [dirty, setDirty] = useState(false);

    // Reset local state when the source prop changes (e.g. parent re-renders with a new ad).
    useEffect(() => {
        setTopic(initial.topic);
        setHooks(initial.hooks);
        setCopy(initial.copy);
        setHeadline(initial.headline);
        setDirty(false);
    }, [initial.topic, initial.hooks, initial.copy, initial.headline]);

    const updateHook = (idx: number, value: string) => {
        setHooks((prev) => {
            const next = prev.slice();
            next[idx] = value;
            return next;
        });
        setDirty(true);
    };

    const handleCopyScript = () => {
        const text = formatScriptForClipboard({ topic, hooks, copy, headline });
        void copyToClipboard(text, 'تم نسخ السكربت كاملاً');
    };

    const canSave = mode === 'preview' || dirty;
    const wordCount = countWords(copy);

    return (
        <Card
            className="overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md"
            dir="rtl"
        >
            {/* Accent strip */}
            <div className="h-1 w-full bg-gradient-to-l from-primary via-primary/70 to-primary/30" />

            <CardHeader className="space-y-3 bg-gradient-to-b from-muted/30 to-transparent pb-4">
                <Input
                    value={topic}
                    onChange={(e) => {
                        setTopic(e.target.value);
                        setDirty(true);
                    }}
                    placeholder="موضوع الإعلان (topic)"
                    className="h-auto border-transparent bg-transparent px-0 text-lg font-bold tracking-tight shadow-none hover:border-input focus-visible:ring-0 sm:text-xl"
                    aria-label="موضوع الإعلان"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1 font-normal">
                        <Clock className="h-3 w-3" />
                        {durationSeconds} ثانية
                    </Badge>
                    <Badge variant="outline" className="gap-1 font-normal">
                        <Target className="h-3 w-3" />
                        {angleName}
                    </Badge>
                    {mode === 'preview' ? (
                        <Badge className="gap-1 font-normal">
                            <Sparkles className="h-3 w-3" />
                            مسودة جديدة
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="gap-1 font-normal text-emerald-700 dark:text-emerald-300">
                            <Check className="h-3 w-3" />
                            محفوظ
                        </Badge>
                    )}
                </div>

                {isPartial && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="leading-relaxed">
                            وصل الإخراج بتنسيق غير مكتمل — بعض الحقول قد تكون فارغة. راجع السكربت قبل الحفظ.
                        </span>
                    </div>
                )}
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Hooks */}
                <Section title="الهوكات" badge={`${hooks.filter((h) => h.trim()).length}/5`}>
                    <div className="grid gap-2">
                        {hooks.map((hook, i) => (
                            <div key={i} className="group flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                                    {i + 1}
                                </span>
                                <Input
                                    value={hook}
                                    onChange={(e) => updateHook(i, e.target.value)}
                                    placeholder={`هوك ${i + 1} — جملة قصيرة توقف السكرول`}
                                    dir="rtl"
                                    className="h-10 bg-muted/20"
                                />
                                <CopyIconButton
                                    text={hook}
                                    label={`نسخ الهوك ${i + 1}`}
                                    className="opacity-0 transition-opacity group-hover:opacity-100"
                                />
                            </div>
                        ))}
                    </div>
                </Section>

                {/* Body */}
                <Section
                    title="السكربت"
                    badge={`${wordCount} كلمة`}
                    action={<CopyIconButton text={copy} label="نسخ السكربت" />}
                >
                    <Textarea
                        value={copy}
                        onChange={(e) => {
                            setCopy(e.target.value);
                            setDirty(true);
                        }}
                        placeholder="نص السكربت — جُمل قصيرة، مفهومة، لهجة مصراتية"
                        dir="rtl"
                        className={cn(
                            'min-h-[200px] resize-y rounded-xl border-border/60 bg-muted/20 text-[15px] leading-loose',
                            'whitespace-pre-wrap',
                        )}
                    />
                </Section>

                {/* Headline */}
                <Section title="العنوان" action={<CopyIconButton text={headline} label="نسخ العنوان" />}>
                    <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 shrink-0 text-primary" />
                        <Input
                            value={headline}
                            onChange={(e) => {
                                setHeadline(e.target.value);
                                setDirty(true);
                            }}
                            placeholder="عنوان قصير وجذّاب"
                            dir="rtl"
                            className="h-11 bg-primary/[0.03] font-semibold"
                        />
                    </div>
                </Section>
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 bg-muted/20 pt-4">
                {mode === 'preview' && onDiscard && (
                    <Button variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving}>
                        تجاهل
                    </Button>
                )}

                {mode === 'saved' && onDelete && (
                    <DeleteButton onDelete={onDelete} isDeleting={!!isDeleting} />
                )}

                <div className="flex-1" />

                <Button variant="outline" size="sm" onClick={handleCopyScript} className="gap-2">
                    <Copy className="h-4 w-4" />
                    نسخ الكل
                </Button>

                <Button
                    size="sm"
                    onClick={() => onSave({ hooks, copy, headline })}
                    disabled={!canSave || !!isSaving}
                    aria-disabled={!canSave || !!isSaving}
                    className="gap-2"
                >
                    {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {mode === 'preview' ? 'حفظ في المكتبة' : 'حفظ التعديلات'}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ─── Section wrapper ─────────────────────────────────────────────────────

interface SectionProps {
    title: string;
    badge?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

function Section({ title, badge, action, children }: SectionProps) {
    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground/90">{title}</span>
                    {badge && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                            {badge}
                        </span>
                    )}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

// ─── Copy helpers ────────────────────────────────────────────────────────

async function copyToClipboard(text: string, successMsg: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(successMsg);
        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('فشل النسخ', { description: msg });
        return false;
    }
}

interface CopyIconButtonProps {
    text: string;
    label: string;
    className?: string;
}

function CopyIconButton({ text, label, className }: CopyIconButtonProps) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        if (!text.trim()) return;
        const ok = await copyToClipboard(text, 'تم النسخ');
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground', className)}
            onClick={handle}
            aria-label={label}
            title={label}
            disabled={!text.trim()}
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
    );
}

// ─── Delete confirmation ─────────────────────────────────────────────────

interface DeleteButtonProps {
    onDelete: () => Promise<void> | void;
    isDeleting: boolean;
}

function DeleteButton({ onDelete, isDeleting }: DeleteButtonProps) {
    const [open, setOpen] = useState(false);
    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isDeleting}
                >
                    {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Trash2 className="h-4 w-4" />
                    )}
                    حذف
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>حذف الإعلان؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف هذا الإعلان نهائياً من المكتبة. لا يمكن التراجع.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            setOpen(false);
                            void onDelete();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        حذف نهائي
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ─── Formatters ───────────────────────────────────────────────────────────

interface ClipboardShape {
    topic: string;
    hooks: string[];
    copy: string;
    headline: string;
}

export function formatScriptForClipboard(s: ClipboardShape): string {
    const lines: string[] = [];
    if (s.topic.trim()) {
        lines.push(s.topic.trim());
        lines.push('');
    }
    s.hooks.forEach((hook, i) => {
        lines.push(`Hook ${i + 1}: ${hook.trim()}`);
    });
    lines.push('');
    lines.push('COPY:');
    lines.push(s.copy.trim());
    lines.push('');
    lines.push(`Headline: ${s.headline.trim()}`);
    return lines.join('\n');
}
