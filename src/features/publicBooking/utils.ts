import { addDays, format, startOfDay } from 'date-fns';
import type { AvailabilityRule } from '@/services/calendarService';

export function isDateAvailableByRules(rules: AvailabilityRule[], date: Date): boolean {
    const dateKey = format(date, 'yyyy-MM-dd');
    const specificRules = rules.filter((rule) => rule.specific_date === dateKey);
    if (specificRules.length > 0) {
        return specificRules.some((rule) => rule.is_available);
    }
    return rules.some((rule) => !rule.specific_date && rule.day_of_week === date.getDay() && rule.is_available);
}

export function findFirstAvailableDate(rules: AvailabilityRule[], maxDaysAhead = 90): Date | undefined {
    const today = startOfDay(new Date());
    for (let offset = 0; offset <= maxDaysAhead; offset += 1) {
        const candidate = addDays(today, offset);
        if (isDateAvailableByRules(rules, candidate)) {
            return candidate;
        }
    }
    return undefined;
}

export function findNextAvailableDate(rules: AvailabilityRule[], fromDate: Date, maxDaysAhead = 90): Date | undefined {
    const start = startOfDay(addDays(fromDate, 1));
    for (let offset = 0; offset <= maxDaysAhead; offset += 1) {
        const candidate = addDays(start, offset);
        if (isDateAvailableByRules(rules, candidate)) {
            return candidate;
        }
    }
    return undefined;
}

export function getSlotCacheKey(bookingTypeId: string, timezone: string, date: Date): string {
    return `${bookingTypeId}:${timezone}:${format(date, 'yyyy-MM-dd')}`;
}

export function hexToRgba(hex: string, alpha: number): string {
    const v = hex?.trim();
    if (!v || !v.startsWith('#')) return `rgba(15, 23, 42, ${alpha})`;
    let h = v.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6) return `rgba(15, 23, 42, ${alpha})`;
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return `rgba(15, 23, 42, ${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getTextColor(backgroundHex: string): string {
    const h = backgroundHex?.replace('#', '');
    if (!h || (h.length !== 3 && h.length !== 6)) return '#f8fafc';
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.62 ? '#0f172a' : '#f8fafc';
}

