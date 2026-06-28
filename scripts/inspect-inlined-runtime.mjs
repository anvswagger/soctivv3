#!/usr/bin/env node
/**
 * inspect-inlined-runtime.mjs — directly inspect what happens when we
 * inline the runtime into a <script> block. Diagnose why </body></html>
 * appears in the middle of the JS.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLISH_DIR = join(ROOT, 'supabase/functions/publish-landing-page');
const OUT = join(ROOT, 'dist/soctiv-preview');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const runtimeJs = readFileSync(join(PUBLISH_DIR, 'client_runtime.js'), 'utf8');

// Check raw bytes around line 188 for any embedded </body> or </html>
const line188 = runtimeJs.split('\n')[187];
console.log('Line 188 of runtime.js (raw bytes):');
console.log(line188);
console.log('Length:', line188.length);
console.log('Contains </body>?', line188.includes('</body>'));
console.log('Contains </html>?', line188.includes('</html>'));
console.log('Contains $?', line188.includes('$'));

// Check the safe runtime
const safeRuntime = runtimeJs.replace(/<\/script>/gi, '<\\/script>');
console.log('\nSafe runtime:');
console.log('  has literal </script> (unescaped)?', /<\/script>/i.test(safeRuntime));
console.log('  has escaped <\\/script>?', safeRuntime.includes('<\\/script>'));
console.log('  has literal </body>?', safeRuntime.includes('</body>'));
console.log('  has literal </html>?', safeRuntime.includes('</html>'));

// What if we wrap it in <script> and write to a file?
const wrapped = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"></head>
<body>
<script>
${safeRuntime}
</script>
</body>
</html>`;
writeFileSync(join(OUT, 'inline-runtime-test.html'), wrapped, 'utf8');
console.log('\nWritten wrapped HTML:', join(OUT, 'inline-runtime-test.html'), `(${wrapped.length} bytes)`);

// Find any </script> in the wrapped HTML
const scriptCloseMatches = wrapped.match(/<\/script>/gi);
console.log('  </script> in wrapped output:', scriptCloseMatches?.length || 0);

// Find </body> and </html> in the wrapped output
const bodyMatches = wrapped.match(/<\/body>/gi);
const htmlMatches = wrapped.match(/<\/html>/gi);
console.log('  </body> in wrapped output:', bodyMatches?.length || 0);
console.log('  </html> in wrapped output:', htmlMatches?.length || 0);
console.log('  Position of first </body>:', wrapped.indexOf('</body>'));
console.log('  Position of first </html>:', wrapped.indexOf('</html>'));
