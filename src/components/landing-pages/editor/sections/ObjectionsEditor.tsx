/**
 * ObjectionsEditor — up to 3 Q&A items.
 *
 * Matches the new Soctiv HTML `.objections` section
 * (template_index.html). One section heading (no separate subheading).
 */
import { TextareaField } from '../fields';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

const MAX_ITEMS = 3;

export function ObjectionsEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const o = config.objections;
    const set = (patch: Partial<SoctivLandingConfig['objections']>) =>
        onChange({ ...config, objections: { ...o, ...patch } });

    const updateItem = (i: number, patch: Partial<(typeof o.items)[number]>) => {
        const items = o.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
        set({ items });
    };

    const addItem = () => {
        if (o.items.length >= MAX_ITEMS) return;
        set({ items: [...o.items, { q: '', a: '' }] });
    };

    const removeItem = (i: number) => {
        if (o.items.length <= 1) return;
        set({ items: o.items.filter((_, idx) => idx !== i) });
    };

    return (
        <div className="space-y-3">
            <TextareaField
                label="عنوان القسم"
                value={o.heading}
                onChange={(e) => set({ heading: e.target.value })}
                rows={2}
            />
            <div className="space-y-3">
                {o.items.map((item, i) => (
                    <div key={i} className="rounded-md border bg-muted/10 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                اعتراض #{i + 1}
                            </span>
                            {o.items.length > 1 && (
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
                        <TextareaField
                            label="السؤال"
                            value={item.q}
                            onChange={(e) => updateItem(i, { q: e.target.value })}
                            rows={2}
                        />
                        <TextareaField
                            label="الإجابة"
                            value={item.a}
                            onChange={(e) => updateItem(i, { a: e.target.value })}
                            rows={3}
                        />
                    </div>
                ))}
                {o.items.length < MAX_ITEMS && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={addItem}
                    >
                        <Plus className="h-3.5 w-3.5 ml-1.5" />
                        إضافة اعتراض ({o.items.length}/{MAX_ITEMS})
                    </Button>
                )}
            </div>
        </div>
    );
}