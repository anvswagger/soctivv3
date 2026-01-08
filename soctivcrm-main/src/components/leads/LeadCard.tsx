import { useState, useEffect } from 'react';
import { Phone, Edit, Trash2, Briefcase, Layers, ChevronRight, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeatIndicator } from './HeatIndicator';
import { CallOutcomeDialog } from './CallOutcomeDialog';
import { useLeadTimer, type HeatLevel } from '@/hooks/useLeadTimer';
import { Lead, Client } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { transliterateFullName } from '@/lib/transliterate';

interface LeadCardProps {
  lead: Lead & { client?: Client };
  onEdit: (lead: Lead) => void;
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

const heatBorderStyles: Record<HeatLevel, string> = {
  gold: 'border-amber-500 shadow-[0_0_20px_hsl(38_92%_50%/0.3)] animate-pulse',
  warm: 'border-blue-500/50',
  cold: 'border-border',
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
    (lead as any).first_contact_at
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
      const { error: pointsError } = await (supabase as any)
        .from('user_gold_points')
        .insert({
          user_id: user.id,
          lead_id: lead.id,
          points: 1,
        });

      if (!pointsError) {
        toast({
          title: '🏆 نقطة ذهبية!',
          description: 'أحسنت! حصلت على نقطة ذهبية للاستجابة السريعة',
        });
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
    setTimeout(() => {
      setShowCallOutcome(true);
    }, 30000);
  };

  // Compact version for desktop kanban
  if (compact) {
    return (
      <div
        className={cn(
          'p-2.5 rounded-lg border bg-card transition-all hover:shadow-md',
          heatBorderStyles[heatLevel]
        )}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-xs truncate flex-1">
              {transliterateFullName(lead.first_name, lead.last_name)}
            </p>
            <HeatIndicator
              heatLevel={heatLevel}
              formattedTime={formattedTime}
              isExpiring={isGoldExpiring}
              size="sm"
              showLabel={false}
            />
          </div>
          
          {lead.phone && (
            <Button
              variant={heatLevel === 'gold' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'w-full h-8 gap-1 text-xs',
                heatLevel === 'gold' && 'bg-amber-500 hover:bg-amber-600 text-white'
              )}
              onClick={handleCall}
            >
              <Phone className="h-3 w-3" />
              اتصل الآن
            </Button>
          )}

          <div className="flex flex-wrap gap-1">
            {lead.worktype && (
              <Badge variant="secondary" className="text-[10px] px-1">
                {lead.worktype}
              </Badge>
            )}
            {isAdmin && clientName && (
              <Badge variant="outline" className="text-[10px] px-1 text-primary">
                {clientName}
              </Badge>
            )}
          </div>

          <div className="flex gap-0.5 justify-end">
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
      </div>
    );
  }

  // Full version for mobile
  return (
    <Card className={cn('overflow-hidden border-2 transition-all', heatBorderStyles[heatLevel])}>
      <CardContent className="p-4">
        {/* Header with heat indicator */}
        <div className="flex items-center justify-between mb-3">
          <HeatIndicator
            heatLevel={heatLevel}
            formattedTime={formattedTime}
            isExpiring={isGoldExpiring}
            size="md"
          />
          {heatLevel === 'gold' && (
            <Badge className="bg-amber-500 text-white animate-bounce">LIVE</Badge>
          )}
        </div>

        {/* Lead Info */}
        <div className="space-y-2">
          <p className="font-semibold text-lg">
            {transliterateFullName(lead.first_name, lead.last_name)}
          </p>

          {/* Big Call Button */}
          {lead.phone && (
            <Button
              size="lg"
              className={cn(
                'w-full h-14 text-lg gap-3 font-bold',
                heatLevel === 'gold'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/30'
                  : heatLevel === 'warm'
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : ''
              )}
              onClick={handleCall}
            >
              <Phone className="h-6 w-6" />
              {heatLevel === 'gold' ? 'اتصل الآن - اربح نقاط!' : 'اتصل'}
            </Button>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
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

          {isAdmin && clientName && (
            <p className="text-xs text-primary">{clientName}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex gap-1">
            {onMovePrev && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={onMovePrev}
                disabled={!canMovePrev}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            {onMoveNext && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={onMoveNext}
                disabled={!canMoveNext}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
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

      {/* Call Outcome Dialog */}
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
