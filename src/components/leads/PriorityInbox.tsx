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
    // Fetch 50 leads to sort on client side for now, or better: server side filter
    // For now, let's just fix the crash by matching the signature.
    const { data: leadsData, isLoading } = useLeads(1, 50, { clientId });
    const leads = leadsData?.data || [];

    const priorityLeads = useMemo(() => {
        return leads
            .filter(l => l.status === 'new' && !l.first_contact_at) // Only fresh leads that haven't been called
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Most recent first
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
                    <Zap className="h-4 w-4 text-green-500 fill-green-500" />
                    عملاء جدد لم يتم الاتصال بهم
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
