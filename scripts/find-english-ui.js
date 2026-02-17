import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TEXT_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'supabase']);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function looksInternalKey(str) {
  // Likely query keys, table names, etc.
  if (str.startsWith('/') || str.includes('://')) return true;
  if (str.includes('/') && !str.includes(' ')) return true; // import paths, routes
  if (str.startsWith('#')) return true; // hex colors
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) return true; // time formats like HH:mm
  if (/^[a-z0-9_\-.:]+$/.test(str)) return true;
  return false;
}

function isProbablyUiLine(line) {
  if (!/[A-Za-z]/.test(line)) return false;
  if (!/['"`<>]/.test(line)) return false;
  if (/^\s*import\b/.test(line)) return false;
  if (/\bdisplayName\s*=/.test(line)) return false;
  if (/console\.(log|warn|error)\(/.test(line)) return false;
  if (/queryKey:|\bfrom\(|\bselect\(|\beq\(|\bin\(/.test(line)) return false;
  return true;
}

const files = walk(path.join(ROOT, 'src')).filter((p) => TEXT_EXTS.has(path.extname(p).toLowerCase()));

const hits = [];

for (const filePath of files) {
  const rel = path.relative(ROOT, filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isProbablyUiLine(line)) continue;

    // Extract simple quoted strings on the line (single/double).
    const matches = [...line.matchAll(/(['"])([^'"]+)\1/g)].map((m) => m[2]);
    const candidates = matches
      .filter((s) => /[A-Za-z]/.test(s) && !looksInternalKey(s))
      .filter((s) => !/^[a-z0-9-_\[\]/():.%]+(\s+[a-z0-9-_\[\]/():.%]+)+$/i.test(s)) // tailwind-like class lists
      .filter((s) => !/\b(bg|text|border|rounded|flex|grid|gap|px|py|pt|pb|pl|pr|w|h|min|max|opacity|shadow|animate|items|justify)-/i.test(s));
    if (candidates.length === 0) continue;

    hits.push({
      file: rel,
      line: i + 1,
      strings: candidates.slice(0, 4),
    });
  }
}

hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

for (const h of hits) {
  console.log(`${h.file}:${h.line}  ${h.strings.join(' | ')}`);
}

console.log(`\nTotal candidates: ${hits.length}`);
