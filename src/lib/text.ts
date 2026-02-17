const ARABIC_RE = /\p{Script=Arabic}/u;
// Common mojibake markers when UTF-8 Arabic gets mis-decoded as Windows-1252/1256.
// Examples we want to catch: "Ø§Ù„..." or "ط§ظ„...".
// These marker characters should basically never appear in normal Arabic UI.
const MOJIBAKE_RE = /[ØÙÃÂ§©¬­]|(?:[طظ].){3,}/;

let win1256CharToByte: Map<string, number> | null = null;

function buildWindows1256CharToByteMap() {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder('windows-1256');
  } catch {
    return new Map<string, number>();
  }
  const map = new Map<string, number>();
  for (let i = 0; i <= 255; i += 1) {
    const ch = decoder.decode(Uint8Array.of(i));
    if (!ch || ch === '\uFFFD') continue;
    if (!map.has(ch)) map.set(ch, i);
  }
  return map;
}

function encodeWindows1256(str: string) {
  if (!win1256CharToByte) win1256CharToByte = buildWindows1256CharToByteMap();
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    const b = win1256CharToByte.get(ch);
    if (b === undefined) return null;
    bytes[i] = b;
  }
  return bytes;
}

export function fixArabicMojibake(value: string) {
  if (!value) return value;
  if (!MOJIBAKE_RE.test(value)) return value;

  const bytes = encodeWindows1256(value);
  if (!bytes) return value;

  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value;
  }

  if (!decoded || decoded === value) return value;
  if (!ARABIC_RE.test(decoded)) return value;
  if (decoded.includes('\uFFFD')) return value;

  return decoded;
}

export function fixArabicMojibakeObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => fixArabicMojibakeObject(item)) as T;
  }
  const next = { ...(obj as Record<string, unknown>) };
  for (const key of Object.keys(next)) {
    const val = next[key];
    if (typeof val === 'string') {
      next[key] = fixArabicMojibake(val);
    } else if (val && typeof val === 'object') {
      next[key] = fixArabicMojibakeObject(val);
    }
  }
  return next as T;
}
