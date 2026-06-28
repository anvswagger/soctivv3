// scripts/analyze-bundle.mjs — debug helper to find runtime errors
import { readFileSync } from 'node:fs';
const text = readFileSync('C:/Users/imanv/AppData/Local/Temp/publish-landing-page.esm.js', 'utf8');

// Look for top-level (not inside strings/comments) references to a bare identifier
// that might not exist in Deno. Deno's globals include most browser/Web APIs, but
// not Node.js-specific things like `global`, `process` (with exceptions), `require`,
// `module`, `__dirname`, `__filename`, `exports` (in ESM context), etc.

const SUSPECTS = [
    'script', 'process', 'global', 'globalThis', 'self', 'window',
    'require', 'module', 'exports', '__dirname', '__filename',
    'Buffer', 'console', 'crypto',
];

// Strip block + line comments and string literals (single, double, backtick).
let s = text;
s = s.replace(/\/\*[\s\S]*?\*\//g, '');
s = s.replace(/(^|[^:])\/\/.*$/gm, '$1');
s = s.replace(/'(?:\\.|[^'\\])*'/g, "''");
s = s.replace(/"(?:\\.|[^"\\])*"/g, '""');
s = s.replace(/`(?:\\.|[^`\\])*`/g, '``');

for (const suspect of SUSPECTS) {
    const re = new RegExp(`(?<![\\w$.])\\b${suspect}\\b(?![\\w$])`, 'g');
    const matches = [...s.matchAll(re)];
    if (matches.length > 0) {
        console.log(`\n${suspect}: ${matches.length} occurrences`);
        matches.slice(0, 3).forEach((m) => {
            const lineNo = s.slice(0, m.index).split('\n').length;
            const line = s.split('\n')[lineNo - 1].slice(0, 200);
            console.log(`  L${lineNo}: ${line.trim()}`);
        });
    }
}