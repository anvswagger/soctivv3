import { fixArabicMojibake } from './text';

const ARABIC_RE = /\p{Script=Arabic}/u;

function extractMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || null;

  // Supabase / PostgREST errors often look like { message, details, hint, code }.
  if (typeof err === 'object') {
    const anyErr = err as { message?: unknown; error?: unknown };
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.error === 'string') return anyErr.error;
    if (anyErr.error && typeof anyErr.error === 'object') {
      const nested = anyErr.error as { message?: unknown };
      if (typeof nested.message === 'string') return nested.message;
    }
  }

  return null;
}

function hasArabic(text: string) {
  return ARABIC_RE.test(text);
}

export function toArabicErrorMessage(err: unknown, fallback = 'حدث خطأ غير متوقع.'): string {
  const raw = extractMessage(err);
  if (!raw) return fallback;

  // First, try to fix mojibake coming from DB/API/headers.
  const msg = fixArabicMojibake(raw);

  // If message is already Arabic, don't "translate" it.
  if (hasArabic(msg)) return msg;

  // Schema cache mismatch (missing column)
  const schemaCacheMatch = msg.match(
    /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i
  );
  if (schemaCacheMatch) {
    const [, col, table] = schemaCacheMatch;
    return `قاعدة البيانات غير محدثة: العمود "${col}" غير موجود في جدول "${table}". نفّذ migrations ثم أعد المحاولة.`;
  }

  // Missing table / relation
  if (/relation .* does not exist/i.test(msg) || /\b42P01\b/.test(msg) || /\bPGRST205\b/.test(msg)) {
    return 'ميزة غير مفعّلة في قاعدة البيانات الحالية. نفّذ migrations ثم أعد المحاولة.';
  }

  // Network / fetch
  if (
    /Failed to fetch/i.test(msg) ||
    /NetworkError/i.test(msg) ||
    /fetch failed/i.test(msg) ||
    /\bECONN\b/i.test(msg)
  ) {
    return 'تعذر الاتصال بالشبكة. تحقق من الإنترنت ثم أعد المحاولة.';
  }

  // Auth common cases
  if (/Invalid login credentials/i.test(msg)) return 'بيانات تسجيل الدخول غير صحيحة.';
  if (/Email not confirmed/i.test(msg)) return 'يرجى تأكيد البريد الإلكتروني أولاً.';
  if (/already registered|User already registered/i.test(msg)) return 'هذا البريد مسجل مسبقاً.';

  // Permissions / RLS
  if (/row-level security|violates row-level security|RLS/i.test(msg)) {
    return 'لا تملك صلاحية للوصول إلى هذه البيانات.';
  }
  if (/permission denied|not authorized|unauthorized|forbidden/i.test(msg)) {
    return 'لا تملك صلاحية لتنفيذ هذا الإجراء.';
  }

  // Generic
  return fallback;
}

