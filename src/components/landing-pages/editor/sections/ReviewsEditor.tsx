/**
 * ReviewsEditor — exactly 3 customer reviews with name, location, text, initial.
 * Matches the new Soctiv HTML `.proof` section (index.html:990-1053).
 *
 * Phase 5: leading Switch toggles whether the whole reviews section is
 * shown on the page. The heading/subheading/items stay editable even
 * when hidden so re-enabling preserves all the copy.
 */
import { Field, TextareaField } from '../fields';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

const MAX_ITEMS = 3;

export function ReviewsEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const r = config.reviews;
    const enabled = r.enabled !== false; // default true when undefined
    const set = (patch: Partial<SoctivLandingConfig['reviews']>) =>
        onChange({ ...config, reviews: { ...r, ...patch } });

    const updateItem = (i: number, patch: Partial<(typeof r.items)[number]>) => {
        const items = r.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
        set({ items });
    };

    const addItem = () => {
        if (r.items.length >= MAX_ITEMS) return;
        set({ items: [...r.items, { name: '', location: '', text: '', initial: '' }] });
    };

    const removeItem = (i: number) => {
        if (r.items.length <= 1) return;
        set({ items: r.items.filter((_, idx) => idx !== i) });
    };

    return (
        <div className="space-y-3">
            {/* Phase 5: show/hide the whole section without deleting copy */}
            <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                <div className="space-y-0.5">
                    <p className="text-xs font-medium">إظهار قسم المراجعات</p>
                    <p className="text-[10px] text-muted-foreground">
                        {enabled
                            ? 'يظهر في الصفحة — انسخ المراجعات قبل إخفائها للحفاظ عليها.'
                            : 'مخفي — النصوص لا تزال محفوظة في الإعدادات.'}
                    </p>
                </div>
                <Switch
                    checked={enabled}
                    onCheckedChange={(v) => set({ enabled: v })}
                    aria-label="إظهار قسم المراجعات"
                />
            </div>

            {/* Always editable so toggling back on preserves the user's copy */}
            <div className={enabled ? 'space-y-3' : 'space-y-3 opacity-60 pointer-events-none'}>
                <div className="grid grid-cols-2 gap-2">
                    <TextareaField
                        label="عنوان القسم"
                        value={r.heading}
                        onChange={(e) => set({ heading: e.target.value })}
                        rows={2}
                    />
                    <TextareaField
                        label="العنوان الفرعي"
                        value={r.subheading}
                        onChange={(e) => set({ subheading: e.target.value })}
                        rows={2}
                    />
                </div>
                <div className="space-y-3">
                    {r.items.map((item, i) => (
                        <div key={i} className="rounded-md border bg-muted/10 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">
                                    مراجعة #{i + 1}
                                </span>
                                {r.items.length > 1 && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-muted-foreground"
                                        onClick={() => removeItem(i)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <Field
                                    label="الاسم"
                                    value={item.name}
                                    onChange={(e) => updateItem(i, { name: e.target.value })}
                                    placeholder="أحمد م."
                                />
                                <Field
                                    label="المدينة"
                                    value={item.location}
                                    onChange={(e) => updateItem(i, { location: e.target.value })}
                                    placeholder="طرابلس"
                                />
                                <Field
                                    label="الحرف الأول"
                                    value={item.initial}
                                    onChange={(e) =>
                                        updateItem(i, {
                                            initial: e.target.value.slice(0, 1),
                                        })
                                    }
                                    placeholder="أ"
                                />
                            </div>
                            <TextareaField
                                label="نص المراجعة"
                                value={item.text}
                                onChange={(e) => updateItem(i, { text: e.target.value })}
                                rows={3}
                                placeholder="تجربة العميل (جملة أو جملتان)"
                            />
                        </div>
                    ))}
                    {r.items.length < MAX_ITEMS && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={addItem}
                        >
                            <Plus className="h-3.5 w-3.5 ml-1.5" />
                            إضافة مراجعة ({r.items.length}/{MAX_ITEMS})
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
