import { useState } from 'react';
import { Lead, LeadStatus, Client } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Edit, Trash2, GripVertical, Briefcase, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const db = supabase as any;

interface LeadWithClient extends Lead {
  client?: Client;
}

interface PipelineStage {
  id: LeadStatus;
  title: string;
  color: string;
}

const stages: PipelineStage[] = [
  { id: 'new', title: 'جديد', color: 'bg-info' },
  { id: 'contacted', title: 'تم التواصل', color: 'bg-warning' },
  { id: 'qualified', title: 'مؤهل', color: 'bg-primary' },
  { id: 'converted', title: 'محول', color: 'bg-success' },
  { id: 'lost', title: 'مفقود', color: 'bg-destructive' },
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

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    if (!draggedLead) return;

    const lead = leads.find(l => l.id === draggedLead);
    if (!lead || lead.status === newStatus) {
      setDraggedLead(null);
      return;
    }

    const { error } = await db.from('leads').update({ status: newStatus }).eq('id', draggedLead);
    
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحديث الحالة', variant: 'destructive' });
    } else {
      toast({ title: 'تم التحديث', description: 'تم تحديث حالة العميل المحتمل' });
      onRefresh();
    }
    
    setDraggedLead(null);
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter(lead => lead.status === status);
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId || !clients) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.company_name;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4" dir="rtl">
      {stages.map((stage) => (
        <div
          key={stage.id}
          className="min-h-[400px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, stage.id)}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                  {stage.title}
                </span>
                <Badge variant="secondary">{getLeadsByStatus(stage.id).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getLeadsByStatus(stage.id).map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className={`p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                    draggedLead === lead.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lead.first_name} {lead.last_name}</p>
                      {lead.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </p>
                      )}
                      {lead.worktype && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Briefcase className="h-3 w-3" />
                          {lead.worktype}
                        </p>
                      )}
                      {lead.stage && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Layers className="h-3 w-3" />
                          {lead.stage}
                        </p>
                      )}
                      {isAdmin && lead.client_id && (
                        <p className="text-xs text-primary mt-1">
                          {getClientName(lead.client_id)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(lead)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(lead.id)}>
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
}
