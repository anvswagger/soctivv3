/**
 * TrustEditor — 3 trust badges (above the form) + 2 short row chips (below submit).
 * Matches the new Soctiv HTML trust strip and `.trust-row` under submit button.
 *
 * Phase 5: each strip has its own show/hide toggle. The Phase-4 shape
 * was a flat `string[]` for each strip; the new shape is
 * `{ enabled, items }`. We accept BOTH so the editor works on legacy
 * DB rows that haven't been migrated, AND so the AI service can keep
 * writing the old shape if it wants to.
 */
import { Field } from '../fields';
import { Switch } from '@/components/ui/switch';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

type Strip = { enabled: boolean; items: string[] };

/** Coerce any input (Phase-4 `string[]` or Phase-5 strip object) into
 *  the canonical strip. Used by the editor to read the user's items
 *  regardless of what shape the DB row has today. */
function toStrip(v: unknown): Strip {
    if (Array.isArray(v)) return { enabled: true, items: v as string[] };
    const obj = (v && typeof v === 'object' ? v : {}) as Partial<Strip>;
    return {
        enabled: obj.enabled !== false,
        items: Array.isArray(obj.items) ? obj.items : [],
    };
}

export function TrustEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const t = config.trust;
    const badgesStrip = toStrip(t.badges);
    const rowStrip = toStrip(t.row);

    // Always write the canonical (Phase-5) shape back so the DB migrates
    // to the new shape the moment the user touches any field.
    const setBadges = (next: Partial<Strip>) =>
        onChange({ ...config, trust: { ...t, badges: { ...badgesStrip, ...next } } });
    const setRow = (next: Partial<Strip>) =>
        onChange({ ...config, trust: { ...t, row: { ...rowStrip, ...next } } });

    const updateBadge = (i: number, value: string) => {
        const items = badgesStrip.items.map((b, idx) => (idx === i ? value : b));
        setBadges({ items });
    };
    const updateRow = (i: number, value: string) => {
        const items = rowStrip.items.map((b, idx) => (idx === i ? value : b));
        setRow({ items });
    };

    return (
        <div className="space-y-3">
            {/* Badges strip */}
            <div className="rounded-md border bg-muted/10 p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <p className="text-xs font-medium">شارات أعلى النموذج (3)</p>
                        <p className="text-[10px] text-muted-foreground">
                            {badgesStrip.enabled ? 'تظهر 3 شارات قبل زر الإرسال' : 'مخفية'}
                        </p>
                    </div>
                    <Switch
                        checked={badgesStrip.enabled}
                        onCheckedChange={(v) => setBadges({ enabled: v })}
                        aria-label="إظهار شارات الثقة"
                    />
                </div>
                <div
                    className={
                        badgesStrip.enabled
                            ? 'space-y-2'
                            : 'space-y-2 opacity-60 pointer-events-none'
                    }
                >
                    {badgesStrip.items.map((b, i) => (
                        <Field
                            key={i}
                            label={`شارة #${i + 1}`}
                            value={b}
                            onChange={(e) => updateBadge(i, e.target.value)}
                            placeholder="الدفع عند الاستلام"
                        />
                    ))}
                </div>
            </div>

            {/* Row strip */}
            <div className="rounded-md border bg-muted/10 p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <p className="text-xs font-medium">سطر أسفل زر الإرسال (2)</p>
                        <p className="text-[10px] text-muted-foreground">
                            {rowStrip.enabled ? 'يظهر سطر قصير بعد الإرسال' : 'مخفي'}
                        </p>
                    </div>
                    <Switch
                        checked={rowStrip.enabled}
                        onCheckedChange={(v) => setRow({ enabled: v })}
                        aria-label="إظهار سطر الثقة تحت الإرسال"
                    />
                </div>
                <div
                    className={
                        rowStrip.enabled
                            ? 'space-y-2'
                            : 'space-y-2 opacity-60 pointer-events-none'
                    }
                >
                    {rowStrip.items.map((b, i) => (
                        <Field
                            key={i}
                            label={`عنصر #${i + 1}`}
                            value={b}
                            onChange={(e) => updateRow(i, e.target.value)}
                            placeholder="دفع عند الاستلام"
                        />
                    ))}
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                استخدم عبارات قصيرة (2-4 كلمات) مثل "الدفع عند الاستلام"، "توصيل مجاني"، "ضمان سنة".
            </p>
        </div>
    );
}
