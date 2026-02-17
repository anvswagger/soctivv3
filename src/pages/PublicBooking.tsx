import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  type AvailabilityRule,
  type BookingType,
  type CalendarConfig,
  type TimeSlot,
  calendarService,
} from '@/services/calendarService';
import { publicBookingService, type PublicBookingResult } from '@/services/publicBookingService';

const TIMEZONES = [
  { value: 'Africa/Tripoli', label: 'طرابلس (UTC+2)' },
  { value: 'Africa/Cairo', label: 'القاهرة (UTC+2)' },
  { value: 'Africa/Riyadh', label: 'الرياض (UTC+3)' },
  { value: 'Asia/Dubai', label: 'دبي (UTC+4)' },
  { value: 'Europe/London', label: 'لندن (UTC+0)' },
  { value: 'America/New_York', label: 'نيويورك (UTC-5)' },
];

const CALENDAR_HEADER_LABELS = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];

function isDateAvailableByRules(rules: AvailabilityRule[], date: Date): boolean {
  const dateKey = format(date, 'yyyy-MM-dd');
  const specificRules = rules.filter((rule) => rule.specific_date === dateKey);
  if (specificRules.length > 0) {
    return specificRules.some((rule) => rule.is_available);
  }
  return rules.some((rule) => !rule.specific_date && rule.day_of_week === date.getDay() && rule.is_available);
}

function findFirstAvailableDate(rules: AvailabilityRule[], maxDaysAhead = 90): Date | undefined {
  const today = startOfDay(new Date());
  for (let offset = 0; offset <= maxDaysAhead; offset += 1) {
    const candidate = addDays(today, offset);
    if (isDateAvailableByRules(rules, candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function findNextAvailableDate(rules: AvailabilityRule[], fromDate: Date, maxDaysAhead = 90): Date | undefined {
  const start = startOfDay(addDays(fromDate, 1));
  for (let offset = 0; offset <= maxDaysAhead; offset += 1) {
    const candidate = addDays(start, offset);
    if (isDateAvailableByRules(rules, candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function hexToRgba(hex: string, alpha: number): string {
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

function getTextColor(backgroundHex: string): string {
  const h = backgroundHex?.replace('#', '');
  if (!h || (h.length !== 3 && h.length !== 6)) return '#f8fafc';
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#0f172a' : '#f8fafc';
}

export default function PublicBooking() {
  const { token } = useParams<{ token: string }>();
  const isEmbed = useMemo(() => new URLSearchParams(window.location.search).get('embed') === 'true', []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([]);

  const [selectedBookingType, setSelectedBookingType] = useState<BookingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<PublicBookingResult | null>(null);

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [userTimezone, setUserTimezone] = useState('Africa/Tripoli');
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);
  const contactStepRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) {
      setError('رابط الحجز غير صحيح');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadCalendar = async () => {
      try {
        setLoading(true);
        const data = await calendarService.getPublicCalendar(token);
        if (!data) {
          if (!cancelled) setError('هذا التقويم غير متاح حالياً');
          return;
        }
        if (isEmbed && !data.config.embed_enabled) {
          if (!cancelled) setError('تم تعطيل تضمين هذا التقويم من إعدادات الحساب');
          return;
        }
        if (!cancelled) {
          setConfig(data.config);
          setAvailability(data.availability);
          setBookingTypes(data.bookingTypes);
          setUserTimezone(data.config.timezone || 'Africa/Tripoli');
          setSelectedBookingType(data.bookingTypes[0] || null);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading calendar:', err);
        if (!cancelled) setError('تعذر تحميل صفحة الحجز');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadCalendar();
    return () => {
      cancelled = true;
    };
  }, [token, isEmbed]);

  useEffect(() => {
    if (!config || !selectedDate || !selectedBookingType || !token) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    const loadSlots = async () => {
      const start = startOfDay(selectedDate);
      const end = startOfDay(addDays(selectedDate, 1));

      try {
        setSlotsLoading(true);
        const availableSlots = await publicBookingService.getAvailableSlots({
          shareToken: token,
          bookingTypeId: selectedBookingType.id,
          date: selectedDate,
          timezone: userTimezone,
        });
        if (!cancelled) setSlots(availableSlots);
      } catch (err) {
        console.warn('Public slots API failed, using local fallback:', err);
        try {
          const fallbackSlots = await calendarService.getAvailableSlots(
            config.id,
            start,
            end,
            selectedBookingType.duration_minutes
          );
          if (!cancelled) setSlots(fallbackSlots);
        } catch (fallbackError) {
          console.error('Error loading slots:', fallbackError);
          if (!cancelled) setSlots([]);
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    };

    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, [config, selectedDate, selectedBookingType, token, userTimezone]);

  useEffect(() => {
    if (selectedDate || availability.length === 0) return;

    const initialDate = findFirstAvailableDate(availability);
    if (!initialDate) return;

    setSelectedDate(initialDate);
    setCurrentMonth(startOfMonth(initialDate));
  }, [availability, selectedDate]);

  useEffect(() => {
    if (!selectedSlot) return;

    const animationFrame = window.requestAnimationFrame(() => {
      firstNameInputRef.current?.focus();
      if (window.innerWidth < 1024) {
        contactStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [selectedSlot]);

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }),
      }),
    [currentMonth]
  );

  const primaryColor = config?.primary_color || '#0f172a';
  const secondaryColor = config?.secondary_color || '#101114';
  const textColor = useMemo(() => getTextColor(secondaryColor), [secondaryColor]);
  const primaryTextColor = useMemo(() => getTextColor(primaryColor), [primaryColor]);
  const mutedTextColor = useMemo(() => hexToRgba(textColor, 0.72), [textColor]);
  const borderColor = useMemo(() => hexToRgba(textColor, 0.14), [textColor]);
  const accentSoft = useMemo(() => hexToRgba(primaryColor, 0.15), [primaryColor]);
  const shellBackground = useMemo(
    () => `radial-gradient(circle at top right, ${hexToRgba(primaryColor, 0.14)} 0%, ${hexToRgba(secondaryColor, 0.96)} 52%, ${hexToRgba(secondaryColor, 0.88)} 100%)`,
    [primaryColor, secondaryColor]
  );
  const panelSurface = useMemo(() => hexToRgba(textColor, 0.04), [textColor]);
  const availableDaySurface = useMemo(() => hexToRgba(textColor, 0.08), [textColor]);
  const disabledDaySurface = useMemo(() => hexToRgba(textColor, 0.03), [textColor]);
  const softDivider = useMemo(() => hexToRgba(textColor, 0.1), [textColor]);
  const primaryDot = useMemo(() => hexToRgba(primaryColor, 0.95), [primaryColor]);
  const actionButtonSurface = useMemo(() => hexToRgba(textColor, 0.08), [textColor]);

  const timezoneLabel = useMemo(
    () => TIMEZONES.find((timezone) => timezone.value === userTimezone)?.label || userTimezone,
    [userTimezone]
  );

  const isDateAvailable = (date: Date) => isDateAvailableByRules(availability, date);
  const firstBookableMonth = useMemo(() => startOfMonth(new Date()), []);
  const canGoPreviousMonth = currentMonth.getTime() > firstBookableMonth.getTime();
  const nextAvailableDate = useMemo(() => {
    if (availability.length === 0) return undefined;
    if (!selectedDate) return findFirstAvailableDate(availability, 120);
    return findNextAvailableDate(availability, selectedDate, 120);
  }, [availability, selectedDate]);

  const groupedSlots = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: TimeSlot[] }> = [
      { key: 'morning', label: 'صباحاً', items: [] },
      { key: 'afternoon', label: 'بعد الظهر', items: [] },
      { key: 'evening', label: 'مساءً', items: [] },
    ];

    for (const slot of slots) {
      const hour = slot.start.getHours();
      if (hour < 12) {
        groups[0].items.push(slot);
      } else if (hour < 17) {
        groups[1].items.push(slot);
      } else {
        groups[2].items.push(slot);
      }
    }

    return groups.filter((group) => group.items.length > 0);
  }, [slots]);

  const normalizedEmail = email.trim();
  const isEmailValid = !normalizedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const canSubmitContact = Boolean(firstName.trim() && lastName.trim() && phone.trim()) && isEmailValid;
  const onContactStep = Boolean(selectedSlot);
  const formatSlotTime = (date: Date) => {
    return format(date, 'h:mma').replace('AM', ' ص').replace('PM', ' م');
  };

  const handleJumpToCurrentDate = () => {
    const today = startOfDay(new Date());
    const fallbackDate = isDateAvailable(today)
      ? today
      : findNextAvailableDate(availability, addDays(today, -1), 120);

    if (!fallbackDate) {
      setCurrentMonth(startOfMonth(today));
      return;
    }

    setCurrentMonth(startOfMonth(fallbackDate));
    setSelectedDate(fallbackDate);
    setSelectedSlot(null);
    setBookingResult(null);
  };

  const handleSubmit = async () => {
    if (!config || !selectedSlot || !selectedBookingType || !token) return;
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setBookingResult({ success: false, error: 'يرجى تعبئة الحقول المطلوبة قبل المتابعة' });
      return;
    }
    if (normalizedEmail && !isEmailValid) {
      setBookingResult({ success: false, error: 'صيغة البريد الإلكتروني غير صحيحة' });
      return;
    }

    try {
      setBooking(true);
      setBookingResult(null);
      const result = await publicBookingService.submitBooking({
        shareToken: token,
        bookingTypeId: selectedBookingType.id,
        scheduledAt: selectedSlot.start,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: normalizedEmail || undefined,
        notes: notes.trim() || undefined,
      });
      setBookingResult(result);
    } catch (err) {
      console.error('Submit booking failed:', err);
      setBookingResult({ success: false, error: 'حدث خطأ أثناء تأكيد الحجز' });
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: primaryColor }} />
          <p className="text-sm text-muted-foreground">جاري تحميل التقويم...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border shadow-sm">
          <CardContent className="space-y-3 p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="text-xl font-bold">تعذر فتح صفحة الحجز</h1>
            <p className="text-sm text-muted-foreground">{error || 'حدث خطأ غير متوقع'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (bookingResult?.success) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-8">
        <Card className="w-full max-w-xl border shadow-sm">
          <CardContent className="space-y-5 p-6 md:p-8">
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: primaryColor }} />
              <h1 className="mt-3 text-2xl font-bold">تم تأكيد الحجز بنجاح</h1>
              <p className="mt-2 text-sm text-muted-foreground">شكراً لك {firstName || 'عميلنا'}.</p>
            </div>
            <div className="space-y-2 rounded-lg border p-4 text-sm" style={{ borderColor, backgroundColor: panelSurface }}>
              <p className="font-semibold">تفاصيل الموعد</p>
              {selectedBookingType && <p>نوع الموعد: {selectedBookingType.name_ar}</p>}
              {selectedSlot && (
                <>
                  <p>التاريخ: {format(selectedSlot.start, 'EEEE d MMMM yyyy', { locale: ar })}</p>
                  <p>الوقت: {formatSlotTime(selectedSlot.start)}</p>
                </>
              )}
              <p>المنطقة الزمنية: {timezoneLabel}</p>
              {config.show_location && config.custom_location && <p>الموقع: {config.custom_location}</p>}
            </div>
            <Button type="button" className="w-full" style={{ backgroundColor: primaryColor }} onClick={() => window.location.reload()}>
              حجز موعد جديد
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className={`${isEmbed ? 'min-h-full' : 'min-h-screen'}`} style={!isEmbed ? { background: shellBackground } : undefined}>
      <div className={`mx-auto w-full max-w-7xl px-4 ${isEmbed ? 'py-4' : 'py-8 md:py-10'}`}>
        <div
          className="overflow-hidden rounded-2xl border backdrop-blur-sm"
          style={{ borderColor, backgroundColor: secondaryColor, color: textColor, boxShadow: `0 18px 50px ${hexToRgba(primaryColor, 0.22)}` }}
        >
          <div className={`grid ${onContactStep ? 'lg:grid-cols-[320px_1fr]' : 'lg:grid-cols-[320px_1fr_300px]'}`}>
            <div className="border-b p-3 lg:hidden" style={{ borderColor: softDivider }}>
              <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold">
                <div
                  className="rounded-full px-3 py-2"
                  style={
                    !onContactStep
                      ? { border: `1px solid ${primaryColor}`, backgroundColor: accentSoft, color: textColor }
                      : { border: `1px solid ${softDivider}`, backgroundColor: panelSurface, color: mutedTextColor }
                  }
                >
                  1. التاريخ والوقت
                </div>
                <div
                  className="rounded-full px-3 py-2"
                  style={
                    onContactStep
                      ? { border: `1px solid ${primaryColor}`, backgroundColor: accentSoft, color: textColor }
                      : { border: `1px solid ${softDivider}`, backgroundColor: panelSurface, color: mutedTextColor }
                  }
                >
                  2. بياناتك
                </div>
              </div>
            </div>

            <aside className="border-b p-6 lg:border-b-0 lg:border-l" style={{ borderColor: softDivider }}>
              <div className="mb-6 flex items-center gap-3">
                {config.show_company_logo && config.logo_url ? (
                  <img src={config.logo_url} alt="Company logo" className="h-11 w-11 rounded-full border object-cover" style={{ borderColor: softDivider }} />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: softDivider, backgroundColor: accentSoft, color: primaryColor }}>
                    {config.company_name?.trim()?.[0] || 'س'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{config.company_name || 'فريق الحجز'}</p>
                  <h1 className="truncate text-lg font-bold">{config.calendar_title || 'حجز موعد'}</h1>
                </div>
              </div>

              {config.description && (
                <p className="mb-5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: softDivider, backgroundColor: panelSurface, color: mutedTextColor }}>
                  {config.description}
                </p>
              )}

              <div className="space-y-3 text-sm">
                {selectedBookingType && (
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" style={{ color: mutedTextColor }} />
                    <span>{selectedBookingType.duration_minutes} دقيقة</span>
                  </div>
                )}
                {config.show_location && config.custom_location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" style={{ color: mutedTextColor }} />
                    <span>{config.custom_location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" style={{ color: mutedTextColor }} />
                  <span>{timezoneLabel}</span>
                </div>
              </div>

              {bookingTypes.length > 1 && (
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold" style={{ color: mutedTextColor }}>أنواع المواعيد</p>
                  {bookingTypes.map((type) => {
                    const selected = selectedBookingType?.id === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setSelectedBookingType(type);
                          setSelectedSlot(null);
                          setBookingResult(null);
                        }}
                        className="w-full rounded-lg border px-3 py-2 text-right text-sm"
                        style={
                          selected
                            ? { borderColor: primaryColor, backgroundColor: accentSoft, color: textColor }
                            : { borderColor: softDivider, backgroundColor: panelSurface, color: textColor }
                        }
                      >
                        <div className="font-semibold">{type.name_ar}</div>
                        <div className="text-xs" style={{ color: mutedTextColor }}>{type.duration_minutes} دقيقة</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className={`${onContactStep ? 'hidden' : ''} border-b p-4 sm:p-6 lg:border-b-0 lg:border-l`} style={{ borderColor: softDivider }}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy', { locale: ar })}</h2>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs hover:opacity-90"
                    style={{ borderColor: softDivider, backgroundColor: actionButtonSurface, color: textColor }}
                    onClick={handleJumpToCurrentDate}
                  >
                    اليوم
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!canGoPreviousMonth}
                    className="h-8 w-8 disabled:opacity-40"
                    style={{ color: mutedTextColor }}
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" style={{ color: mutedTextColor }} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: mutedTextColor }}>
                {CALENDAR_HEADER_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const inCurrentMonth = isSameMonth(day, currentMonth);
                  const available = inCurrentMonth && isDateAvailable(day) && day.getTime() >= startOfDay(new Date()).getTime();
                  const selected = !!selectedDate && isSameDay(day, selectedDate);
                  const isCurrentDay = isToday(day);

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        setSelectedDate(day);
                        setSelectedSlot(null);
                        setBookingResult(null);
                      }}
                      className="h-14 rounded-lg border text-sm font-semibold disabled:cursor-not-allowed"
                      style={
                        selected
                          ? { borderColor: primaryColor, backgroundColor: primaryColor, color: primaryTextColor }
                          : available
                            ? { borderColor: softDivider, backgroundColor: availableDaySurface, color: textColor }
                            : inCurrentMonth
                              ? { borderColor: softDivider, backgroundColor: disabledDaySurface, color: mutedTextColor }
                              : { borderColor: hexToRgba(textColor, 0.06), backgroundColor: 'transparent', color: hexToRgba(textColor, 0.3) }
                      }
                    >
                      <div>{format(day, 'd')}</div>
                      {isCurrentDay && <div className="text-[10px]">{selected ? 'اليوم' : '•'}</div>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold">
                    {selectedSlot ? 'بيانات الحجز' : selectedDate ? format(selectedDate, 'EEEE d', { locale: ar }) : 'اختر يوماً'}
                  </p>
                  <p className="text-xs" style={{ color: mutedTextColor }}>
                    {selectedSlot
                      ? `${format(selectedSlot.start, 'EEEE d MMMM', { locale: ar })} - ${formatSlotTime(selectedSlot.start)}`
                      : selectedBookingType
                        ? `${selectedBookingType.duration_minutes} دقيقة`
                        : 'اختر نوع موعد'}
                  </p>
                </div>
              </div>

              {!selectedSlot && (
                <>
                  {!selectedDate && <p className="text-sm" style={{ color: mutedTextColor }}>اختر يوماً من التقويم لعرض الأوقات المتاحة.</p>}
                  {selectedDate && !isDateAvailable(selectedDate) && <p className="text-sm" style={{ color: mutedTextColor }}>هذا اليوم غير متاح للحجز.</p>}
                  {selectedDate && isDateAvailable(selectedDate) && slotsLoading && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: mutedTextColor }}>
                      <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل الأوقات...
                    </div>
                  )}
                  {selectedDate && isDateAvailable(selectedDate) && !slotsLoading && slots.length === 0 && (
                    <p className="text-sm" style={{ color: mutedTextColor }}>لا توجد أوقات متاحة في هذا اليوم.</p>
                  )}

                  {selectedDate && isDateAvailable(selectedDate) && !slotsLoading && slots.length > 0 && (
                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {slots.map((slot) => (
                        <button
                          key={slot.start.toISOString()}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            setBookingResult(null);
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold"
                          style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primaryDot }} />
                          <span>{formatSlotTime(slot.start)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {selectedSlot && (
                <div ref={contactStepRef} className="space-y-4">
                  <div className="rounded-lg border p-3" style={{ borderColor: softDivider, backgroundColor: panelSurface }}>
                    <p className="text-xs font-semibold" style={{ color: mutedTextColor }}>الموعد المختار</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                      <CalendarDays className="h-4 w-4" style={{ color: primaryColor }} />
                      <span>{format(selectedSlot.start, 'EEEE d MMMM yyyy', { locale: ar })}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <Clock3 className="h-4 w-4" style={{ color: primaryColor }} />
                      <span>{formatSlotTime(selectedSlot.start)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: mutedTextColor }}>الخطوة 2 من 2: بيانات التواصل</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs hover:opacity-90"
                      style={{ borderColor: softDivider, backgroundColor: actionButtonSurface, color: textColor }}
                      onClick={() => {
                        setSelectedSlot(null);
                        setBookingResult(null);
                      }}
                    >
                      تغيير الوقت
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">الاسم الأول *</Label>
                      <Input id="firstName" ref={firstNameInputRef} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">اسم العائلة *</Label>
                      <Input id="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف *</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-2.5 h-4 w-4" style={{ color: mutedTextColor }} />
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" dir="ltr" className="pr-10" style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-2.5 h-4 w-4" style={{ color: mutedTextColor }} />
                      <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="pr-10" style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                    </div>
                    {normalizedEmail && !isEmailValid && (
                      <p className="text-xs text-red-300">صيغة البريد الإلكتروني غير صحيحة</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">ملاحظات</Label>
                    <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                  </div>

                  {bookingResult && !bookingResult.success && (
                    <div className="rounded-md border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {bookingResult.error || 'تعذر إتمام الحجز الآن.'}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="hover:opacity-90"
                      style={{ borderColor: softDivider, backgroundColor: actionButtonSurface, color: textColor }}
                      onClick={() => { setSelectedSlot(null); setBookingResult(null); }}
                    >
                      رجوع لاختيار وقت آخر
                    </Button>
                    <Button type="button" style={{ backgroundColor: primaryColor, color: primaryTextColor }} onClick={handleSubmit} disabled={!canSubmitContact || booking}>
                      {booking ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري التأكيد...
                        </>
                      ) : (
                        <>
                          تأكيد الحجز <CheckCircle2 className="mr-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


