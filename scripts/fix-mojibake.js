import fs from 'node:fs';
import path from 'node:path';

/**
 * Fixes common Arabic mojibake caused by UTF-8 bytes being decoded as Windows-1256.
 *
 * Typical symptom in source code: strings like "ط§ظ„..." instead of "ال...".
 *
 * This script scans `src/` text files and converts suspicious non-ASCII runs by:
 * 1) Encoding the run to Windows-1256 bytes (using a reverse map built from TextDecoder).
 * 2) Decoding those bytes as UTF-8.
 * 3) Replacing only if the result looks like real Arabic and the input contains marker chars.
 */

const ROOT = process.cwd();

const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.md']);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const win1256Decoder = new TextDecoder('windows-1256');
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function buildWindows1256CharToByteMap() {
  const map = new Map();
  for (let i = 0; i <= 255; i++) {
    const ch = win1256Decoder.decode(Uint8Array.of(i));
    // Skip "undefined" bytes that map to replacement.
    if (!ch || ch === '\uFFFD') continue;
    // In practice this is 1 code unit for Windows-125x.
    if (!map.has(ch)) map.set(ch, i);
  }
  return map;
}

const win1256CharToByte = buildWindows1256CharToByteMap();

function encodeWindows1256(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const b = win1256CharToByte.get(ch);
    if (b === undefined) return null;
    bytes[i] = b;
  }
  return bytes;
}

const ARABIC_RE = /\p{Script=Arabic}/u;
const MARKER_RE = /[\u00A0-\u00FF\u2018-\u201F\u2026]/u;

function markerCount(str) {
  return (str.match(/[\u00A0-\u00FF\u2018-\u201F\u2026]/gu) || []).length;
}

function tryFixRun(run) {
  // Only attempt on runs that look like mojibake (Arabic + Latin-1/punct markers).
  if (!MARKER_RE.test(run)) return null;

  const bytes = encodeWindows1256(run);
  if (!bytes) return null;

  let decoded;
  try {
    decoded = utf8Decoder.decode(bytes);
  } catch {
    return null;
  }

  // Must decode to Arabic text.
  if (!decoded || !ARABIC_RE.test(decoded)) return null;

  // Heuristic: the decoded string should contain fewer marker chars.
  if (markerCount(decoded) >= markerCount(run)) return null;

  return decoded;
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTS.has(ext)) return false;
  if (!filePath.includes(`${path.sep}src${path.sep}`)) return false;

  const original = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const fixed = original.replace(/[^\x00-\x7F]+/g, (run) => {
    const next = tryFixRun(run);
    if (!next) return run;
    changed = true;
    return next;
  });

  if (!changed) return false;
  fs.writeFileSync(filePath, fixed, 'utf8');
  return true;
}

const files = walk(ROOT).filter((p) => p.includes(`${path.sep}src${path.sep}`));
let touched = 0;
for (const f of files) {
  if (processFile(f)) touched += 1;
}

console.log(`Mojibake fix complete. Updated files: ${touched}`);
