export const DAYS_OF_WEEK = [
    { value: 0, label: 'الأحد', short: 'أح' },
    { value: 1, label: 'الإثنين', short: 'إث' },
    { value: 2, label: 'الثلاثاء', short: 'ثل' },
    { value: 3, label: 'الأربعاء', short: 'أر' },
    { value: 4, label: 'الخميس', short: 'خم' },
    { value: 5, label: 'الجمعة', short: 'جم' },
    { value: 6, label: 'السبت', short: 'سب' },
] as const;

export const TIMEZONE_OPTIONS = [
    { value: 'Africa/Tripoli', label: 'طرابلس (UTC+2)' },
    { value: 'Africa/Cairo', label: 'القاهرة (UTC+2)' },
    { value: 'Africa/Riyadh', label: 'الرياض (UTC+3)' },
    { value: 'Asia/Dubai', label: 'دبي (UTC+4)' },
    { value: 'Europe/London', label: 'لندن (UTC+0)' },
] as const;

export type ColorTemplate = {
    id: string;
    name: string;
    subtitle: string;
    primary: string;
    secondary: string;
};

export const COLOR_TEMPLATES: ColorTemplate[] = [
    { id: 'clean', name: 'أبيض نظيف', subtitle: 'بسيط وواضح', primary: '#0f172a', secondary: '#ffffff' },
    { id: 'midnight', name: 'ليل فاخر', subtitle: 'تباين قوي', primary: '#38bdf8', secondary: '#0b1220' },
    { id: 'ocean', name: 'محيط حديث', subtitle: 'تقني وواضح', primary: '#0f766e', secondary: '#ecfeff' },
    { id: 'royal', name: 'أزرق ملكي', subtitle: 'ثقة ووضوح', primary: '#1d4ed8', secondary: '#eff6ff' },
    { id: 'forest', name: 'أخضر أعمال', subtitle: 'ثبات وهدوء', primary: '#166534', secondary: '#f7fee7' },
    { id: 'sunset', name: 'غروب دافئ', subtitle: 'ودود وجذاب', primary: '#c2410c', secondary: '#fff7ed' },
    { id: 'rose', name: 'وردي أنيق', subtitle: 'راقي ومميز', primary: '#be123c', secondary: '#fff1f2' },
    { id: 'violet', name: 'بنفسجي فاخر', subtitle: 'إبداع وهوية', primary: '#6d28d9', secondary: '#f5f3ff' },
    { id: 'charcoal', name: 'فحمي ليلي', subtitle: 'داكن ومركز', primary: '#22c55e', secondary: '#111827' },
    { id: 'amber', name: 'كهرماني فاخر', subtitle: 'دافئ ومريح', primary: '#92400e', secondary: '#fffbeb' },
];

export const SETTINGS_TABS = [
    { value: 'overview', label: 'الأساسيات' },
    { value: 'availability', label: 'التوفر' },
    { value: 'booking', label: 'المواعيد' },
    { value: 'branding', label: 'المظهر' },
    { value: 'share', label: 'النشر' },
] as const;

