import { useState, useEffect } from 'react';
import { Phone, Edit, Trash2, Briefcase, Layers, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeatIndicator } from './HeatIndicator';
import { CallOutcomeDialog } from './CallOutcomeDialog';
import { useLeadTimer, type HeatLevel } from '@/hooks/useLeadTimer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { transliterateFullName } from '@/lib/transliterate';
import { LeadWithRelations } from '@/types/app';
import { motion } from 'framer-motion';

interface LeadCardProps {
  lead: LeadWithRelations;
  onEdit: (lead: LeadWithRelations) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onMoveNext?: () => void;
  onMovePrev?: () => void;
  canMoveNext?: boolean;
  canMovePrev?: boolean;
  isAdmin?: boolean;
  clientName?: string;
  compact?: boolean;
}

// Minimalist status colors - subtle borders only
const heatStyles: Record<HeatLevel, string> = {
  gold: 'border-amber-400 dark:border-amber-600',
  warm: 'border-blue-200 dark:border-blue-800',
  cold: 'border-transparent',
};

export function LeadCard({
  lead,
  onEdit,
  onDelete,
  onRefresh,
  onMoveNext,
  onMovePrev,
  canMoveNext = true,
  canMovePrev = true,
  isAdmin,
  clientName,
  compact = false,
}: LeadCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { heatLevel, formattedTime, isGoldExpiring } = useLeadTimer(
    lead.created_at,
    lead.first_contact_at
  );

  const [showCallOutcome, setShowCallOutcome] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number>(0);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      setShowCallOutcome(false);
    };
  }, []);

  const handleCall = async () => {
    const now = new Date().toISOString();
    const callStart = Date.now();
    setCallStartTime(callStart);

    // Record first contact
    const { error: updateError } = await (supabase as any)
      .from('leads')
      .update({ first_contact_at: now })
      .eq('id', lead.id);

    // Award gold points if within gold window
    if (heatLevel === 'gold' && user?.id) {
      await (supabase as any)
        .from('user_gold_points')
        .insert({
          user_id: user.id,
          lead_id: lead.id,
          points: 1,
        });

      toast({
        title: 'نقطة ذهبية',
        description: 'تم تسجيل استجابة سريعة.',
      });
    }

    if (!updateError) {
      onRefresh();
    }

    // Open phone dialer
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, '_self');
    }

    // Show call outcome dialog after 30 seconds
    setTimeout(() => {
      setShowCallOutcome(true);
    }, 30000);
  };

  // Compact version for desktop kanban
  if (compact) {
    return (
      <motion.div
        layoutId={lead.id}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'group p-3 rounded-lg border bg-card transition-all hover:shadow-card-hover',
          heatStyles[heatLevel]
        )}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="font-semibold text-sm truncate text-foreground leading-tight">
                {transliterateFullName(lead.first_name, lead.last_name)}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formattedTime}</span>
              </div>
            </div>

            {heatLevel === 'gold' && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0 mt-1" />
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {lead.worktype && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                {lead.worktype}
              </span>
            )}
            {isAdmin && clientName && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-border text-muted-foreground">
                {clientName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {lead.phone && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs flex-1 gap-1.5 font-medium shadow-none"
                onClick={handleCall}
              >
                <Phone className="h-3 w-3" />
                اتصل
              </Button>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onEdit(lead)}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full version for mobile - Clean list card style
  return (
    <Card className={cn('border shadow-sm rounded-xl overflow-hidden', heatStyles[heatLevel])}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-foreground">
              {transliterateFullName(lead.first_name, lead.last_name)}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className={heatLevel === 'gold' ? 'text-amber-600 font-medium' : ''}>
                {formattedTime}
              </span>
              {heatLevel === 'gold' && <Badge variant="secondary" className="h-5 text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100 border-none">جديد</Badge>}
            </div>
          </div>
        </div>

        {/* Action Button - Large but clean */}
        {lead.phone && (
          <Button
            size="lg"
            className={cn(
              'w-full h-12 text-base font-semibold shadow-none mb-4',
              heatLevel === 'gold'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-primary hover:bg-primary/90'
            )}
            onClick={handleCall}
          >
            <Phone className="h-4 w-4 mr-2" />
            {heatLevel === 'gold' ? 'اتصال عاجل' : 'اتصال'}
          </Button>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground mb-4">
          {lead.worktype && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span>{lead.worktype}</span>
            </div>
          )}
          {lead.stage && (
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>{lead.stage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => onEdit(lead)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => onDelete(lead.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={onMovePrev} disabled={!canMovePrev}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={onMoveNext} disabled={!canMoveNext}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <CallOutcomeDialog
        open={showCallOutcome}
        onOpenChange={setShowCallOutcome}
        lead={lead}
        callStartTime={callStartTime}
        onRefresh={onRefresh}
      />
    </Card>
  );
}
