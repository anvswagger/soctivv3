/**
 * FilterBar — status chips + search input above the landing page card grid.
 *
 * One clear primary action ("+ New Landing Page" gradient button) sits on
 * the right. Chips control which subset of pages is shown. The search
 * input filters by title.
 */
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'live' | 'draft' | 'legacy' | 'empty';

const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'live', label: 'منشور' },
    { id: 'draft', label: 'جاهز للنشر' },
    { id: 'legacy', label: 'قالب قديم' },
    { id: 'empty', label: 'فارغ' },
];

interface FilterBarProps {
    active: StatusFilter;
    onActiveChange: (next: StatusFilter) => void;
    search: string;
    onSearchChange: (next: string) => void;
    onNew: () => void;
    /** When true, hide the primary CTA (used when the user has no
     *  products with DNA yet — they shouldn't see a broken "New" button). */
    hideNew?: boolean;
}

export function FilterBar({
    active,
    onActiveChange,
    search,
    onSearchChange,
    onNew,
    hideNew,
}: FilterBarProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 backdrop-blur p-1">
                    {FILTERS.map((f) => {
                        const isActive = active === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => onActiveChange(f.id)}
                                className={cn(
                                    'px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                )}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>

                <div className="relative flex-1 min-w-[180px] md:w-64 md:flex-none">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="ابحث في العناوين…"
                        className="h-9 pr-9 text-sm bg-card/60 border-border"
                    />
                </div>
            </div>

            {!hideNew && (
                <Button
                    onClick={onNew}
                    className="gap-2 bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-bold shadow-glow-cyan transform transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Sparkles className="h-4 w-4" />
                    صفحة جديدة
                </Button>
            )}
        </div>
    );
}
