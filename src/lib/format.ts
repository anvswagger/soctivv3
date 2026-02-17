const AR_LOCALE = 'ar-SA';
const APP_TIMEZONE = 'Africa/Tripoli'; // UTC+2

const toDate = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat(AR_LOCALE, options).format(value);
};

export const formatDate = (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
  const date = toDate(value);
  if (!date) return '';
  // dateStyle is mutually exclusive with year/month/day - don't use it if custom options provided
  const hasDateOptions = options && ('year' in options || 'month' in options || 'day' in options || 'dateStyle' in options);
  const formatOptions = hasDateOptions
    ? { timeZone: APP_TIMEZONE, ...options } as Intl.DateTimeFormatOptions
    : { dateStyle: 'medium' as const, timeZone: APP_TIMEZONE, ...options };
  return new Intl.DateTimeFormat(AR_LOCALE, formatOptions).format(date);
};

export const formatTime = (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
  const date = toDate(value);
  if (!date) return '';
  // timeStyle is mutually exclusive with hour/minute/hour12 - don't use it if custom options provided
  const hasTimeOptions = options && ('hour' in options || 'minute' in options || 'hour12' in options);
  const formatOptions = hasTimeOptions
    ? { timeZone: APP_TIMEZONE, ...options } as Intl.DateTimeFormatOptions
    : { timeStyle: 'short' as const, timeZone: APP_TIMEZONE, ...options };
  return new Intl.DateTimeFormat(AR_LOCALE, formatOptions).format(date);
};

export const formatDateTime = (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(AR_LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: APP_TIMEZONE, ...options }).format(date);
};

export const formatWeekday = (
  value: Date | string | number,
  style: 'long' | 'short' | 'narrow' = 'long'
) => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(AR_LOCALE, { weekday: style, timeZone: APP_TIMEZONE }).format(date);
};

export const formatDateYmd = (value: Date | string | number) => {
  const date = toDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat(AR_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: APP_TIMEZONE,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}/${get('month')}/${get('day')}`;
};

export const formatTime24 = (value: Date | string | number) => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(AR_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: APP_TIMEZONE }).format(date);
};
