import React, { useState } from 'react';
import { Lead, Client } from '@/types/database';
import { LeadWithRelations } from '@/types/app';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { LeadCard } from './LeadCard';
import { VirtualColumn } from './VirtualColumn';
import { getHeatLevelFromTimestamp } from '@/hooks/useLeadTimer';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

// Typed supabase client used directly

type LeadStatus = Database['public']['Enums']['lead_status'];

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
  leads: LeadWithRelations[];
  onEdit: (lead: LeadWithRelations) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
  isAdmin?: boolean;
  clients?: Client[];
}

export function LeadPipeline({ leads, onEdit, onDelete, onRefresh, onStatusChange, isAdmin, clients }: LeadPipelineProps) {
  const { toast } = useToast();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string>('new');

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
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

    hapticSuccess();
    await onStatusChange(draggedLead, newStatus);
    setDraggedLead(null);
  };

  // Helper to maintain compatibility if we want to log or do other things
  // But simpler to just use onStatusChange directly in moveTo... functions
  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    await onStatusChange(leadId, newStatus);
  };

  const moveToNextStage = async (lead: LeadWithRelations) => {
    const currentIndex = stages.findIndex(s => s.id === lead.status);
    if (currentIndex < stages.length - 1) {
      await updateLeadStatus(lead.id, stages[currentIndex + 1].id);
    }
  };

  const moveToPrevStage = async (lead: LeadWithRelations) => {
    const currentIndex = stages.findIndex(s => s.id === lead.status);
    if (currentIndex > 0) {
      await updateLeadStatus(lead.id, stages[currentIndex - 1].id);
    }
  };

  const getLeadsByStatus = (status: string) => {
    if (!Array.isArray(leads)) {
      console.error('LeadPipeline: leads prop is not an array', leads);
      return [];
    }
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
                className={`flex-shrink-0 gap-2 min-h-[44px] px-4 ${activeStage === stage.id ? '' : 'hover:bg-muted'
                  }`}
                onClick={() => {
                  hapticLight();
                  setActiveStage(stage.id);
                }}
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
    <ScrollArea className="w-full" dir="rtl">
      <div className="flex gap-3 pb-4 min-w-max">
        {stages.map((stage) => (
          <VirtualColumn
            key={stage.id}
            id={stage.id}
            title={stage.title}
            color={stage.color}
            leads={getLeadsByStatus(stage.id)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            draggedLeadId={draggedLead}
            onEdit={onEdit}
            onDelete={onDelete}
            onRefresh={onRefresh}
            isAdmin={isAdmin}
            getClientName={getClientName}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
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
