import { formatDateTime } from '@/lib/format';

type NotificationTypeMeta = {
  label: string;
  badgeClassName: string;
  dotClassName: string;
};

const DEFAULT_NOTIFICATION_TYPE_META: NotificationTypeMeta = {
  label: 'معلومة',
  badgeClassName: 'bg-sky-100 text-sky-700 border-sky-200',
  dotClassName: 'bg-sky-500',
};

const NOTIFICATION_TYPE_META: Record<string, NotificationTypeMeta> = {
  success: {
    label: 'نجاح',
    badgeClassName: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotClassName: 'bg-emerald-500',
  },
  error: {
    label: 'خطأ',
    badgeClassName: 'bg-rose-100 text-rose-700 border-rose-200',
    dotClassName: 'bg-rose-500',
  },
  warning: {
    label: 'تنبيه',
    badgeClassName: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClassName: 'bg-amber-500',
  },
  info: {
    label: 'معلومة',
    badgeClassName: 'bg-sky-100 text-sky-700 border-sky-200',
    dotClassName: 'bg-sky-500',
  },
  system: {
    label: 'نظام',
    badgeClassName: 'bg-violet-100 text-violet-700 border-violet-200',
    dotClassName: 'bg-violet-500',
  },
};

const VALUE_LABELS: Record<string, string> = {
  scheduled: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
  appointment_booked: 'موعد محجوز',
  contacting: 'تواصل',
  interviewed: 'تمت المقابلة',
  sold: 'تم البيع',
  new: 'جديد',
  pending: 'قيد المراجعة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
};

const ISO_DATE_TIME_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;
const KNOWN_VALUE_REGEX = /\b(?:scheduled|completed|cancelled|no_show|appointment_booked|contacting|interviewed|sold|new|pending|approved|rejected)\b/gi;

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const toLatinDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EXTENDED_ARABIC_INDIC_DIGITS.indexOf(digit)));

const normalizeToken = (token: string) => token.trim().toLowerCase().replace(/[\s-]+/g, '_');

const localizeToken = (token: string) => VALUE_LABELS[normalizeToken(token)] ?? token;

export const getNotificationTypeMeta = (type: string | null | undefined): NotificationTypeMeta => {
  if (!type) return DEFAULT_NOTIFICATION_TYPE_META;
  return NOTIFICATION_TYPE_META[type.toLowerCase()] ?? DEFAULT_NOTIFICATION_TYPE_META;
};

export const formatNotificationMessage = (message: string | null | undefined): string => {
  if (!message) return '';

  let normalized = message.replace(/[\u200E\u200F\u061C]/g, '').trim();
  normalized = toLatinDigits(normalized);

  normalized = normalized.replace(ISO_DATE_TIME_REGEX, (isoValue) => formatDateTime(isoValue));
  normalized = normalized.replace(/\bno[\s_-]?show\b/gi, VALUE_LABELS.no_show);
  normalized = normalized.replace(KNOWN_VALUE_REGEX, (token) => localizeToken(token));

  return normalized.replace(/\s{2,}/g, ' ');
};

