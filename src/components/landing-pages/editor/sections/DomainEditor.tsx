/**
 * DomainEditor — Phase 6: subdomain + custom domain management UI.
 *
 * Lives in the Setup tab. Lets the user:
 *   - Set / change the soctiv.ly subdomain (auto-derived from the brand
 *     slug the first time, editable thereafter).
 *   - Set / change a custom domain (e.g. shop.example.com).
 *   - See the live status pill: not configured → on soctiv.ly → awaiting
 *     DNS → active.
 *
 * Saving is a narrow PATCH to `landing_pages.subdomain` /
 * `landing_pages.custom_domain` via the `onSaveDomain` callback. We do
 * NOT trigger AI regen or rewrite the config — this is a pure hosting
 * concern and should never disturb the user's content work.
 *
 * DNS verification is marked TODO. The status pill honestly reflects
 * "manual check pending" so the user is not misled.
 */
import { useEffect, useState } from 'react';
import { Copy, Globe, Loader2 } from 'lucide-react';
import { Field } from '../fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SUBDOMAIN_BASE = 'soctiv.ly';
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const DOMAIN_RE =
    /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface DomainEditorProps {
    subdomain: string | null;
    customDomain: string | null;
    /** True if the row has been published at least once. */
    isPublished: boolean;
    /** True while the parent mutation is in-flight (disabled). */
    saving?: boolean;
    /** Called debounced with the latest values when the user edits a field. */
    onSaveDomain: (next: { subdomain: string; customDomain: string }) => Promise<void> | void;
}

function isValidSubdomain(s: string): boolean {
    return SUBDOMAIN_RE.test(s);
}

function isValidDomain(s: string): boolean {
    return DOMAIN_RE.test(s);
}

export function DomainEditor({
    subdomain,
    customDomain,
    isPublished,
    saving,
    onSaveDomain,
}: DomainEditorProps) {
    // Local controlled state — keep the parent's value as the source of
    // truth on mount, then own edits locally and debounce-save on change.
    const [sub, setSub] = useState<string>(subdomain ?? '');
    const [custom, setCustom] = useState<string>(customDomain ?? '');
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [copied, setCopied] = useState<'sub' | 'custom' | null>(null);

    // Re-sync if the parent flips (e.g. fetch refetch, navigation away).
    useEffect(() => setSub(subdomain ?? ''), [subdomain]);
    useEffect(() => setCustom(customDomain ?? ''), [customDomain]);

    // Debounced autosave — 800 ms mirrors the config autosave so a user
    // typing in this tab sees consistent UX.
    useEffect(() => {
        if (sub === (subdomain ?? '') && custom === (customDomain ?? '')) return;
        // Don't save if either field is non-empty AND invalid.
        if (sub.length > 0 && !isValidSubdomain(sub)) return;
        if (custom.length > 0 && !isValidDomain(custom)) return;
        const t = setTimeout(async () => {
            setSaveState('saving');
            try {
                await onSaveDomain({ subdomain: sub, customDomain: custom });
                setSaveState('saved');
            } catch (e) {
                setSaveState('error');
            }
        }, 800);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sub, custom]);

    const subValid = sub.length === 0 || isValidSubdomain(sub);
    const customValid = custom.length === 0 || isValidDomain(custom);
    const fullSubUrl = sub ? `https://${sub}.${SUBDOMAIN_BASE}` : null;
    const fullCustomUrl = custom ? `https://${custom}` : null;

    // Status pill — honest about verification gaps.
    let status: { label: string; tone: 'muted' | 'sky' | 'amber' | 'emerald' };
    if (!isPublished) {
        status = { label: 'لم تنشر بعد', tone: 'muted' };
    } else if (custom && isValidDomain(custom)) {
        status = { label: 'بانتظار التحقق من DNS (يدوي حالياً)', tone: 'amber' };
    } else if (sub && isValidSubdomain(sub)) {
        status = { label: `متاح على ${sub}.${SUBDOMAIN_BASE}`, tone: 'emerald' };
    } else {
        status = { label: 'لم يتم الإعداد بعد', tone: 'muted' };
    }

    const copy = (text: string, which: 'sub' | 'custom') => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(which);
            setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
        });
    };

    return (
        <div className="space-y-4">
            {/* Status pill */}
            <div
                className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                    status.tone === 'emerald' &&
                        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                    status.tone === 'sky' &&
                        'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
                    status.tone === 'amber' &&
                        'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
                    status.tone === 'muted' &&
                        'bg-muted text-muted-foreground border-border'
                )}
                role="status"
                aria-live="polite"
            >
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="font-medium">{status.label}</span>
                {saving && (
                    <Loader2 className="h-3 w-3 animate-spin mr-auto opacity-60" />
                )}
            </div>

            {/* Subdomain */}
            <div className="space-y-2">
                <Field
                    label="نطاق فرعي على soctiv.ly"
                    hint={
                        subValid
                            ? 'أحرف لاتينية صغيرة، أرقام، وشرطات فقط. 2-32 حرفاً.'
                            : 'صيغة غير صالحة — أحرف صغيرة وأرقام وشرطات فقط.'
                    }
                    value={sub}
                    onChange={(e) =>
                        setSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }
                    placeholder="my-brand"
                    dir="ltr"
                    inputMode="text"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(
                        !subValid &&
                            'border-destructive focus-visible:ring-destructive/40'
                    )}
                />
                {fullSubUrl && (
                    <div className="flex items-center gap-2 text-xs">
                        <code
                            dir="ltr"
                            className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono"
                        >
                            {fullSubUrl}
                        </code>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="نسخ الرابط"
                            onClick={() => copy(fullSubUrl, 'sub')}
                        >
                            {copied === 'sub' ? '✓' : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                )}
            </div>

            {/* Custom domain */}
            <div className="space-y-2">
                <Field
                    label="نطاق مخصص (اختياري)"
                    hint={
                        customValid
                            ? 'مثال: shop.example.com — أضف سجل CNAME يشير إلى proxy.soctiv.ly بعد النشر.'
                            : 'صيغة نطاق غير صالحة (مثال: shop.example.com).'
                    }
                    value={custom}
                    onChange={(e) => setCustom(e.target.value.trim().toLowerCase())}
                    placeholder="shop.example.com"
                    dir="ltr"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(
                        !customValid &&
                            'border-destructive focus-visible:ring-destructive/40'
                    )}
                />
                {fullCustomUrl && customValid && (
                    <div className="flex items-center gap-2 text-xs">
                        <code
                            dir="ltr"
                            className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono"
                        >
                            {fullCustomUrl}
                        </code>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="نسخ الرابط"
                            onClick={() => copy(fullCustomUrl, 'custom')}
                        >
                            {copied === 'custom' ? '✓' : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                )}
            </div>

            {/* CNAME instructions — read-only block, only when custom is set */}
            {custom && customValid && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <p className="text-xs font-medium">خطوات ربط النطاق المخصص</p>
                    <ol
                        dir="ltr"
                        className="text-[11px] text-muted-foreground space-y-1 list-decimal pl-5"
                    >
                        <li>
                            Add a <strong>CNAME</strong> record for{' '}
                            <code className="font-mono">{custom}</code> pointing
                            to{' '}
                            <code className="font-mono">proxy.soctiv.ly</code>.
                        </li>
                        <li>
                            Wait for DNS propagation (usually &lt; 1 hour, can
                            take up to 24 hours).
                        </li>
                        <li>
                            Click <strong>نشر</strong> above — we'll publish
                            to <code className="font-mono">{custom}</code>{' '}
                            once DNS resolves.
                        </li>
                    </ol>
                    <p className="text-[10px] text-muted-foreground/80 pt-1">
                        التحقق التلقائي من DNS قيد التطوير — نتأكد يدوياً
                        حالياً.
                    </p>
                </div>
            )}

            {/* Save state indicator — only when actively saving or just saved */}
            {(saveState === 'saving' || saveState === 'saved' || saveState === 'error') && (
                <p
                    className={cn(
                        'text-[10px]',
                        saveState === 'saving' && 'text-muted-foreground',
                        saveState === 'saved' && 'text-emerald-600',
                        saveState === 'error' && 'text-destructive'
                    )}
                >
                    {saveState === 'saving' && 'جاري الحفظ…'}
                    {saveState === 'saved' && 'تم الحفظ'}
                    {saveState === 'error' && 'فشل الحفظ — أعد المحاولة'}
                </p>
            )}

            {/* Quietly render an empty Input with id so screen readers can
                find a labeled region for this whole card if needed in
                future; harmless now. */}
            <Input className="sr-only" aria-hidden tabIndex={-1} readOnly />
        </div>
    );
}
