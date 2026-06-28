// scripts/find-bare-script.mjs — debug helper
import { readFileSync } from 'node:fs';
const text = readFileSync('C:/Users/imanv/AppData/Local/Temp/publish-landing-page.esm.js', 'utf8');
// Naive stripping: remove block comments, line comments, string literals
let stripped = text;
stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');
stripped = stripped.replace(/^\s*\/\/.*$/gm, '');
stripped = stripped.replace(/'(?:\\.|[^'\\])*'/g, "''");
stripped = stripped.replace(/"(?:\\.|[^"\\])*"/g, '""');
stripped = stripped.replace(/`(?:\\.|[^`\\])*`/g, '``');
const matches = [...stripped.matchAll(/\bscript\b/g)];
console.log('Bare "script" identifier occurrences:', matches.length);
matches.slice(0, 10).forEach((m) => {
  const before = stripped.slice(Math.max(0, m.index - 80), m.index);
  const after = stripped.slice(m.index, m.index + 80);
  console.log('  ctx:', JSON.stringify(before + '«' + after));
});