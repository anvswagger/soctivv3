import { useState } from 'react';
import { Lead, Client } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Edit, Trash2, GripVertical, Briefcase, Layers, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    if (!clientId || !clients) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.company_name;
  };

  const getStageColor = (status: string) => {
    return stages.find(s => s.id === status)?.color || 'bg-gray-500';
  };

  const getStageTitle = (status: string) => {
    return stages.find(s => s.id === status)?.title || status;
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
          getLeadsByStatus(activeStage).map((lead) => (
            <Card key={lead.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">
                      {lead.first_name} {lead.last_name}
                    </p>
                    {lead.phone && (
                      <a 
                        href={`tel:${lead.phone}`}
                        className="flex items-center gap-2 text-primary mt-2 min-h-[44px] text-base"
                      >
                        <Phone className="h-5 w-5" />
                        {lead.phone}
                      </a>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {lead.worktype && (
                        <Badge variant="secondary" className="text-xs">
                          <Briefcase className="h-3 w-3 ml-1" />
                          {lead.worktype}
                        </Badge>
                      )}
                      {lead.stage && (
                        <Badge variant="outline" className="text-xs">
                          <Layers className="h-3 w-3 ml-1" />
                          {lead.stage}
                        </Badge>
                      )}
                    </div>
                    {isAdmin && lead.client_id && (
                      <p className="text-xs text-primary mt-2">
                        {getClientName(lead.client_id)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Stage Navigation */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => moveToPrevStage(lead)}
                      disabled={lead.status === 'new'}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <Select
                      value={lead.status}
                      onValueChange={(value: LeadStatus) => updateLeadStatus(lead.id, value)}
                    >
                      <SelectTrigger className="w-[130px] h-10">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStageColor(lead.status)}`} />
                          <span className="text-xs">{stages.find(s => s.id === lead.status)?.title}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                              {stage.title}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => moveToNextStage(lead)}
                      disabled={stages.findIndex(s => s.id === lead.status) === stages.length - 1}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onEdit(lead)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 text-destructive hover:text-destructive" 
                      onClick={() => onDelete(lead.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  // Desktop: Full Kanban Board
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
                  className={`p-2.5 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                    draggedLead === lead.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{lead.first_name} {lead.last_name}</p>
                      {lead.phone && (
                        <a 
                          href={`tel:${lead.phone}`}
                          className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </a>
                      )}
                      {lead.worktype && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                          <Briefcase className="h-2.5 w-2.5" />
                          {lead.worktype}
                        </p>
                      )}
                      {lead.stage && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Layers className="h-2.5 w-2.5" />
                          {lead.stage}
                        </p>
                      )}
                      {isAdmin && lead.client_id && (
                        <p className="text-[10px] text-primary mt-1">
                          {getClientName(lead.client_id)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 mt-2 justify-end">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(lead)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-destructive hover:text-destructive" 
                      onClick={() => onDelete(lead.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
