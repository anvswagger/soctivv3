// Render via Puppeteer-style: use built-in Node tools to verify the HTML structure
// (Node doesn't have a built-in DOM, but we can at least confirm the source is correct)

import { readFileSync } from 'node:fs';

const html = readFileSync('dist/soctiv-preview/iframe-test.html', 'utf8');

// Find all <style> tags and report where they sit
const styleRe = /<style\b[^>]*>([^]*?)<\/style>/gi;
const styles = [...html.matchAll(styleRe)];

console.log(`Total <style> tags: ${styles.length}`);
for (let i = 0; i < styles.length; i++) {
    const m = styles[i];
    const tag = m[0];
    const headEnd = html.indexOf('</head>');
    const bodyStart = html.indexOf('<body');
    const loc = m.index < headEnd ? 'HEAD' : (m.index < bodyStart ? 'BETWEEN' : 'BODY');
    // Check if it has the malformed `:root--bg` (missing space + braces)
    const hasBadPalette = /:root--/.test(tag);
    console.log(`  style[${i}] length=${tag.length} at pos=${m.index} (${loc}) badPalette=${hasBadPalette}`);
}

// Check the palette style block specifically
const paletteMatch = html.match(/<style>:root[^<]*<\/style>/);
if (paletteMatch) {
    console.log('\nPalette style block:');
    console.log('  ', paletteMatch[0]);
}
