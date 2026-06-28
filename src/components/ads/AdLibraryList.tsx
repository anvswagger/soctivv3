/**
 * AdLibraryList — the "Library" tab content.
 *
 * Lists every ad for the current scope (one product, or all products if
 * no productId prop). Filterable by angle. Empty state prompts the user
 * to generate one.
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAdsQuery, useDeleteAd, useUpdateAd } from '@/hooks/useAds';
import { AdCard } from './AdCard';
import { EmptyAdsLibrary } from './EmptyAdsState';

interface AdLibraryListProps {
    productId?: string;
    onSwitchToGenerate?: () => void;
}

export function AdLibraryList({ productId, onSwitchToGenerate }: AdLibraryListProps) {
    const [angleFilter, setAngleFilter] = useState<string>('__all__');

    const { data: ads = [], isLoading } = useAdsQuery(
        productId ? { productId } : {},
    );

    // Distinct angle names from the loaded data, sorted.
    const angleOptions = useMemo(() => {
        const set = new Set<string>();
        for (const ad of ads) set.add(ad.angleName);
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
    }, [ads]);

    const visible = useMemo(() => {
        if (angleFilter === '__all__') return ads;
        return ads.filter((a) => a.angleName === angleFilter);
    }, [ads, angleFilter]);

    const update = useUpdateAd();
    const del = useDeleteAd();

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (ads.length === 0) {
        return (
            <EmptyAdsLibrary
                onStartCreating={onSwitchToGenerate}
            />
        );
    }

    return (
        <div className="space-y-4">
            {angleOptions.length > 1 && (
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-foreground/80">
                        الزاوية:
                    </label>
                    <Select value={angleFilter} onValueChange={setAngleFilter}>
                        <SelectTrigger className="w-72">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">الكل ({ads.length})</SelectItem>
                            {angleOptions.map((angle) => {
                                const count = ads.filter((a) => a.angleName === angle).length;
                                return (
                                    <SelectItem key={angle} value={angle}>
                                        {angle} ({count})
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {visible.length === 0 ? (
                <EmptyAdsLibrary onStartCreating={onSwitchToGenerate} />
            ) : (
                <div className="grid gap-4">
                    {visible.map((ad) => (
                        <AdCard
                            key={ad.id}
                            mode="saved"
                            ad={ad}
                            angleName={ad.angleName}
                            durationSeconds={ad.durationSeconds}
                            isSaving={update.isPending}
                            isDeleting={del.isPending}
                            onSave={async (changes) => {
                                await update.mutateAsync({
                                    id: ad.id,
                                    changes: {
                                        hooks: changes.hooks,
                                        copy: changes.copy,
                                        headline: changes.headline,
                                    },
                                });
                            }}
                            onDelete={async () => {
                                await del.mutateAsync({ id: ad.id, productId: ad.productId });
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}