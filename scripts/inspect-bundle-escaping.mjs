// scripts/inspect-bundle-escaping.mjs
import { readFileSync } from 'node:fs';
const text = readFileSync('supabase/functions/publish-landing-page/bundled-assets.ts', 'utf8');
const matches = [...text.matchAll(/export const (\w+): string =/g)];
console.log('exports:', matches.map(m => m[1]));
const runtimeIdx = text.indexOf('export const runtime:');
if (runtimeIdx === -1) { console.log('runtime not found'); process.exit(0); }
const sample = text.slice(runtimeIdx, runtimeIdx + 600);
console.log('---start---');
console.log(sample);
console.log('---end---');
// Check escaping: a JSON-stringified string uses \\$ for backslash-dollar
// and never embeds raw ${ (template-literal interpolation) inside double-quoted strings.
const escCount = (text.match(/\\\$\{/g) || []).length;
console.log('escaped \\${ count:', escCount);
// Raw ${ would be a template-literal interpolation if it appeared in
// unquoted code, but inside JSON.stringify output it's already surrounded
// by double quotes so JS treats it as plain text. Still count raw ${ as a smell.
const rawCount = (text.match(/[^\\]\$\{/g) || []).length;
console.log('unescaped ${ count:', rawCount);
// Where do those unescaped ${ appear?
const indices = [...text.matchAll(/[^\\]\$\{/g)].map(m => m.index);
indices.slice(0, 5).forEach(i => {
    const before = text.slice(Math.max(0, i - 40), i);
    const after = text.slice(i, i + 60);
    console.log('  ctx:', JSON.stringify(before + '«' + after));
});