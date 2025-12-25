import { useState } from 'react';
import { Lead, Client } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { LeadCard } from './LeadCard';
import type { Database } from '@/integrations/supabase/types';

const db = supabase as any;

type LeadStatus = Database['public']['Enums']['lead_status'];

interface LeadWithClient extends Lead {
  client?: Client;
}

interface PipelineStage {
  id: string;
  title: string;
  color: string;
}

const stages: PipelineStage[] = [
  { id: 'new', title: 'جديد', color: 'bg-blue-500' },
  { id: 'contacting', title: 'قيد التواصل', color: 'bg-yellow-500' },
  { id: 'appointment_booked', title: 'موعد محجوز', color: 'bg-purple-500' },
  { id: 'interviewed', title: 'تمت المقابلة', color: 'bg-cyan-500' },
  { id: 'no_show', title: 'غائب', color: 'bg-orange-500' },
  { id: 'sold', title: 'تم البيع', color: 'bg-green-500' },
  { id: 'cancelled', title: 'ملغاة', color: 'bg-red-500' },
];

interface LeadPipelineProps {
  leads: LeadWithClient[];
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  isAdmin?: boolean;
  clients?: Client[];
}

export function LeadPipeline({ leads, onEdit, onDelete, onRefresh, isAdmin, clients }: LeadPipelineProps) {
  const { toast } = useToast();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string>('new');

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedLead) return;

    const lead = leads.find(l => l.id === draggedLead);
    if (!lead || lead.status === newStatus) {
      setDraggedLead(null);
      return;
    }

    await updateLeadStatus(draggedLead, newStatus);
    setDraggedLead(null);
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const { error } = await db.from('leads').update({ status: newStatus }).eq('id', leadId);
    
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحديث الحالة', variant: 'destructive' });
    } else {
      toast({ title: 'تم التحديث', description: 'تم تحديث حالة العميل المحتمل' });
      onRefresh();
    }
  };

  const moveToNextStage = async (lead: Lead) => {
    const currentIndex = stages.findIndex(s => s.id === lead.status);
    if (currentIndex < stages.length - 1) {
      await updateLeadStatus(lead.id, stages[currentIndex + 1].id);
    }
  };

  const moveToPrevStage = async (lead: Lead) => {
    const currentIndex = stages.findIndex(s => s.id === lead.status);
    if (currentIndex > 0) {
      await updateLeadStatus(lead.id, stages[currentIndex - 1].id);
    }
  };

  const getLeadsByStatus = (status: string) => {
    return leads.filter(lead => lead.status === status);
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId || !clients) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.company_name;
  };

  // Mobile: Show stage tabs + cards for active stage
  const MobileView = () => (
    <div className="space-y-4">
      {/* Stage Tabs - Scrollable */}
      <ScrollArea className="w-full" dir="rtl">
        <div className="flex gap-2 pb-2">
          {stages.map((stage) => {
            const count = getLeadsByStatus(stage.id).length;
            return (
              <Button
                key={stage.id}
                variant={activeStage === stage.id ? 'default' : 'outline'}
                size="sm"
                className={`flex-shrink-0 gap-2 min-h-[44px] px-4 ${
                  activeStage === stage.id ? '' : 'hover:bg-muted'
                }`}
                onClick={() => setActiveStage(stage.id)}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <span>{stage.title}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Lead Cards for Active Stage */}
      <div className="space-y-3">
        {getLeadsByStatus(activeStage).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            لا يوجد عملاء في هذه المرحلة
          </div>
        ) : (
          getLeadsByStatus(activeStage).map((lead) => {
            const currentIndex = stages.findIndex(s => s.id === lead.status);
            return (
              <LeadCard
                key={lead.id}
                lead={lead}
                onEdit={onEdit}
                onDelete={onDelete}
                onRefresh={onRefresh}
                onMoveNext={() => moveToNextStage(lead)}
                onMovePrev={() => moveToPrevStage(lead)}
                canMoveNext={currentIndex < stages.length - 1}
                canMovePrev={currentIndex > 0}
                isAdmin={isAdmin}
                clientName={getClientName(lead.client_id)}
              />
            );
          })
        )}
      </div>
    </div>
  );

  // Desktop: Full Kanban Board with compact cards
  const DesktopView = () => (
    <div className="grid grid-cols-7 gap-3" dir="rtl">
      {stages.map((stage) => (
        <div
          key={stage.id}
          className="min-h-[400px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, stage.id)}
        >
          <Card className="h-full">
            <CardHeader className="pb-3 px-3">
              <CardTitle className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  {stage.title}
                </span>
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {getLeadsByStatus(stage.id).length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-2">
              {getLeadsByStatus(stage.id).map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className={`cursor-grab active:cursor-grabbing ${
                    draggedLead === lead.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-1 mb-1">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
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
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden">
        <MobileView />
      </div>
      {/* Desktop View */}
      <div className="hidden lg:block">
        <DesktopView />
      </div>
    </>
  );
}
