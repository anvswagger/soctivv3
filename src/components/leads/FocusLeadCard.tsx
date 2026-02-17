import { Phone, User, MapPin, Briefcase, Clock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LeadWithRelations } from '@/types/app';
import { transliterateFullName } from '@/lib/transliterate';
import { motion } from 'framer-motion';
import { formatDate } from '@/lib/format';

interface FocusLeadCardProps {
    lead: LeadWithRelations;
    onCall: () => void;
    isCalling: boolean;
    callDuration: string;
}

export function FocusLeadCard({ lead, onCall, isCalling, callDuration }: FocusLeadCardProps) {
    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0 space-y-6">
                {/* Name and Basic Info */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-2">
                        <User className="h-10 w-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-foreground">
                        {transliterateFullName(lead.first_name, lead.last_name)}
                    </h2>
                    <div className="flex items-center justify-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Phone className="h-4 w-4" />
                            <span dir="ltr">{lead.phone}</span>
                        </div>
                        {lead.worktype && (
                            <div className="flex items-center gap-1.5">
                                <Briefcase className="h-4 w-4" />
                                <span>{lead.worktype}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Call Progress / Action */}
                <div className="flex flex-col items-center justify-center p-8 bg-card rounded-3xl border shadow-sm space-y-6">
                    {isCalling ? (
                        <div className="text-center space-y-4">
                            <div className="flex items-center justify-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-2xl font-mono font-bold">{callDuration}</span>
                            </div>
                            <p className="text-muted-foreground animate-pulse">جاري الاتصال للعميل الآن...</p>
                        </div>
                    ) : (
                        <div className="text-center space-y-2">
                            <p className="text-muted-foreground">هل أنت مستعد لبدء المكالمة؟</p>
                        </div>
                    )}

                    <Button
                        size="lg"
                        className={cn(
                            "w-full h-20 text-xl font-bold rounded-2xl transition-all active:scale-95 shadow-lg",
                            isCalling ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"
                        )}
                        onClick={onCall}
                    >
                        <Phone className={cn("h-6 w-6 ml-3 fill-current", isCalling ? "animate-bounce" : "")} />
                        {isCalling ? 'إنهاء وتسجيل النتيجة' : 'بدء الاتصال الآن'}
                    </Button>
                </div>

                {/* Extra Lead Context */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-card/40 border-none shadow-none">
                        <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">تاريخ التسجيل</span>
                            <span className="text-sm font-medium">
                                {formatDate(lead.created_at)}
                            </span>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/40 border-none shadow-none">
                        <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">المرحلة الحالية</span>
                            <span className="text-sm font-medium">{lead.stage || 'جديد'}</span>
                        </CardContent>
                    </Card>
                </div>

                {lead.notes && (
                    <div className="p-4 bg-muted/40 rounded-xl space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            ملاحظات سابقة
                        </p>
                        <p className="text-sm leading-relaxed">{lead.notes}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
