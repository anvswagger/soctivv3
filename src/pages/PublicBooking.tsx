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
import {
  PUBLIC_BOOKING_CALENDAR_HEADER_LABELS,
  PUBLIC_BOOKING_EMBED_HEIGHT_MESSAGE_TYPE,
  PUBLIC_BOOKING_MIN_EMBED_HEIGHT,
  PUBLIC_BOOKING_TIMEZONES,
} from '@/features/publicBooking/constants';
import {
  findFirstAvailableDate,
  findNextAvailableDate,
  getSlotCacheKey,
  getTextColor,
  hexToRgba,
  isDateAvailableByRules,
} from '@/features/publicBooking/utils';

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
  const [nextDateSuggestion, setNextDateSuggestion] = useState<Date | null>(null);
  const [findingNextDate, setFindingNextDate] = useState(false);

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
  const calendarStepRef = useRef<HTMLElement | null>(null);
  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const slotPresenceCacheRef = useRef(new Map<string, boolean>());
  const noSlotsTrackedDatesRef = useRef(new Set<string>());
  const userPickedDateRef = useRef(false);
  const autoShiftedToNextDateRef = useRef(false);
  const pageViewTrackedRef = useRef(false);

  const trackPublicEvent = (
    eventType: string,
    metadata?: Record<string, unknown>,
    eventName?: string,
    bookingTypeId?: string
  ) => {
    if (!token) return;
    void publicBookingService.trackPublicEvent({
      shareToken: token,
      eventType,
      eventName,
      bookingTypeId: bookingTypeId || selectedBookingType?.id,
      metadata,
    });
  };

  const handleReturnToSlotSelection = () => {
    trackPublicEvent('public_booking_return_to_slots');
    setSelectedSlot(null);
    setBookingResult(null);

    if (window.innerWidth < 1024) {
      window.requestAnimationFrame(() => {
        calendarStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  useEffect(() => {
    if (!token) {
      setError('رابط الحجز غير صحيح');
      setLoading(false);
      return;
    }

    pageViewTrackedRef.current = false;
    slotPresenceCacheRef.current.clear();
    noSlotsTrackedDatesRef.current.clear();
    userPickedDateRef.current = false;
    autoShiftedToNextDateRef.current = false;

    let cancelled = false;
    const loadCalendar = async () => {
      try {
        setLoading(true);
        const data = await calendarService.getPublicCalendar(token);
        if (!data) {
          if (!cancelled) setError('هذا التقويم غير متاح حالياً. قد يكون غير منشور أو تم تعطيله.');
          void publicBookingService.trackPublicEvent({
            shareToken: token,
            eventType: 'public_booking_page_error',
            eventName: 'calendar_not_available',
            metadata: { reason: 'calendar_not_available', is_embed: isEmbed },
          });
          return;
        }
        if (isEmbed && !data.config.embed_enabled) {
          if (!cancelled) setError('تم تعطيل تضمين هذا التقويم من إعدادات الحساب');
          void publicBookingService.trackPublicEvent({
            shareToken: token,
            eventType: 'public_booking_page_error',
            eventName: 'embed_disabled',
            metadata: { reason: 'embed_disabled', is_embed: isEmbed },
          });
          return;
        }
        if (!cancelled) {
          setConfig(data.config);
          setAvailability(data.availability);
          setBookingTypes(data.bookingTypes);
          setUserTimezone(data.config.timezone || 'Africa/Tripoli');
          setSelectedBookingType(data.bookingTypes[0] || null);
          setError(null);

          if (!pageViewTrackedRef.current) {
            pageViewTrackedRef.current = true;
            void publicBookingService.trackPublicEvent({
              shareToken: token,
              eventType: 'public_booking_page_loaded',
              metadata: {
                is_embed: isEmbed,
                booking_types_count: data.bookingTypes.length,
                has_description: Boolean(data.config.description?.trim()),
              },
            });
          }
        }
      } catch (err) {
        console.error('Error loading calendar:', err);
        if (!cancelled) setError('تعذر تحميل صفحة الحجز');
        void publicBookingService.trackPublicEvent({
          shareToken: token,
          eventType: 'public_booking_page_error',
          eventName: 'load_failed',
          metadata: { reason: 'load_failed', is_embed: isEmbed },
        });
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
      setNextDateSuggestion(null);
      return;
    }

    let cancelled = false;
    const loadSlots = async () => {
      try {
        setSlotsLoading(true);
        const availableSlots = await publicBookingService.getAvailableSlots({
          shareToken: token,
          bookingTypeId: selectedBookingType.id,
          date: selectedDate,
          timezone: userTimezone,
        });
        if (!cancelled) {
          setSlots(availableSlots);
          const cacheKey = getSlotCacheKey(selectedBookingType.id, userTimezone, selectedDate);
          slotPresenceCacheRef.current.set(cacheKey, availableSlots.length > 0);
        }
      } catch (err) {
        console.warn('Public slots API failed, using local fallback:', err);
        try {
          const fallbackSlots = await calendarService.getAvailableSlots(
            config.id,
            startOfDay(selectedDate),
            startOfDay(addDays(selectedDate, 1)),
            selectedBookingType.duration_minutes
          );
          if (!cancelled) {
            setSlots(fallbackSlots);
            const cacheKey = getSlotCacheKey(selectedBookingType.id, userTimezone, selectedDate);
            slotPresenceCacheRef.current.set(cacheKey, fallbackSlots.length > 0);
          }
        } catch (fallbackError) {
          console.error('Error loading slots:', fallbackError);
          if (!cancelled) {
            setSlots([]);
            const cacheKey = getSlotCacheKey(selectedBookingType.id, userTimezone, selectedDate);
            slotPresenceCacheRef.current.set(cacheKey, false);
          }
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
    if (!config || !selectedDate || !selectedBookingType || !token || slotsLoading || slots.length > 0) {
      if (slots.length > 0) {
        setNextDateSuggestion(null);
      }
      return;
    }

    if (!isDateAvailableByRules(availability, selectedDate)) {
      setNextDateSuggestion(null);
      return;
    }

    const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
    if (!noSlotsTrackedDatesRef.current.has(selectedDateKey)) {
      noSlotsTrackedDatesRef.current.add(selectedDateKey);
      void publicBookingService.trackPublicEvent({
        shareToken: token,
        eventType: 'public_booking_empty_day',
        eventName: 'empty_day',
        bookingTypeId: selectedBookingType.id,
        metadata: {
          date_key: selectedDateKey,
          booking_type_id: selectedBookingType.id,
        },
      });
    }

    let cancelled = false;
    const searchNextDate = async () => {
      setFindingNextDate(true);
      setNextDateSuggestion(null);

      const maxDaysAhead = 45;
      for (let offset = 1; offset <= maxDaysAhead; offset += 1) {
        const candidate = addDays(selectedDate, offset);
        if (!isDateAvailableByRules(availability, candidate)) continue;

        const cacheKey = getSlotCacheKey(selectedBookingType.id, userTimezone, candidate);
        const cachedHasSlots = slotPresenceCacheRef.current.get(cacheKey);
        if (cachedHasSlots === false) continue;
        if (cachedHasSlots === true) {
          if (!cancelled) setNextDateSuggestion(candidate);
          return;
        }

        let candidateSlots: TimeSlot[] = [];
        try {
          candidateSlots = await publicBookingService.getAvailableSlots({
            shareToken: token,
            bookingTypeId: selectedBookingType.id,
            date: candidate,
            timezone: userTimezone,
          });
        } catch {
          try {
            candidateSlots = await calendarService.getAvailableSlots(
              config.id,
              startOfDay(candidate),
              startOfDay(addDays(candidate, 1)),
              selectedBookingType.duration_minutes
            );
          } catch {
            candidateSlots = [];
          }
        }

        const hasSlots = candidateSlots.length > 0;
        slotPresenceCacheRef.current.set(cacheKey, hasSlots);

        if (hasSlots) {
          if (!cancelled) setNextDateSuggestion(candidate);
          return;
        }
      }
    };

    void searchNextDate().finally(() => {
      if (!cancelled) setFindingNextDate(false);
    });

    return () => {
      cancelled = true;
    };
  }, [availability, config, selectedDate, selectedBookingType, slots.length, slotsLoading, token, userTimezone]);

  useEffect(() => {
    if (slotsLoading || slots.length > 0 || !selectedDate || !nextDateSuggestion || !token || !selectedBookingType) return;
    if (userPickedDateRef.current || autoShiftedToNextDateRef.current) return;

    autoShiftedToNextDateRef.current = true;
    setSelectedDate(nextDateSuggestion);
    setCurrentMonth(startOfMonth(nextDateSuggestion));
    void publicBookingService.trackPublicEvent({
      shareToken: token,
      eventType: 'public_booking_auto_shifted_to_next_date',
      bookingTypeId: selectedBookingType.id,
      metadata: {
        from_date: format(selectedDate, 'yyyy-MM-dd'),
        to_date: format(nextDateSuggestion, 'yyyy-MM-dd'),
      },
    });
  }, [nextDateSuggestion, selectedBookingType, selectedDate, slots.length, slotsLoading, token]);

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

  useEffect(() => {
    if (!isEmbed || !token || window.self === window.top) {
      return;
    }

    let rafId = 0;
    const sendEmbedHeight = () => {
      const rootHeight = rootContainerRef.current?.getBoundingClientRect().height ?? 0;
      const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const height = Math.max(Math.ceil(Math.max(rootHeight, docHeight)), PUBLIC_BOOKING_MIN_EMBED_HEIGHT);
      window.parent.postMessage(
        {
          type: PUBLIC_BOOKING_EMBED_HEIGHT_MESSAGE_TYPE,
          token,
          height,
        },
        '*'
      );
    };

    const queueEmbedHeightSync = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(sendEmbedHeight);
    };

    queueEmbedHeightSync();
    window.addEventListener('resize', queueEmbedHeightSync);

    if (typeof ResizeObserver === 'undefined') {
      const intervalId = window.setInterval(queueEmbedHeightSync, 700);
      return () => {
        window.removeEventListener('resize', queueEmbedHeightSync);
        window.cancelAnimationFrame(rafId);
        window.clearInterval(intervalId);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      queueEmbedHeightSync();
    });
    if (rootContainerRef.current) {
      resizeObserver.observe(rootContainerRef.current);
    }
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('resize', queueEmbedHeightSync);
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isEmbed, token]);

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
    () => PUBLIC_BOOKING_TIMEZONES.find((timezone) => timezone.value === userTimezone)?.label || userTimezone,
    [userTimezone]
  );

  const isDateAvailable = (date: Date) => isDateAvailableByRules(availability, date);
  const firstBookableMonth = useMemo(() => startOfMonth(new Date()), []);
  const canGoPreviousMonth = currentMonth.getTime() > firstBookableMonth.getTime();

  const normalizedPhone = phone.trim();
  const phoneDigitsCount = normalizedPhone.replace(/[^\d٠-٩۰-۹]/g, '').length;
  const isPhoneValid = !normalizedPhone || phoneDigitsCount >= 8;
  const normalizedEmail = email.trim();
  const isEmailValid = !normalizedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const canSubmitContact = Boolean(firstName.trim() && normalizedPhone && isPhoneValid) && isEmailValid;
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

    userPickedDateRef.current = true;
    setCurrentMonth(startOfMonth(fallbackDate));
    setSelectedDate(fallbackDate);
    setSelectedSlot(null);
    setBookingResult(null);
    setNextDateSuggestion(null);
    trackPublicEvent('public_booking_jump_to_current', { selected_date: format(fallbackDate, 'yyyy-MM-dd') }, 'jump_to_current');
  };

  const handleGoToSuggestedDate = () => {
    if (!nextDateSuggestion) return;
    userPickedDateRef.current = true;
    setSelectedDate(nextDateSuggestion);
    setCurrentMonth(startOfMonth(nextDateSuggestion));
    setSelectedSlot(null);
    setBookingResult(null);
    trackPublicEvent(
      'public_booking_jump_to_next_available',
      { next_date: format(nextDateSuggestion, 'yyyy-MM-dd') },
      'jump_to_next_available'
    );
  };

  const handleSubmit = async () => {
    if (!config || !selectedSlot || !selectedBookingType || !token) return;
    trackPublicEvent('public_booking_submit_attempt', {
      has_email: Boolean(normalizedEmail),
      has_notes: Boolean(notes.trim()),
      has_last_name: Boolean(lastName.trim()),
      is_contact_ready: canSubmitContact,
    });

    if (!firstName.trim() || !normalizedPhone) {
      setBookingResult({ success: false, error: 'يرجى إدخال الاسم الأول ورقم الهاتف قبل المتابعة' });
      trackPublicEvent('public_booking_submit_validation_error', { reason: 'missing_required_fields' }, 'validation_error');
      return;
    }
    if (!isPhoneValid) {
      setBookingResult({ success: false, error: 'يرجى إدخال رقم هاتف صحيح' });
      trackPublicEvent('public_booking_submit_validation_error', { reason: 'invalid_phone' }, 'validation_error');
      return;
    }
    if (normalizedEmail && !isEmailValid) {
      setBookingResult({ success: false, error: 'صيغة البريد الإلكتروني غير صحيحة' });
      trackPublicEvent('public_booking_submit_validation_error', { reason: 'invalid_email' }, 'validation_error');
      return;
    }

    try {
      setBooking(true);
      setBookingResult(null);
      const safeLastName = lastName.trim() || firstName.trim();
      const result = await publicBookingService.submitBooking({
        shareToken: token,
        bookingTypeId: selectedBookingType.id,
        scheduledAt: selectedSlot.start,
        firstName: firstName.trim(),
        lastName: safeLastName,
        phone: normalizedPhone,
        email: normalizedEmail || undefined,
        notes: notes.trim() || undefined,
      });
      setBookingResult(result);
      if (result.success) {
        trackPublicEvent('public_booking_submit_success', {
          scheduled_at: selectedSlot.start.toISOString(),
        });
      } else {
        trackPublicEvent('public_booking_submit_failed', {
          scheduled_at: selectedSlot.start.toISOString(),
          reason: result.error || 'unknown',
        });
      }
    } catch (err) {
      console.error('Submit booking failed:', err);
      setBookingResult({ success: false, error: 'حدث خطأ أثناء تأكيد الحجز' });
      trackPublicEvent('public_booking_submit_failed', { reason: 'submit_exception' }, 'submit_exception');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" className={`flex items-center justify-center bg-background px-4 ${isEmbed ? 'min-h-[320px]' : 'min-h-screen'}`}>
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: primaryColor }} />
          <p className="text-sm text-muted-foreground">جاري تحميل التقويم...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div dir="rtl" className={`flex items-center justify-center bg-background px-4 ${isEmbed ? 'min-h-[320px]' : 'min-h-screen'}`}>
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
      <div dir="rtl" className={`flex items-center justify-center bg-muted/20 px-4 py-8 ${isEmbed ? 'min-h-[320px]' : 'min-h-screen'}`}>
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
    <div
      ref={rootContainerRef}
      dir="rtl"
      className={isEmbed ? 'min-h-full' : 'min-h-screen'}
      style={!isEmbed ? { background: shellBackground } : { backgroundColor: secondaryColor }}
    >
      <div className={`mx-auto w-full max-w-7xl ${isEmbed ? 'px-2 py-2 sm:px-3 sm:py-3' : 'px-4 py-6 sm:py-8 md:py-10'}`}>
        <div
          className={`overflow-hidden border backdrop-blur-sm ${isEmbed ? 'rounded-xl sm:rounded-2xl' : 'rounded-2xl'}`}
          style={{
            borderColor,
            backgroundColor: secondaryColor,
            color: textColor,
            boxShadow: isEmbed ? `0 8px 26px ${hexToRgba(primaryColor, 0.16)}` : `0 18px 50px ${hexToRgba(primaryColor, 0.22)}`,
          }}
        >
          <div className="grid lg:grid-cols-[320px_1fr_300px]">
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

            <aside className={`${onContactStep ? 'hidden lg:block' : 'block'} border-b p-4 sm:p-6 lg:border-b-0 lg:border-l`} style={{ borderColor: softDivider }}>
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
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: softDivider, backgroundColor: panelSurface }}>
                    <p className="text-[11px] font-semibold" style={{ color: mutedTextColor }}>نوع الموعد</p>
                    <p className="mt-1 text-sm font-semibold">{selectedBookingType.name_ar}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Clock3 className="h-3.5 w-3.5" style={{ color: mutedTextColor }} />
                      <span>{selectedBookingType.duration_minutes} دقيقة</span>
                    </div>
                    {selectedBookingType.description && (
                      <p className="mt-1 text-xs" style={{ color: mutedTextColor }}>{selectedBookingType.description}</p>
                    )}
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
                          setNextDateSuggestion(null);
                          autoShiftedToNextDateRef.current = false;
                          trackPublicEvent('public_booking_type_selected', {
                            booking_type_id: type.id,
                            booking_type_name: type.name_ar,
                          }, undefined, type.id);
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
                        {type.description && <div className="mt-1 text-xs" style={{ color: mutedTextColor }}>{type.description}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <section ref={calendarStepRef} className={`${onContactStep ? 'hidden lg:block' : ''} border-b p-3 sm:p-6 lg:border-b-0 lg:border-l`} style={{ borderColor: softDivider }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold sm:text-xl">{format(currentMonth, 'MMMM yyyy', { locale: ar })}</h2>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs hover:opacity-90"
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
                    className="h-9 w-9 disabled:opacity-40"
                    style={{ color: mutedTextColor }}
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" style={{ color: mutedTextColor }} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide sm:gap-2" style={{ color: mutedTextColor }}>
                {PUBLIC_BOOKING_CALENDAR_HEADER_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
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
                        userPickedDateRef.current = true;
                        setSelectedDate(day);
                        setSelectedSlot(null);
                        setBookingResult(null);
                        setNextDateSuggestion(null);
                        trackPublicEvent('public_booking_date_selected', { date_key: format(day, 'yyyy-MM-dd') }, 'date_selected');
                      }}
                      className="min-h-12 rounded-lg border px-0.5 text-xs font-semibold disabled:cursor-not-allowed sm:h-14 sm:text-sm"
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
                      <div className="leading-none">{format(day, 'd')}</div>
                      {isCurrentDay && <div className="text-[10px]">{selected ? 'اليوم' : '•'}</div>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="p-3 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold">
                    {selectedSlot ? 'بيانات الحجز' : selectedDate ? format(selectedDate, 'EEEE d', { locale: ar }) : 'اختر يوماً'}
                  </p>
                  <p className="text-xs" style={{ color: mutedTextColor }}>
                    {selectedSlot
                      ? `${format(selectedSlot.start, 'EEEE d MMMM', { locale: ar })} - ${formatSlotTime(selectedSlot.start)}`
                      : selectedBookingType
                        ? `${selectedBookingType.name_ar} - ${selectedBookingType.duration_minutes} دقيقة`
                        : 'اختر نوع موعد'}
                  </p>
                  {!selectedSlot && selectedBookingType?.description && (
                    <p className="mt-1 text-xs" style={{ color: mutedTextColor }}>{selectedBookingType.description}</p>
                  )}
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
                    <div className="space-y-2 rounded-lg border p-3 text-sm" style={{ borderColor: softDivider, backgroundColor: panelSurface }}>
                      <p style={{ color: mutedTextColor }}>لا توجد أوقات متاحة في هذا اليوم.</p>
                      {findingNextDate && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: mutedTextColor }}>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري البحث عن أقرب موعد متاح...
                        </div>
                      )}
                      {!findingNextDate && nextDateSuggestion && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs hover:opacity-90"
                          style={{ borderColor: softDivider, backgroundColor: actionButtonSurface, color: textColor }}
                          onClick={handleGoToSuggestedDate}
                        >
                          عرض أقرب موعد متاح: {format(nextDateSuggestion, 'EEEE d MMMM', { locale: ar })}
                        </Button>
                      )}
                    </div>
                  )}

                  {selectedDate && isDateAvailable(selectedDate) && !slotsLoading && slots.length > 0 && (
                    <div className="space-y-2 sm:max-h-[360px] sm:overflow-y-auto sm:pr-1">
                      {slots.map((slot) => (
                        <button
                          key={slot.start.toISOString()}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            setBookingResult(null);
                            trackPublicEvent('public_booking_slot_selected', {
                              slot_start: slot.start.toISOString(),
                              selected_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
                            });
                          }}
                          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold"
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

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold" style={{ color: mutedTextColor }}>الخطوة 2 من 2: بيانات التواصل</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs hover:opacity-90 sm:self-auto"
                      style={{ borderColor: softDivider, backgroundColor: actionButtonSurface, color: textColor }}
                      onClick={handleReturnToSlotSelection}
                    >
                      تغيير التاريخ أو الوقت
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">الاسم الأول *</Label>
                      <Input id="firstName" ref={firstNameInputRef} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">اسم العائلة (اختياري)</Label>
                      <Input id="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف *</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-2.5 h-4 w-4" style={{ color: mutedTextColor }} />
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" dir="ltr" className="pr-10" style={{ borderColor: softDivider, backgroundColor: panelSurface, color: textColor }} />
                    </div>
                    {normalizedPhone && !isPhoneValid && (
                      <p className="text-xs text-red-300">يرجى إدخال رقم هاتف صحيح</p>
                    )}
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
                      onClick={handleReturnToSlotSelection}
                    >
                      رجوع لاختيار وقت آخر
                    </Button>
                    <Button type="button" style={{ backgroundColor: primaryColor, color: primaryTextColor }} onClick={handleSubmit} disabled={booking}>
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


