import { useLeads } from '@/hooks/useCrmData';
import { useAuth } from '@/hooks/useAuth';
import { LeadCard } from './LeadCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2, ListFilter } from 'lucide-react';
import { getHeatLevelFromTimestamp } from '@/hooks/useLeadTimer';
import { getLeadSuggestion } from '@/hooks/useLeadSuggestions';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function PriorityInbox() {
    const { isSuperAdmin, isAdmin, assignedClients, client } = useAuth();

    const clientId = isSuperAdmin ? undefined : (isAdmin ? assignedClients : client?.id);
    const { data: leads = [], isLoading } = useLeads(!!(isSuperAdmin || isAdmin), clientId);

    const priorityLeads = useMemo(() => {
        return leads
            .filter(l => l.status !== 'sold' && l.status !== 'cancelled')
            .map(l => ({
                ...l,
                heat: getHeatLevelFromTimestamp(l.created_at, l.first_contact_at)
            }))
            .filter(l => l.heat === 'gold' || l.heat === 'warm')
            .sort((a, b) => {
                if (a.heat === 'gold' && b.heat !== 'gold') return -1;
                if (a.heat !== 'gold' && b.heat === 'gold') return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .slice(0, 5);
    }, [leads]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    if (priorityLeads.length === 0) {
        return null; // Don't show if no priority leads
    }

    return (
        <Card className="border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/5 py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                    عملاء بحاجة لاهتمام فوري
                </CardTitle>
                <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                    <Link to="/leads">عرض الكل</Link>
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                    {priorityLeads.map(lead => (
                        <div key={lead.id} className="p-1">
                            <LeadCard
                                lead={lead}
                                compact
                                onEdit={() => { }}
                                onDelete={() => { }}
                                onRefresh={() => { }}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
