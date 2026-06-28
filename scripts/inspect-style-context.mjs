// Inspect what comes around each <style> tag in the rendered HTML
import { readFileSync } from 'node:fs';

const html = readFileSync('dist/soctiv-preview/iframe-test.html', 'utf8');

const styleMatches = [...html.matchAll(/<style[^>]*>/g)];
console.log('style tag openings:', styleMatches.length);
styleMatches.forEach((m, i) => {
    const start = Math.max(0, m.index - 100);
    const end = Math.min(html.length, m.index + 200);
    console.log(`  [${i}] at ${m.index}`);
    console.log(`    PRE:  ${JSON.stringify(html.substring(start, m.index))}`);
    console.log(`    TAG:  ${JSON.stringify(m[0])}`);
});

const styleCloses = [...html.matchAll(/<\/style>/g)];
console.log('\nstyle tag closings:', styleCloses.length);
styleCloses.forEach((m, i) => {
    const start = Math.max(0, m.index - 100);
    const end = Math.min(html.length, m.index + 100);
    console.log(`  [${i}] at ${m.index}`);
    console.log(`    PRE:   ${JSON.stringify(html.substring(start, m.index))}`);
    console.log(`    CLOSE: ${JSON.stringify(m[0])}`);
    console.log(`    POST:  ${JSON.stringify(html.substring(m.index + 8, end))}`);
});
