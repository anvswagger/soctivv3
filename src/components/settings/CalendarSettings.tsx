import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
    Calendar,
    Clock,
    Palette,
    Link as LinkIcon,
    Copy,
    Check,
    Plus,
    Trash2,
    Loader2,
    Eye,
    Code,
    Globe,
    MapPin,
    Smartphone,
    ExternalLink,
    Share2,
    CalendarDays,
    Timer,
    Users
} from 'lucide-react';
import {
    CalendarConfig,
    CalendarConfigUpdate,
    AvailabilityRule,
    BookingType,
    calendarService
} from '@/services/calendarService';
import { useImageKit } from '@/hooks/useImageKit';
import {
    COLOR_TEMPLATES,
    type ColorTemplate,
    DAYS_OF_WEEK,
    SETTINGS_TABS,
    TIMEZONE_OPTIONS,
} from '@/features/calendarSettings/constants';

export function CalendarSettings({ targetClientId, targetClientName }: { targetClientId?: string; targetClientName?: string }) {
    const { toast } = useToast();
    const { upload: uploadLogo, isUploading: isUploadingLogo } = useImageKit();

    const [calendars, setCalendars] = useState<CalendarConfig[]>([]);
    const [selectedCalendarId, setSelectedCalendarId] = useState(() => calendarService.getActiveCalendarId() || '');
    useEffect(() => {
        // Reset local selection when targeting a different client
        if (targetClientId) {
            setSelectedCalendarId('');
        }
    }, [targetClientId]);

    const [config, setConfig] = useState<CalendarConfig | null>(null);
    const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
    const [bookingTypes, setBookingTypes] = useState<BookingType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creatingCalendar, setCreatingCalendar] = useState(false);
    const [deletingCalendar, setDeletingCalendar] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const [companyName, setCompanyName] = useState('');
    const [calendarTitle, setCalendarTitle] = useState('');
    const [description, setDescription] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#0f172a');
    const [secondaryColor, setSecondaryColor] = useState('#ffffff');
    const [showCompanyLogo, setShowCompanyLogo] = useState(true);
    const [logoUrl, setLogoUrl] = useState('');
    const [timezone, setTimezone] = useState('Africa/Tripoli');
    const [bufferMinutes, setBufferMinutes] = useState(15);
    const [allowCancellation, setAllowCancellation] = useState(true);
    const [requireConfirmation, setRequireConfirmation] = useState(false);
    const [showLocation, setShowLocation] = useState(true);
    const [customLocation, setCustomLocation] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [embedEnabled, setEmbedEnabled] = useState(true);

    const [newBookingTypeNameAr, setNewBookingTypeNameAr] = useState('');
    const [newBookingTypeNameEn, setNewBookingTypeNameEn] = useState('');
    const [newBookingTypeDuration, setNewBookingTypeDuration] = useState(30);
    const [newBookingTypeDesc, setNewBookingTypeDesc] = useState('');

    const populateForm = useCallback((cfg: CalendarConfig) => {
        setCompanyName(cfg.company_name || '');
        setCalendarTitle(cfg.calendar_title || '');
        setDescription(cfg.description || '');
        setPrimaryColor(cfg.primary_color || '#0f172a');
        setSecondaryColor(cfg.secondary_color || '#ffffff');
        setShowCompanyLogo(cfg.show_company_logo);
        setLogoUrl(cfg.logo_url || '');
        setTimezone(cfg.timezone || 'Africa/Tripoli');
        setBufferMinutes(cfg.buffer_minutes || 15);
        setAllowCancellation(cfg.allow_cancellation);
        setRequireConfirmation(cfg.require_confirmation);
        setShowLocation(cfg.show_location);
        setCustomLocation(cfg.custom_location || '');
        setIsPublic(cfg.is_public);
        setEmbedEnabled(cfg.embed_enabled);
    }, []);

    const updateConfigInCollection = useCallback((updatedConfig: CalendarConfig) => {
        setCalendars((prev) => prev.map((item) => (item.id === updatedConfig.id ? updatedConfig : item)));
    }, []);

    const loadData = useCallback(async (preferredCalendarId?: string) => {
        try {
            setLoading(true);

            let configList = await calendarService.listConfigs(targetClientId);
            if (configList.length === 0) {
                const created = await calendarService.createConfig(undefined, targetClientId);
                configList = created ? [created] : [];
            }

            if (configList.length === 0) {
                setCalendars([]);
                setConfig(null);
                setAvailability([]);
                setBookingTypes([]);
                calendarService.setActiveCalendarId(null);
                return;
            }

            setCalendars(configList);

            const selectedConfig =
                configList.find((item) => item.id === preferredCalendarId) ||
                configList.find((item) => item.id === selectedCalendarId) ||
                configList[0];

            await calendarService.ensureDefaults(selectedConfig.id);
            setConfig(selectedConfig);
            setSelectedCalendarId(selectedConfig.id);
            calendarService.setActiveCalendarId(selectedConfig.id);
            populateForm(selectedConfig);

            const [availabilityData, typesData] = await Promise.all([
                calendarService.getAvailabilityRules(selectedConfig.id),
                calendarService.getBookingTypes(selectedConfig.id),
            ]);

            setAvailability(availabilityData);
            setBookingTypes(typesData);
        } catch (error) {
            console.error('Error loading calendar data:', error);
            toast({ title: 'خطأ', description: 'فشل تحميل إعدادات التقويم', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [populateForm, selectedCalendarId, toast, targetClientId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleSaveConfig = async (
        overrides: Partial<CalendarConfigUpdate> = {},
        options?: { silent?: boolean }
    ) => {
        if (!config) return;
        try {
            setSaving(true);
            const updated = await calendarService.updateConfig(config.id, {
                company_name: companyName,
                calendar_title: calendarTitle,
                description,
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                show_company_logo: showCompanyLogo,
                logo_url: logoUrl,
                timezone,
                buffer_minutes: bufferMinutes,
                allow_cancellation: allowCancellation,
                require_confirmation: requireConfirmation,
                show_location: showLocation,
                custom_location: customLocation,
                is_public: isPublic,
                embed_enabled: embedEnabled,
                ...overrides,
            });

            if (updated) {
                setConfig(updated);
                updateConfigInCollection(updated);
                populateForm(updated);
            }

            if (!options?.silent) {
                toast({ title: 'تم الحفظ', description: 'تم حفظ إعدادات التقويم بنجاح' });
            }
        } catch (error) {
            if (!options?.silent) {
                toast({ title: 'خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSelectCalendar = async (calendarId: string) => {
        if (!calendarId || calendarId === selectedCalendarId) return;
        await loadData(calendarId);
    };

    const handleCreateCalendar = async () => {
        try {
            setCreatingCalendar(true);
            const created = await calendarService.createConfig({
                company_name: companyName || config?.company_name || 'مكتبي',
                calendar_title: `تقويم ${calendars.length + 1}`,
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                timezone,
            });

            if (!created) {
                throw new Error('Calendar creation failed');
            }

            toast({ title: 'تم الإنشاء', description: 'تم إنشاء تقويم جديد بنجاح' });
            await loadData(created.id);
        } catch (error) {
            console.error('Error creating calendar:', error);
            toast({ title: 'خطأ', description: 'فشل إنشاء تقويم جديد', variant: 'destructive' });
        } finally {
            setCreatingCalendar(false);
        }
    };

    const handleDeleteCurrentCalendar = async () => {
        if (!config) return;

        if (calendars.length <= 1) {
            toast({
                title: 'غير ممكن',
                description: 'يجب أن يكون لديك تقويم واحد على الأقل',
                variant: 'destructive',
            });
            return;
        }

        const confirmed = window.confirm('هل تريد حذف هذا التقويم؟ سيتم حذف الإعدادات وأنواع المواعيد الخاصة به.');
        if (!confirmed) return;

        try {
            setDeletingCalendar(true);
            await calendarService.deleteConfig(config.id);
            const fallbackId = calendars.find((item) => item.id !== config.id)?.id;
            toast({ title: 'تم الحذف', description: 'تم حذف التقويم بنجاح' });
            await loadData(fallbackId);
        } catch (error) {
            console.error('Error deleting calendar:', error);
            toast({ title: 'خطأ', description: 'فشل حذف التقويم', variant: 'destructive' });
        } finally {
            setDeletingCalendar(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !config) return;
        try {
            const result = await uploadLogo(file, '/calendar-logos');
            setLogoUrl(result.url);
            await handleSaveConfig({ logo_url: result.url }, { silent: true });
            toast({ title: 'تم الرفع', description: 'تم رفع الشعار بنجاح' });
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل رفع الشعار', variant: 'destructive' });
        }
    };

    const handleDayToggle = async (dayValue: number) => {
        if (!config) return;
        const existingRule = availability.find(r => r.day_of_week === dayValue);
        let newAvailability: AvailabilityRule[];
        if (existingRule) {
            newAvailability = availability.map(r =>
                r.day_of_week === dayValue ? { ...r, is_available: !r.is_available } : r
            );
        } else {
            newAvailability = [...availability, {
                id: crypto.randomUUID(),
                calendar_config_id: config.id,
                day_of_week: dayValue,
                start_time: '09:00',
                end_time: '17:00',
                is_available: true,
                specific_date: null,
                created_at: new Date().toISOString(),
            }];
        }
        setAvailability(newAvailability);
        try {
            const rulesToSave = newAvailability.map(r => ({
                day_of_week: r.day_of_week,
                start_time: r.start_time,
                end_time: r.end_time,
                is_available: r.is_available,
                specific_date: r.specific_date,
            }));
            await calendarService.updateAvailabilityRules(config.id, rulesToSave);
            toast({ title: 'تم التحديث', description: 'تم تحديث التوفر بنجاح' });
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل حفظ التوفر', variant: 'destructive' });
        }
    };

    const handleTimeChange = async (dayValue: number, field: 'start_time' | 'end_time', value: string) => {
        if (!config) return;
        const newAvailability = availability.map(r =>
            r.day_of_week === dayValue ? { ...r, [field]: value } : r
        );
        setAvailability(newAvailability);
        try {
            const rulesToSave = newAvailability.map(r => ({
                day_of_week: r.day_of_week,
                start_time: r.start_time,
                end_time: r.end_time,
                is_available: r.is_available,
                specific_date: r.specific_date,
            }));
            await calendarService.updateAvailabilityRules(config.id, rulesToSave);
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل حفظ ساعات العمل', variant: 'destructive' });
        }
    };

    const handleAddBookingType = async () => {
        if (!config) return;
        const nameAr = newBookingTypeNameAr.trim();
        if (!nameAr) return;

        const nameEn = newBookingTypeNameEn.trim() || nameAr;
        const durationMinutes = Number.isFinite(newBookingTypeDuration)
            ? Math.max(15, Math.min(240, newBookingTypeDuration))
            : 30;
        const descriptionValue = newBookingTypeDesc.trim();

        try {
            const newType = await calendarService.createBookingType(config.id, {
                name_ar: nameAr,
                name_en: nameEn,
                duration_minutes: durationMinutes,
                description: descriptionValue || null,
                is_active: true,
                display_order: bookingTypes.length,
            });
            setBookingTypes([...bookingTypes, newType]);
            setNewBookingTypeNameAr('');
            setNewBookingTypeNameEn('');
            setNewBookingTypeDuration(30);
            setNewBookingTypeDesc('');
            toast({ title: 'تمت الإضافة', description: 'تمت إضافة نوع الموعد' });
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل إضافة نوع الموعد', variant: 'destructive' });
        }
    };

    const handleDeleteBookingType = async (id: string) => {
        try {
            await calendarService.deleteBookingType(id);
            setBookingTypes(bookingTypes.filter(t => t.id !== id));
            toast({ title: 'تم الحذف', description: 'تم حذف نوع الموعد' });
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل حذف نوع الموعد', variant: 'destructive' });
        }
    };

    const setCopiedFeedback = useCallback((key: string) => {
        setCopiedKey(key);
        window.setTimeout(() => {
            setCopiedKey((current) => (current === key ? null : current));
        }, 1800);
    }, []);

    const copyToClipboard = useCallback(async (value: string, key: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedFeedback(key);
        } catch {
            toast({ title: 'خطأ', description: 'تعذر نسخ المحتوى', variant: 'destructive' });
        }
    }, [setCopiedFeedback, toast]);

    const handlePublicChange = async (nextIsPublic: boolean) => {
        if (!config) return;
        try {
            setIsPublic(nextIsPublic);
            await handleSaveConfig({ is_public: nextIsPublic }, { silent: true });
            toast({
                title: nextIsPublic ? 'تم تفعيل التقويم العام' : 'تم إيقاف التقويم العام',
                description: nextIsPublic ? 'يمكن الآن لأي عميل حجز موعد' : 'الحجز متاح من داخل النظام فقط'
            });
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل تحديث حالة التقويم', variant: 'destructive' });
        }
    };

    const handleTogglePublic = async () => {
        await handlePublicChange(!isPublic);
    };

    const isTemplateSelected = useCallback((template: ColorTemplate) => (
        primaryColor.trim().toLowerCase() === template.primary.toLowerCase()
        && secondaryColor.trim().toLowerCase() === template.secondary.toLowerCase()
    ), [primaryColor, secondaryColor]);

    const handleApplyColorTemplate = async (template: ColorTemplate) => {
        setPrimaryColor(template.primary);
        setSecondaryColor(template.secondary);
        await handleSaveConfig(
            { primary_color: template.primary, secondary_color: template.secondary },
            { silent: true }
        );
        toast({
            title: 'تم تطبيق القالب',
            description: `تم اختيار قالب "${template.name}" بنجاح`,
        });
    };

    const renderColorTemplates = () => (
        <div className="space-y-2">
            <Label>ثيمات جاهزة للتقويم (تطبيق فوري)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
                {COLOR_TEMPLATES.map((template) => {
                    const selected = isTemplateSelected(template);
                    return (
                        <button
                            key={template.id}
                            type="button"
                            onClick={() => void handleApplyColorTemplate(template)}
                            className={`rounded-lg border p-3 text-right transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold">{template.name}</p>
                                    <p className="text-xs text-muted-foreground">{template.subtitle}</p>
                                </div>
                                {selected && <Badge variant="secondary">مفعل</Badge>}
                            </div>
                            <div className="mt-2 flex gap-2">
                                <span className="h-7 flex-1 rounded-md border" style={{ backgroundColor: template.primary }} />
                                <span className="h-7 flex-1 rounded-md border" style={{ backgroundColor: template.secondary }} />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const copyShareLink = () => {
        if (!config) return;
        void copyToClipboard(calendarService.getShareUrl(config.share_token), `share-${config.id}`);
    };

    const copyEmbedCode = () => {
        if (!config) return;
        void copyToClipboard(calendarService.getEmbedCode(config.share_token), `embed-${config.id}`);
    };

    const copyCalendarShareLink = (calendar: CalendarConfig) => {
        void copyToClipboard(calendarService.getShareUrl(calendar.share_token), `calendar-${calendar.id}`);
    };

    const selectedShareUrl = config ? calendarService.getShareUrl(config.share_token) : '';
    const selectedBookingPath = config ? `/book/${config.share_token}` : '#';
    const selectedCalendarLabel = config?.calendar_title?.trim() || 'تقويم بدون اسم';
    const selectedTimezoneLabel = TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label || timezone;
    const setupScore = [
        Boolean(calendarTitle.trim()),
        bookingTypes.length > 0,
        availability.some((rule) => rule.is_available),
        isPublic,
    ].filter(Boolean).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <Loader2 className="h-10 w-10 animate-spin" style={{ color: primaryColor }} />
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <Card className="border border-border/80 bg-card shadow-sm">
                <CardContent className="space-y-5 p-4 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                            <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
                                <Calendar className="w-7 h-7" />
                                تقويم الحجز
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                إعدادات بسيطة وسريعة لتجهيز صفحة الحجز ومشاركتها.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="secondary">التقاويم: {calendars.length}</Badge>
                                <Badge variant={isPublic ? 'default' : 'outline'}>{isPublic ? 'منشور' : 'غير منشور'}</Badge>
                                <Badge variant="outline">{selectedCalendarLabel}</Badge>
                            </div>
                        </div>

                        <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
                            <select
                                value={selectedCalendarId}
                                onChange={(event) => void handleSelectCalendar(event.target.value)}
                                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm sm:col-span-2 lg:w-[240px]"
                            >
                                {calendars.map((item, index) => (
                                    <option key={item.id} value={item.id}>
                                        {item.calendar_title?.trim() || `تقويم ${index + 1}`}
                                    </option>
                                ))}
                            </select>

                            <Button
                                variant="outline"
                                onClick={() => void handleCreateCalendar()}
                                disabled={creatingCalendar}
                                className="w-full sm:w-auto"
                            >
                                {creatingCalendar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                تقويم جديد
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => void handleDeleteCurrentCalendar()}
                                disabled={deletingCalendar || calendars.length <= 1}
                                className="w-full text-red-600 sm:w-auto"
                            >
                                {deletingCalendar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="mr-2 sm:hidden">حذف التقويم</span>
                            </Button>

                            <Button onClick={() => void handleSaveConfig()} disabled={saving} className="w-full sm:w-auto">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                حفظ
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Switch checked={isPublic} onCheckedChange={(checked) => void handlePublicChange(checked)} />
                                    <div>
                                        <p className="text-sm font-semibold">حالة النشر</p>
                                        <p className="text-xs text-muted-foreground">
                                            {isPublic ? 'الزوار يمكنهم الحجز الآن.' : 'التقويم خاص ولن يظهر للزوار.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={copyShareLink} disabled={!config}>
                                        {copiedKey === `share-${config?.id}` ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="outline" size="sm" asChild disabled={!config}>
                                        <a href={selectedBookingPath} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">رابط صفحة الحجز للتقويم الحالي</Label>
                                <div className="rounded-lg border border-border bg-background p-3">
                                    <p className="font-mono text-sm break-all" dir="ltr">{selectedShareUrl}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/20 p-4">
                            <p className="text-sm font-semibold">جاهزية الإطلاق</p>
                            <div className="mt-3 flex items-end gap-2">
                                <span className="text-3xl font-bold">{setupScore}</span>
                                <span className="pb-1 text-sm text-muted-foreground">/ 4</span>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-muted">
                                <div className="h-2 rounded-full bg-primary" style={{ width: `${(setupScore / 4) * 100}%` }} />
                            </div>
                            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                                <p>المنطقة الزمنية: {selectedTimezoneLabel}</p>
                                <p>فاصل المواعيد: {bufferMinutes} دقيقة</p>
                                <p>أنواع المواعيد: {bookingTypes.length}</p>
                                <p>أيام العمل المفعلة: {availability.filter((rule) => rule.is_available).length}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {targetClientId && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="flex items-center gap-3 py-4">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                            <p className="text-sm font-bold text-primary">أنت تقوم بتعديل إعدادات التقويم لـ {targetClientName || 'عميل معين'}</p>
                            <p className="text-xs text-muted-foreground">التغييرات ستظهر مباشرة لزوار صفحة هذا العميل.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
                <div className="md:hidden">
                    <Label htmlFor="calendar-settings-tab" className="mb-2 block text-xs text-muted-foreground">
                        اختر القسم
                    </Label>
                    <select
                        id="calendar-settings-tab"
                        value={activeTab}
                        onChange={(event) => setActiveTab(event.target.value)}
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                        {SETTINGS_TABS.map((tab) => (
                            <option key={tab.value} value={tab.value}>
                                {tab.label}
                            </option>
                        ))}
                    </select>
                </div>

                <TabsList className="hidden h-auto w-full rounded-xl bg-muted/30 p-1 md:grid md:grid-cols-5">
                    <TabsTrigger value="overview" className="rounded-lg py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Calendar className="mr-2 h-4 w-4" /> الأساسيات
                    </TabsTrigger>
                    <TabsTrigger value="availability" className="rounded-lg py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Clock className="mr-2 h-4 w-4" /> التوفر
                    </TabsTrigger>
                    <TabsTrigger value="booking" className="rounded-lg py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <CalendarDays className="mr-2 h-4 w-4" /> المواعيد
                    </TabsTrigger>
                    <TabsTrigger value="branding" className="rounded-lg py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Palette className="mr-2 h-4 w-4" /> المظهر
                    </TabsTrigger>
                    <TabsTrigger value="share" className="rounded-lg py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Share2 className="mr-2 h-4 w-4" /> النشر
                    </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview">
                    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>معلومات صفحة الحجز</CardTitle>
                                <CardDescription>البيانات الأساسية التي يشاهدها العميل</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>اسم الشركة</Label>
                                    <Input
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        onBlur={() => void handleSaveConfig({ company_name: companyName }, { silent: true })}
                                        placeholder="اسم شركتك"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>عنوان صفحة الحجز</Label>
                                    <Input
                                        value={calendarTitle}
                                        onChange={(e) => setCalendarTitle(e.target.value)}
                                        onBlur={() => void handleSaveConfig({ calendar_title: calendarTitle }, { silent: true })}
                                        placeholder="احجز موعد"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>الوصف</Label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        onBlur={() => void handleSaveConfig({ description }, { silent: true })}
                                        rows={3}
                                        placeholder="وصف مختصر وواضح لخدمة الحجز"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>الإعدادات العامة</CardTitle>
                                <CardDescription>مكان واحد لإعدادات الحجز الأساسية</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>المنطقة الزمنية</Label>
                                        <select
                                            value={timezone}
                                            onChange={(e) => {
                                                const nextTimezone = e.target.value;
                                                setTimezone(nextTimezone);
                                                void handleSaveConfig({ timezone: nextTimezone }, { silent: true });
                                            }}
                                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        >
                                            {TIMEZONE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>فاصل بين المواعيد (دقيقة)</Label>
                                        <Input
                                            type="number"
                                            value={bufferMinutes}
                                            onChange={(e) => setBufferMinutes(Number(e.target.value))}
                                            onBlur={() => void handleSaveConfig({ buffer_minutes: bufferMinutes }, { silent: true })}
                                            min={0}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                <Label>إظهار موقع الموعد</Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground">عنوان المكتب أو رابط اجتماع يظهر للعميل</p>
                                        </div>
                                        <Switch
                                            checked={showLocation}
                                            onCheckedChange={(checked) => {
                                                setShowLocation(checked);
                                                void handleSaveConfig({ show_location: checked }, { silent: true });
                                            }}
                                        />
                                    </div>
                                    {showLocation && (
                                        <Input
                                            value={customLocation}
                                            onChange={(e) => setCustomLocation(e.target.value)}
                                            onBlur={() => void handleSaveConfig({ custom_location: customLocation }, { silent: true })}
                                            placeholder="عنوان المكتب أو رابط الاجتماع"
                                        />
                                    )}
                                </div>

                                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                                            <Label>السماح بإلغاء الموعد</Label>
                                        </div>
                                        <Switch
                                            checked={allowCancellation}
                                            onCheckedChange={(checked) => {
                                                setAllowCancellation(checked);
                                                void handleSaveConfig({ allow_cancellation: checked }, { silent: true });
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-muted-foreground" />
                                            <Label>يتطلب تأكيد يدوي للحجز</Label>
                                        </div>
                                        <Switch
                                            checked={requireConfirmation}
                                            onCheckedChange={(checked) => {
                                                setRequireConfirmation(checked);
                                                void handleSaveConfig({ require_confirmation: checked }, { silent: true });
                                            }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Availability Tab */}
                <TabsContent value="availability">
                    <div className="space-y-4">
                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarDays className="w-5 h-5" />
                                    أيام العمل
                                </CardTitle>
                                <CardDescription>اختر الأيام وساعات الحجز فقط</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6">
                                <div className="mb-6 grid grid-cols-4 gap-2 sm:mb-8 sm:grid-cols-7">
                                    {DAYS_OF_WEEK.map((day) => {
                                        const rule = availability.find(r => r.day_of_week === day.value);
                                        const isActive = rule?.is_available ?? false;
                                        return (
                                            <button
                                                key={day.value}
                                                type="button"
                                                onClick={() => void handleDayToggle(day.value)}
                                                className={`rounded-lg border px-2 py-3 text-center ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                                            >
                                                <div className="text-base font-bold">{day.short}</div>
                                                <div className="mt-1 hidden text-[11px] font-medium sm:block">{day.label}</div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                                        <Timer className="w-4 h-4" /> ساعات العمل
                                    </h4>
                                    <div className="space-y-3">
                                        {DAYS_OF_WEEK.map((day) => {
                                            const rule = availability.find(r => r.day_of_week === day.value);
                                            const isActive = rule?.is_available ?? false;
                                            const startTime = rule?.start_time || '09:00';
                                            const endTime = rule?.end_time || '17:00';
                                            return (
                                                <div
                                                    key={day.value}
                                                    className={`rounded-xl p-4 ${isActive ? 'border border-border bg-card' : 'border border-border/60 bg-muted/40 opacity-60'}`}
                                                >
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                                {day.short}
                                                            </div>
                                                            <span className={`font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{day.label}</span>
                                                            {isActive && <Badge variant="secondary">متاح</Badge>}
                                                        </div>
                                                        {isActive && (
                                                            <div className="flex w-full items-center gap-2 sm:w-auto">
                                                                <Input type="time" value={startTime} onChange={(e) => void handleTimeChange(day.value, 'start_time', e.target.value)} className="w-full sm:w-32" />
                                                                <span className="text-muted-foreground">-</span>
                                                                <Input type="time" value={endTime} onChange={(e) => void handleTimeChange(day.value, 'end_time', e.target.value)} className="w-full sm:w-32" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {isPublic && config && (
                            <Button asChild className="h-12 w-full">
                                <a href={`/book/${config.share_token}`} target="_blank" rel="noopener noreferrer">
                                    <Eye className="mr-2 h-5 w-5" /> معاينة صفحة الحجز <ExternalLink className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                </TabsContent>

                {/* Booking Types Tab */}
                <TabsContent value="booking">
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarDays className="w-5 h-5" />
                                    أنواع المواعيد
                                </CardTitle>
                                <CardDescription>الخيارات التي يراها العميل في أول خطوة</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6">
                                {bookingTypes.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>لا توجد أنواع مواعيد مضافة حالياً</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {bookingTypes.map((type) => (
                                            <div key={type.id} className="rounded-xl border border-border bg-card p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white font-bold" style={{ backgroundColor: primaryColor }}>
                                                            {type.duration_minutes}د
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-base sm:text-lg">{type.name_ar}</p>
                                                            <p className="text-sm text-muted-foreground">{type.name_en}</p>
                                                            {type.description && <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>}
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteBookingType(type.id)} className="h-9 w-9 self-start text-red-500 hover:bg-red-50 hover:text-red-700 sm:self-auto">
                                                        <Trash2 className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> إنشاء نوع جديد</CardTitle>
                                <CardDescription>صمّم نوع الموعد بالاسم والمدة والوصف</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2"><Label>الاسم بالعربية</Label><Input value={newBookingTypeNameAr} onChange={(e) => setNewBookingTypeNameAr(e.target.value)} placeholder="استشارة" /></div>
                                    <div className="space-y-2"><Label>الاسم بالإنجليزية (اختياري)</Label><Input value={newBookingTypeNameEn} onChange={(e) => setNewBookingTypeNameEn(e.target.value)} placeholder="Consultation" /></div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2"><Label>المدة (دقيقة)</Label><Input type="number" value={newBookingTypeDuration} onChange={(e) => setNewBookingTypeDuration(Number(e.target.value))} min={15} max={240} /></div>
                                    <div className="space-y-2"><Label>الوصف</Label><Input value={newBookingTypeDesc} onChange={(e) => setNewBookingTypeDesc(e.target.value)} placeholder="وصف مختصر للخدمة..." /></div>
                                </div>
                                <Button onClick={handleAddBookingType} disabled={!newBookingTypeNameAr.trim()} className="w-full" style={{ backgroundColor: primaryColor }}>
                                    <Plus className="mr-2 h-4 w-4" /> إضافة نوع الموعد
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Branding Tab */}
                <TabsContent value="branding">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>الشعار</CardTitle>
                                <CardDescription>أضف الشعار وحدد ظهوره داخل صفحة الحجز</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>شعار الشركة</Label>
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-20 w-20 object-contain border rounded-xl" /> : <div className="h-20 w-20 border-2 border-dashed rounded-xl flex items-center justify-center"><Palette className="h-8 w-8 text-muted-foreground" /></div>}
                                        <div className="w-full sm:w-auto">
                                            <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="w-full sm:max-w-xs" />
                                            {isUploadingLogo && <p className="mt-1 text-sm text-muted-foreground">جاري الرفع...</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                                    <div className="space-y-1">
                                        <Label>إظهار الشعار للزوار</Label>
                                        <p className="text-xs text-muted-foreground">فعّلها لعرض الشعار أعلى صفحة الحجز</p>
                                    </div>
                                    <Switch
                                        checked={showCompanyLogo}
                                        onCheckedChange={(checked) => {
                                            setShowCompanyLogo(checked);
                                            void handleSaveConfig({ show_company_logo: checked }, { silent: true });
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    تعديل اسم الشركة والعنوان والوصف يتم من قسم "الأساسيات" لتجربة أبسط.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>نظام الألوان</CardTitle>
                                <CardDescription>اختر ألواناً تعكس علامتك مع معاينة فورية</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5 sm:space-y-6">
                                {renderColorTemplates()}

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2"><Label>اللون الرئيسي</Label>
                                        <div className="flex items-center gap-3">
                                            <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} onBlur={() => void handleSaveConfig({ primary_color: primaryColor }, { silent: true })} className="h-11 w-14 rounded-lg p-1" />
                                            <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} onBlur={() => void handleSaveConfig({ primary_color: primaryColor }, { silent: true })} className="flex-1 font-mono" />
                                        </div>
                                    </div>
                                    <div className="space-y-2"><Label>لون الخلفية</Label>
                                        <div className="flex items-center gap-3">
                                            <Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} onBlur={() => void handleSaveConfig({ secondary_color: secondaryColor }, { silent: true })} className="h-11 w-14 rounded-lg p-1" />
                                            <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} onBlur={() => void handleSaveConfig({ secondary_color: secondaryColor }, { silent: true })} className="flex-1 font-mono" />
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={() => void handleSaveConfig()} disabled={saving} className="w-full" style={{ backgroundColor: primaryColor }}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} حفظ التعديلات
                                </Button>
                                <div className="space-y-2">
                                    <Label>معاينة مباشرة</Label>
                                    <div className="p-6 rounded-2xl border-2 transition-all" style={{ backgroundColor: secondaryColor, borderColor: primaryColor }}>
                                        {showCompanyLogo && logoUrl && <img src={logoUrl} alt="Logo" className="h-10 mb-3" />}
                                        <h3 className="text-xl font-bold" style={{ color: primaryColor }}>{calendarTitle || 'احجز موعد'}</h3>
                                        <p className="text-sm mt-1" style={{ color: primaryColor, opacity: 0.8 }}>{companyName || 'شركتك'}</p>
                                        {description && <p className="text-sm mt-2 text-muted-foreground">{description}</p>}
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>9:00 - 10:00</div>
                                            <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>10:00 - 11:00</div>
                                            <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>11:00 - 12:00</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Share Tab */}
                <TabsContent value="share">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5" /> رابط الحجز</CardTitle>
                                <CardDescription>الرابط المباشر للحجوزات على التقويم الحالي</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-medium">{isPublic ? 'التقويم منشور' : 'التقويم غير منشور'}</p>
                                        <p className="text-xs text-muted-foreground">فعّل النشر لكي يعمل الرابط للزوار</p>
                                    </div>
                                    <Switch checked={isPublic} onCheckedChange={(checked) => void handlePublicChange(checked)} />
                                </div>
                                <div className="rounded-xl bg-muted/30 p-4">
                                    <p className="font-mono text-sm break-all" dir="ltr">{selectedShareUrl}</p>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button onClick={copyShareLink} className="flex-1" style={{ backgroundColor: primaryColor }}>
                                        {copiedKey === `share-${config?.id}` ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                                        {copiedKey === `share-${config?.id}` ? 'تم النسخ' : 'نسخ الرابط'}
                                    </Button>
                                    <Button variant="outline" asChild className="w-full sm:w-auto">
                                        <a href={selectedBookingPath} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4 sm:mr-0" />
                                            <span className="sm:hidden">فتح الصفحة</span>
                                        </a>
                                    </Button>
                                </div>
                                {!isPublic && (
                                    <Button onClick={handleTogglePublic} variant="outline" className="w-full">
                                        <Globe className="mr-2 h-4 w-4" /> تفعيل النشر الآن
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5" /> كود التضمين</CardTitle>
                                <CardDescription>استخدم هذا الكود لإظهار التقويم داخل موقعك</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea value={config ? calendarService.getEmbedCode(config.share_token) : ''} readOnly className="font-mono text-sm h-32" dir="ltr" />
                                <Button onClick={copyEmbedCode} variant="outline" className="w-full">
                                    {copiedKey === `embed-${config?.id}` ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                                    {copiedKey === `embed-${config?.id}` ? 'تم النسخ' : 'نسخ الكود'}
                                </Button>
                                <div className="flex items-center gap-2 border-t pt-4">
                                    <Switch
                                        checked={embedEnabled}
                                        onCheckedChange={(checked) => {
                                            setEmbedEnabled(checked);
                                            void handleSaveConfig({ embed_enabled: checked }, { silent: true });
                                        }}
                                    />
                                    <Label>السماح بتضمين التقويم في مواقع أخرى</Label>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-border shadow-sm lg:col-span-2">
                            <CardHeader>
                                <CardTitle>دليل روابط كل التقاويم</CardTitle>
                                <CardDescription>كل تقويم لديه صفحة مستقلة يمكنك نسخها أو فتحها مباشرة</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {calendars.map((item, index) => {
                                    const itemUrl = calendarService.getShareUrl(item.share_token);
                                    const isCopied = copiedKey === `calendar-${item.id}`;
                                    return (
                                        <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{item.calendar_title?.trim() || `تقويم ${index + 1}`}</p>
                                                    <Badge variant={item.is_public ? 'default' : 'outline'}>
                                                        {item.is_public ? 'منشور' : 'غير منشور'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 font-mono text-xs text-muted-foreground break-all" dir="ltr">{itemUrl}</p>
                                            </div>
                                            <div className="flex w-full gap-2 sm:w-auto">
                                                <Button variant="outline" size="sm" onClick={() => copyCalendarShareLink(item)} className="flex-1 sm:flex-none">
                                                    {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => void handleSelectCalendar(item.id)} className="flex-1 sm:flex-none">
                                                    تعديل
                                                </Button>
                                                <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none">
                                                    <a href={`/book/${item.share_token}`} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}



