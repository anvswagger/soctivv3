import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLeads } from '@/hooks/useCrmData';
import { FocusLeadCard } from '@/components/leads/FocusLeadCard';
import { ScriptPanel } from '@/components/leads/ScriptPanel';
import { CallOutcomeDialog } from '@/components/leads/CallOutcomeDialog';
import { ChevronRight, ChevronLeft, X, Loader2, Trophy, Phone } from 'lucide-react';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LeadWithRelations } from '@/types/app';

export default function FocusMode() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: leadsResponse, isLoading, refetch } = useLeads();

    // Filter for actionable leads (new or contacting)
    const queue = (leadsResponse?.data || []).filter(lead => lead.status === 'new' || lead.status === 'contacting');

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isCalling, setIsCalling] = useState(false);
    const [callStartTime, setCallStartTime] = useState<number>(0);
    const [showOutcome, setShowOutcome] = useState(false);
    const [callDuration, setCallDuration] = useState('00:00');

    const currentLead: LeadWithRelations | undefined = queue[currentIndex];

    // Call duration timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isCalling && callStartTime) {
            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
                const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const secs = (elapsed % 60).toString().padStart(2, '0');
                setCallDuration(`${mins}:${secs}`);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isCalling, callStartTime]);

    const handleStartCall = async () => {
        if (!currentLead) return;

        const now = new Date().toISOString();
        setCallStartTime(Date.now());
        setIsCalling(true);
        hapticLight();

        // Update status to contacting if new
        if (currentLead.status === 'new') {
            await supabase
                .from('leads')
                .update({ status: 'contacting', first_contact_at: now } as any)
                .eq('id', currentLead.id as any);
        }

        // Open dialer
        if (currentLead.phone) {
            window.open(`tel:${currentLead.phone}`, '_self');
        }
    };

    const handleEndCall = () => {
        setIsCalling(false);
        setShowOutcome(true);
        hapticSuccess();
    };

    const handleNext = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setCallDuration('00:00');
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setCallDuration('00:00');
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">جاري تجهيز قائمة الاتصال...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (queue.length === 0) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6">
                    <div className="bg-primary/10 p-6 rounded-full">
                        <Trophy className="h-16 w-16 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold">كل شيء جاهز!</h2>
                        <p className="text-muted-foreground max-w-sm">لا يوجد عملاء جدد قيد الانتظار حالياً. استمتع باستراحة قصيرة!</p>
                    </div>
                    <Button onClick={() => navigate('/leads')} size="lg"> العودة للقائمة </Button>
                </div>
            </DashboardLayout>
        );
    }

    const progress = ((currentIndex + 1) / queue.length) * 100;

    return (
        <DashboardLayout>
            <div className="h-[calc(100vh-120px)] flex flex-col gap-6" dir="rtl">
                {/* Top Header Section */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium">التقدم: {currentIndex + 1} من {queue.length}</span>
                            <span className="text-muted-foreground">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => navigate('/leads')} className="rounded-full h-10 w-10">
                        <X className="h-6 w-6" />
                    </Button>
                </div>

                {/* Main Workspace */}
                <div className="flex-1 grid md:grid-cols-2 gap-8 items-start overflow-hidden">
                    {/* Left Side: Lead Info & Call Controls */}
                    <div className="h-full flex flex-col justify-center max-w-lg mx-auto w-full">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentLead.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-8"
                            >
                                <FocusLeadCard
                                    lead={currentLead}
                                    onCall={isCalling ? handleEndCall : handleStartCall}
                                    isCalling={isCalling}
                                    callDuration={callDuration}
                                />

                                {/* Navigation Controls */}
                                <div className="flex items-center justify-between px-4">
                                    <Button
                                        variant="outline"
                                        onClick={handlePrev}
                                        disabled={currentIndex === 0 || isCalling}
                                        className="gap-2"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                        السابق
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleNext}
                                        disabled={currentIndex === queue.length - 1 || isCalling}
                                        className="gap-2"
                                    >
                                        التالي
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Right Side: Scripts & Notes */}
                    <div className="hidden md:block h-full border-r pr-8">
                        <ScriptPanel clientId={currentLead.client_id} />
                    </div>
                </div>
            </div>

            {/* Outcome Dialog */}
            <CallOutcomeDialog
                open={showOutcome}
                onOpenChange={(open) => {
                    setShowOutcome(open);
                    if (!open) {
                        handleNext(); // Move to next lead after closing outcome dialog
                        refetch(); // Refresh data to update status labels
                    }
                }}
                lead={currentLead}
                callStartTime={callStartTime}
                onRefresh={() => {
                    refetch();
                }}
            />
        </DashboardLayout>
    );
}
