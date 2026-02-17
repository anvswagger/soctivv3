import { useState, useEffect, memo, useMemo, useRef } from 'react';
import { Phone, Edit, Trash2, Briefcase, Layers, ChevronRight, ChevronLeft, Clock, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CallOutcomeDialog } from './CallOutcomeDialog';
import { useLeadTimer, getHeatLevelFromTimestamp, type HeatLevel } from '@/hooks/useLeadTimer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { transliterateFullName } from '@/lib/transliterate';
import { LeadWithRelations } from '@/types/app';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { LeadActivityTimeline } from './LeadActivityTimeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { analyticsService } from '@/services/analyticsService';

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
  gold: 'border-amber-500 shadow-amber-100 dark:shadow-amber-900/20 ring-1 ring-amber-500/20 animate-pulse-subtle',
  warm: 'border-blue-200 dark:border-blue-800',
  cold: 'border-transparent',
};

// Atomic component to only re-render the time string
const LeadTimeDisplay = memo(function LeadTimeDisplay({
  createdAt,
  firstContactAt,
  heatLevel: initialHeatLevel,
}: {
  createdAt: string;
  firstContactAt?: string | null;
  heatLevel: HeatLevel;
}) {
  const { formattedTime, heatLevel } = useLeadTimer(createdAt, firstContactAt);
  return (
    <span className={heatLevel === 'gold' ? 'text-amber-600 font-medium' : ''}>
      {formattedTime}
    </span>
  );
});

export const LeadCard = memo(function LeadCard({
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
  // Pre-calculate non-timer-dependent heat (for border/styles) to keep it stable
  const initialHeatLevel = useMemo(() =>
    getHeatLevelFromTimestamp(lead.created_at, lead.first_contact_at),
    [lead.created_at, lead.first_contact_at]
  );

  const [showCallOutcome, setShowCallOutcome] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number>(0);
  const [showHistory, setShowHistory] = useState(false);
  const callOutcomeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      setShowCallOutcome(false);
      if (callOutcomeTimeoutRef.current) {
        clearTimeout(callOutcomeTimeoutRef.current);
      }
    };
  }, []);

  const handleCall = async () => {
    const now = new Date().toISOString();
    const callStart = Date.now();
    setCallStartTime(callStart);
    hapticLight();

    // Record first contact
    const { error: updateError } = await supabase
      .from('leads')
      .update({ first_contact_at: now })
      .eq('id', lead.id);

    // Award gold points if within gold window
    if (initialHeatLevel === 'gold' && user?.id) {
      await supabase
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

    // Move to contacting if currently new
    if (lead.status === 'new') {
      const { error: statusError } = await supabase
        .from('leads')
        .update({ status: 'contacting' })
        .eq('id', lead.id);

      // Track analytics for status change
      if (!statusError && user?.id) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData.user?.id;
          if (userId) {
            void analyticsService.trackEvent({
              userId,
              clientId: lead.client_id ?? null,
              leadId: lead.id,
              eventType: 'lead_status_changed',
              eventName: lead.source || 'unknown',
              metadata: {
                previous_status: 'new',
                new_status: 'contacting',
                trigger: 'call_initiated',
              },
            });
          }
        } catch {
          // Non-blocking analytics
        }
      }
    }

    if (!updateError) {
      onRefresh();
    }

    // Open phone dialer
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, '_self');
    }

    // Show call outcome dialog after 30 seconds
    callOutcomeTimeoutRef.current = setTimeout(() => {
      setShowCallOutcome(true);
    }, 30000);
  };

  // Compact version for desktop kanban
  if (compact) {
    return (
      <div
        className={cn(
          'group p-3 rounded-lg border bg-card transition-all hover:shadow-card-hover',
          heatStyles[initialHeatLevel]
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
                <LeadTimeDisplay
                  createdAt={lead.created_at}
                  firstContactAt={lead.first_contact_at}
                  heatLevel={initialHeatLevel}
                />
              </div>
            </div>

            {initialHeatLevel === 'gold' && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0 mt-1" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {lead.worktype && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                  {lead.worktype}
                </span>
              )}
              {(lead.client?.company_name || clientName) && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-primary/20 bg-primary/5 text-primary truncate max-w-[120px]">
                  {lead.client?.company_name || clientName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {lead.phone && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs flex-1 gap-1.5 font-medium shadow-none"
                onClick={() => {
                  hapticLight();
                  handleCall();
                }}
              >
                <Phone className="h-3 w-3" />
                اتصل
              </Button>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground transition-transform active:scale-90" onClick={(e) => { e.stopPropagation(); hapticLight(); onEdit(lead); }}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group transition-all duration-200">
      <Card className={cn('border shadow-sm rounded-xl overflow-hidden transition-all active:scale-[0.98]',
        lead.status !== 'sold' && lead.status !== 'cancelled' ? heatStyles[initialHeatLevel] : 'border-border'
      )}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex justify-between items-start mb-3 sm:mb-4">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-foreground">
                {transliterateFullName(lead.first_name, lead.last_name)}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <LeadTimeDisplay
                    createdAt={lead.created_at}
                    firstContactAt={lead.first_contact_at}
                    heatLevel={initialHeatLevel}
                  />
                </div>
                {initialHeatLevel === 'gold' && <Badge variant="secondary" className="h-5 text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100 border-none shrink-0">جديد</Badge>}
                {lead.client?.company_name && (
                  <div className="flex items-center gap-1.5 text-primary/80 font-medium">
                    <Briefcase className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                    <span>{lead.client.company_name}</span>
                  </div>
                )}
              </div>
            </div>

          </div>


          {/* Action Button - Large but clean */}
          {lead.phone && (
            <div className="flex gap-2 mb-3 sm:mb-4">
              <Button
                size="lg"
                className={cn(
                  'flex-1 h-10 sm:h-12 text-sm sm:text-base font-semibold shadow-none transition-all',
                  initialHeatLevel === 'gold'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-500/50 ring-offset-2'
                    : 'bg-primary hover:bg-primary/90'
                )}
                onClick={() => {
                  hapticLight();
                  handleCall();
                }}
              >
                <Phone className="h-3.5 sm:h-4 w-3.5 sm:w-4 ml-2" />
                {initialHeatLevel === 'gold' ? 'اتصال عاجل الآن' : 'اتصال'}
              </Button>
            </div>
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
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => { hapticLight(); setShowHistory(true); }}>
                <History className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => { hapticLight(); onEdit(lead); }}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => { hapticLight(); onDelete(lead.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9 transition-all active:scale-90" onClick={() => { hapticLight(); onMovePrev?.(); }} disabled={!canMovePrev}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 transition-all active:scale-90" onClick={() => { hapticLight(); onMoveNext?.(); }} disabled={!canMoveNext}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              سجل العميل: {transliterateFullName(lead.first_name, lead.last_name)}
            </DialogTitle>
          </DialogHeader>
          <LeadActivityTimeline leadId={lead.id} leadCreatedAt={lead.created_at} />
        </DialogContent>
      </Dialog>

    </div>
  );
});
