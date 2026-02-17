import React, { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LeadWithRelations } from '@/types/app';
import { LeadCard } from './LeadCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';

interface VirtualColumnProps {
    id: string;
    title: string;
    color: string;
    leads: LeadWithRelations[];
    onDragStart: (e: React.DragEvent, leadId: string) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, status: string) => void;
    draggedLeadId: string | null;
    // LeadCard props
    onEdit: (lead: LeadWithRelations) => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
    isAdmin?: boolean;
    getClientName: (clientId: string | null) => string | undefined;
}

// Memoized VirtualColumn to prevent unnecessary re-renders
export const VirtualColumn = memo(function VirtualColumn({
    id,
    title,
    color,
    leads,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    draggedLeadId,
    onEdit,
    onDelete,
    onRefresh,
    isAdmin,
    getClientName
}: VirtualColumnProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    const leadCount = leads.length;

    const virtualizer = useVirtualizer({
        count: leadCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // Estimate height of a card
        overscan: 5,
    });

    return (
        <div
            className="min-h-[500px] w-[200px] flex-shrink-0"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, id)}
        >
            <Card className="h-full border-muted-foreground/10 bg-muted/5 flex flex-col max-h-[calc(100vh-220px)]">
                <CardHeader className="pb-3 px-3 flex-shrink-0">
                    <CardTitle className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${color} shadow-sm`} />
                            {title}
                        </span>
                        <Badge variant="secondary" className="h-6 px-2 text-xs font-bold">
                            {leads.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 flex-1 overflow-hidden">
                    <div
                        ref={parentRef}
                        className="h-full overflow-y-auto pr-1" // pr-1 for scrollbar space
                    >
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const lead = leads[virtualRow.index];
                                return (
                                    <div
                                        key={lead.id}
                                        data-index={virtualRow.index}
                                        ref={virtualizer.measureElement}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        <div className="pb-3"> {/* Spacer for consistent gap */}
                                            <div
                                                draggable
                                                onDragStart={(e: any) => onDragStart(e, lead.id)}
                                                onDragEnd={onDragEnd}
                                                className={`cursor-grab active:cursor-grabbing transition-all ${draggedLeadId === lead.id ? 'opacity-50 scale-95' : ''}`}
                                            >
                                                <div className="flex items-start gap-1.5">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 opacity-40" />
                                                    <div className="flex-1 min-w-0">
                                                        <LeadCard
                                                            lead={lead}
                                                            onEdit={onEdit}
                                                            onDelete={onDelete}
                                                            onRefresh={onRefresh}
                                                            isAdmin={isAdmin}
                                                            clientName={getClientName(lead.client_id)}
                                                            compact
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
});
