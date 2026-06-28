/**
 * PricingTiersEditor — qty stepper tiers with discount %, label, total price.
 *
 * Tiers are pre-derived from `product.value` by `buildDefaultSoctivConfig`.
 * The editor lets you tweak the AI-generated Arabic label per tier and the
 * total price for each qty. Max-qty is auto-derived from `tiers.length`.
 *
 * Minimal surface: just the tier rows. The previous `discountLabel` field
 * has been dropped — the Arabic label "التخفيض" is fixed and applied by
 * the renderer.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

export function PricingTiersEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const p = config.pricing;
    const set = (patch: Partial<SoctivLandingConfig['pricing']>) =>
        onChange({ ...config, pricing: { ...p, ...patch } });

    const updateTier = (i: number, patch: Partial<(typeof p.tiers)[number]>) => {
        const tiers = p.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
        set({ tiers });
    };

    const removeTier = (i: number) => {
        if (p.tiers.length <= 1) return;
        const tiers = p.tiers.filter((_, idx) => idx !== i).map((t, idx) => ({
            ...t,
            quantity: idx + 1,
        }));
        set({ tiers, maxQty: tiers.length });
    };

    return (
        <div className="space-y-2">
            <Label className="text-xs font-medium">مستويات السعر</Label>
            <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-muted-foreground">
                        <tr>
                            <th className="text-right px-2 py-2 font-medium w-16">الكمية</th>
                            <th className="text-right px-2 py-2 font-medium">السعر</th>
                            <th className="text-right px-2 py-2 font-medium">التسمية</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {p.tiers.map((t, i) => (
                            <tr key={i} className="border-t">
                                <td className="px-2 py-2 text-center font-medium">
                                    {t.quantity}
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        type="number"
                                        value={t.price}
                                        min={0}
                                        step="0.01"
                                        dir="ltr"
                                        className="h-8 text-sm"
                                        onChange={(e) =>
                                            updateTier(i, {
                                                price: Number(e.target.value) || 0,
                                            })
                                        }
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        value={t.label}
                                        dir="auto"
                                        className="h-8 text-sm"
                                        onChange={(e) =>
                                            updateTier(i, { label: e.target.value })
                                        }
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    {p.tiers.length > 1 && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-muted-foreground"
                                            onClick={() => removeTier(i)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}