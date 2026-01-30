import { LeadWithRelations } from '@/types/app';
import { HeatLevel } from './useLeadTimer';

export interface LeadSuggestion {
    action: string;
    description: string;
    icon: 'phone' | 'message' | 'calendar' | 'check';
    priority: 'high' | 'medium' | 'low';
}

export function getLeadSuggestion(lead: LeadWithRelations, heat: HeatLevel): LeadSuggestion | null {
    if (lead.status === 'sold' || lead.status === 'cancelled') return null;

    // New Gold Leads - Immediate Action
    if (lead.status === 'new' && heat === 'gold') {
        return {
            action: 'اتصل الآن!',
            description: 'عميل جديد ذهبي، اتصل خلال الدقيقة الأولى لزيادة فرص الإغلاق.',
            icon: 'phone',
            priority: 'high'
        };
    }

    // New Warm Leads - Quick Follow up
    if (lead.status === 'new') {
        return {
            action: 'تواصل سريع',
            description: 'عميل جديد ينتظر تواصلك، ابدأ بمكالمة أو رسالة.',
            icon: 'phone',
            priority: 'high'
        };
    }

    // Contacting leads - Move to appointment
    if (lead.status === 'contacting') {
        return {
            action: 'حجز موعد',
            description: 'العميل مهتم، اقترح موعداً للمقابلة الآن.',
            icon: 'calendar',
            priority: 'medium'
        };
    }

    // Appointment booked - Prep for interview
    if (lead.status === 'appointment_booked') {
        return {
            action: 'تجهيز المقابلة',
            description: 'تأكد من مراجعة تفاصيل العميل قبل الموعد.',
            icon: 'calendar',
            priority: 'low'
        };
    }

    // No show - Re-contact
    if (lead.status === 'no_show') {
        return {
            action: 'إعادة تواصل',
            description: 'العميل غاب عن الموعد، حاول الاتصال لمعرفة السبب.',
            icon: 'message',
            priority: 'medium'
        };
    }

    return null;
}
