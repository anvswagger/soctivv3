/**
 * ListHeader — page header for the landing pages list.
 *
 * Title + subtitle on the left. Optional action slot on the right.
 */
import type { ReactNode } from 'react';

interface ListHeaderProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
}

export function ListHeader({ title, subtitle, actions }: ListHeaderProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-muted-foreground max-w-2xl leading-relaxed">
                        {subtitle}
                    </p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
